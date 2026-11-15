# Field Time Machine MVP (M0–M5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Thai-first web app on GitHub Pages where a tap on any Thai field shows three strategy cards and a day-by-day replay of every past dry season since 2001 for four post-rice crops, using NASA POWER data.

**Architecture:** A Python pipeline (GitHub Actions) writes one static JSON file per NASA POWER grid cell; a React app on GitHub Pages loads the tapped cell's file and runs the FAO-56 replay engine in TypeScript in the browser. Setup runs first on `main`; then three lanes (pipeline, engine, UI) run in parallel on their own branches against frozen contracts, and merge at M5.

**Tech Stack:** Vite + React 18 + TypeScript, Tailwind CSS, MapLibre GL JS, React Router (HashRouter), `@turf/boolean-point-in-polygon`, Vitest + Testing Library; Python 3.11 with `requests`, `pandas`, `numpy`, `shapely`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-11-14-field-time-machine-design.md` (the "blueprint"). Section numbers below (§) refer to it. Read §0–§5 before your lane.

**Supersedes:** `docs/superpowers/plans/2026-11-14-ceres.md` (old Streamlit plan; ignore it).

## Global Constraints

- Deadline: MVP live by **Sun 15 Nov 2026 ~12:00**; final submit by **20:00** Thailand time.
- Hosting: GitHub Pages, static only; Vite `base` = `/ceres/`.
- Thai is the default language; every UI string lives in `web/src/i18n/th.json` and `en.json`. Thai mode shows Buddhist Era years (CE + 543); season 2015 → `2558/59`.
- Every number on screen names its source and resolution (§2 G2).
- The replay engine exists only in TypeScript under `web/src/engine/`; Python never computes outcomes.
- Data contracts are §8 exactly. Season arrays run 1 Aug → 31 Jul (365/366 days), index 0 = 1 Aug; missing values are `null`, never -999.
- Cell = 0.5° lat × 0.625° lon, centre snapped to `round(lat/0.5)*0.5`, `round(lon/0.625)*0.625`; id = `f"{lat:.2f}_{lon:.3f}"` (TS: `` `${lat.toFixed(2)}_${lon.toFixed(3)}` ``).
- Defaults: sowing date `12-01`, soil `loamySand`, seasons from 2001 to the last complete one.
- Tests never touch the network. Earthdata credentials are never read, typed or committed by an agent.
- Lanes edit only the paths they own (§13 table). A needed contract change stops the lane and goes to `main` first.
- Commits: imperative subject ≤ 72 chars, body says why, end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Taps on islands and border tips** (Phuket 7.88, 98.39; Mae Sai 20.43, 99.88; Ko Kut 11.66, 102.57) must land in a cell that exists in `grid.json`, not "outside Thailand". → test in Task P1.
2. **Sowing dates in Jan–Jul and leap years** (`01-15`, `02-29`) must index into the second calendar year of the season; `02-29` in a non-leap season maps to 1 Mar. → test in Task E3.
3. **A crop with every season `nodata`** (fresh cell, data gaps) must show "ข้อมูลไม่พอ" / "Not enough data", never `0/0`, `NaN` or 0 %. → tests in Tasks E4 and U3.
4. **Cell files too big for a phone on a rural connection**: each `cells/{id}.json` stays under 300 KB uncompressed. → test in Task P4.
5. **Death-day dates in the drawer** must be real calendar dates in the right year and era (e.g. `28 ม.ค. 2559`), not day indexes. → test in Task U4.

---

## Part 1 — Setup (one session, on `main`, before the lanes)

### Task S1: Access spike and data-access notes (M0)

**Files:**
- Create: `docs/data-access.md`, `pipeline/tests/fixtures/power_khonkaen_2015.json`, `docs/decisions.md`

- [ ] **Step 1:** Call NASA POWER once:
  `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,GWETROOT&community=AG&latitude=16.44&longitude=102.83&start=20150801&end=20160731&format=JSON`
  Save the raw response as `pipeline/tests/fixtures/power_khonkaen_2015.json`.
  Expected: JSON with `properties.parameter.PRECTOTCORR` keyed by `YYYYMMDD`, 366 keys.
- [ ] **Step 2:** In `docs/data-access.md`, write one section per source D1–D7 (§7): working URL or call, auth, response shape, fill value, time zone, units. D1 comes from Step 1. For D2–D5 and D7, try only if a `~/.netrc` with Earthdata credentials already exists; otherwise write `pending: needs Earthdata login (P1)`. D6: try `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=16.44&longitude=102.83&startDate=A2015305&endDate=A2015365&kmAboveBelow=0&kmLeftRight=0` and record the result.
- [ ] **Step 3:** Check the EOX Sentinel-2 cloudless layer licence; record the layer name and licence in `docs/data-access.md`, or record "use NASA GIBS MODIS true colour instead".
- [ ] **Step 4:** Create `docs/decisions.md` with headings `## Setup`, `## Pipeline lane`, `## Engine lane`, `## UI lane`.
- [ ] **Step 5:** Commit `Record NASA data access spike and POWER fixture`.

