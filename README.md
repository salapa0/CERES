# DEMETER: Field Time Machine

**What should a rain-fed rice farmer in Thailand plant after the harvest? Tap your field, and the app replays 25 past dry seasons of NASA data to show how each crop would have done.**

**Live demo: https://salapa0.github.io/demeter-fieldshift/**

NASA Space Apps Challenge 2026, challenge *Field Shift: Adapting Farms with NASA Data*.
Submission deadline: Sunday 15 Nov 2026, 23:59 local time (team target: 20:00).

## What it does

Most rain-fed rice fields in Isan (northeast Thailand) sit empty after the wet-season harvest. The Field Time Machine
asks a simple question for each field: *if you had sown this crop on this date in each of the last 25 years, how
often would it have survived on the water in the soil and the rain that followed?*

- **Tap your field** (or use your location). The app finds the NASA POWER grid cell around it.
- **Three strategy cards:** keep today's rice → bare field; the best legume (mung bean or peanut); the best other
  crop (sunn hemp or field corn). Each card shows the odds ("survived 18 of 25 seasons"), the odds in years that
  look like this one, the latest safe sowing date and the days left, the effect on the soil, a confidence badge,
  what the data cannot see, and what to ask the local extension officer.
- **This season looks like…:** the dry season under way is fetched live from NASA POWER and matched with the three
  most similar past seasons.
- **Time machine timeline:** every crop in every past season; tap one to see the soil-water chart and the day and
  cause of failure.
- **Share link:** the page address keeps the field and its settings, so "Copy link" sends someone the exact same answer
  (for example, to the local extension officer). Try the pilot area: https://salapa0.github.io/demeter-fieldshift/#lat=16.43&lon=102.83
- **Times you can water:** tell the app how many waterings you can give (30 mm each, from a pond or shallow well)
  and the odds update. Each crop card also says how many waterings that crop needs to survive 4 years in 5, or that
  it is a crop for irrigated fields.
- **What-if sliders:** less rain or more heat, applied to every past season (not a forecast).
- English by default, Thai one tap away, with Buddhist-era years.

## Data and method

| Source | Used for |
|---|---|
| NASA POWER daily point API (`PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `GWETROOT`), 0.5° × 0.625°, seasons 2001/02 to 2025/26 | Rain, temperature and starting root-zone wetness for every replay; the current season for the look-alike years |
| FAO-56 (Allen et al. 1998), Tables 11, 12, 19, 22 | Crop stages, crop coefficients, root depth, depletion fraction, soil water; Hargreaves ET0 |
| EOX Sentinel-2 cloudless 2016 (CC BY 4.0) | Satellite basemap (display only) |
| OpenFreeMap / OpenStreetMap | Street basemap (display only) |

Each replay is an FAO-56 root-zone water balance, day by day from the sowing date. A week of severe water stress
after establishment, or three days of extreme heat at flowering, counts as a failed season. Lowland paddies get a
small daily groundwater supply (capillary rise) that fades as the NASA soil wetness falls. A watering is applied
when the soil passes the crop's stress line, at most once a week, while the farmer's waterings last.

## Limits

- **Not calibrated.** The thresholds and the groundwater number are starting values. Use the results to compare
  crops and sowing dates, not as exact probabilities.
- **55 km cells.** The data is an average over a wide area; a single field can be wetter or drier.
- **Some crop values are assumptions:** Thai mung bean stage lengths, all heat limits, every sunn hemp value.
- Pests, disease, prices and labour are not modelled. Watering is a simple fixed 30 mm per turn; the cost and
  source of the water are not modelled. Soil texture and field type are the farmer's choice.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173/demeter-fieldshift/
npm test
npm run build      # typecheck + production build into web/dist
```

Rebuild the NASA history (optional; it is committed, about 33 MB): `python pipeline/build_history.py`.
`.github/workflows/deploy.yml` tests, builds and deploys `web/dist` to GitHub Pages on every push to `main`.

Status, decisions and next steps for the team: **[docs/HANDOFF.md](docs/HANDOFF.md)**. Full design:
`docs/superpowers/specs/2026-11-14-field-time-machine-design.md`.

## Use of AI

Parts of the code and text were written with an AI coding assistant (Claude, by Anthropic). The team reviews them and
is responsible for the content. The app itself does not use AI to compute results: every number comes from the FAO-56
formulas in `web/src/engine/`.

## License

MIT, see [LICENSE](LICENSE). Not affiliated with or endorsed by NASA.
