# DEMETER — Field Time Machine: Blueprint

**Status:** design, approved choices recorded below. Supersedes `docs/superpowers/plans/2026-11-14-demeter-fieldshift.md` (old Streamlit plan) and the feature table in `README.md`.
**Event:** NASA Space Apps Challenge 2026, challenge *Field Shift: Adapting Farms with NASA Data*.
**Deadline:** submit by **Sun 15 Nov 2026, 20:00** Thailand time (hard close 23:59).
**Deliverable:** an MVP prototype hosted on **GitHub Pages** from `salapa0/demeter-fieldshift`.

---

## 0. How to use this document (AI developers read first)

1. Read sections 1–5 once to understand the product and the words used.
2. Work **milestone by milestone** in section 13, in order. A milestone is done only when every item in its **Done when** list is true and you have run the check it names.
3. Sections 6–12 are reference: look up the contract, formula or screen you need while working.
4. When this document and the code disagree, this document wins until a human changes it. When this document is silent, make the smallest reasonable choice, write it in `docs/decisions.md` (one line: date, choice, reason), and continue.
5. Items marked **[CALIBRATE]** are starting values, chosen by the designer. Keep them in `web/src/engine/constants.ts` so they can be tuned in one place.

---

## 1. The product in one paragraph

After the wet-season rice harvest, a rain-fed rice farmer in Thailand must decide whether to plant a second crop on the moisture left in the soil, which crop, and by when. Getting it wrong loses money on seed and labour; staying cautious leaves the field bare, earns nothing, and leaves sandy soil unimproved. **DEMETER's Field Time Machine** lets the farmer tap their field on a map and then **replays every past dry season since 2001, day by day, for each candidate crop** using NASA data. It shows which seasons each crop would have survived, the day and reason it would have died, how well the model agrees with satellite soil moisture, which past seasons **this** season resembles, and the latest safe sowing date. It compares three strategies, always including today's "rice then bare field", and shows each strategy's effect on soil. Thai first, honest about its limits, a support for the farmer's judgement, never a replacement.

### Pain points it answers (for the pitch and the About page)

| Pain point | Effect if left alone | What DEMETER gives |
|---|---|---|
| The farmer does not know the odds that a dry-season crop survives on *their* field | Either a failed crop and debt, or no second crop at all: no dry-season income, soil unimproved, family members leave to find work | Odds per crop from every past season, with the day and cause of each failure |
| The leftover soil moisture runs out after harvest and nobody can see how fast | Sowing too late wastes the whole season; a missed season means waiting a full year | Latest safe sowing date and days left |
| Advice feels generic and untested | Farmers distrust it | A visible self-check against NASA satellite soil moisture, and past seasons the farmer remembers |

These pain points are the designer's reading of rain-fed farming in Isan and still need confirming with at least one farmer (see section 16).

---

## 2. Goals, non-goals, anti-goals

**Goals**
- G1. Any tap on Thai land returns three strategy cards and the season timeline in under 3 seconds on a phone.
- G2. Every number on screen names its data source and resolution.
- G3. Replays run in the browser, so what-if sliders and sowing-date changes respond instantly.
- G4. The demo works from the public GitHub Pages URL with no login for the visitor.

**Non-goals (this hackathon)**
- Yield in kg/rai, prices, or profit calculations.
- Irrigated farming, cassava (an 8–12 month crop, not a post-rice catch crop) and vegetables (need irrigation).
- Climate projections. Sliders are labelled "what-if", never "forecast".
- Accounts, saved fields, offline mode, notifications.

**Anti-goals (failure even if it technically works)**
- Advice that sounds certain. Every card shows a confidence badge and blind spots.
- Painting fallow land as farmer failure. "Rice then bare" is shown neutrally as today's choice.
- A pretty page whose numbers cannot be traced to a NASA dataset.

---

## 3. Constraints