### Task S2: Scaffold, contracts and live Pages (M1)

**Files:**
- Create: `LICENSE` (MIT, holder "CERES team"), `web/` (Vite React TS), `web/vite.config.ts`, `web/tailwind.config.ts`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/i18n/th.json`, `web/src/i18n/en.json`, `web/src/styles/tokens.css`, `web/src/engine/types.ts`, `web/src/engine/index.ts`, `web/src/engine/constants.ts`, `web/public/data/sample/cell.json`, `web/public/data/sample/grid.json`, `web/public/data/sample/current.json`, `web/src/App.test.tsx`, `pipeline/pyproject.toml`, `pipeline/ceres_pipeline/__init__.py`, `pipeline/tests/test_smoke.py`, `.github/workflows/deploy.yml`

**Interfaces (frozen after this task; lanes import these exactly):**
- Produces `web/src/engine/types.ts`:
```ts
export type Num = number | null;
export interface SeasonData { year: number; start: string; rain: Num[]; tmax: Num[]; tmin: Num[]; wetness: Num[]; rootzone?: Num[]; }
export interface CellData { id: string; lat: number; lon: number; sources: Record<string, string>; wetnessScale: { p05: number; p95: number }; seasons: SeasonData[]; }
export interface GridCell { id: string; lat: number; lon: number; }
export interface Grid { version: number; cellSize: { lat: number; lon: number }; generated: string; cells: GridCell[]; }
export type SoilTexture = 'sand' | 'loamySand' | 'sandyLoam' | 'loam' | 'clayLoam';
export type SoilEffect = 'nitrogen' | 'organic' | 'uses' | 'bare';
export interface Crop { id: string; nameTh: string; nameEn: string; stages: { ini: number; dev: number; mid: number; late: number }; kc: { ini: number; mid: number; end: number }; rootDepthM: number; p: number; heatC: number; soilEffect: SoilEffect; greenManure?: boolean; incorporateAfterDevDays?: number; sources: string[]; assumption: boolean; }
export interface WhatIf { rainFactor: number; dT: number; }
export type OutcomeKind = 'good' | 'poor' | 'failed' | 'nodata';
export interface DailyTrace { dr: number[]; taw: number; raw: number; rain: number[]; }
export interface Outcome { kind: OutcomeKind; ret: number | null; deathDay: number | null; reason: 'drought' | 'heat' | null; sowIndex: number; daily?: DailyTrace; }
export interface OddsResult { good: number; poor: number; failed: number; nodata: number; total: number; }
export type Timeline = Record<string, Outcome[]>; // cropId -> one Outcome per season, same order as cell.seasons
export interface Strategy { id: 'A' | 'B' | 'C'; cropId: string | null; altCropId: string | null; odds: OddsResult | null; soilEffect: SoilEffect; }
export interface ReplayArgs { cell: CellData; season: SeasonData; crop: Crop; sowMonthDay: string; soil: SoilTexture; whatIf?: WhatIf; withDaily?: boolean; }
export interface BadgeInput { seasons: number; hitRate: number | null; analogsAgree: boolean | null; }
export interface BadgeResult { level: 'high' | 'medium' | 'low'; reasons: string[]; }
```
- Produces `web/src/engine/index.ts` exporting these names, each a stub that throws `Error('not implemented')` until the engine lane replaces it:
  `replay(a: ReplayArgs): Outcome`, `runTimeline(cell: CellData, crops: Crop[], sowMonthDay: string, soil: SoilTexture, whatIf?: WhatIf): Timeline`, `odds(outcomes: Outcome[]): OddsResult`, `buildStrategies(timeline: Timeline, crops: Crop[]): Strategy[]`, `badge(i: BadgeInput): BadgeResult`, `dayIndexToDate(season: SeasonData, index: number): Date`, `loadCrops(): Crop[]`.
- Produces `constants.ts` with every name and start value in §9.5 plus `DEFAULT_SOW = '12-01'`, `DEFAULT_SOIL: SoilTexture = 'loamySand'`, `FIRST_SEASON = 2001`.
- Sample files follow §8 exactly: `cell.json` holds two synthetic seasons (2015 leap-containing, 2016); `grid.json` holds the Khon Kaen cell `16.50_102.500`.

- [ ] **Step 1:** Scaffold `web/` with `npm create vite@latest web -- --template react-ts`, add Tailwind, MapLibre GL, react-router-dom, `@turf/boolean-point-in-polygon`, Vitest, `@testing-library/react`, jsdom. Add Noto Sans Thai and Noto Serif Thai from Google Fonts in `index.html`. Put the §11.1 colour tokens in `tokens.css`.
- [ ] **Step 2:** Write `App.test.tsx`: `renders Thai header by default` → `expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CERES')` and the subtitle from `th.json` key `app.subtitle` = `ไทม์แมชชีนแปลงนา`.
- [ ] **Step 3:** Run `npm --prefix web test -- --run` → FAIL. Implement `App.tsx` with a `HashRouter` and the header. Run → PASS.
- [ ] **Step 4:** Create `pipeline/pyproject.toml` (package `ceres_pipeline`, Python ≥ 3.11, deps from Tech Stack, `dev` extra with pytest) and `test_smoke.py` (`import ceres_pipeline`). Run `cd pipeline && pip install -e ".[dev]" && pytest -q` → 1 passed.
- [ ] **Step 5:** Write `types.ts`, the `index.ts` stubs, `constants.ts` and the three sample files. Run `npx --prefix web tsc --noEmit -p web` → no errors.
- [ ] **Step 6:** Write `deploy.yml`: `on: [push, workflow_call, workflow_dispatch]`; jobs: test (pytest + `npm test -- --run`), build (`npm run build` in `web`), deploy with `actions/upload-pages-artifact` + `actions/deploy-pages`; permissions `pages: write, id-token: write, contents: read`. Deploy only from `main`.
- [ ] **Step 7:** Enable Pages: `gh api -X POST repos/salapa0/ceres/pages -f build_type=workflow` (ignore "already exists").
- [ ] **Step 8:** Commit `Scaffold web app, pipeline, contracts and Pages deploy`, push `main`.
- [ ] **Step 9:** Verify: `gh run watch` shows the deploy succeeding, and `curl -s https://salapa0.github.io/ceres/ | grep -c CERES` prints ≥ 1.
- [ ] **Step 10:** Tell the human: add repo secrets `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` (needed from P1). Then start the three lane sessions from `main`.

