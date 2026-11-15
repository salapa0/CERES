# Space Apps submission kit

Text to paste into the project page, a script for the 2-minute video, and a final checklist.
Everything here matches what the live app does on 15 Nov 2026. Edit freely; keep the limits honest.

- **Live demo:** https://salapa0.github.io/CERES/
- **Code:** https://github.com/salapa0/CERES
- **Challenge:** Field Shift: Adapting Farms with NASA Data

## One-line summary

CERES's Field Time Machine replays 25 past dry seasons of NASA data for any field in Thailand, to show a rice farmer which crop could follow the harvest, how often it would have survived, and how much extra water it would need.

## Project description (about 250 words)

After the wet-season harvest, most rain-fed rice fields in northeast Thailand sit bare until the next rains. Planting a second crop on the moisture left in the soil could add income and improve sandy soils, but a failed crop costs seed and labour, and nobody can see how fast the soil is drying.

The Field Time Machine turns NASA's long climate record into an answer a farmer can read. Tap a field on the map. For that location the app takes 25 dry seasons of daily NASA POWER rain, temperature and root-zone soil wetness, and replays each season day by day for four crops (mung bean, peanut, field corn and sunn hemp) with the FAO-56 soil water balance. It then compares three rotation strategies, always including today's "rice, then bare field":

- how many of the 25 seasons each crop would have survived, and the day and cause of each failure;
- the odds in the three past seasons most like the one now under way, fetched live from NASA;
- the latest safe sowing date;
- how many waterings the crop would need to survive four years in five, or that it needs irrigation;
- what it does for the soil (nitrogen, organic matter) and what the data cannot see.

The farmer sets the sowing date, soil, field type and how many times they can water, and can test drier or hotter seasons with sliders. The tool is in English and Thai.

It supports a decision; it does not make one. The model's thresholds are uncalibrated starting values, the data is a 55 km average, and each card lists questions for the local extension officer.

## NASA and partner data used

| Data | How it is used |
|---|---|
| **NASA POWER** daily agroclimatology (`PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`, `GWETROOT`; MERRA-2 based; 0.5° × 0.625°) | 25 seasons (2001/02–2025/26) for all 194 grid cells over Thailand, and the live current season |
| **NASA GPM IMERG** Late daily V07, 0.1° | Satellite rain for the season under way, shown beside the model's rain |
| **NASA SMAP** L4 root-zone soil moisture (SPL4SMGP v8), 9 km | "Soil now", compared with the same date in every year since 2015 |
| **NASA GLDAS** Noah 2.1 root-zone soil moisture, 0.25° | Self-check: in how many past seasons the model's dry-down day matched GLDAS; sets the confidence badge |
| **FAO-56** crop evapotranspiration guidelines (Tables 11, 12, 19, 22) | Crop coefficients, growth stages, root depth, soil water limits |
| **Copernicus Sentinel-2** cloudless mosaic 2016 by EOX (CC BY 4.0) | Satellite basemap |
| OpenStreetMap via OpenFreeMap | Street basemap |

IMERG, SMAP and GLDAS are averaged into the same NASA POWER grid cell. The model is not tuned to them: they are shown as independent checks, and the self-check result (about half the seasons agree at the median cell) is reported as it came out.

## How it meets the challenge

- Decision-support tool built on NASA Earth data, combined with crop characteristics (FAO-56) and farmer inputs (sowing date, soil, field type, water available).
- Compares three rotation strategies including the existing one.
- For each: why (odds), evidence (season timeline and soil-water chart), benefits (soil effect), gaps and risks (confidence badge, "what the data cannot see", questions for the extension officer).
- Highlights vulnerable seasons and the sowing window.
- Scenario sliders for rainfall and temperature, labelled "not a forecast".
- Statistical pattern matching: look-alike past seasons.
- Uncertainty made visible: a self-check against NASA GLDAS soil moisture and a confidence badge that lists its reasons.

## Use of AI

Code and documentation were written with an AI coding assistant (Claude, by Anthropic) under the team's direction and review. The app does not use AI at run time; every number comes from the FAO-56 formulas in `web/src/engine/`.

## Honest limits (say these in the pitch)

- The model is not calibrated against real fields, and no farmer or agronomist has reviewed it.
- No independent satellite check of the results yet.
- One watering is a fixed 30 mm; the cost and source of water are not modelled.
- Thai mung bean stage lengths, heat limits and all sunn hemp values are assumptions.

## 2-minute video script

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Satellite map of northeast Thailand | "After the rice harvest, most rain-fed fields here sit bare for months. Planting again is a gamble on water nobody can see." |
| 0:15–0:35 | Tap a field near Khon Kaen; the summary appears | "CERES replays 25 dry seasons of NASA data for this field. The answer comes first: on leftover moisture alone, this is risky." |
| 0:35–0:55 | The three cards | "Three strategies, including what the farmer does today. Each shows how many seasons the crop survived, and what it does for the soil." |
| 0:55–1:15 | Set "Times you can water" to 2 | "The farmer has a small pond: two waterings. Sunn hemp, a green manure that feeds the soil, goes from 11 to 22 years in 25." |
| 1:15–1:35 | Timeline; tap a failed year, show the chart | "Every icon is a real season. Tap one to see the soil drying and the day the crop would have died." |
| 1:35–1:50 | Look-alike line; what-if sliders | "It matches this season to the most similar past years, and lets you test a drier or hotter future." |
| 1:50–2:00 | About page, limits | "It is honest about what it cannot see, and it works for any field in Thailand, in Thai and English." |

Record on the live URL. Check the numbers on screen before recording: they come from live data and can shift by a season.

## Final checklist

- [ ] Open the live URL on a real phone: tap a field, change the waterings, open a season, switch to Thai.
- [ ] Project page: summary, description, data list, AI statement, links to the demo and the repository.
- [ ] Video of 2 minutes or less, public link.
- [ ] Submit by 20:00 Thailand time (hard close 23:59).
