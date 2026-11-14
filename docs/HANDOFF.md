# DEMETER Field Time Machine: handoff and progress report

**Last updated:** Sat 14 Nov 2026, night. **Branch:** `build/p1-features` (pushed, PR open to `main`, not deployed).
**Deadline:** submit by Sun 15 Nov 2026, 20:00 Thailand time (hard close 23:59).

Read this first, then the blueprint (`docs/superpowers/specs/2026-11-14-field-time-machine-design.md`) for the full design. Where the two disagree about what exists today, this file is right.

## 1. Status in one paragraph

The MVP core (`build/mvp-core`) is merged to `main`. On top of it, `build/p1-features` adds the sowing window (F12), what-if sliders (F13), this-season look-alike years (F10, live from NASA POWER), a satellite basemap toggle (F16), a my-location button (F1), an About page (F17), and crop and soil values checked against the FAO-56 tables. English is now the default language, with a Thai toggle. **The site is still not live:** the first deploy on `main` failed because GitHub Pages is not enabled for the repository, and only a repo admin can enable it (see §7, step 1). Styling is still functional only.

## 2. How to run it

```bash
cd web
npm install
npm run dev        # open http://localhost:5173/demeter-fieldshift/
npm test           # 39 tests
npm run build      # typecheck + production build into web/dist
```

Rebuild the NASA data (optional; it is already committed, about 33 MB):

```bash
python pipeline/build_history.py            # all 194 cells, skips files that exist, ~10 min
python pipeline/build_history.py --limit 1  # just the Khon Kaen pilot cell
```

## 3. What is done and verified

| Piece | Where | Verified by |
|---|---|---|
| NASA POWER history for all 194 grid cells touching Thailand, seasons 2001–2025 | `pipeline/build_history.py` → `web/public/data/grid.json`, `cells/*.json` | Run log: 194 ok, 0 failed |
| Replay engine: Hargreaves ET0, FAO-56 Kc curve, root-zone water balance, outcomes, odds, strategies | `web/src/engine/index.ts` | 15 unit tests, incl. FAO-56 Ra example value |
| Crop and soil values checked against FAO-56 Tables 11, 12, 19, 22 (fao.org web edition, 14 Nov) | `web/src/data/crops.json`, `engine/constants.ts` | Each `sources` line quotes the table row and range it used; see §5.10 |
| Sowing window (F12): sweep 1 Nov → 1 Feb every 7 days, latest date within 0.10 of the best odds, days left | `engine/index.ts` (`sowingWindow`, `latestSafe`, `daysLeft`), cards B and C | 4 tests incl. "later sowing never raises odds in a steadily drying season"; checked in the browser |
| What-if sliders (F13): rain −30 % … +10 %, temperature +0 … +3 °C | `Results.tsx` (`WhatIfPanel`) | Test: 0.7 × rain or +3 °C never raises any crop's odds on the real Khon Kaen cell; component test; checked in the browser |
| This season looks like… (F10): 3 nearest past seasons on Aug–Oct rain, rain since 1 Nov, root-zone wetness; "years like this" odds on cards; analog years marked on the timeline; badge drops to Low when analogs split | `engine/analog.ts`, `data.ts` (`fetchCurrentSeason`) | 5 analog tests + parse test + 2 component tests; live in the browser: cell 16.00, 103.13 → data to 11 Nov 2026, looks like 2025, 2016, 2008 |
| Tap → cell, with nearest-cell snap for islands and border tips | `web/src/data.ts` | 3 tests on the real grid |
| Satellite basemap toggle (F16): EOX Sentinel-2 cloudless 2016, CC BY 4.0, under the labels | `MapView.tsx` | Licence read from EOX's WMTS capabilities; tile over Khon Kaen fetched and viewed. **The 2016 layer was not seen rendering in the browser** (an earlier try with the 2017 layer showed blank land, which is why it was swapped) |
| My-location button (F1) | `App.tsx` | **Not tested**: the preview browser has no GPS |
| About page (F17): method, data, limits, soil effects, AI use, credits | `About.tsx`, `i18n.ts` | Component test in both languages; not reviewed visually |
| Screen: map, inputs, 3 cards, timeline, drawer, sources footer, English/Thai, Buddhist-era dates | `App.tsx`, `Results.tsx`, `i18n.ts` | Component tests; manual check at 375 px: no sideways page scroll, timeline scrolls in its own box |
| Live fallback: if a cell file is missing, the browser fetches NASA POWER directly | `data.ts` (`fetchLiveCell`) | CORS works (the live current-season fetch uses the same API); the missing-file path itself is still not exercised |

## 4. What is NOT done

| Item | Blueprint ref | Notes |
|---|---|---|
| **Enable GitHub Pages and deploy** | M1/M5 | Needs a repo **admin** (the `ZENLIK02` account has write access only). Settings → Pages → Source: **GitHub Actions**, then re-run the failed "Test and deploy" run on `main`, or merge this PR. |
| Self-check against GLDAS satellite soil moisture; "High" confidence badge | F11 | Needs Earthdata login as repo secrets `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD` (a human adds them) |
| IMERG rain, SMAP soil moisture | F14, F15 | Same Earthdata secrets |
| Daily cron writing `season/current.json` | F10 / M6 | Replaced by a live browser fetch, see §5.11 |
| AI chat, MODIS check, SRTM | F18–F20 | P2 |
| Styling and visual design | §11 | Deliberately minimal; the team owns this. Known nit: odds are green even at "0 of 25" |
| Citations for the soil-effect text | §10.2 | About page links the Land Development Department home page for green manure; the team should add a specific document |
| Demo video, Space Apps project page | Submit | Human tasks |