---

## Part 2 — Pipeline lane (`lane/pipeline`, M2)

Owns: `pipeline/`, `.github/workflows/data-*.yml`, `web/public/data/` (except `sample/`). Command: `cd pipeline && pytest -q`.

### Task P1: Thailand grid

**Files:** Create `pipeline/ceres_pipeline/grid.py`, `pipeline/ceres_pipeline/data/thailand.geojson`; Test `pipeline/tests/test_grid.py`

**Interfaces:**
- Produces: `@dataclass(frozen=True) class Cell: id: str; lat: float; lon: float`; `snap(lat: float, lon: float) -> tuple[float, float]`; `cell_id(lat: float, lon: float) -> str`; `thailand_polygon() -> shapely.geometry.base.BaseGeometry`; `thai_cells() -> list[Cell]` (sorted by id).

- [ ] **Step 1:** Download Natural Earth 1:10m admin-0 countries, extract Thailand, simplify to 0.01° tolerance, save as `data/thailand.geojson` (public domain; note the source in `docs/decisions.md`).
- [ ] **Step 2:** Write tests:
  - `test_snap_khon_kaen` → `snap(16.44, 102.83) == (16.5, 102.5)`; `cell_id(16.5, 102.5) == "16.50_102.500"`.
  - `test_khon_kaen_cell_included`, `test_gulf_of_thailand_excluded` (point 10.0, 101.5 → its cell absent), `test_vientiane_excluded` → `in_thailand(17.97, 102.60) is False` (add `in_thailand(lat: float, lon: float) -> bool` to the Produces list).
  - `test_island_and_border_points_have_cells` → for Phuket (7.88, 98.39), Mae Sai (20.43, 99.88), Ko Kut (11.66, 102.57): `cell_id(*snap(lat, lon)) in {c.id for c in thai_cells()}`.
  - `test_cell_count_reasonable` → `150 <= len(thai_cells()) <= 400`.
