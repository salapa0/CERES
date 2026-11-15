# DEMETER Field Time Machine: handoff

**Written:** Sun 15 Nov 2026, early afternoon (Thailand time), after pull request 8 was merged.
**Live:** https://salapa0.github.io/demeter-fieldshift/ (deploys from `main` on every push and once a day).
**Code:** https://github.com/salapa0/demeter-fieldshift. Everything is on `main`; no feature branch is open.
**Deadline:** submit to NASA Space Apps by Sun 15 Nov 2026, 20:00 Thailand time (hard close 23:59).

This file is the single place to learn what exists, how it runs, and what to watch. The blueprint
(`docs/superpowers/specs/2026-11-14-field-time-machine-design.md`) is the original design; where the two disagree,
this file describes the app as built, and §10 lists every difference and why.

---

## 1. Status at a glance

| Area | State |
|---|---|
| App | Feature-complete for the submission. All P0 and P1 features of the blueprint are live except IMERG for past seasons (§12). |
| NASA data | NASA POWER history for all 194 grid cells over Thailand; GLDAS soil moisture in 185 of them (9 are mostly sea); IMERG rain and SMAP soil moisture for all 194, refreshed daily. |
| Tests | 70 web tests (Vitest), 10 pipeline tests (unittest). All pass on `main` (§3). |
| Operations | No one needs to run anything. One secret (`EARTHDATA_TOKEN`) is due to expire around mid-January 2027 (§6). |
| Open decision | Whether to present the app as covering all of Thailand rather than a Khon Kaen pilot, and how to handle the one-calendar limit for the south and the irrigated central plains (§11.2). |
| Human tasks left | Phone check, demo video, Space Apps project page, submit (§13). |

---

## 2. What the app does

A rice farmer, or an extension officer helping one, opens the page and taps their field on a map of Thailand (or
uses the my-location button). The app finds the NASA POWER grid cell around that point (0.5° × 0.625°, about
55 km) and answers one question: *if you had sown this crop on this date in each of the last 25 dry seasons, how
often would it have survived on the soil water and the rain that followed?*

What the user sees, top to bottom:

1. **In short:** the best option in one sentence, its sowing deadline, and how many waterings would make it safe.
2. **This season looks like…:** the three past seasons most like the one under way, from a live NASA POWER fetch.
3. **NASA satellite rain:** IMERG rain since 1 Aug beside the rain the model uses (POWER), over the same days.
4. **Soil now:** SMAP root-zone soil moisture on its latest day, and whether that is wetter or drier than on the same
   date in each year since 2015.
5. **Inputs:** sowing date, soil texture, field type (lowland paddy or upland), times you can water.
6. **Three strategy cards:** A keep today's rice → bare field; B the better legume (mung bean or peanut); C the
   better other crop (sunn hemp or field corn). Each card shows: survived N of 25 seasons; in years like this one;
   waterings needed; estimated income per rai at a standard price; the latest safe sowing date and days left; the
   effect on the soil; and under "More", the sowing-window chart, the confidence badge with its reasons, what the
   data cannot see, and what to ask the extension officer.
7. **Time machine timeline:** every crop in every past season. Tapping a season opens a drawer with the daily
   soil-water chart and the day and cause of failure. Under the timeline: the GLDAS self-check line.
8. **What-if sliders:** less rain or more heat applied to every past season (labelled "not a forecast").
9. **Sources footer**, **About page**, **Copy link** (the address holds the field and settings), English and Thai
   with Buddhist-era years.

---

## 3. Run, test, deploy

```bash
cd web
npm install
npm run dev        # http://localhost:5173/demeter-fieldshift/
npm test           # 70 tests in 10 files
npm run build      # typecheck + production build into web/dist
```

```bash
cd pipeline
python -m unittest test_build_imerg test_build_smap test_build_gldas   # 10 tests, no network
```

