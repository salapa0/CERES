# DEMETER Field Time Machine: handoff and progress report

**Last updated:** Sat 14 Nov 2026, evening. **Branch:** `build/mvp-core` (local only, not pushed, not deployed).
**Deadline:** submit by Sun 15 Nov 2026, 20:00 Thailand time (hard close 23:59).

Read this first, then the blueprint (`docs/superpowers/specs/2026-11-14-field-time-machine-design.md`) for the full design. Where the two disagree about what exists today, this file is right.

## 1. Status in one paragraph

The core works end to end on a developer machine: tap a field on the map of Thailand, and the app replays 25 past dry seasons (2001/02 to 2025/26) for four post-rice crops using real NASA POWER data, shows three strategy cards (today's rice → bare, best legume, best other crop), a season-by-season timeline, and a drawer with the soil-water chart and the day and cause of failure. Thai is the default language, with an English toggle. Styling is functional only. Nothing is on GitHub yet.

## 2. How to run it

```bash
cd web
npm install
npm run dev        # open http://localhost:5173/demeter-fieldshift/
npm test           # 22 tests
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
| Replay engine: Hargreaves ET0, FAO-56 Kc curve, root-zone water balance, outcomes, odds, strategies | `web/src/engine/` | 15 unit tests, incl. FAO-56 Ra example value |
| Tap → cell, with nearest-cell snap for islands and border tips | `web/src/data.ts` | 3 tests on the real grid |
| Live fallback: if a cell file is missing, the browser fetches NASA POWER directly | `web/src/data.ts` (`fetchLiveCell`) | CORS header checked; **code path not exercised in a browser** |
| Screen: map, inputs (sowing date, soil, field type), 3 cards, timeline, season drawer, sources footer, Thai/English, Buddhist-era dates | `web/src/App.tsx`, `Results.tsx`, `MapView.tsx`, `i18n.ts` | 4 component tests + manual check in the browser with real data, no console errors |

Manual check on 14 Nov: a tap in Sakon Nakhon/Udon area (cell 17.50, 103.125), sowing 15 Nov, loamy sand, lowland → mung bean survived 1 of 25, sunn hemp 15 of 25, peanut and field corn 0 of 25; the drawer opened for sunn hemp 2562/63 (failed, 41 % of water need).

## 4. What is NOT done

| Item | Blueprint ref | Notes |
|---|---|---|
| Push to GitHub and deploy to GitHub Pages | M1/M5 | `.github/workflows/deploy.yml` is written but has never run. Needs Pages enabled with source "GitHub Actions". |
| Analog seasons ("this season looks like…") | F10 | Needs current-season data + `analog.ts` |
| Self-check against GLDAS satellite soil moisture; "High" confidence badge | F11 | Needs Earthdata login as repo secrets |
| Sowing window ("plant by…", days left) | F12 | Engine can already replay any sowing date; needs a sweep + UI |
| What-if sliders (rain, temperature) | F13 | Engine supports `whatIf`; only the UI is missing |
| IMERG rain, SMAP soil moisture | F14, F15 | Earthdata login needed |
| Satellite basemap, About page, my-location button | F16, F17, F1 | |
| AI chat, MODIS check, SRTM | F18–F20 | P2 |
| Styling and visual design | §11 | Deliberately minimal; the team owns this |
| README update, demo video, Space Apps project page | Submit | |

## 5. Where the build differs from the blueprint and plan

Decisions made during the build. Change them freely, but know they were deliberate.

1. **One screen, no router.** Map and results share a page; state is not in the URL.
2. **No Tailwind.** Plain CSS in `web/src/styles.css` with the blueprint's colour tokens, so the team can restyle with any tool.
3. **Engine is one file** (`engine/index.ts`) plus `et0.ts`, `constants.ts`, `types.ts`.
4. **Pipeline is one stdlib-only Python script** (no pandas/shapely) and was run locally, not in GitHub Actions. There are no data workflows yet.
5. **"Field type" input and groundwater supply (new, important).** With the blueprint's model alone, every crop failed in every year in Isan, because stored soil water in sandy soil cannot carry a 70–125 day crop through a rainless dry season. That is realistic for upland fields but not for paddies with a shallow water table. So the engine adds FAO-56 capillary rise: `CAPILLARY_RISE_MAX_MM` (lowland 3.5 mm/day, upland 0) × that day's relative NASA root-zone wetness. Default field type is lowland.
6. **Default sowing date is 15 Nov**, not 1 Dec; later sowing fails almost everywhere in Isan in this model.
7. **Outside-Thailand check** uses the grid only (a tap must be within one cell of a Thai cell); there is no polygon test in the browser. Taps just off the coast or just across a border are accepted.
8. **Confidence badge** is only Low (< 15 seasons) or Medium, as the blueprint says for P0.
9. **Wetness is stored to 2 decimals**, not 3, to keep cell files at about 176 KB.

## 6. Known limits and risks (be honest about these in the pitch)

- **The model is not calibrated.** All thresholds in `web/src/engine/constants.ts` and the groundwater number are starting values. Results show sensible patterns (the rainy south is mostly safe, Isan favours early sowing and short crops), but the exact odds should not be quoted as facts.
- **Crop values:** Kc, root depth and depletion fraction are FAO-56 values **entered from memory**; someone must check them against FAO-56 Tables 11, 12 and 22. Mung bean stage lengths (70 days), all heat limits, and every sunn hemp value are assumptions. All four crops are flagged `"assumption": true`, and the cards say so.
- **Data is a 55 km average** from NASA POWER (MERRA-2 based). No direct satellite soil moisture or rain yet.
- **The premise is unconfirmed:** nobody has yet asked an Isan farmer whether water risk is what stops them planting after rice.
- **Cosmetic:** on narrow screens the first timeline column slides under the sticky crop names.
- **Repo size:** the data adds about 33 MB.

## 7. Suggested next steps, in order

1. Push the branch, open a PR to `main`, enable Pages (Settings → Pages → Source: GitHub Actions), merge, and check the live URL on a phone.
2. Check `web/src/data/crops.json` against FAO-56 and correct the numbers.
3. Sowing window (F12) and what-if sliders (F13): both are UI work on top of the existing engine and are the cheapest visible wins.
4. Styling pass (team).
5. Analog seasons (F10), then the Earthdata features (F11, F14, F15) if time allows.
6. README, 2-minute video, Space Apps project page; submit by 20:00 Sunday.

## 8. File map

```
pipeline/build_history.py        NASA POWER → web/public/data (stdlib only)
pipeline/data/thailand.geo.json  coarse Thailand outline (johan/world.geo.json)
web/public/data/grid.json        194 cells
web/public/data/cells/*.json     25 seasons of daily rain, tmax, tmin, wetness per cell
web/src/engine/                  replay engine + tests (types.ts is the data contract)
web/src/data/crops.json          crop parameters with sources
web/src/data.ts                  loading, tap → cell, live POWER fallback
web/src/Results.tsx              cards, timeline, drawer, chart
web/src/App.tsx, MapView.tsx     page shell and MapLibre map
web/src/i18n.ts                  all Thai/English text and date formats
.github/workflows/deploy.yml     test + build + deploy to Pages (never run)
```