## 5. Where the build differs from the blueprint and plan

Decisions made during the build. Change them freely, but know they were deliberate.

1. **One screen, no router.** Map and results share a page; state is not in the URL. About is a toggle that hides the field page without unmounting it.
2. **No Tailwind.** Plain CSS in `web/src/styles.css` with the blueprint's colour tokens, so the team can restyle with any tool.
3. **Engine is one file** (`engine/index.ts`, now with the sowing window) plus `analog.ts`, `et0.ts`, `constants.ts`, `types.ts`.
4. **Pipeline is one stdlib-only Python script** (no pandas/shapely) and was run locally, not in GitHub Actions. There are no data workflows yet.
5. **"Field type" input and groundwater supply.** With the blueprint's model alone, every crop failed in every year in Isan. The engine adds FAO-56 capillary rise: `CAPILLARY_RISE_MAX_MM` (lowland 3.5 mm/day, upland 0) × that day's relative NASA root-zone wetness. Default field type is lowland.
6. **Default sowing date is 15 Nov**, not 1 Dec.
7. **Outside-Thailand check** uses the grid only (within one cell of a Thai cell).
8. **Confidence badge:** Low (< 15 seasons, or the look-alike years split 1-1-1) or Medium. High needs F11.
9. **Wetness is stored to 2 decimals**, not 3, to keep cell files at about 176 KB.
10. **FAO-56 check (new).** Mung bean Kc end is now 0.35 (Table 12 value for a dry-seed harvest; it was 0.6, the fresh-harvest value). FAO-56 Table 19 has no "clay loam" row, so `clayLoam` now uses its nearest row, "Silt clay loam" (FC 0.335, WP 0.205). Root depths stay at the low end of each Table 22 range, because the footnote reserves the larger values for soils without layering and paddies have a plough pan; switching to the larger values would make every crop look safer. Field corn keeps Kc end 0.60 (harvest at high grain moisture). Other values already matched. Not adopted: the Table 22 footnote adjustment of p for daily ETc.
11. **Look-alike years come from a live fetch, not a cron (new).** The browser asks NASA POWER for 1 Aug → today for the tapped cell and keeps days up to the last one with every value (POWER runs about 3 days behind). No `season/current.json` and no daily workflow. If the fetch fails, the page says so and the cards show no "years like this" line.
12. **Sowing window ignores dates where nothing survived (new).** With best odds below the 0.10 tolerance (for example 1 of 25), the blueprint rule would have accepted every date. A date now needs at least one good season to count.
13. **English is the default language (new),** at the team's request; Thai is one tap away.
14. **Satellite layer is EOX Sentinel-2 cloudless 2016 (new).** It is the global CC BY 4.0 year. The 2017 layer is also CC BY but blank over Thailand; 2018 onward is CC BY-NC-SA.

## 6. Known limits and risks (be honest about these in the pitch)

- **The model is not calibrated.** All thresholds in `web/src/engine/constants.ts` and the groundwater number are starting values. Results show sensible patterns (the rainy south is mostly safe, Isan favours early sowing and short crops), but the exact odds should not be quoted as facts. Mung bean in particular fails almost every season in Isan in this model.
- **Crop values:** checked against FAO-56 (§5.10), but Thai mung bean stage lengths (70 days), all heat limits and every sunn hemp value are still assumptions, and the cards say so.
- **Data is a 55 km average** from NASA POWER (MERRA-2 based). No direct satellite soil moisture or rain yet.
- **The premise is unconfirmed:** nobody has yet asked an Isan farmer whether water risk is what stops them planting after rice.
- **Repo size:** the data adds about 33 MB. The JS bundle is about 1 MB (MapLibre); Vite warns about it.

## 7. Suggested next steps, in order

1. **Repo admin:** enable Pages (Settings → Pages → Source: GitHub Actions). Then merge the `build/p1-features` PR (CI runs the tests on the PR) and check the live URL on a phone: `https://salapa0.github.io/demeter-fieldshift/`.
2. Check the satellite toggle and the my-location button on a real phone.
3. Styling pass (team).
4. Earthdata features (F11, F14, F15) if someone adds the secrets and time allows.
5. 2-minute video, Space Apps project page; submit by 20:00 Sunday.

## 8. File map

```
pipeline/build_history.py        NASA POWER → web/public/data (stdlib only)
pipeline/data/thailand.geo.json  coarse Thailand outline (johan/world.geo.json)
web/public/data/grid.json        194 cells
web/public/data/cells/*.json     25 seasons of daily rain, tmax, tmin, wetness per cell
web/src/engine/index.ts          replay engine, odds, strategies, sowing window
web/src/engine/analog.ts         look-alike past seasons (F10)
web/src/engine/*.test.ts         engine, window, analog tests (types.ts is the data contract)
web/src/data/crops.json          crop parameters with FAO-56 sources
web/src/data.ts                  loading, tap → cell, live POWER fallback, live current season
web/src/Results.tsx              cards, sowing window, timeline, drawer, chart, what-if sliders
web/src/App.tsx, MapView.tsx     page shell, MapLibre map, satellite toggle, my location
web/src/About.tsx                About page
web/src/i18n.ts                  all English/Thai text and date formats
.github/workflows/deploy.yml     test + build + deploy to Pages (ran once on main; deploy step failed, Pages off)
```