Local development has no IMERG or SMAP file (they are built in CI with the Earthdata secret and are git-ignored),
so those two lines do not appear on `localhost`. To see them locally, download the `github-pages` artifact of any
recent deploy run and copy `data/imerg/current.json` and `data/smap/current.json` into `web/public/data/`.

**Deploying** is automatic: every push to `main` runs `.github/workflows/deploy.yml`, which tests, fetches IMERG
and SMAP, builds and publishes to GitHub Pages. A deploy takes 10–15 minutes, most of it NASA downloads. Pull
requests run the same build without publishing.

> **Never re-run an old deploy run.** Re-running a past "Test and deploy" run publishes that run's old build over
> the live site (this happened once on 14 Nov). To redeploy, re-run the **latest** run on `main`, or push a commit.

---

## 4. How the data flows

```
                          built once, committed to the repo                     built on every deploy (CI, with the
                          ───────────────────────────────                     Earthdata secret), never committed
NASA POWER daily API ──► pipeline/build_history.py ──► web/public/data/grid.json        ───────────────────────────
                                                      web/public/data/cells/{id}.json   GES DISC OPeNDAP (IMERG)
Giovanni API (GLDAS) ──► pipeline/build_gldas.py  ──► adds `rootzone` to the cells        └► build_imerg.py ─► data/imerg/current.json
  (GLDAS workflow, by hand)                                                             NSIDC cloud OPeNDAP (SMAP)
                                                                                          └► build_smap.py ─► data/smap/current.json
fetched live by the browser
───────────────────────────
NASA POWER daily API (1 Aug → today, tapped cell) ──► "this season looks like…" (data.ts fetchCurrentSeason)
NASA POWER (whole history) only if a cell file is missing ──► data.ts fetchLiveCell
```

Every NASA source is averaged into the same POWER grid cell, so all numbers on a page refer to the same ~55 km box.

### Data files

| File | Built by | Contents | Size |
|---|---|---|---|
| `web/public/data/grid.json` | `build_history.py` | 194 cells (id, lat, lon), cell size, first and last season | small |
| `web/public/data/cells/{id}.json` | `build_history.py`, then `build_gldas.py` | `seasons[]` 2001–2025, each 1 Aug → 31 Jul daily: `rain` mm, `tmax`, `tmin` °C, `wetness` (POWER GWETROOT, 0–1), `rootzone` (GLDAS kg/m², 185 cells only); `wetnessScale` p05/p95; `sources` | ~220 KB each, 43 MB total |
| `web/public/data/imerg/current.json` | `build_imerg.py` (CI) | `start` (1 Aug), `asOf`, `cells: {id: [daily mm or null]}` | ~90 KB |
| `web/public/data/smap/current.json` | `build_smap.py` (CI) | `date`, `years` (2015…), `cells: {id: {now, past[]}}` in m³/m³ | small |
| `web/src/data/crops.json` | by hand | four crops: FAO-56 stages, Kc, root depth, p, heat limit, soil effect, sources, `market` price and yield | small |

The data contract in TypeScript is `web/src/engine/types.ts` (cells) and `web/src/data.ts` (`ImergFile`, `SmapFile`).

---

## 5. NASA and partner data

