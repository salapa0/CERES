"""GLDAS root-zone soil moisture for every past season, added to each cell file as `rootzone` (F11 self-check).

Reads and rewrites web/public/data/cells/{id}.json. For each cell it asks NASA's Giovanni time-series service for
every GLDAS 0.25° land pixel whose centre lies inside the cell, averages the 3-hourly values into UTC days, then
averages the pixels. Needs EARTHDATA_TOKEN (an Earthdata Login user token); run by the GLDAS workflow, never by
hand with a pasted token. Standard library only.

Usage: python pipeline/build_gldas.py [--shard I/N]
"""
import concurrent.futures
import datetime as dt
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CELLS = ROOT / "web/public/data/cells"
GRID = ROOT / "web/public/data/grid.json"
# Giovanni replaced the GES DISC Hydrology Data Rods service; it serves one point per request.
API = "https://api.giovanni.earthdata.nasa.gov/timeseries"
DATA = "GLDAS_NOAH025_3H_2_1_RootMoist_inst"
SOURCE = "GLDAS Noah 2.1 RootMoist (0.25°, mean of land pixels in the cell)"
PIXEL = 0.25


def pixel_centres(lat, lon, half_lat, half_lon):
    """GLDAS pixel centres (…, x.125, x.375, …) whose centre lies inside the cell box."""
    def axis(c, half):
        first = math.ceil((c - half - PIXEL / 2) / PIXEL)
        last = math.floor((c + half - PIXEL / 2) / PIXEL)
        return [round(k * PIXEL + PIXEL / 2, 3) for k in range(first, last + 1)]
    return [(la, lo) for la in axis(lat, half_lat) for lo in axis(lon, half_lon)]


def parse_series(text):
    """{date: daily mean} from a Giovanni CSV; undefined values are dropped and days keep what is left."""
    lines = text.splitlines()
    undef = None
    for line in lines:
        key, _, value = line.partition(",")
        if key == "undef":
            undef = float(value)
        if key == "Timestamp (UTC)":
            break
    else:
        raise ValueError("no data header in Giovanni response")
    sums = {}
    for line in lines[lines.index(line) + 1:]:
        stamp, _, value = line.partition(",")
        if not value:
            continue
        v = float(value)
        if undef is not None and v == undef or v < 0:
            continue
        day = dt.date.fromisoformat(stamp[:10])
        s, n = sums.get(day, (0.0, 0))
        sums[day] = (s + v, n + 1)
    return {d: s / n for d, (s, n) in sums.items()}


def cell_daily(series_list):
    """Mean over pixels, day by day; a day missing from every pixel is absent."""
    days = {}
    for series in series_list:
        for d, v in series.items():
            days.setdefault(d, []).append(v)
    return {d: sum(vs) / len(vs) for d, vs in days.items()}


def season_array(daily, start, length):
    """Values for `length` days from `start`, rounded to 0.1 kg/m², None where there is no data."""
    out = []
    for n in range(length):
        v = daily.get(start + dt.timedelta(n))
        out.append(None if v is None else round(v, 1))
    return out


def get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read().decode("utf-8")
        except Exception:
            if attempt == 4:
                raise
            time.sleep(5 * 2 ** attempt)
    return ""


def fetch_point(lat, lon, first, last, token):
    q = urllib.parse.urlencode({
        "data": DATA,
        "location": f"[{lat},{lon}]",
        "time": f"{first.isoformat()}T00:00:00/{last.isoformat()}T21:00:00",
    })
    return parse_series(get(f"{API}?{q}", token))


def main():
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        sys.exit("EARTHDATA_TOKEN is not set")
    shard, shards = 0, 1
    if "--shard" in sys.argv:
        shard, shards = map(int, sys.argv[sys.argv.index("--shard") + 1].split("/"))
    grid = json.loads(GRID.read_text(encoding="utf-8"))
    half_lat, half_lon = grid["cellSize"]["lat"] / 2, grid["cellSize"]["lon"] / 2
    cells = grid["cells"][shard::shards]

    def work(c):
        path = CELLS / f"{c['id']}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        first = dt.date.fromisoformat(data["seasons"][0]["start"])
        last_season = data["seasons"][-1]
        last = dt.date.fromisoformat(last_season["start"]) + dt.timedelta(len(last_season["rain"]) - 1)
        series = []
        for la, lo in pixel_centres(c["lat"], c["lon"], half_lat, half_lon):
            s = fetch_point(la, lo, first, last, token)
            if s:  # ocean pixels come back empty
                series.append(s)
        daily = cell_daily(series)
        if not daily:
            return c["id"], "no land pixels"
        for season in data["seasons"]:
            season["rootzone"] = season_array(daily, dt.date.fromisoformat(season["start"]), len(season["rain"]))
        data["sources"]["rootzone"] = SOURCE
        path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        return c["id"], f"ok, {len(series)} pixels"

    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(work, c): c["id"] for c in cells}
        for f in concurrent.futures.as_completed(futures):
            try:
                cid, status = f.result()
            except Exception as e:  # one bad cell is reported, not fatal; the workflow checks the count
                cid, status = futures[f], f"FAILED {e}"
                failed += 1
            print(cid, status, flush=True)
    print(f"{len(cells) - failed} of {len(cells)} cells done")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
