"""NASA SMAP L4 root-zone soil moisture "now" for each app grid cell, plus the same date in past years (F15).

Writes web/public/data/smap/current.json. Granules are found through the public CMR search; their Thailand subset is
read as text from NSIDC's cloud OPeNDAP. Needs EARTHDATA_TOKEN (an Earthdata Login user token); run by the deploy
workflow, never by hand with a pasted token. Standard library only.
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
OUT = ROOT / "web/public/data/smap/current.json"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
SHORT_NAME, VERSION = "SPL4SMGP", "008"
PRODUCT = "NASA SMAP L4 Global 3-hourly 9 km (SPL4SMGP v8), root-zone soil moisture"
FIRST_YEAR = 2015  # SMAP data start 31 Mar 2015
ROWS, COLS = 1624, 3856  # EASE-Grid 2.0 global 9 km


def get(url, token=None, attempts=5):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read().decode("utf-8")
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(5 * 2 ** attempt)
    return ""


def opendap_links(day):
    """OPeNDAP URLs of the 3-hourly granules that start on `day` (UTC), from the public CMR search."""
    q = urllib.parse.urlencode({
        "short_name": SHORT_NAME, "version": VERSION, "page_size": 20,
        "temporal": f"{day.isoformat()}T00:00:00Z,{day.isoformat()}T23:59:59Z",
    })
    entries = json.loads(get(f"{CMR}?{q}"))["feed"]["entry"]
    links = []
    for e in entries:
        if not e["time_start"].startswith(day.isoformat()):
            continue  # a granule centred just after midnight belongs to the next day
        links += [l["href"] for l in e["links"] if l["href"].startswith("https://opendap.earthdata.nasa.gov/")]
    return sorted(set(links))


def parse_rows(text, name):
    """{row: [values]} from an OPeNDAP ASCII response; `name` is the variable's short name (its last part)."""
    rows = {}
    for line in text.splitlines():
        m = re.match(r"^(\S+)\[(\d+)\], (.*)$", line)
        if m and m.group(1).split(".")[-1].endswith(name):
            rows[int(m.group(2))] = [float(v) for v in m.group(3).split(", ")]
    return rows


def index_range(coords, lo, hi):
    """First and last index whose coordinate lies in [lo, hi], for a monotonic coordinate list."""
    idx = [i for i, c in enumerate(coords) if lo <= c <= hi]
    return idx[0], idx[-1]


def cell_means(values, lats, lons, cells, half_lat, half_lon):
    """Mean of valid pixels (0..1 m³/m³) whose centres fall inside each cell; None where none do."""
    out = {}
    for c in cells:
        vals = [values[r][k] for r, la in enumerate(lats) if abs(la - c["lat"]) <= half_lat
                for k, lo in enumerate(lons) if abs(lo - c["lon"]) <= half_lon and 0 <= values[r][k] <= 1]
        out[c["id"]] = sum(vals) / len(vals) if vals else None
    return out


def past_dates(day, first_year=FIRST_YEAR):
    """[(year, the same calendar day in that year)] for each earlier year with SMAP data (from 31 Mar 2015).
    29 February becomes 28 February in a common year, rather than failing the whole run."""
    out = []
    for y in range(first_year, day.year):
        try:
            d = dt.date(y, day.month, day.day)
        except ValueError:
            d = dt.date(y, day.month, day.day - 1)
        if d >= dt.date(2015, 3, 31):
            out.append((y, d))
    return out


def mean_of(days):
    """Per-cell mean over several granules, ignoring None."""
    out = {}
    for cid in days[0]:
        vals = [d[cid] for d in days if d.get(cid) is not None]
        out[cid] = sum(vals) / len(vals) if vals else None
    return out


def main():
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        sys.exit("EARTHDATA_TOKEN is not set")
    grid = json.loads(GRID.read_text(encoding="utf-8"))
    cells = grid["cells"]
    half_lat, half_lon = grid["cellSize"]["lat"] / 2, grid["cellSize"]["lon"] / 2

    # Latest UTC day with all eight granules (SMAP L4 runs a few days behind).
    day = dt.date.today()
    for _ in range(10):
        day -= dt.timedelta(1)
        latest = opendap_links(day)
        if len(latest) == 8:
            break
    else:
        sys.exit("no complete SMAP day found in the last 10 days")

    first = latest[0]
    dds = get(f"{first}.dds", token)
    found = re.search(r"(\S*sm_rootzone)\[", dds)
    if not found:
        sys.exit("sm_rootzone not found in the granule's variable list")
    var = found.group(1)
    lat_col = parse_rows(get(f"{first}.ascii?cell_lat%5B0:1:{ROWS - 1}%5D%5B0%5D", token), "cell_lat")
    lon_row = parse_rows(get(f"{first}.ascii?cell_lon%5B0%5D%5B0:1:{COLS - 1}%5D", token), "cell_lon")
    all_lats = [lat_col[r][0] for r in range(ROWS)]
    all_lons = lon_row[0]
    lat_lo = min(c["lat"] for c in cells) - half_lat
    lat_hi = max(c["lat"] for c in cells) + half_lat
    lon_lo = min(c["lon"] for c in cells) - half_lon
    lon_hi = max(c["lon"] for c in cells) + half_lon
    # Rows run north to south, so the lat range comes back reversed.
    r_hi, r_lo = index_range(all_lats, lat_lo, lat_hi)
    r0, r1 = min(r_hi, r_lo), max(r_hi, r_lo)
    c0, c1 = index_range(all_lons, lon_lo, lon_hi)
    lats, lons = all_lats[r0:r1 + 1], all_lons[c0:c1 + 1]
    sel = f"{var}%5B{r0}:1:{r1}%5D%5B{c0}:1:{c1}%5D"

    def granule(url):
        rows = parse_rows(get(f"{url}.ascii?{sel}", token), var.split("/")[-1].split(".")[-1])
        values = [rows[r] for r in range(len(lats))]
        return cell_means(values, lats, lons, cells, half_lat, half_lon)

    def day_mean(d):
        links = latest if d == day else opendap_links(d)
        if len(links) < 4:  # too few granules to stand for the day
            return d, None
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            return d, mean_of(list(pool.map(granule, links)))

    now = day_mean(day)[1]
    if now is None:
        sys.exit(f"no SMAP values for {day}")
    past = {}
    for y, same_day in past_dates(day):
        try:
            _, m = day_mean(same_day)
        except Exception as e:  # a missing past year narrows the comparison, it does not stop the run
            print(f"{y} failed: {e}", flush=True)
            continue
        if m is not None:
            past[y] = m
        print(f"{y} {'ok' if m else 'skipped'}", flush=True)

    kept = sorted(past)
    out = {
        "product": PRODUCT,
        "date": day.isoformat(),
        "years": kept,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "cells": {
            c["id"]: {
                "now": None if now[c["id"]] is None else round(now[c["id"]], 3),
                "past": [None if past[y][c["id"]] is None else round(past[y][c["id"]], 3) for y in kept],
            }
            for c in cells if now[c["id"]] is not None
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT}: {day}, {len(out['cells'])} cells, past years {kept}")


if __name__ == "__main__":
    main()