| Source | Product | Access route | Auth | Refresh | Used for |
|---|---|---|---|---|---|
| NASA POWER | Daily `PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `GWETROOT` (MERRA-2 based), 0.5° × 0.625° | `power.larc.nasa.gov/api/temporal/daily/point` | none | history once; current season live in the browser | All replays; look-alike seasons |
| GPM IMERG | Late Run daily V07 (`GPM_3IMERGDL`), 0.1° | GES DISC on-premises OPeNDAP, ASCII subset of the Thailand box, `gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDL.07/` | Earthdata token, `Authorization: Bearer` | every deploy + daily 01:30 UTC | Satellite rain line (F14) |
| SMAP | L4 Global 3-hourly 9 km (`SPL4SMGP` v8), `sm_rootzone` | Granules found through public CMR search; Thailand subset read from NSIDC cloud OPeNDAP (`opendap.earthdata.nasa.gov`, DAP2 `.ascii`) | Earthdata token, Bearer | every deploy + daily | Soil-now line (F15) |
| GLDAS | Noah 2.1 3-hourly (`GLDAS_NOAH025_3H`), `RootMoist_inst`, 0.25° | Giovanni time-series API, `api.giovanni.earthdata.nasa.gov/timeseries` (one point per request) | Earthdata token, Bearer (the `authorizationtoken` header in older examples is refused) | once, by hand (GLDAS workflow) | Self-check and High badge (F11) |
| FAO-56 | Tables 11, 12, 19, 22 | fao.org web edition | – | – | Crop and soil values |
| OAE (Thai Office of Agricultural Economics), TDRI | Farm-gate prices and yields | news releases, weekly prices | – | by hand | Income estimate |
| EOX | Sentinel-2 cloudless 2016, CC BY 4.0 | WMTS tiles | – | – | Satellite basemap |
| OpenStreetMap via OpenFreeMap | vector tiles | – | – | – | Street basemap |

**How each NASA cell value is made:** IMERG (0.1°) and SMAP (9 km) average the valid pixels whose centres lie inside
the POWER cell. GLDAS averages the 4–6 land pixels (0.25°) inside the cell, each turned into daily means from
3-hourly values. Ocean pixels and fill values are dropped.

---

## 6. Secrets and Earthdata access

- **One secret:** `EARTHDATA_TOKEN` in the repo's Actions secrets (added 15 Nov 2026, 02:32 UTC). It is an Earthdata
  Login user token belonging to a team member's Earthdata account. It is read only by `deploy.yml` and `gldas.yml`.
- **It expires.** Earthdata Login user tokens are normally valid for 60 days, so expect this one to stop working
  around **mid-January 2027**. Nothing breaks visibly: the IMERG and SMAP steps are allowed to fail, the deploy still
  publishes, and the app hides those two lines. The deploy log then shows HTTP 401 in "Fetch IMERG satellite rain"
  and "Fetch SMAP soil moisture".
- **To renew:** the account owner signs in at https://urs.earthdata.nasa.gov, opens **Generate Token**, creates a
  token, and pastes it into GitHub → repo **Settings → Secrets and variables → Actions → `EARTHDATA_TOKEN` →
  Update**. Then re-run the **latest** deploy run on `main`. Never paste the token into chat, an issue, a commit or a
  workflow file.
- **Applications the account has approved** (Earthdata profile → Applications): the GES DISC data archive
  (needed for IMERG and GLDAS). SMAP from NSIDC worked with the same token without a separate approval step.
- **A new account** needs the same: sign up at https://urs.earthdata.nasa.gov, approve the GES DISC application,
  generate a token, and replace the secret.

---

## 7. Workflows

### `deploy.yml`: Test and deploy to GitHub Pages
- **Triggers:** push to `main`, pull requests (build only), manual, and a daily schedule at 01:30 UTC (08:30 in
  Thailand) that keeps IMERG and SMAP current with no one on duty.
- **Steps:** `npm ci` → `npm test` → pipeline unit tests → **Fetch IMERG** (`continue-on-error`) → **Fetch SMAP**
  (`continue-on-error`) → `npm run build` → upload → deploy (only on `main`, not on pull requests).
- **Timing:** IMERG fetches 1 Aug → yesterday, about 105 days on 15 Nov, two days at a time; GES DISC answers HTTP 503
  when pushed harder. It took 6 minutes in the morning of 15 Nov and 11 minutes at midday. It needs 80 % of the days
  or it writes nothing. SMAP takes about a minute (about 96 small subsets).
- **A "success" does not prove the data came through.** Because the two fetch steps may fail, check their logs for
  `wrote …/imerg/current.json` and `wrote …/smap/current.json`.

### `gldas.yml`: GLDAS history (manual only)
- Past seasons do not change, so GLDAS is built once and committed. Run it again only after adding a season to the
  cell files.
- **How to run:** Actions → GLDAS history → Run workflow. It runs 6 parallel jobs (`--shard i/6`), each
  about 10 minutes, and uploads artifacts `cells-0` … `cells-5`.
- **How to bring the result into the repo:** `gh run download <run id> -D <dir>`, then copy every cell file whose
  `sources` contains `rootzone` into `web/public/data/cells/`, check that nothing but `rootzone` changed, and commit.
  The 15 Nov run was 43678147918.

---

## 8. The model (engine) in brief

All in `web/src/engine/`, pure TypeScript, no network. Values to tune are in `constants.ts`.

- **Replay** (`index.ts`, `replay`): for one crop, season and sowing date, a daily FAO-56 root-zone water balance.
  ET0 by Hargreaves (`et0.ts`); crop coefficient by the FAO-56 single-Kc curve; total available water
  `TAW = 1000 × (FC − WP) × root depth`; stress begins past `RAW = p × TAW`. The starting depletion comes from POWER
  root-zone wetness on the sowing day, scaled between the cell's 5th and 95th percentiles. Rain counts at 80 %.
  Lowland fields get capillary rise of up to 3.5 mm/day times that day's relative wetness.
- **Outcome:** *failed* after 7 days in a row of severe stress (Ks < 0.2) past the initial stage, or if less than
  half the water demand was met, or after 3 days above the crop's heat limit at flowering; *good* if at least 75 % was
  met; *poor* otherwise; *nodata* if a day is missing.
- **Odds:** good seasons ÷ seasons with data. **Strategies:** B and C each take the better of two crops; a tie goes
  to the first.
- **Sowing window** (F12): odds every 7 days from 1 Nov to 1 Feb; the latest date within 0.10 of the best odds that
  had at least one good season. **Days left** counts to it during the dry season.
- **Look-alike years** (`analog.ts`, F10): rain 1 Aug–31 Oct, rain 1 Nov → today, and root-zone wetness today, each
  standardised over the past seasons; the 3 nearest past seasons.
- **Waterings:** 30 mm each, given when the soil passes the stress line, at most once a week. "Waterings needed" is
  the fewest (up to 8) with which the crop survives 4 seasons in 5.
- **Income** (`income.ts`): good = full yield × price, poor = half, failed = 0, averaged over the seasons with data;
  plus a good-year figure. Income, not profit.
- **Self-check** (`selfcheck.ts`, F11): for each past season, mung bean sown on 15 Nov on the farmer's soil and field
  type. The *model dry-down day* is the first day past the stress point (Dr > RAW). The *GLDAS dry-down day* is the
  first day GLDAS root-zone moisture, scaled between its own 5th and 95th percentiles for the cell, falls below
  1 − p (the same stress point). Both are looked for only while the crop is in the field. They agree if within 14
  days of each other, or if neither dries. Hit rate = agreeing seasons ÷ seasons with data.
- **Confidence badge** (`badge` in `selfcheck.ts`): **Low** if fewer than 15 seasons have data, the hit rate is
  below 0.5, or the look-alike years split three ways. **High** if the hit rate is at least 0.75 and all three
  look-alike years gave this card's crop the same outcome. **Medium** otherwise, including every cell without GLDAS.
  The card lists every reason. High means the app is confident in its answer, which can be "this crop fails".

**Crops** (`web/src/data/crops.json`; every value has a source line, and all four are flagged as partly assumed):

| Crop | Stages ini/dev/mid/late (days) | Kc ini/mid/end | Root (m) | p | Heat limit | Market |
|---|---|---|---|---|---|---|
| Mung bean | 15/20/25/10 | 0.40/1.05/0.35 | 0.6 | 0.45 | 40 °C | 150 kg/rai (estimate) × ฿22.00, Feb 2026 |
| Peanut | 25/35/45/25 | 0.40/1.15/0.60 | 0.5 | 0.50 | 40 °C | 630 kg/rai × ฿26.41, May 2023 |
| Field corn | 20/35/40/30 | 0.30/1.20/0.60 | 1.0 | 0.55 | 38 °C | 748 kg/rai × ฿8.19, Aug 2025 |
| Sunn hemp | 15/35, ploughed in at flowering | 0.40/1.00 | 0.8 | 0.50 | none | no cash income (green manure) |

Defaults: sowing 15 Nov, loamy sand, lowland paddy, no waterings.

---

## 9. Feature register: what is done and how it was checked

| Feature | Where | Evidence |
|---|---|---|
| NASA POWER history, 194 cells, seasons 2001–2025 | `pipeline/build_history.py` | Run log: 194 ok, 0 failed |
| Replay engine, odds, strategies | `engine/index.ts`, `et0.ts` | 15 tests incl. the FAO-56 Ra example |
| Crop and soil values against FAO-56 | `crops.json`, `constants.ts` | Each source line quotes the table row (§10.10) |
| Sowing window and days left (F12) | `engine/index.ts`, cards B and C | 4 tests incl. "later sowing never raises odds in a steadily drying season"; browser |
| What-if sliders (F13) | `Results.tsx` `WhatIfPanel` | Test on the real Khon Kaen cell: 0.7 × rain or +3 °C never raises any crop's odds; browser |
| This season looks like… (F10) | `engine/analog.ts`, `data.ts` | 5 analog tests + parse test + 2 component tests; live: cell 16.50, 102.50 → data to 11 Nov 2026, looks like 2008, 2016, 2025 |
| Waterings and waterings needed | `engine/index.ts`, `Results.tsx` | 3 engine + 1 component test; cell 16.50, 102.50, defaults: sunn hemp 11 → 22 of 25 seasons with 2 waterings (rechecked 15 Nov afternoon) |
| Share link | `share.ts`, `App.tsx`, `Results.tsx` | 4 codec + 3 component tests; browser incl. the clipboard fallback. **Not tried in LINE or on a phone** |
| Income estimate | `engine/income.ts`, `crops.json` | 4 + 1 tests; Khon Kaen with 2 waterings: mung bean ≈ ฿330/rai average, ฿3,300 good year |
| IMERG satellite rain (F14) | `build_imerg.py`, `Results.tsx` `SatelliteRain` | 3 pipeline + 2 component tests; live site, cell 16.50, 103.13: IMERG 412 mm vs POWER 633 mm, 1 Aug → 12 Nov |
| GLDAS self-check and High badge (F11) | `build_gldas.py`, `engine/selfcheck.ts`, `Results.tsx` | 3 pipeline + 7 engine + 2 component tests. 185 cells: median hit rate 0.52 (middle half 0.36–0.64), 16 cells ≥ 0.75, 89 below 0.5. Browser: cell 16.50, 102.50 (Khon Kaen) 16 of 25, Medium; live site, cell 16.50, 103.13: 20 of 25, both cards High |
| SMAP soil now (F15) | `build_smap.py`, `data.ts` `loadSmap`, `Results.tsx` `SoilNow` | 4 pipeline + 2 component tests; CI wrote 10 Nov 2026 for 194 cells, past years 2015–2025; browser: cell 16.50, 102.50 "24% … drier than 9 of 11 past years", Thai checked; live site, cell 16.50, 103.13: "26% … drier than 10 of 11" |
| Tap → cell with nearest-cell snap | `data.ts` | 3 tests on the real grid |
| Satellite basemap (F16) | `MapView.tsx` | Licence read from EOX; tile viewed. **Not seen rendering in the browser** |
| My-location button (F1) | `App.tsx` | **Not tested** (no GPS in the preview browser) |
| About page (F17) | `About.tsx` | Component test in both languages; not reviewed visually |
| Layout at 375 px | `styles.css` | No sideways scroll; timeline scrolls in its own box |
| Live fallback when a cell file is missing | `data.ts` `fetchLiveCell` | CORS works; the missing-file path is not exercised |

**High-badge cells** (hit rate ≥ 0.75), useful for the demo: 16.50_103.125 (east of Khon Kaen), 16.00_103.750,
15.50_103.750, 15.50_104.375, 15.50_105.000, 15.00_103.750, 14.50_103.750, 14.00_100.000, 13.50_100.625,
10.00_98.750, 10.50_98.750, 8.00_99.375, 7.50_99.375, 7.50_100.000, 6.00_101.250, 5.50_101.250. A card shows High
only while the look-alike years also agree, so this can change as the season goes on.

---

## 10. Where the build differs from the blueprint, and why

1. **One screen, no router.** About is a toggle that hides the field page without unmounting it. The URL hash holds
   the field and settings for sharing.
2. **No Tailwind.** Plain CSS in `web/src/styles.css` with the blueprint's colour tokens.
3. **Engine layout:** `index.ts` plus `analog.ts`, `et0.ts`, `income.ts`, `selfcheck.ts`, `constants.ts`, `types.ts`.
4. **Pipeline is stdlib-only Python**, one script per source. POWER history was built locally; GLDAS, IMERG and SMAP
   run in GitHub Actions because only the repo secret holds the Earthdata token.
5. **Field type and groundwater.** With the blueprint's model alone, every crop failed in every year in Isan. The
   engine adds FAO-56 capillary rise for lowland fields (up to 3.5 mm/day × relative wetness). Default: lowland.
6. **Default sowing date is 15 Nov**, not 1 Dec.
7. **Outside-Thailand check** uses the grid only (within one cell of a Thai cell).
8. **Confidence badge** as in §8, with every reason listed.
9. **Wetness stored to 2 decimals**, to keep cell files small.
10. **FAO-56 check.** Mung bean Kc end 0.35 (dry-seed harvest). `clayLoam` uses Table 19's nearest row, "Silt clay
    loam". Root depths at the low end of Table 22, because paddies have a plough pan. Table 22's p adjustment for
    daily ETc is not applied.
11. **Look-alike years come from a live browser fetch**, not a daily `season/current.json`.
12. **Sowing window ignores dates where nothing survived**; otherwise a best of 1 in 25 would accept every date.
13. **English is the default language**, at the team's request.
14. **Satellite layer is EOX Sentinel-2 cloudless 2016**, the global CC BY year; 2017 is blank over Thailand and 2018
    onward is non-commercial.
15. **Waterings.** Leftover moisture alone could not carry three of four crops in the pilot area, and the challenge
    names water availability as a constraint, so the farmer can say how many times they can water. All four
    waterings constants are starting values.
16. **Self-check rule.** The blueprint compared the model's stress point with GLDAS's 25th percentile of 1 Nov–31 Mar.
    That is a much drier bar, and in many years the model is past its stress point on the sowing day; the median
    cell agreed in 8 % of seasons. Both now use the same stress point, each on its own scale (§8). This was changed
    once, for that reason, and not tuned afterwards. Both dry-down days are looked for only while the crop is in the
    field, because the model does not run outside it.
17. **GLDAS through Giovanni.** GES DISC shut down the Hydrology Data Rods service the blueprint named.
18. **IMERG and SMAP are checks shown beside the model; they do not drive it.** The replays still use POWER rain. SMAP
    is not a look-alike feature, as the blueprint says, because it starts in 2015.
19. **No cron writes data to the repo.** IMERG and SMAP are rebuilt on every deploy instead and never committed, so the
    repo history does not grow daily.

---

## 11. Known limits and risks (say these plainly in the pitch)

### 11.1 Science
- **The model is not calibrated.** Every value in `constants.ts` is a starting value. Patterns are sensible (Isan
  favours early sowing and short crops) but the odds are not facts. Mung bean fails almost every season in Isan.
- **The data is a 55 km average.** A single field can be wetter or drier.
- **The self-check is modest.** The median cell agrees with GLDAS in about half of past seasons, so most cards show
  Medium or Low. GLDAS is a land model driven by satellite data, not a field measurement. This is a consistency check
  between two models, not a validation against farms.
- **IMERG sees less rain than POWER this season** in the north-east (cell 16.50, 103.13: 412 vs 633 mm to 12 Nov), and
  SMAP says the soil there is drier than in 10 of 11 past years on the same date. The replays use POWER, so they may be optimistic this
  season. Nobody has checked which source is closer to rain gauges.
- **Crop values:** Thai mung bean stage lengths, all heat limits and all sunn hemp values are assumptions; the cards
  say so. The mung bean yield is an estimate; the peanut price dates from 2022/23.
- **The premise is unconfirmed:** nobody has asked an Isan farmer whether water risk is what stops them planting.

### 11.2 Coverage: the whole of Thailand, one calendar
The data covers all 194 cells, so the app works anywhere in Thailand. The model uses one crop calendar everywhere:
seasons start on 1 Aug and sowing runs 1 Nov–1 Feb (default 15 Nov). That fits rain-fed rice in the north-east,
north and much of the centre. It does not fit:
- **the southern east coast** (Nakhon Si Thammarat, Songkhla, Pattani), where the monsoon peaks October–December and
  rice is harvested around February–March. A 15 Nov sowing lands in the rains, which is why the south looks "mostly
  safe": the app answers the wrong question there;
- **the irrigated central plains**, where many farmers grow a second rice crop with canal water and soils are clay.
  The waterings input covers part of this; the default soil is Isan's loamy sand.

Options: state the limit in the app and the pitch (about 10 minutes), or add regional sowing calendars and defaults
(about 2 hours with tests: sowing dates to March, default date and soil by region).

### 11.3 Operations
- **The Earthdata token expires around mid-January 2027** (§6). After that the IMERG and SMAP lines disappear.
- **GES DISC's on-premises OPeNDAP** (IMERG) is due to move to Earthdata Cloud "no earlier than 30 Sep 2026". When it
  goes, the IMERG step fails and the line disappears until `build_imerg.py` points at the cloud OPeNDAP, as
  `build_smap.py` already does.
- **GES DISC is slow under load:** IMERG returns HTTP 503 with more than two parallel requests.
- **Repo size:** the data adds about 43 MB (33 MB POWER, 10 MB GLDAS). The JS bundle is about 1 MB (MapLibre).

---

## 12. Not done

| Item | Blueprint ref | Effort | Notes |
|---|---|---|---|
| Regional sowing calendars | – | ~2 h | See §11.2 |
| IMERG Final for past seasons' rain, driving the replays | F14 (history half) | ~3 h of downloads + review | About 9,000 more daily files; would change every result, so it needs its own check |
| IMERG through Earthdata Cloud OPeNDAP | – | ~30 min | Before the on-premises server closes |
| Token-expiry warning | – | ~30 min | e.g. fail loudly or open an issue when both fetch steps return 401 |
| MODIS vegetation check | F19 | – | ORNL service was down on 14 and 15 Nov |
| AI chat, SRTM | F18, F20 | – | P2 |
| Specific citations for the soil-effect text | §10.2 | – | About page links only the Land Development Department home page |
| Real-phone check of the share link in LINE, my-location, satellite toggle | – | ~15 min | Human |

---

## 13. Before 20:00 today

1. Open the live site on a real phone: tap a field, change settings, Copy link and open it in LINE, try my-location
   and the satellite toggle.
2. Decide the coverage framing (§11.2) and update `docs/SUBMISSION.md` and the video script to match.
3. Record the 2-minute video from the script in `docs/SUBMISSION.md`. Cell 16.50, 103.13 (`#lat=16.5&lon=103.125`) shows a
   High badge, the IMERG line and the SMAP line; the Khon Kaen cell 16.50, 102.50 shows Medium.
