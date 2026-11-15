"""Daily NASA IMERG satellite rain for the current dry season, averaged into each app grid cell (F14).

Writes web/public/data/imerg/current.json. Needs EARTHDATA_TOKEN (an Earthdata Login user token) in the
environment; run by the deploy workflow, never by hand with a pasted token. Standard library only.

Past days do not change, and each NASA request takes 10–50 s, so the season is not fetched afresh: the file the
live site already serves (or, failing that, the copy kept in pipeline/data) supplies the days it holds, and only
missing days plus the last few known ones are fetched. `--plan` prints that plan without fetching or a token.
"""
import concurrent.futures
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRID = ROOT / "web/public/data/grid.json"
OUT = ROOT / "web/public/data/imerg/current.json"
BASELINE = ROOT / "pipeline/data/imerg_baseline.json"  # fallback copy; even an old one saves most requests
REFETCH_DAYS = 3  # the newest days of the Late run can still be revised, so they are fetched again
# IMERG Late daily, version 7 (0.1°): about a day behind real time. The on-premises GES DISC server is due to move
# to Earthdata Cloud; if this URL stops working, the deploy keeps the old file out and the app hides the line.
SERVER = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDL.07"
PRODUCT = "NASA GPM IMERG Late Run daily, V07 (GPM_3IMERGDL), 0.1°"
FILL = -9000.0


def pixel_index(lon, lat):
    """OPeNDAP indices of the 0.1° pixel whose centre is (lon, lat); centres run from -179.95 and -89.95."""
    return round((lon + 179.95) / 0.1), round((lat + 89.95) / 0.1)


def parse_ascii(text):
    """{(lon, lat): mm} from an OPeNDAP ASCII response of precipitation[time][lon][lat]; fill values dropped."""
    lats = None
    rain = {}
    for line in text.splitlines():
        head, _, rest = line.partition(", ")
        if head == "precipitation.lat":
            lats = [float(v) for v in rest.split(", ")]
        m = re.search(r"precipitation\.lon=(-?[\d.]+)\]$", head)
        if m and lats:
            lon = float(m.group(1))
            for lat, v in zip(lats, rest.split(", ")):
                value = float(v)
                if value > FILL:
                    rain[(lon, lat)] = value
    return rain


def cell_means(rain, cells, half_lat, half_lon):
    """Mean rain of the pixels whose centres fall inside each cell; None when no pixel does."""
    out = {}
    for c in cells:
        vals = [v for (lon, lat), v in rain.items()
                if abs(lat - c["lat"]) <= half_lat and abs(lon - c["lon"]) <= half_lon]
        out[c["id"]] = sum(vals) / len(vals) if vals else None
    return out


def get(url, token):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode("utf-8")
        except Exception:
            if attempt == 4:
                raise
            time.sleep(5 * 2 ** attempt)  # GES DISC answers 503 when pushed; back off 5, 10, 20, 40 s
    return ""


def previous_by_day(prev, start, cell_ids):
    """{date: {cell id: mm or None}} from an earlier output file; {} unless it is this product, season and grid.
    A day with no value in any cell is left out, so it gets fetched again."""
    try:
        if prev.get("product") != PRODUCT or prev.get("start") != start.isoformat():
            return {}
        cells = prev["cells"]
        if not cell_ids or not all(isinstance(cells.get(i), list) for i in cell_ids):
            return {}
    except (AttributeError, KeyError, TypeError):
        return {}
    known = {}
    for n in range(max(len(cells[i]) for i in cell_ids)):
        values = {i: cells[i][n] if n < len(cells[i]) else None for i in cell_ids}
        if any(v is not None for v in values.values()):
            known[start + dt.timedelta(n)] = values
    return known


def plan_fetch(have, known, refetch=REFETCH_DAYS):
    """Days to request: every listed day not known yet, plus the last `refetch` known days."""
    if not known:
        return list(have)
    recent = set(sorted(known)[-refetch:])
    return [d for d in have if d not in known or d in recent]


def live_url():
    """The file the live site serves; follows the repo name (GITHUB_REPOSITORY in Actions)."""
    owner, name = os.environ.get("GITHUB_REPOSITORY", "salapa0/CERES").split("/", 1)
    return f"https://{owner.lower()}.github.io/{name}/data/imerg/current.json"