- **Hosting:** GitHub Pages only, which serves static files. No server code runs at request time.
- **Secrets:** the Earthdata login exists only as GitHub Actions secrets `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD`, used by the data pipeline. Never in the web bundle, never committed.
- **Language:** Thai is the default UI language; English is a toggle. All UI text lives in `web/src/i18n/th.json` and `en.json`.
- **Dates:** in Thai mode show Buddhist Era years (CE + 543), e.g. season 2015 → "2558/59".
- **Tests run offline:** pipeline tests use recorded fixtures in `pipeline/tests/fixtures/`; web tests use small synthetic data.
- **Data list:** only datasets on the challenge resource list, plus the map basemaps named in section 7.
- **Licence:** MIT (designer's call; team may change). Not affiliated with or endorsed by NASA.

---

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **Static site on GitHub Pages + Python pipeline in GitHub Actions + replay engine in TypeScript in the browser** | Matches "hosted on GitHub"; keeps the Earthdata secret server-side in Actions; instant sliders. Data must be precomputed per grid cell. | **Chosen** |
| Python API (FastAPI) + React frontend | Live data for any point, but needs a separate server host, which breaks "hosted on GitHub". | Rejected |
| Streamlit, all Python | Fastest data wiring, but hard to make warm and custom, wastes the team's frontend strength, and needs a server. | Rejected |

Other recorded decisions from the team conversation (Q1–Q20):
- **User:** an Isan smallholder. **Channel:** web app. **Scope:** all of Thailand. **Field input:** tap the map.
- **Headline horizon:** this dry season. **Lead benefit:** less risk.
- **Comparison:** three cards. **Honesty:** confidence badge. **Look:** warm farm. **Proof:** backtest against history.
- **AI chat:** added only after the core works (P2).
- **Earthdata login:** one team login, stored as Actions secrets.

---

## 5. Glossary (use these words in code, UI keys and commits)

| Word | Meaning |
|---|---|
| **cell** | One NASA POWER / MERRA-2 grid box, 0.5° lat × 0.625° lon. All data is stored per cell. The id is `f"{lat:.2f}_{lon:.3f}"` of its centre, e.g. `16.50_102.500`. |
| **season** | A dry season, labelled by the CE year it starts in. Season 2015 = stored days 1 Aug 2015 → 31 Jul 2016, so a crop sown as late as 1 Feb can finish inside the data. **Past seasons** are complete ones since 2001; the **current season** is the one whose 1 Aug start is the most recent (in June and July that is still the season that began the previous August). |
| **sowing date** | The calendar day (month-day) the crop is sown. The same month-day is applied to every past season. Default 1 Dec. |
| **replay** | Running the soil-water model for one crop, one season, one sowing date, day by day. |
| **outcome** | The result of a replay: `good`, `poor` or `failed`, plus `deathDay` and `reason` when failed. |
| **odds** | Good outcomes ÷ number of past seasons, shown as "21 จาก 25 ฤดู". |
| **strategy** | One of three cards: A today (rice → bare), B legume, C other crop. |
| **analog** | A past season whose early conditions resemble the current season's. |
| **self-check** | The comparison of the model's soil dry-down day with the satellite soil-moisture dry-down day, season by season. |
| **sowing window** | The latest sowing date that keeps odds close to their best. |
| **what-if** | User-applied changes to rain (×) and temperature (+°C) across all seasons. |
| **badge** | The confidence label on a card: สูง / กลาง / ต่ำ (High / Medium / Low). |

---

## 6. Architecture

```
            GitHub Actions (Python pipeline, has Earthdata secrets)
 ┌──────────────────────────────────────────────────────────────────┐
 │ data-history.yml  (manual run + yearly on 5 Aug to add the season │
 │                    that just closed)                              │
 │   NASA POWER ─┐                                                   │
 │   GLDAS ──────┼─► build cells/{id}.json  (past seasons, daily)    │
 │   IMERG Final ┘                                                   │
 │ data-season.yml   (daily cron 01:00 UTC)                          │
 │   NASA POWER (recent) + IMERG Late + SMAP L4 ─► season/current.json│
 │ deploy.yml        (on push to main)                               │
 │   test pipeline + web ─► build web ─► publish to GitHub Pages     │
 └──────────────────────────────────────────────────────────────────┘
                                   │ static JSON + JS
                                   ▼
            Browser (React app on GitHub Pages)
 ┌──────────────────────────────────────────────────────────────────┐
 │ Map tap ─► snap to cell ─► fetch cells/{id}.json + current.json   │
 │        ─► replay engine (TypeScript) ─► cards, timeline, window   │
 │ Sliders / sowing date ─► re-run engine locally (no network)       │
 └──────────────────────────────────────────────────────────────────┘
```

**Deploy trigger:** a commit pushed by a workflow with `GITHUB_TOKEN` does not start other workflows. So `deploy.yml` is a reusable workflow (`on: [push, workflow_call]`), and both data workflows call it as their last job after committing data. Data workflows need `permissions: contents: write`; deploy needs `pages: write, id-token: write`.

**Single source of truth:** the replay engine exists **only** in TypeScript (`web/src/engine/`). The Python pipeline prepares data and never computes outcomes.

### Repository layout

```
demeter-fieldshift/
├─ README.md
├─ LICENSE
├─ docs/
│  ├─ superpowers/specs/2026-11-14-field-time-machine-design.md   (this file)
│  ├─ data-access.md        (written in M0: verified endpoints, quirks)
│  └─ decisions.md          (one line per builder decision)
├─ pipeline/                (Python 3.11)
│  ├─ pyproject.toml
│  ├─ demeter_pipeline/
│  │  ├─ grid.py            (Thailand cells)
│  │  ├─ power.py           (NASA POWER client)
│  │  ├─ gldas.py           (GLDAS root-zone history)
│  │  ├─ imerg.py           (IMERG Final / Late)
│  │  ├─ smap.py            (SMAP L4 current root zone)
│  │  ├─ build_history.py   (writes cells/*.json, grid.json)
│  │  └─ build_season.py    (writes season/current.json)
│  └─ tests/ (+ fixtures/)
├─ web/                     (Vite + React + TypeScript)
│  ├─ public/data/          (pipeline output, committed)
│  │  ├─ grid.json
│  │  ├─ thailand.geojson
│  │  ├─ cells/{id}.json
│  │  └─ season/current.json
│  └─ src/
│     ├─ engine/            (et0.ts, kc.ts, replay.ts, outcomes.ts, analog.ts,
│     │                      selfcheck.ts, window.ts, strategies.ts, constants.ts)
│     ├─ data/crops.json    (crop parameters with sources)
│     ├─ i18n/th.json, en.json
│     ├─ components/        (Map, StrategyCard, Timeline, SeasonDrawer, WhatIf,
│     │                      SowingWindow, Badge, SourcesFooter, ChatDrawer[P2])
│     └─ pages/             (Home, Field, About)
└─ .github/workflows/ (deploy.yml, data-history.yml, data-season.yml)
```

**Stack (designer's calls):** Vite + React 18 + TypeScript, Tailwind CSS, MapLibre GL JS, Vitest + Testing Library; pipeline uses `requests`, `numpy`, `pandas`, `xarray`, `h5py`, `shapely`, `earthaccess`, `pytest`. Charts are hand-built SVG (the timeline and the soil-water chart are simple), so there is no chart library.

---

## 7. Data sources

| ID | Dataset | Product / version | Used for | Resolution, period | Access | Priority |
|---|---|---|---|---|---|---|
| D1 | **NASA POWER** daily point API, community `AG` | params `PRECTOTCORR, T2M_MAX, T2M_MIN, GWETROOT` | Replay weather (rain, Tmax, Tmin), starting soil wetness, analog features | 0.5° × 0.625°, daily since 1981 | Open, no login. `https://power.larc.nasa.gov/api/temporal/daily/point` | **P0** |
| D2 | **GLDAS Noah** land surface model | `GLDAS_NOAH025_3H` v2.1, `RootMoist_inst` | Self-check: satellite-informed root-zone dry-down per past season | 0.25°, 3-hourly since 2000 | Earthdata; point time series via GES DISC Hydrology Data Rods (verify in M0) | P1 |
| D3 | **GPM IMERG Final** daily | `GPM_3IMERGDF` V07 | Replaces POWER rain in **all** past seasons together (sharper local rain). Days after Final ends are filled from IMERG Late, and the cell's `sources.rain` says so. Rain is never mixed with POWER inside one build, so odds stay comparable across seasons. After the switch, rerun the section 14 sanity check | 0.1°, daily since 1998; currently ends ~Oct 2025 | Earthdata, GES DISC (OPeNDAP or earthaccess) | P1 |
| D4 | **GPM IMERG Late** daily | `GPM_3IMERGDL` V07 | Current-season rain (analog features) | 0.1°, about 1 day lag | Earthdata | P1 |
| D5 | **SMAP L4** root-zone soil moisture | `SPL4SMGP` **version 8** | Current-season root-zone moisture at the cell (analog feature + "soil now" display) | 9 km, 3-hourly since 31 Mar 2015 | Earthdata, NSIDC (HDF5) | P1 |
| D6 | **MODIS NDVI** | `MOD13Q1` C6.1 | Second self-check: vegetation stress in seasons the replay calls failures | 250 m, 16-day since 2000 | ORNL DAAC MODIS subset REST API, no login | P2 |
| D7 | **SRTM** | `SRTMGL1` | Lowland vs upland adjustment of starting moisture | 30 m | Earthdata | P2 |
| D8 | **FAO-56** (Allen et al. 1998, *Crop evapotranspiration*, FAO Irrigation and Drainage Paper 56) | Tables 11, 12, 19, 22; eq. 21, 52 | Crop stages, Kc, root depth, depletion fraction p, soil water, ET0 | — | Public document | **P0** |
| D9 | **FAO GAEZ** | crop requirement / suitability | Cross-check crop parameters and heat limits | — | Open portal | P1 |

**Basemaps (display only, attribution required in the map corner):**
- Streets and labels: OpenFreeMap (no key).
- Satellite toggle: EOX Sentinel-2 cloudless WMTS (ESA Copernicus Sentinel-2 data). M0 checks the licence of the chosen year layer; if it is unclear, use the NASA GIBS MODIS true-colour layer instead.

**Why each NASA source:** POWER is the long, gap-free daily record with no account, so it is the backbone. GLDAS gives satellite-informed root-zone moisture for every past season to test the replay honestly. IMERG is the best NASA rain estimate at field-relevant scale. SMAP is the only satellite product measuring the moisture roots actually reach, right now. MODIS shows real vegetation stress across the same years. SRTM explains why low paddies stay wet longer.

---

## 8. Data contracts (pipeline → web)

All JSON. Numbers rounded to 1 decimal (rain, temperature) or 3 decimals (wetness, moisture). Missing values are `null`, never -999.

### `grid.json`
```json
{
  "version": 1,
  "cellSize": { "lat": 0.5, "lon": 0.625 },
  "generated": "2026-11-14T20:00:00Z",
  "cells": [ { "id": "16.50_102.500", "lat": 16.5, "lon": 102.5 } ]
}
```
A cell is included when its box intersects the Thailand polygon (`thailand.geojson`, simplified Natural Earth admin-0, public domain).

### `cells/{id}.json`
```json
{
  "id": "16.50_102.500", "lat": 16.5, "lon": 102.5,
  "sources": {
    "rain": "NASA POWER PRECTOTCORR (0.5°×0.625°)",
    "temp": "NASA POWER T2M_MAX/T2M_MIN (0.5°×0.625°)",
    "wetness": "NASA POWER GWETROOT (MERRA-2)",
    "rootzone": "GLDAS Noah 2.1 RootMoist (0.25°)"
  },
  "wetnessScale": { "p05": 0.31, "p95": 0.82 },
  "seasons": [
    {
      "year": 2015,
      "start": "2015-08-01",
      "rain":    [0.0, 3.2, ...],
      "tmax":    [33.1, ...],
      "tmin":    [23.0, ...],
      "wetness": [0.71, ...],
      "rootzone":[312.4, ...]
    }
  ]
}
```
- Each daily array runs from `start` (1 Aug) to 31 Jul (365 days, or 366 when the season contains 29 Feb). Index 0 = 1 Aug. A replay whose crop season would run past the last index is marked `nodata`; with sowing dates up to 1 Feb this does not happen for the crops in section 10.
- `rootzone` (GLDAS, kg/m², daily mean) appears from M7 on; it is absent in the P0 build.
- `wetnessScale` = 5th and 95th percentiles of all stored `wetness` values for the cell.
- Only complete past seasons are stored here.

### `season/current.json`
```json
{
  "asOf": "2026-11-13",
  "season": 2026,
  "cells": {
    "16.50_102.500": {
      "rain": [...], "tmax": [...], "tmin": [...], "wetness": [...],
      "smapRootzone": 0.284,
      "sources": { "rain": "GPM IMERG Late V07 (0.1°, mean over cell)", "smap": "SMAP L4 SPL4SMGP v8 (9 km)" }
    }
  }
}
```
Arrays run from 1 Aug of the current season to `asOf`. P0 fills them from POWER; P1 swaps rain to IMERG Late and adds `smapRootzone`.

---

## 9. Science specification (engine, TypeScript)

All functions are pure and unit-tested. Day-of-year `J` and latitude `φ` (radians) come from the cell.

### 9.1 Reference evapotranspiration (Hargreaves, FAO-56 eq. 52)
```
ET0 = 0.0023 × (Tmean + 17.8) × sqrt(max(Tmax − Tmin, 0)) × 0.408 × Ra      [mm/day]
Tmean = (Tmax + Tmin) / 2
```
`Ra` = extraterrestrial radiation (MJ m⁻² day⁻¹), FAO-56 eq. 21:
```
Ra = (24·60/π) · 0.0820 · dr · [ωs·sinφ·sinδ + cosφ·cosδ·sin ωs]
dr = 1 + 0.033·cos(2πJ/365);  δ = 0.409·sin(2πJ/365 − 1.39);  ωs = arccos(−tanφ·tanδ)
```
Test value: FAO-56 Example 8, latitude 20°S on 3 September gives Ra ≈ 32.2 MJ m⁻² day⁻¹.

### 9.2 Crop coefficient curve (FAO-56 single Kc)
For a crop with stage lengths `Lini, Ldev, Lmid, Llate` (days) and `KcIni, KcMid, KcEnd`: constant `KcIni` through initial; linear to `KcMid` across development; constant `KcMid` through mid-season; linear to `KcEnd` across late season. Season length = sum of the stages.

### 9.3 Soil water bucket (FAO-56 chapter 8, root-zone depletion)
```
TAW = 1000 × (θFC − θWP) × Zr           [mm]   Zr = crop max root depth (m)
RAW = p × TAW
Dr(0) = (1 − wRel) × TAW
wRel = clamp((wetness[sowDay] − p05) / (p95 − p05), 0, 1)
Each day i after sowing:
  Peff = RAIN_EFFECTIVE_FRACTION × rain[i]
  Ks   = 1                                  if Dr ≤ RAW
       = (TAW − Dr) / ((1 − p) × TAW)        otherwise
  ETc  = Kc(i) × ET0(i);  ETa = Ks × ETc
  Dr   = clamp(Dr − Peff + ETa, 0, TAW)
```
- Soil texture sets θFC and θWP from FAO-56 Table 19 (use the midpoints of its ranges): `sand`, `loamy sand` (default for Isan), `sandy loam`, `loam`, `clay loam`. The farmer may change the texture; show it as "ดินของคุณ".
- **What-if** applies before the loop: `rain × rainFactor`, `tmax + dT`, `tmin + dT`.

### 9.4 Outcome of one replay
```
RET = ΣETa / ΣETc over the whole crop season
kill run   = first run of ≥ KILL_DAYS consecutive days with Ks < KILL_KS after the initial stage
heat days  = days in the critical window with tmax > crop.heatC
critical window = first half of the mid-season stage (flowering / pod set)

failed  if kill run exists, or RET < FAIL_RET, or heat days ≥ HEAT_DAYS_FAIL
good    if not failed and RET ≥ GOOD_RET
poor    otherwise
deathDay = first day of the kill run (or first heat day past the limit); reason = "drought" | "heat"
```
If any input day inside the crop season is `null`, mark the outcome `nodata` and leave it out of the odds denominator.

**Green manure rule (sunn hemp, `"greenManure": true` in `crops.json`):** the crop is ploughed in at the start of flowering, so its season ends at the end of the development stage plus `crop.incorporateAfterDevDays` (designer's start value 0 **[CALIBRATE]**), and the heat rule is skipped. RET, the kill run and the outcome are computed over that shorter season only.

### 9.5 Constants **[CALIBRATE]** (`constants.ts`)
| Name | Start value | Why |
|---|---|---|
| `RAIN_EFFECTIVE_FRACTION` | 0.8 | Some rain runs off or evaporates from the surface |
| `KILL_KS` | 0.2 | Severe water stress |
| `KILL_DAYS` | 7 | A week of severe stress after establishment kills short-season crops |
| `GOOD_RET` | 0.75 | Most of the water demand met |
| `FAIL_RET` | 0.50 | Less than half met |
| `HEAT_DAYS_FAIL` | 3 | Repeated heat at flowering |
| `ANALOG_K` | 3 | Nearest past seasons |
| `SELFCHECK_TOLERANCE_DAYS` | 14 | Dry-down dates within two weeks count as agreeing |
| `SELFCHECK_PERCENTILE` | 25 | GLDAS dry-down threshold |
| `WINDOW_TOLERANCE` | 0.10 | Odds drop allowed when finding the latest safe sowing date |

### 9.6 Odds
`odds(crop, sowDate, whatIf) = good / (count of non-nodata past seasons)`. Display "N จาก M ฤดู" and also the poor and failed counts.

### 9.7 Analog seasons (this-season match)
Features for every past season and for the current season, measured up to the current `asOf` month-day:
- `f1` total rain 1 Aug → 31 Oct (wet-season tail)
- `f2` total rain 1 Nov → `asOf` (skip this feature when `asOf` is before 1 Nov)
- `f3` POWER `wetness` on `asOf`. SMAP is **not** used as an analog feature (its units and its 2015 start do not match the 2001+ POWER record); SMAP appears only in the "ดินตอนนี้" (soil now) display.

Standardise each feature by the past seasons' mean and standard deviation, take the Euclidean distance, and pick the `ANALOG_K` nearest. **This-season odds** = good outcomes among the analogs. Show the analog years (in BE in Thai mode). The current season is never an analog of itself.

### 9.8 Self-check (P1, needs `rootzone`)
For each past season and the default sowing date:
- **Model dry-down day:** first day after sowing when Dr > RAW in the mung bean replay with no what-if.
- **Satellite dry-down day:** first day after sowing when GLDAS `rootzone` falls below the cell's `SELFCHECK_PERCENTILE`-th percentile of 1 Nov–31 Mar values.
- They **agree** if both occur within `SELFCHECK_TOLERANCE_DAYS` of each other, or neither occurs before 31 Mar.
- **Hit rate** = agreeing seasons ÷ seasons with data. Display: "ตรงกับข้อมูลดาวเทียม 20 จาก 25 ฤดู".

### 9.9 Sowing window (P1)
Sweep sowing dates from 1 Nov to 1 Feb in 7-day steps. For each date compute the odds for the chosen crop. `best` = max odds. Latest safe date = the latest date whose odds ≥ `best − WINDOW_TOLERANCE`. During the current season, days left = latest safe date − today (show "เลยกำหนดแล้ว" when negative).

### 9.10 Badge
- **ต่ำ / Low:** fewer than 15 non-nodata seasons, or hit rate < 0.5, or analogs split (no outcome shared by ≥ 2 of 3).
- **สูง / High:** hit rate ≥ 0.75 and all analogs share the same outcome. Unavailable before self-check exists (P0 shows at most Medium).
- **กลาง / Medium:** everything else.
The badge tooltip lists the reasons in one line each.

---

## 10. Crops and strategies

### 10.1 Crop list (`web/src/data/crops.json`)

| id | Thai | English | Parameter source |
|---|---|---|---|
| `mungbean` | ถั่วเขียว | Mung bean | FAO-56 nearest legume entry; say which in `sources` |
| `peanut` | ถั่วลิสง | Peanut | FAO-56 "Groundnut" |
| `maize` | ข้าวโพดเลี้ยงสัตว์ | Field corn | FAO-56 "Maize (grain)" |
| `sunnhemp` | ปอเทือง | Sunn hemp (green manure) | No FAO-56 entry: use a cited agronomy source, else mark `"assumption": true` |

Each crop record:
```json
{
  "id": "peanut", "nameTh": "ถั่วลิสง", "nameEn": "Peanut",
  "stages": { "ini": 0, "dev": 0, "mid": 0, "late": 0 },
  "kc": { "ini": 0, "mid": 0, "end": 0 },
  "rootDepthM": 0, "p": 0, "heatC": 0,
  "soilEffect": "nitrogen",
  "sources": ["FAO-56 Table 11 ...", "FAO-56 Table 12 ...", "FAO-56 Table 22 ..."],
  "assumption": false
}
```
Fill every number from the cited table. Choose the stage lengths FAO-56 gives for a tropical or dry-season planting where it offers several. Every crop needs at least one source; values without one must carry `"assumption": true`, and the UI then shows "ค่าประมาณ".

### 10.2 Soil effect (shown on cards, not scored)
| `soilEffect` | Thai label | Applies to |
|---|---|---|
| `nitrogen` | เพิ่มไนโตรเจนให้ดิน | mung bean, peanut |
| `organic` | เพิ่มอินทรียวัตถุและไนโตรเจน (ไถกลบ) | sunn hemp |
| `uses` | ใช้ธาตุอาหารจากดิน | field corn |
| `bare` | ดินว่าง ไม่มีพืชคลุม | strategy A |
Each label links to a one-paragraph explanation on the About page, with a citation the builder finds (for example FAO or Thai Land Development Department material on green manure).

### 10.3 Strategies (three cards, always in this order)
- **A — ทำแบบเดิม (rice → bare).** Shows: no crop risk, no dry-season income, soil effect `bare`. No odds.
- **B — ปลูกถั่ว (rice → legume).** The legume (mung bean or peanut) with the higher odds; a tie goes to mung bean. The other legume is named as "ทางเลือกใกล้เคียง".
- **C — พืชอื่น (rice → other).** Field corn or sunn hemp, whichever has the higher odds.
A card shows: title, crop, odds (big), this-season odds from analogs (P1), soil effect, sowing window (P1), badge, "สิ่งที่ข้อมูลมองไม่เห็น" (blind spots, 2–3 bullets), and "ควรถามเจ้าหน้าที่เกษตร" (1–2 questions for the local extension officer).

Standard blind spots (pick those that apply): the cell is about 55 km wide, so it averages many fields; soil texture is the farmer's choice, not measured; pests, prices and labour are not modelled; the satellite record covers only seasons since 2001.

---

## 11. Screens and look

### 11.1 Style ("warm farm")
| Token | Value | Use |
|---|---|---|
| `--straw` | `#F6EBD3` | page background |
| `--soil` | `#6B4A2B` | headings, text |
| `--leaf` | `#4F8A3C` | good outcome, primary button |
| `--sun` | `#E0A526` | poor outcome, highlights |
| `--clay` | `#B5523B` | failed outcome |
| `--sky` | `#5B8DB8` | rain, links |
| `--paper` | `#FFFDF7` | cards |
Fonts: **Noto Sans Thai** for UI and **Noto Serif Thai** for headings (Google Fonts). Rounded cards (12 px), soft shadows, large tap targets (min 44 px), mobile-first (360 px width). Outcome icons: 🌱 good, 🍂 poor, ✖ failed, · no data. Pair every colour with an icon so it works for colour-blind users.

### 11.2 Home / map screen
```
┌───────────────────────────────────────┐
│ DEMETER  ไทม์แมชชีนแปลงนา      [TH|EN] │
│ ฤดูแล้งนี้ ปลูกอะไรดี? แตะที่นาของคุณ  │
│ ┌───────────────────────────────────┐ │
│ │        (map of Thailand)          │ │
│ │            📍 tap here            │ │
│ │                    [ดาวเทียม|แผนที่]│ │
│ └───────────────────────────────────┘ │
│ [ 📍 ใช้ตำแหน่งของฉัน ]                │
│ ข้อมูลจาก NASA POWER · GPM · SMAP ...  │
└───────────────────────────────────────┘
```
A tap outside Thailand shows: "ตอนนี้รองรับเฉพาะพื้นที่ในประเทศไทย".

### 11.3 Field screen (main screen)
```
┌───────────────────────────────────────────────┐
│ ← แปลงของคุณ · ขอนแก่น (16.50, 102.50)          │
│ วันปลูก [1 ธ.ค. ▾]   ดินของคุณ [ดินร่วนปนทราย ▾] │
│ ฤดูนี้คล้ายปี 2547, 2558, 2562                 │
├───────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────┐ ┌─────────────┐   │
│ │A ทำแบบเดิม│ │B ปลูกถั่วเขียว │ │C ปลูกปอเทือง  │   │
│ │ ดินว่าง   │ │ รอด 21/25 ฤดู│ │ รอด 17/25 ฤดู│   │
│ │ ไม่มีรายได้│ │ ปีแบบนี้ 3/3  │ │ ปีแบบนี้ 2/3  │   │
│ │          │ │ +ไนโตรเจน    │ │ +อินทรียวัตถุ │   │
│ │          │ │ ปลูกภายใน 20 ธ.ค.│ ปลูกภายใน 10 ธ.ค.│
│ │          │ │ ความมั่นใจ: กลาง│ │ ความมั่นใจ: กลาง│
│ └─────────┘ └─────────────┘ └─────────────┘   │
├───────────────────────────────────────────────┤
│ ไทม์แมชชีน: ถ้าปลูกในปีที่ผ่านมา                │
│            44 45 46 ... 58 59 ... 62 ... 68    │
│ ถั่วเขียว   🌱 🌱 🌱 ...  ✖  🌱 ... 🌱 ... 🌱    │
│ ถั่วลิสง    🌱 🍂 🌱 ...  ✖  🌱 ... 🌱 ... 🌱    │
│ ข้าวโพด    🌱 ✖  🌱 ...  ✖  ✖  ...  ✖ ... 🌱    │
│ ปอเทือง    🌱 🌱 🍂 ...  ✖  🌱 ... 🌱 ... 🌱    │
│ ตรงกับข้อมูลดาวเทียม 20 จาก 25 ฤดู              │
├───────────────────────────────────────────────┤
│ ถ้าฟ้าเปลี่ยน (ไม่ใช่การพยากรณ์)                 │
│ ฝน   [−30% ─────●── +10%]  อุณหภูมิ [+0 ●── +3°C]│
├───────────────────────────────────────────────┤
│ ข้อมูลจาก: NASA POWER (0.5°×0.625°) · GLDAS ... │
└───────────────────────────────────────────────┘
```
On a phone the cards stack and the timeline scrolls sideways, with the crop names kept fixed on the left.

### 11.4 Season drawer (tap a timeline icon)
```
┌───────────────────────────────────────────────┐
│ ข้าวโพด · ฤดู 2558/59 · ✖ ไม่รอด                 │
│ น่าจะตายราว 28 ม.ค. 2559: ดินแห้งช่วงออกดอก       │
│ ความชื้นดินในเขตราก (SVG line) ─── เส้นขาดน้ำ     │
│ ▂▁ ▃  ▁  (rain bars)                           │
│ ข้อมูลดาวเทียม: ดินแห้งราว 22 ม.ค. ✓ ตรงกัน       │
└───────────────────────────────────────────────┘
```

### 11.5 About page
Sections: how the time machine works (plain Thai with diagrams), the data and its resolution, what it cannot see, soil-effect explanations with citations, AI-use statement, credits ("Not affiliated with or endorsed by NASA").

---

## 12. Feature list

| ID | Feature | Priority |
|---|---|---|
| F1 | Map with tap-to-cell and "outside Thailand" message; my-location button | P0 |
| F2 | Replay engine (ET0, Kc, bucket, outcomes, odds) | P0 |
| F3 | Three strategy cards with odds, soil effect, blind spots, officer questions, badge (max Medium) | P0 |
| F4 | Time-machine timeline (crops × past seasons) | P0 |
| F5 | Season drawer with soil-water chart and death reason | P0 |
| F6 | Sowing date and soil texture inputs | P0 |
| F7 | Thai/English toggle, BE years | P0 |
| F8 | Sources footer on every screen | P0 |
| F9 | GitHub Pages deploy + history data for all Thai cells from POWER | P0 |
| F10 | Analog seasons + this-season odds (POWER features, daily cron) | P1 |
| F11 | Self-check vs GLDAS, hit rate, High badge enabled | P1 |
| F12 | Sowing window and days left | P1 |
| F13 | What-if sliders | P1 |
| F14 | IMERG rain (Final for history, Late for current) | P1 |
| F15 | SMAP current root zone in analogs and "ดินตอนนี้" display | P1 |
| F16 | Satellite basemap toggle | P1 |
| F17 | About page | P1 |
| F18 | "ถามว่าทำไม" AI chat (Claude) calling engine functions | P2 |
| F19 | MODIS NDVI second self-check | P2 |
| F20 | SRTM lowland adjustment | P2 |

---

## 13. Build order (milestones)

The schedule is a target against the deadline. **P0 is the MVP; submit it even if nothing after M5 lands.**

### Team setup: parallel AI agents (decided by the team)
- **M0 and M1 run first, in one session, on `main`.** M1 also commits `web/public/data/sample/` with one hand-made cell file and a `current.json` that follow section 8 exactly. Those files are the frozen contract the lanes build against.
- **Then three agent sessions run at once, each on its own branch and in its own worktree:**

| Lane | Branch | Milestones | Owns these paths only |
|---|---|---|---|
| Pipeline | `lane/pipeline` | M2 → M6 (pipeline half) → M7 (pipeline half) → M9 (pipeline half) | `pipeline/`, `.github/workflows/data-*.yml`, `web/public/data/` (except `sample/`) |
| Engine | `lane/engine` | M3 → M6 (`analog.ts`) → M7 (`selfcheck.ts`) → M8 (engine half) | `web/src/engine/`, `web/src/data/crops.json` |
| UI | `lane/ui` | M4 → M6/M7/M8/M9 (UI halves) | `web/src/components/`, `web/src/pages/`, `web/src/i18n/`, styles |

- **Merge points:** (1) **M5**: the lanes merge into `main` once M2, M3 and M4 are all done. The UI lane does the wiring and the release. (2) After **M8**, merge again. (3) After **M9**, final merge before Submit. At each merge, every test suite passes on `main` before anyone continues.
- **Contract changes:** a lane that needs a change to section 8 stops, says so in its PR description, and waits for the change to be merged to `main` first. A lane never edits another lane's paths.
- Each lane records its own decisions in `docs/decisions.md` under a heading with its lane name, to avoid merge conflicts.

### M0 — Access spikes (Sat evening, ~1 h)
- Fetch one real sample from each source: POWER (D1) for Khon Kaen 16.44, 102.83; GLDAS data rods (D2); IMERG Late (D4); SMAP L4 v8 (D5); ORNL MODIS (D6). Save them as fixtures.
- Write `docs/data-access.md`: the exact working URL or call, auth needed, response shape, quirks (fill values, time zones, units).
- Check the EOX Sentinel-2 cloudless layer licence.
**Done when:** each source has a fixture file and a section in `data-access.md`, or a written "blocked: why" line. A blocked P1 source moves that feature to "not in this build".

### M1 — Scaffold and live page (Sat night)
- Create the `web/` Vite React TS app with Tailwind, Vitest, i18n files and style tokens; `pipeline/` package with pytest; `LICENSE` (MIT); `.github/workflows/deploy.yml` (run both test suites, build web with base path `/demeter-fieldshift/`, deploy to Pages).
- Enable Pages with source "GitHub Actions" (`gh api -X POST repos/salapa0/demeter-fieldshift/pages -f build_type=workflow`, or Settings → Pages). The repo is already public.
- Add the repo secrets `EARTHDATA_USERNAME` and `EARTHDATA_PASSWORD` (a human does this; agents never handle the password).
**Done when:** `npm test` and `pytest` both pass in CI, and the public Pages URL shows the Thai placeholder header from `th.json`.

### M2 — Grid and history data from POWER (pipeline lane)
- `grid.py`: cells intersecting Thailand; also writes `thailand.geojson`.
- `power.py`: daily point fetch with retries; -999 → null; a disk cache in Actions.
- `build_history.py`: `grid.json` and `cells/{id}.json` for seasons 2001 → last complete one; `wetnessScale`.
- `data-history.yml`: manual workflow that runs the build and commits `web/public/data/`.
**Done when:** tests pass for fill values, season slicing (29 Feb included), and cell selection (Khon Kaen in, a Gulf of Thailand point out, Vientiane out); the workflow has run and committed files; one cell file validates against section 8.

### M3 — Replay engine (engine lane)
- `et0.ts`, `kc.ts`, `replay.ts`, `outcomes.ts`, `strategies.ts`, `constants.ts`, `crops.json` filled with cited values.
**Done when:** Vitest passes for: the Ra test value (9.1); ET0 is 0 when Tmax = Tmin; the Kc curve at each stage boundary; the bucket never leaves [0, TAW]; a wet synthetic season → `good`; a zero-rain season from a dry start → `failed` with reason `drought` and a deathDay; a heat-only season → `failed` with reason `heat`; null days → `nodata` excluded from odds; strategy B tie → mung bean; identical inputs → identical outputs.

### M4 — Field screen MVP (UI lane)
- Map (F1), cards (F3), timeline (F4), drawer (F5), inputs (F6), language toggle and BE years (F7), sources footer (F8).
**Done when:** Testing Library tests cover: tapping a Thai cell renders three cards and four timeline rows; tapping outside Thailand shows the message; switching to EN changes the card titles; season 2015 shows as 2558/59 in Thai. Manual check on a 360 px viewport: no horizontal page scroll; the timeline scrolls inside its box.

### M5 — MVP release (Sun ~12:00)
- Wire M2 data + M3 engine + M4 UI, deploy, update `README.md` (what it does, data and limits, how to run, AI-use statement).
**Done when:** on the public URL from a phone, tapping 16.44, 102.83 shows cards and the timeline within 3 s; numbers match a local `npm run dev` run; tag `v0.1-mvp`.

### M6 — This-season match (F10)
- `build_season.py` + `data-season.yml` daily cron writing `season/current.json` from POWER; `analog.ts`; analog years on the field screen and the "ปีแบบนี้" odds on cards.
**Done when:** analog tests pass (a season identical to a past one picks it first; features are standardised; `f2` is skipped before 1 Nov); the cron run has committed `current.json`.

### M7 — Self-check (F11)
- `gldas.py` adds `rootzone` to cell files; `selfcheck.ts`; hit rate line under the timeline; badge High enabled.
**Done when:** tests cover agreement within tolerance, "neither dries" counting as agreement, and missing rootzone giving no hit rate (badge stays at most Medium).

### M8 — Sowing window and what-if (F12, F13)
**Done when:** tests show later sowing never raises odds in a synthetic steadily-drying season; the window date is the latest within tolerance; a rain factor of 0.7 never raises any crop's odds versus 1.0; sliders re-render in under 200 ms on a mid-range phone (profile once).

### M9 — Sharper NASA data (F14, F15, F16, F17)
- IMERG Final into history rain and IMERG Late into current rain (cell mean of 0.1° pixels); SMAP v8 root zone into `current.json`; satellite basemap toggle; About page.
**Done when:** `sources` strings in the JSON name IMERG and SMAP and the footer shows them; the pipeline tests pass with IMERG/SMAP fixtures.

### M10 — Stretch (P2, only if M9 is done by Sun 16:00)
- F18 chat: needs a decision from the team (see section 17). When building it, load the `claude-api` skill first.
- F19 MODIS NDVI check; F20 SRTM lowland adjustment.

### Submit (Sun 17:00 → 20:00)
- Final deploy, README, ≤ 2 min demo video on the live URL, Space Apps project page, tag `v1.0-submission`, **submit by 20:00**.

---

## 14. Testing and verification rules

- Every engine function has unit tests; every pipeline module has fixture-based tests. No test touches the network.
- CI (`deploy.yml`) blocks deploy when any test fails.
- Before saying a milestone is done, run its check and paste the command and its output into the PR or commit message body.
- Science sanity check after M5 (human or agent): for Khon Kaen with default inputs, mung bean odds should come out at least as high as field corn odds. If not, inspect `crops.json` and the constants before changing anything else.

---

## 15. Challenge alignment checklist

| Challenge asks or suggests | Where |
|---|---|
| Decision-support tool using NASA Earth observations | D1–D7, sections 7 and 9 |
| Local soil information | Soil texture input (9.3), soil effect (10.2) |
| Crop characteristics | `crops.json` from FAO-56 (10.1) |
| Farmer priorities and constraints | Sowing date, soil texture, choosing among strategies; risk-first framing |
| Compare at least three rotation strategies including the existing one | Cards A/B/C (10.3) |
| For each: why, evidence, benefits, gaps, risks needing local review | Card contents, drawer, blind spots, officer questions |
| Highlight seasons when crops are vulnerable / bare periods | Timeline (F4), sowing window (F12) |
| Soil health: nitrogen fixing, organic matter | Soil effect row (10.2) |
| AI or statistical pattern finding; uncertainty explained | Analogs (9.7), self-check (9.8), badge (9.10) |
| Harmonising datasets of different resolutions | POWER cell as the common grid; IMERG/SMAP/GLDAS averaged into it (M9) |
| Scenario sliders for rainfall and temperature | What-if (F13) |
| Supports, not replaces, farmer judgement | Badge, blind spots, "ask your officer", About page |

---

## 16. Risks and limits (also shown to users on the About page)

- The bucket model checks water and heat only; it does not predict yield, pests or prices.
- A cell averages a large area; one farm can differ a lot, especially low paddies that stay wet longer.
- POWER rain and GWETROOT come from models that blend satellite and ground data; IMERG and SMAP improve this in M9.
- Crop parameters come from international tables, not Thai field trials; sunn hemp values may be assumptions.
- **Unverified premise:** that water risk and timing are the main reasons farmers leave fields bare. Someone on the team should ask one Isan farmer: "หลังเกี่ยวข้าวเสร็จ อะไรทำให้ไม่ปลูกพืชอื่นต่อ?" If the answer is markets or labour, raise it with the team before M6.

---

## 17. Decisions

### Made by the team
Approach (section 4), AI chat after the core works, one stored Earthdata login, MVP on GitHub Pages, built by parallel AI agents in three lanes (section 13).

### Made by the designer (check these)
- Grid = POWER/MERRA-2 cell (0.5° × 0.625°); all other data averaged into it.
- Seasons since 2001 to match the GLDAS, IMERG and MODIS records.
- Default sowing date 1 Dec; default soil texture loamy sand.
- Crops: mung bean, peanut, field corn, sunn hemp. Cassava and vegetables are left out.
- All constants in 9.5.
- Stack in section 6; MIT licence; OpenFreeMap + EOX basemaps.
- Seasons stored 1 Aug → 31 Jul, so late sowings finish inside the data.
- SMAP is display-only ("soil now"); analogs use POWER wetness for all three features.
- IMERG replaces POWER rain for all past seasons at once, with IMERG Late filling after Final ends.
- Sunn hemp is judged only until it is ploughed in at flowering, with no heat rule.
- Data workflows call the deploy workflow directly; history data is rebuilt yearly on 5 Aug.

### Still open (do not block the MVP)
- **F18 AI chat:** GitHub Pages cannot hold an API key. Options: a small Cloudflare Worker proxy holding the key, with a rate limit; or drop the chat. The team decides before M10.
- **Long-term zero-ops:** the daily cron already refreshes data unattended; renewing the Earthdata login remains manual.

### Left to the builder
Component structure inside `components/`, Tailwind details, exact Thai wording beyond the keys shown (keep it short and plain), retry and back-off values, how the GLDAS 3-hourly series becomes daily means.