4. Fill in the Space Apps project page from `docs/SUBMISSION.md` and submit.

---

## 14. Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Satellite rain or soil-now line missing on the live site | That fetch step failed in the last deploy | Open the latest deploy run → "Fetch IMERG satellite rain" / "Fetch SMAP soil moisture". 401: renew the token (§6). 503 or timeouts: re-run the latest run later. |
| Live site shows an old version | Someone re-ran an old deploy run | Re-run the latest run on `main` |
| No self-check line on a field | The cell has no GLDAS land pixels (9 coastal cells) | Expected |
| Badge never reaches High on a field | Hit rate below 0.75, or look-alike years disagree, or no current-season data | Expected; see the card's reasons |
| "This season looks like…" says it could not load | NASA POWER live API down or slow | Nothing to fix; it comes back on reload |
| GLDAS request returns 401 "Failed validating user token" | Wrong header | Use `Authorization: Bearer`, not `authorizationtoken` |
| SMAP OPeNDAP returns empty CSV | DAP4 CSV is empty for these files | Use DAP2 `.ascii`, as `build_smap.py` does |

---

## 15. File map

```
.github/workflows/deploy.yml        test, fetch IMERG + SMAP, build, deploy; daily 01:30 UTC
.github/workflows/gldas.yml         GLDAS history, manual, 6 shards
pipeline/build_history.py           NASA POWER → grid.json, cells/*.json (stdlib only)
pipeline/build_gldas.py             Giovanni GLDAS → `rootzone` in cells/*.json
pipeline/build_imerg.py             GES DISC IMERG → data/imerg/current.json (CI only)
pipeline/build_smap.py              NSIDC SMAP → data/smap/current.json (CI only)
pipeline/test_build_*.py            pipeline tests, using real server responses as fixtures
pipeline/data/thailand.geo.json     coarse Thailand outline for picking cells
web/public/data/grid.json           194 cells
web/public/data/cells/*.json        25 seasons of daily data per cell
web/src/engine/index.ts             replay, odds, strategies, sowing window, waterings
web/src/engine/analog.ts            look-alike seasons (F10)
web/src/engine/selfcheck.ts         GLDAS self-check and confidence badge (F11)
web/src/engine/income.ts            income estimate
web/src/engine/et0.ts               Hargreaves ET0, extraterrestrial radiation
web/src/engine/constants.ts         every tunable value
web/src/engine/types.ts             data contract for cells and results
web/src/data/crops.json             crop values with sources and market prices
web/src/data.ts                     loading, tap → cell, live POWER, IMERG and SMAP loaders
web/src/share.ts                    share-link encoding
web/src/Results.tsx                 summary, NASA lines, inputs, cards, timeline, drawer, what-if
web/src/App.tsx, MapView.tsx        page shell, map, satellite toggle, my location
web/src/About.tsx                   About page
web/src/i18n.ts                     every English and Thai string, date formats
docs/SUBMISSION.md                  project page text, video script, checklist
docs/superpowers/specs/             blueprint and the income design
```

---

## 16. History

| PR | Branch | What it added |
|---|---|---|
| 1 | `build/mvp-core` | Data pipeline, replay engine, three cards, timeline, drawer |
| 2, 3 | `build/p1-features` | Sowing window, what-if, look-alike years, satellite basemap, my location, About, FAO-56 check, team design |
| 4 | `build/submission-polish` | Waterings and waterings needed; submission kit |
| 5 | `build/share-link` | Share link and Copy link |
| 6 | `build/income-estimate` | Income estimate at standard prices |
| 7 | `build/earthdata` | IMERG satellite rain (F14), Earthdata secret, daily schedule |
| 8 | `build/selfcheck-smap` | GLDAS self-check and High badge (F11), SMAP soil now (F15), GLDAS history in the cell files |
