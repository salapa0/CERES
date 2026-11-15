"""Download NASA POWER daily history for every grid cell touching Thailand.

Writes web/public/data/grid.json and web/public/data/cells/{id}.json (blueprint section 8).
Standard library only. Safe to re-run: cells already on disk are skipped.

Usage: python pipeline/build_history.py [--limit N]
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "web" / "public" / "data"
FIRST, LAST = 2001, 2025  # seasons, labelled by the year they start (1 Aug)
DLAT, DLON = 0.5, 0.625  # NASA POWER / MERRA-2 grid
PARAMS = {"rain": "PRECTOTCORR", "tmax": "T2M_MAX", "tmin": "T2M_MIN", "wetness": "GWETROOT"}
DECIMALS = {"rain": 1, "tmax": 1, "tmin": 1, "wetness": 2}
URL = (
    "https://power.larc.nasa.gov/api/temporal/daily/point?parameters={p}&community=AG"
    "&latitude={lat}&longitude={lon}&start={a}&end={b}&format=JSON"
)


def cell_id(lat, lon):
    return f"{lat:.2f}_{lon:.3f}"


def thailand_rings():
    geo = json.loads((ROOT / "data" / "thailand.geo.json").read_text(encoding="utf-8"))
    rings = []
    for feature in geo["features"]:
        g = feature["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        rings += [poly[0] for poly in polys]
    return rings


def inside(lon, lat, ring):
    hit = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def thai_cells():
    """A cell is kept when its box touches the Thailand outline."""
    rings = thailand_rings()
    cells = []
    for i in range(10, 43):  # lat 5.0 .. 21.0
        for j in range(155, 171):  # lon 96.875 .. 106.25
            lat, lon = i * DLAT, j * DLON
            samples = [
                (lon + (a - 2) * DLON / 4, lat + (b - 2) * DLAT / 4) for a in range(5) for b in range(5)
            ]
            touches = any(inside(x, y, r) for x, y in samples for r in rings) or any(
                abs(x - lon) <= DLON / 2 and abs(y - lat) <= DLAT / 2 for r in rings for x, y in r
            )
            if touches:
                cells.append({"id": cell_id(lat, lon), "lat": lat, "lon": lon})
    # Khon Kaen pilot area first, so the demo works before the full download ends.
    cells.sort(key=lambda c: (c["lat"] - 16.5) ** 2 + (c["lon"] - 102.5) ** 2)
    return cells


def fetch(cell):
    url = URL.format(
        p=",".join(PARAMS.values()), lat=cell["lat"], lon=cell["lon"], a=f"{FIRST}0801", b=f"{LAST + 1}0731"
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return json.load(r)["properties"]["parameter"]
        except Exception as e:  # noqa: BLE001 - retry any network failure
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def build_cell(cell, param):
    seasons, all_wet = [], []
    for year in range(FIRST, LAST + 1):
        d, end = date(year, 8, 1), date(year + 1, 7, 31)
        season = {"year": year, "start": d.isoformat(), **{k: [] for k in PARAMS}}
        while d <= end:
            key = d.strftime("%Y%m%d")
            for name, code in PARAMS.items():
                v = param[code].get(key)
                v = None if v is None or v <= -900 else round(v, DECIMALS[name])
                season[name].append(v)
            d += timedelta(days=1)
        all_wet += [v for v in season["wetness"] if v is not None]
        seasons.append(season)
    all_wet.sort()
    pct = lambda q: all_wet[min(len(all_wet) - 1, int(q * len(all_wet)))] if all_wet else None
    return {
        **cell,
        "sources": {
            "rain": "NASA POWER PRECTOTCORR (0.5°×0.625°)",
            "temp": "NASA POWER T2M_MAX/T2M_MIN (0.5°×0.625°)",
            "wetness": "NASA POWER GWETROOT (MERRA-2)",
        },
        "wetnessScale": {"p05": pct(0.05), "p95": pct(0.95)},
        "seasons": seasons,
    }


def work(cell):
    path = OUT / "cells" / f"{cell['id']}.json"
    if path.exists():
        return cell["id"], "skip"
    try:
        data = build_cell(cell, fetch(cell))
        path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        return cell["id"], "ok"
    except Exception as e:  # noqa: BLE001 - one bad cell must not stop the run
        return cell["id"], f"FAILED {e}"


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    cells = thai_cells()
    (OUT / "cells").mkdir(parents=True, exist_ok=True)
    grid = {
        "version": 1,
        "cellSize": {"lat": DLAT, "lon": DLON},
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "firstSeason": FIRST,
        "lastSeason": LAST,
        "cells": sorted(cells, key=lambda c: c["id"]),
    }
    (OUT / "grid.json").write_text(json.dumps(grid, separators=(",", ":")), encoding="utf-8")
    print(f"{len(cells)} cells", flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for n, (cid, status) in enumerate(pool.map(work, cells[:limit]), 1):
            print(n, cid, status, flush=True)


if __name__ == "__main__":
    main()