- [ ] **Step 3:** Run → FAIL. Implement: a cell is kept when its box intersects the polygon; `in_thailand` uses point-in-polygon. Run → PASS.
- [ ] **Step 4:** Commit `Add Thailand grid of POWER cells`.

### Task P2: NASA POWER client

**Files:** Create `pipeline/ceres_pipeline/power.py`; Test `pipeline/tests/test_power.py`

**Interfaces:**
- Produces: `class PowerError(Exception)`; `fetch_daily(lat: float, lon: float, start: date, end: date, session: requests.Session | None = None) -> pd.DataFrame` with a daily `DatetimeIndex` and float columns `rain, tmax, tmin, wetness` (from `PRECTOTCORR, T2M_MAX, T2M_MIN, GWETROOT`); -999 → NaN. Three tries with back-off 2, 4, 8 s, then `PowerError`.

- [ ] **Step 1:** Write tests with a fake session serving the S1 fixture: `test_columns_and_index` (366 rows, columns exactly `["rain","tmax","tmin","wetness"]`); `test_fill_value_becomes_nan` (fixture copy with one -999 → that cell `isna()`); `test_http_error_retries_then_raises` (fake returns 503 three times → `PowerError`, 3 calls; patch `time.sleep`).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `Add NASA POWER daily client`.

### Task P3: Season slicing

**Files:** Create `pipeline/ceres_pipeline/seasons.py`; Test `pipeline/tests/test_seasons.py`

**Interfaces:**
- Consumes: `fetch_daily` DataFrame.
- Produces: `last_complete_season(today: date) -> int` (if `today >= date(today.year, 8, 1)` then `today.year - 1` else `today.year - 2`); `split_seasons(df: pd.DataFrame, first: int, last: int) -> list[dict]` → §8 season dicts (`year, start, rain, tmax, tmin, wetness`; NaN → `None`; rain/temps rounded to 1 dp, wetness to 3 dp); `wetness_scale(df) -> dict` with `p05`, `p95` (3 dp, NaN ignored).

- [ ] **Step 1:** Tests: `test_last_complete_season` (`date(2026,11,14) → 2025`, `date(2026,7,31) → 2024`); `test_season_lengths` (season 2015 has 366 values, 2016 has 365; build a synthetic 2015-08-01..2017-07-31 frame); `test_index_zero_is_aug_1` (value placed on 2015-08-01 appears at `rain[0]`); `test_nan_becomes_none`; `test_wetness_scale_percentiles` (values 0..100 /100 → `p05 == 0.05`, `p95 == 0.95`).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Commit `Add dry-season slicing and wetness scale`.

### Task P4: History build and workflow

**Files:** Create `pipeline/ceres_pipeline/build_history.py`, `.github/workflows/data-history.yml`; Test `pipeline/tests/test_build_history.py`

