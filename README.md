# DEMETER — Field Shift

**Climate-resilient crop rotation advice from NASA Earth data, starting with rain-fed rice farms in Thailand.**

NASA Space Apps Challenge 2026, challenge *Field Shift: Adapting Farms with NASA Data*.
Submission deadline: Sunday 15 Nov 2026, 23:59 local time (team target: 20:00).

## The idea

Most rain-fed rice fields in Isan sit empty after the wet-season rice harvest. DEMETER tells a farmer which
post-rice crop (mung bean, peanut, field corn, cassava, sunn hemp, vegetables) fits their field, using
NASA climate, rainfall, soil-moisture, terrain and vegetation data. Each recommendation names the data
behind it and how uncertain it is. Pilot area: Khon Kaen. Expanding to other countries means swapping the
soil and crop sources; the NASA data layers already cover the whole world.

## Features (build order)

| # | Feature | Data |
|---|---|---|
| A | Rotation engine: scores yield, water, soil, resilience and income, weighted by the farmer's priorities | FAO GAEZ + C–I |
| B | Explainable recommendations with uncertainty | all sources |
| C | Climate baseline and how reliable the rain is | NASA POWER, GPM IMERG |
| E | Soil moisture after the rice harvest | SMAP L4 root zone (GLDAS fallback) |
| I | Terrain, slope and erosion risk | SRTM |
| D | Climate trend projected out to 2040–2050 (simple trend lines, not a climate model) | POWER / ERA5 |
| F | NDVI check of what is actually planted after rice | MODIS/VIIRS, Landsat |
| S | Thai soil series (optional) | LDD 1:25,000 shapefile (CC BY-NC-ND) |
| H | Map view (optional) | NASA Worldview |

## Status

A working core prototype, the **Field Time Machine**, is on branch `build/mvp-core`: tap a field in Thailand and
it replays 25 past dry seasons for four post-rice crops with NASA POWER data. The feature table above is the
original idea; the current design is in `docs/superpowers/specs/2026-11-14-field-time-machine-design.md`, and
what is built, what is not, and how to run it is in **[docs/HANDOFF.md](docs/HANDOFF.md)**.

```bash
cd web && npm install && npm run dev
```

## License

To be decided by the team. Not affiliated with or endorsed by NASA.
