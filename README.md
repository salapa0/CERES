# CERES: Field Time Machine

**What should a rain-fed rice farmer in Thailand plant after the harvest? Tap your field, and the app replays 25 past dry seasons of NASA data to show how each crop would have done.**

**Live demo: https://salapa0.github.io/demeter-fieldshift/**

NASA Space Apps Challenge 2026, challenge *Field Shift: Adapting Farms with NASA Data*.
Submission deadline: Sunday 15 Nov 2026, 23:59 local time (team target: 20:00).

**Full project document:** [docs/PROJECT.md](docs/PROJECT.md) covers the idea, the science, the NASA data, the
architecture, the interface, how it was built, the results, the limits and how it answers the challenge.

## What it does

Most rain-fed rice fields in Isan (northeast Thailand) sit empty after the wet-season harvest. The Field Time Machine
asks a simple question for each field: *if you had sown this crop on this date in each of the last 25 years, how
often would it have survived on the water in the soil and the rain that followed?*

- **Tap your field** (or use your location). The app finds the NASA POWER grid cell around it.
- **Pick, set, see:** a one-line summary of everything the answer depends on (sowing time, soil, field type,
  waterings, and the weather to test) sits above the answer; Change opens large tap choices.
- **Income first:** the summary recommends the crop that earns most among the crops that are safe (survived at least
  4 years in 5), or says plainly that no crop to sell is safe and how much watering would fix it.
- **Ten crops to choose from:** mung bean, peanut, soybean, field corn, sweet corn, sesame, watermelon, chili,
  shallot and sunn hemp, plus leaving the field bare. Each choice shows its average income per rai (or "no income",
  or "no reference price yet" where no official farm-gate price was found) and years survived. The picked crop shows
  the odds ("survived 18 of 25 years"), the odds in years that look like this one, the latest safe sowing date and the
  days left, years survived by sowing month, the month failed crops died in, the effect on the soil, a confidence
  badge, what the data cannot see, and what to ask the local extension officer.
- **This season looks like…:** the dry season under way is fetched live from NASA POWER and matched with the three
  most similar past seasons.
- **Past years:** every crop in every past year (on phones, the picked crop first); tap one to see the soil-water chart and the day and
  cause of failure.
- **Estimated income:** what the harvest would sell for per rai at a government farm-gate price (OAE; for shallot,
  the Si Sa Ket provincial offices), averaged over the past years and in a good year. Income, not profit.
- **NASA satellite checks:** the season under way shows NASA IMERG satellite rain beside the rain the model uses,
  and "soil now" from NASA SMAP (wetter or drier than the same date in past years). Under the timeline, a self-check
  says in how many past seasons the model's dry-down day matched NASA GLDAS soil moisture; it decides whether a card's
  confidence badge can reach High.
- **Share link:** the page address keeps the field and its settings, so "Copy link" sends someone the exact same answer
  (for example, to the local extension officer). Try the pilot area: https://salapa0.github.io/demeter-fieldshift/#lat=16.43&lon=102.83
- **Times you can water:** tell the app how many waterings you can give (30 mm each, from a pond or shallow well)
  and the odds update. The picked crop also says how many waterings that crop needs to survive 4 years in 5, or that
  it is a crop for irrigated fields.
- **Weather to test:** less rain or more heat, applied to every past year (not a forecast), as one of the settings.
- Opens in the phone's language (Thai on a Thai phone, otherwise English), with ไทย/EN one tap away and Buddhist-era
  years in Thai. The choice is remembered.

## Data and method

| Source | Used for |
|---|---|
| NASA POWER daily point API (`PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `GWETROOT`), 0.5° × 0.625°, seasons 2001/02 to 2025/26 | Rain, temperature and starting root-zone wetness for every replay; the current season for the look-alike years |
| NASA GPM IMERG Late daily V07 (`GPM_3IMERGDL`), 0.1°, via GES DISC OPeNDAP | Satellite rain for the season under way, beside the model's rain (refreshed daily by the deploy workflow) |
| NASA SMAP L4 (`SPL4SMGP` v8) root-zone soil moisture, 9 km, via NSIDC cloud OPeNDAP | "Soil now" and the same date in each year since 2015 (refreshed daily) |
| NASA GLDAS Noah 2.1 (`GLDAS_NOAH025_3H`) root-zone soil moisture, 0.25°, via the Giovanni time-series API | Self-check of the model in each past season (stored in the cell files) |
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
- **Some crop values are assumptions:** Thai mung bean stage lengths, all heat limits, every sunn hemp value, chili
  (borrowed from FAO-56 sweet pepper) and shallot (borrowed from onion). Second rice (นาปรัง) is left out: flooded
  rice needs a different water model.
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