**Interfaces:**
- Consumes: P1–P3.
- Produces: `build_cell(cell: Cell, df: pd.DataFrame, first: int, last: int) -> dict` (§8 cell JSON, `sources` with `rain`, `temp`, `wetness` strings exactly as §8); `main(out_dir: Path, today: date, limit: int | None = None) -> None` writing `out_dir/grid.json`, `out_dir/thailand.geojson`, `out_dir/cells/{id}.json` (fetch range `date(first, 8, 1)` → `date(last + 1, 7, 31)`, 1 s pause between cells, a failed cell is logged and skipped, never aborts the run). CLI: `python -m ceres_pipeline.build_history --out ../web/public/data [--limit N]`.

- [ ] **Step 1:** Tests: `test_build_cell_matches_contract` (keys `id, lat, lon, sources, wetnessScale, seasons`; every season has equal-length arrays); `test_cell_file_under_300kb` (25 synthetic seasons of realistic values → `len(json.dumps(cell)) < 300_000`); `test_main_skips_failed_cell` (fetch patched to raise `PowerError` for one of two cells → one cell file written, grid still lists both).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** Local check: `python -m ceres_pipeline.build_history --out /tmp/ceres --limit 1` → one cell file whose first season is 2001.
- [ ] **Step 4:** Write `data-history.yml`: `on: workflow_dispatch` and `schedule: cron '0 2 5 8 *'`; run the build into `web/public/data`, commit with `[data]` subject prefix, push, then `uses: ./.github/workflows/deploy.yml`. Permissions `contents: write`.
- [ ] **Step 5:** Commit `Add history build and data workflow`; push `lane/pipeline`; run the workflow on the branch with `gh workflow run data-history.yml --ref lane/pipeline`.
- [ ] **Step 6:** Verify: the run commits `web/public/data/cells/16.50_102.500.json`; `grid.json` cell count equals the P1 test count.

---

## Part 3 — Engine lane (`lane/engine`, M3)

Owns: `web/src/engine/` (replacing the S2 stubs), `web/src/data/crops.json`. Command: `npm --prefix web test -- --run src/engine`.

### Task E1: ET0

**Files:** Create `web/src/engine/et0.ts`; Test `web/src/engine/et0.test.ts`

**Interfaces:** Produces `extraterrestrialRadiation(latDeg: number, doy: number): number` (MJ m⁻² day⁻¹, §9.1) and `hargreavesEt0(tmax: number, tmin: number, ra: number): number` (mm/day, §9.1).

- [ ] **Step 1:** Tests: `Ra at 20°S on 3 Sep ≈ 32.2` (`toBeCloseTo(32.2, 1)`, doy 246); `ET0 is 0 when tmax equals tmin`; `ET0 never negative when tmin > tmax` (returns 0).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS. Commit `Add Hargreaves ET0`.

### Task E2: Crop coefficients, soil and crop library

**Files:** Create `web/src/engine/kc.ts`, `web/src/engine/soil.ts`, `web/src/engine/crops.ts` (holds `loadCrops`), `web/src/data/crops.json`; Test `web/src/engine/kc.test.ts`, `web/src/engine/crops.test.ts`

**Interfaces:** Produces `kcOnDay(crop: Crop, d: number): number` (d = days after sowing, 0-based, §9.2); `seasonLength(crop: Crop): number` (sum of stages; green manure → `ini + dev + (incorporateAfterDevDays ?? 0)`); `criticalWindow(crop: Crop): [number, number]` (first half of mid stage, day range, inclusive start, exclusive end); `SOIL_TEXTURES: Record<SoilTexture, { fc: number; wp: number; source: string }>` (FAO-56 Table 19 midpoints); `loadCrops(): Crop[]` (imports `crops.json`).