def load_known(start, cell_ids):
    """The most complete earlier data: the live site's file or the copy kept in the repo; {} if neither fits."""
    best, source = {}, None
    for where in (live_url(), BASELINE):
        try:
            if isinstance(where, Path):
                prev = json.loads(where.read_text(encoding="utf-8"))
            else:
                with urllib.request.urlopen(where, timeout=30) as r:
                    prev = json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"no earlier data from {where}: {e}", flush=True)
            continue
        known = previous_by_day(prev, start, cell_ids)
        if len(known) > len(best):
            best, source = known, where
    if source:
        print(f"reusing {len(best)} days from {source}", flush=True)
    return best


def month_files(year, month):
    """{date: file name} listed for one month (the listing is public; the version letter changes over time)."""
    with urllib.request.urlopen(f"{SERVER}/{year}/{month:02d}/", timeout=60) as r:
        html = r.read().decode("utf-8")
    files = {}
    for m in re.finditer(r"(3B-DAY-L\.MS\.MRG\.3IMERG\.(\d{8})-S000000-E235959\.V07[A-Z]\.nc4)(?=[\"<])", html):
        files[dt.datetime.strptime(m.group(2), "%Y%m%d").date()] = m.group(1)  # later letters overwrite earlier
    return files


def main():
    plan_only = "--plan" in sys.argv[1:]
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token and not plan_only:
        sys.exit("EARTHDATA_TOKEN is not set")
    grid = json.loads(GRID.read_text(encoding="utf-8"))
    cells = grid["cells"]
    half_lat, half_lon = grid["cellSize"]["lat"] / 2, grid["cellSize"]["lon"] / 2
    i0, j0 = pixel_index(min(c["lon"] for c in cells) - half_lon, min(c["lat"] for c in cells) - half_lat)
    i1, j1 = pixel_index(max(c["lon"] for c in cells) + half_lon, max(c["lat"] for c in cells) + half_lat)

    today = dt.date.today()
    start = dt.date(today.year if today.month >= 8 else today.year - 1, 8, 1)
    files = {}
    y, m = start.year, start.month
    while (y, m) <= (today.year, today.month):
        files.update(month_files(y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    days = [start + dt.timedelta(n) for n in range((today - start).days)]
    have = [d for d in days if d in files]
    if not have:
        sys.exit("no IMERG files listed for this season")

    known = {d: v for d, v in load_known(start, [c["id"] for c in cells]).items() if d in files}
    todo = plan_fetch(have, known)
    print(f"fetching {len(todo)} of {len(have)} days" + (f": {todo[0]} to {todo[-1]}" if todo else ""), flush=True)
    if plan_only:
        return

    sel = urllib.parse.quote(f"precipitation[0:0][{i0}:{i1}][{j0}:{j1}]", safe="")

    def fetch(day):
        url = f"{SERVER}/{day.year}/{day.month:02d}/{files[day]}.ascii?{sel}"
        try:
            return day, cell_means(parse_ascii(get(url, token)), cells, half_lat, half_lon)
        except Exception as e:  # one missing day becomes nulls rather than losing the whole season
            print(f"{day} failed: {e}", flush=True)
            return day, None

    by_day = dict(known)  # a failed re-fetch keeps the earlier value
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for day, means in pool.map(fetch, todo):
            if means is not None:
                by_day[day] = means
                print(f"{day} ok", flush=True)
    if len(by_day) < 0.8 * len(have):
        sys.exit(f"only {len(by_day)} of {len(have)} days available; not writing a patchy file")

    last = max(by_day)
    span = [start + dt.timedelta(n) for n in range((last - start).days + 1)]
    out = {
        "product": PRODUCT,
        "start": start.isoformat(),
        "asOf": last.isoformat(),
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "cells": {
            c["id"]: [None if by_day.get(d, {}).get(c["id"]) is None else round(by_day[d][c["id"]], 1) for d in span]
            for c in cells
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} with {len(span)} days to {last} for {len(cells)} cells")


if __name__ == "__main__":
    main()