- [ ] **Step 1:** Tests (use a test crop with stages 10/20/30/20, kc 0.4/1.1/0.6): `kc at day 0 is ini`; `kc at end of dev is mid`; `kc at last day ≈ end`; `kc halfway through dev is 0.75`; `greenManure season stops after dev`; `critical window is first half of mid` (`[30, 45)`); `every soil has fc > wp`.
- [ ] **Step 2:** crops tests: `four crops with ids mungbean, peanut, maize, sunnhemp`; `every crop has at least one source`; `sunnhemp is greenManure`; `stage lengths positive and kc values in (0, 1.5]`.
- [ ] **Step 3:** Run → FAIL. Fill `crops.json` from FAO-56 Tables 11, 12, 22 per blueprint §10.1 (cite table and row in `sources`; `assumption: true` where no table exists). Implement `kc.ts`, `soil.ts`. Run → PASS.
- [ ] **Step 4:** Commit `Add crop library, Kc curve and soil textures`.

### Task E3: Replay

**Files:** Create `web/src/engine/replay.ts`, `web/src/engine/dates.ts`; Test `web/src/engine/replay.test.ts`, `web/src/engine/dates.test.ts`

**Interfaces:**
- Consumes: E1, E2, `types.ts`, `constants.ts`.
- Produces: `sowIndex(season: SeasonData, sowMonthDay: string): number` (Aug–Dec → start year, Jan–Jul → next year; `02-29` in a non-leap year → 1 Mar); `dayIndexToDate(season: SeasonData, index: number): Date`; `replay(a: ReplayArgs): Outcome` (§9.3–§9.4 including the green-manure rule; `deathDay` is an index into the season arrays; `nodata` when any needed day is null or the crop runs past the last index).

- [ ] **Step 1:** dates tests: `sowIndex 12-01 in season 2015 is 122`; `sowIndex 01-15 in season 2015 points at 2016-01-15` (via `dayIndexToDate`); `sowIndex 02-29 in season 2016 (non-leap 2017) maps to 2017-03-01`; `dayIndexToDate(season2015, 0)` is 2015-08-01.
- [ ] **Step 2:** replay tests (synthetic season: tmax 33, tmin 22 every day; vary rain and wetness): `wet season is good` (rain 5 mm/day, wetness at p95); `dry start, zero rain fails with drought and a deathDay after the initial stage`; `heat only fails with heat` (ample rain, tmax = crop.heatC + 2 inside critical window); `null rain inside crop season gives nodata`; `crop running past season end gives nodata`; `sunn hemp skips heat rule` (same heat input → not `heat`); `dr stays within [0, taw] every day` (withDaily); `rainFactor 0 is never better than 1` (compare `ret`); `same inputs give identical outputs`.
- [ ] **Step 3:** Run → FAIL. Implement. Run → PASS. Commit `Add day-by-day replay engine`.

### Task E4: Timeline, odds, strategies, badge

**Files:** Create `web/src/engine/odds.ts`, `web/src/engine/strategies.ts`, `web/src/engine/badge.ts`; Modify `web/src/engine/index.ts` (replace stubs with real exports); Test `web/src/engine/strategies.test.ts`, `web/src/engine/badge.test.ts`

**Interfaces:** Implements the S2 signatures: `runTimeline`, `odds`, `buildStrategies` (A: `cropId null`, `odds null`, `soilEffect 'bare'`; B: best of mungbean/peanut by `good`, tie → mungbean, other legume in `altCropId`; C: best of maize/sunnhemp, tie → sunnhemp), `badge` (§9.10; with `hitRate null` the result is never `high`; reasons are i18n keys `badge.reason.fewSeasons`, `badge.reason.noSelfCheck`, `badge.reason.lowHitRate`, `badge.reason.analogsSplit`).

- [ ] **Step 1:** Tests: `odds counts kinds and excludes nodata from total`; `all nodata gives total 0` (no division; `good 0, total 0`); `timeline has one outcome per season per crop in season order`; `strategy order is A, B, C`; `B tie picks mungbean`; `badge without self-check is at most medium`; `badge with fewer than 15 seasons is low`; `badge high needs hitRate >= 0.75 and analogsAgree`.
- [ ] **Step 2:** Run → FAIL. Implement. Run `npm --prefix web test -- --run` (whole web suite) → PASS.
- [ ] **Step 3:** Commit `Add timeline, odds, strategies and badge`; push `lane/engine`.

---

## Part 4 — UI lane (`lane/ui`, M4)

Owns: `web/src/components/`, `web/src/pages/`, `web/src/lib/`, `web/src/i18n/`, `web/src/styles/`, `web/src/App.tsx`. Until M5, tests mock `../engine` with `vi.mock` and load `web/public/data/sample/`. Command: `npm --prefix web test -- --run`.

### Task U1: Language, formatting and layout

**Files:** Create `web/src/lib/i18n.tsx`, `web/src/lib/format.ts`, `web/src/components/LangToggle.tsx`, `web/src/components/SourcesFooter.tsx`; Test `web/src/lib/format.test.ts`, `web/src/components/LangToggle.test.tsx`

**Interfaces:** Produces `I18nProvider`, `useT(): { t: (key: string, vars?: Record<string, string | number>) => string; lang: 'th' | 'en'; setLang(l: 'th' | 'en'): void }` (choice saved in `localStorage` key `ceres.lang`, wrapped in try/catch, default `th`); `formatSeason(year: number, lang): string` (`2015 → '2558/59'` th, `'2015/16'` en); `formatDate(d: Date, lang): string` (th: `28 ม.ค. 2559`, en: `28 Jan 2016`); `SourcesFooter({ sources }: { sources: Record<string, string> })`.

- [ ] **Step 1:** Tests: the two `formatSeason` cases; `formatDate(new Date(2016, 0, 28), 'th') === '28 ม.ค. 2559'`; `formatDate(..., 'en') === '28 Jan 2016'`; `toggle switches heading subtitle to English` (`app.subtitle` en = `Field Time Machine`).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS. Commit `Add Thai/English i18n and formatters`.

### Task U2: Data loading, map and home page

**Files:** Create `web/src/lib/data.ts`, `web/src/components/MapView.tsx`, `web/src/pages/Home.tsx`; Test `web/src/lib/data.test.ts`, `web/src/pages/Home.test.tsx`

**Interfaces:**
- Produces: `dataUrl(path: string): string` (`import.meta.env.BASE_URL + 'data/' + path`); `loadGrid(): Promise<Grid>`; `loadCell(id: string): Promise<CellData>`; `loadThailand(): Promise<GeoJSON.FeatureCollection>`; `cellForPoint(grid: Grid, thailand: GeoJSON.FeatureCollection, lat: number, lon: number): GridCell | null` (null when the point is outside the polygon or its snapped cell is missing); `MapView({ onPick }: { onPick(lat: number, lon: number): void })` (MapLibre, OpenFreeMap style, centred on Thailand, attribution visible); `Home` navigates to `#/field?lat=..&lon=..` on a pick inside Thailand, else shows `home.outside` = `ตอนนี้รองรับเฉพาะพื้นที่ในประเทศไทย`. A "ใช้ตำแหน่งของฉัน" button uses `navigator.geolocation`.

- [ ] **Step 1:** Tests: `cellForPoint returns Khon Kaen cell for 16.44, 102.83` (sample grid + `thailand.geojson`); `cellForPoint returns null for 10.0, 101.5`; `Home shows outside message when pick is outside` (MapView mocked to call `onPick(10, 101.5)`).
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS. Commit `Add map home page and data loading`.

### Task U3: Field page, strategy cards and timeline

**Files:** Create `web/src/pages/Field.tsx`, `web/src/components/StrategyCard.tsx`, `web/src/components/Timeline.tsx`, `web/src/components/Badge.tsx`, `web/src/components/InputsBar.tsx`; Test `web/src/pages/Field.test.tsx`

**Interfaces:**
- Consumes: engine `runTimeline`, `buildStrategies`, `odds`, `badge`, `loadCrops` (all from `../engine`); `loadCell`.
- Produces: route `#/field?lat&lon&sow&soil`. The page shows the cell id and coordinates, `InputsBar` (sowing date select from `11-01` to `02-01` weekly, soil select of the five textures, both written back to the URL), three `StrategyCard`s (§10.3 contents; odds as `t('card.odds', { good, total })` = `รอด {good} จาก {total} ฤดู`; `total 0` → `card.noData` = `ข้อมูลไม่พอ`), a `Timeline` (rows = crops, columns = seasons via `formatSeason`, icons 🌱/🍂/✖/·, crop names sticky on the left, horizontal scroll inside its box), `Badge` (level text สูง/กลาง/ต่ำ plus reasons in a tooltip), `SourcesFooter` from `cell.sources`.

- [ ] **Step 1:** Tests (engine mocked to return a fixed timeline): `renders three cards in order A, B, C`; `renders four timeline rows`; `shows 2558/59 column in Thai`; `card shows Not enough data when total is 0` (EN mode, mocked odds total 0 → text `Not enough data`); `changing soil updates the URL`.
- [ ] **Step 2:** Run → FAIL. Implement with the §11.3 layout and §11.1 tokens. Run → PASS.
- [ ] **Step 3:** Commit `Add field page with strategy cards and timeline`.

### Task U4: Season drawer

**Files:** Create `web/src/components/SeasonDrawer.tsx`, `web/src/components/SoilWaterChart.tsx`; Test `web/src/components/SeasonDrawer.test.tsx`

**Interfaces:**
- Consumes: engine `replay` (with `withDaily: true`), `dayIndexToDate`; `formatDate`.
- Produces: `SeasonDrawer({ cell, season, crop, sowMonthDay, soil, onClose })`, opened by tapping a timeline icon; it shows crop, season, outcome, the death sentence `drawer.died` = `น่าจะตายราว {date}: {reason}` (reasons `reason.drought` = `ดินแห้งจนพืชขาดน้ำ`, `reason.heat` = `ร้อนจัดช่วงออกดอก`), and an SVG chart of `dr` against `raw` and `taw` with rain bars.

- [ ] **Step 1:** Tests (replay mocked: failed, deathDay = index of 2016-01-28 in season 2015): `drawer shows death date in Thai BE` → text contains `28 ม.ค. 2559`; `drawer shows English date in EN mode` → `28 Jan 2016`; `good outcome shows no death sentence`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS. Check at 360 px width in the dev server: no horizontal page scroll.
- [ ] **Step 3:** Commit `Add season drawer with soil-water chart`; push `lane/ui`.

---

## Part 5 — Integration and MVP release (M5, UI lane session, on `main`)

### Task I1: Merge, wire, verify, release

**Files:** Modify `README.md`; Create `web/src/pages/About.tsx` only if time allows (else link the README).

- [ ] **Step 1:** Merge into `main` in this order: `lane/engine`, `lane/pipeline`, `lane/ui`. Resolve conflicts only in files the merging lane owns. Run `cd pipeline && pytest -q` and `npm --prefix web test -- --run` → all pass.
- [ ] **Step 2:** Remove the UI tests' dependence on stubs where the real engine now exists (keep the mocks that pin layout). Run the web suite → PASS.
- [ ] **Step 3:** `npm --prefix web run dev`, open `#/field?lat=16.44&lon=102.83`: three cards, four rows, at least 20 season columns. Science sanity check (§14): mung bean `good` ≥ maize `good`. If not, record numbers in `docs/decisions.md` and inspect `crops.json` and constants before changing anything else.
- [ ] **Step 4:** Update `README.md`: what it does, live link, NASA data used with resolution and limits (§16), how to run (`web`, `pipeline`), AI-use statement, licence, "Not affiliated with or endorsed by NASA".
- [ ] **Step 5:** Commit `Wire MVP and update README`; push `main`; `gh run watch` → deploy succeeds.
- [ ] **Step 6:** Verify on a phone (or 360 px emulation) at `https://salapa0.github.io/ceres/#/field?lat=16.44&lon=102.83`: results within 3 s, numbers equal to the dev run. Tap the sea → outside message.
- [ ] **Step 7:** `git tag v0.1-mvp && git push origin v0.1-mvp`.

---

## After the MVP

P1 (M6–M9) and P2 (M10) get their own plan once `v0.1-mvp` is tagged, written from blueprint §13 with the same lane split.
