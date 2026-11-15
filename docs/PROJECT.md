# CERES Field Time Machine: the complete project document

**Team:** CERES · **Event:** NASA Space Apps Challenge 2026 · **Challenge:** *Field Shift: Adapting Farms with NASA Data*
**Live app:** https://salapa0.github.io/ceres-fieldshift/ · **Code:** https://github.com/salapa0/ceres-fieldshift (MIT licence)
**State of this document:** written Sun 15 Nov 2026, early afternoon Thailand time, from `main` at pull request 9.
Every number in it was measured on the code and data in the repository at that point.

This is the base document for presenters, judges, teammates and any AI reading the project. It covers the idea, the
farmer, the science, the data, the architecture, the interface, how it was built, what was checked, what is weak, and
how it answers the challenge. Shorter documents draw from it:

| Document | Purpose |
|---|---|
| `docs/PROJECT.md` (this file) | Everything, in one place |
| `docs/HANDOFF.md` | Operations: run, deploy, secrets, workflows, troubleshooting |
| `docs/SUBMISSION.md` | Text for the Space Apps project page, the 2-minute video script, final checklist |
| `docs/superpowers/specs/2026-11-14-field-time-machine-design.md` | The original blueprint (design before the build) |
| `README.md` | Short public overview |

---

## Contents

1. The project in one page
2. The problem
3. Who it is for
4. The idea: a time machine for one field
5. How it answers the challenge
6. What the user sees (screen by screen)
7. Feature catalogue (every feature, P0 to P2, built or not)
8. The science
9. NASA data and how it is combined
10. Architecture
11. Technology stack
12. Interface and experience design
13. Quality: tests and verification
14. How it was built (development cycle and timeline)
15. Operations: how it keeps running with no one on duty
16. Results: what the app says about Thailand
17. Honest limits and risks
18. Roadmap
19. Presenting the project
20. Glossary
21. Where to find things in the code

---

## 1. The project in one page

After the wet-season rice harvest, most rain-fed rice fields in Thailand sit bare for months. A second crop planted on
the moisture left in the soil could earn money and improve poor sandy soils, but if the soil dries out before the
crop matures, the farmer loses seed and labour. Nobody can see how fast the soil will dry, so most farmers do nothing.

**CERES's Field Time Machine** lets a farmer, or the extension officer advising them, tap their field on a map of
Thailand. The app then *replays every dry season since 2001* for that location, day by day, for four candidate crops,
using NASA data and the FAO-56 crop water method. It answers in plain language:

- how many of the last 25 seasons each crop would have survived, and on which day and why each failure happened;
- which past seasons the season under way looks like, and how the crop did in those;
- the latest safe sowing date, and how many days are left;
- how many waterings from a pond or shallow well would make the crop safe;
- what the harvest would sell for at a standard market price;
- what each crop does for the soil;
- how much to trust all of this, with a confidence badge that is checked against NASA satellite-based soil moisture.

It compares three strategies, always including today's practice (rice, then a bare field). It uses **four NASA datasets**
(POWER, GPM IMERG, SMAP and GLDAS, delivered through NASA's open API and Earthdata services), all brought onto one
common grid. It covers **all of Thailand** (194 grid cells), works on a phone, in **Thai and English**, has no login, runs
entirely in the browser, and refreshes its satellite data every day with nobody on duty.

It is honest about itself: the model is uncalibrated, the data is a 55 km average, and every card lists what the data
cannot see and what to ask the local extension officer. It supports the farmer's judgement; it does not replace it.

**Numbers at a glance**

| | |
|---|---|
| Area covered | All of Thailand: 194 NASA POWER grid cells (0.5° × 0.625°, about 55 km) |
| Seasons replayed | 25 dry seasons, 2001/02 to 2025/26, every day from 1 Aug to 31 Jul |
| Crops | Mung bean, peanut, field corn, sunn hemp (green manure) |
| Strategies compared | 3: keep today's rice → bare field; best legume; best other crop |
| NASA datasets | POWER (4 variables), GPM IMERG Late, SMAP L4, GLDAS Noah 2.1 |
| Replays per field view | 4 crops × 25 seasons, plus sowing-window sweeps (14 dates) and watering searches (up to 9 levels), all in the browser |
| Languages | Thai and English, with Buddhist-era years in Thai |
| Tests | 70 web tests, 10 pipeline tests |
| Build | 33 commits, 9 merged pull requests, about 17 hours from first commit to this document |
| Running cost | Zero: GitHub Pages and GitHub Actions, no server, no paid API |

---

## 2. The problem

### 2.1 The farmer's situation
- Most rice in Thailand's north-east (Isan), north and much of the centre is **rain-fed**: one rice crop in the wet
  season (roughly June to November), then a long dry season.
- After harvest the soil still holds water, and a short crop could use it. The government promotes crops after rice
  (for example sunn hemp as a green manure; legumes such as mung bean and peanut fix nitrogen; field corn sells).
- **The risk is invisible.** Leftover moisture fades week by week. A crop sown too late, or in a dry year, dies before
  it matures. One bad experience can make a family never try again.

### 2.2 The pain points
| Pain point | Cost if left alone | What CERES gives |
|---|---|---|
| The farmer cannot see the odds that a dry-season crop survives on *their* field | A failed crop and debt, or no second crop at all: no dry-season income, soil left unimproved, family members leave to find work | Survival odds per crop from every past season, with the day and cause of each failure |
| Leftover moisture runs out after harvest and nobody knows how fast | Sowing late wastes the season; a missed season means waiting a year | Latest safe sowing date and days left |
| Water is the constraint, but how much is "enough" is unknown | Farmers either do not try, or over-invest in water they cannot get | Waterings needed to make each crop safe (4 years in 5) |
| Advice feels generic and untested | Farmers distrust it | Answers for their own field, from seasons they remember, with a visible self-check against NASA soil moisture |
| Income is a guess | Hard to weigh risk against reward | Income per rai at a standard market price, averaged over past seasons |

**Honest note:** these pain points come from the team's reading of rain-fed farming in Isan. No farmer has yet
confirmed that water risk is the main reason fields stay bare (markets and labour could matter as much). This is
stated in the app and in the pitch (§17).

### 2.3 Why NASA data is the right tool
Thailand has rain gauges, but a smallholder has no record of *their* field's soil moisture across decades. NASA's
records are long, global, free, and gap-free at the daily scale:
- **NASA POWER** gives daily rain, temperature and root-zone soil wetness for every point since 1981.
- **GPM IMERG** gives satellite rain at 0.1° (about 10 km) within a day.
- **SMAP** gives satellite-based root-zone soil moisture at 9 km every 3 hours since 2015.
- **GLDAS** gives land-model soil moisture driven by satellite observations, every 3 hours since 2000.

Together they let the app replay the past for any field and check itself against independent measurements.

---

## 3. Who it is for

| User | Need | How they use CERES |
|---|---|---|
| **Rain-fed rice farmer** (primary), often over 50, on a phone, more comfortable in Thai | "Should I plant something after the rice, what, and by when?" | Taps their field (or uses location), reads the short answer, changes the sowing date or waterings, shares the link with family or the officer |
| **Agricultural extension officer** (Department of Agricultural Extension, sub-district level) | Advise many farmers quickly and credibly | Opens a field, walks through the timeline and the soil-water chart with the farmer, uses the "ask your officer" questions, sends a share link over LINE |
| **Cooperative, NGO, local government** | Plan crop-after-rice programmes by area | Compares fields across a district; sees where sowing windows close early |
| **Judges and researchers** | See how NASA data is used and how honest it is | Read the sources footer, the self-check, the About page and this document |

Design consequences: Thai with Buddhist-era years, large tap targets, the answer before the detail, plain words, no
login, works on a slow phone connection (static files, about 220 KB per field).

---

## 4. The idea: a time machine for one field

Forecasts say what *might* happen this season. Farmers trust what *did* happen. CERES takes the farmer back in time:

> "If you had sown mung bean on 15 November in each of the last 25 years, here is what would have happened, year by
> year, on your field's soil and weather."

Each past season becomes a **replay**: a day-by-day soil-water account starting from that year's real soil moisture on
the sowing day, driven by that year's real rain and temperature, for that crop's real water needs at each growth stage.
The replay ends in one of four outcomes: **good**, **poor**, **failed** (with day and cause), or **no data**.

Three ideas make it more than a statistics table:
1. **Seasons the farmer remembers.** "2558/59 (2015/16) would have failed on 28 January" is something a farmer can
   check against memory, which builds trust.
2. **This season is not average.** The app matches the season under way to the three most similar past seasons, and
   shows the odds in those years separately.
3. **It checks itself.** For each past season it compares the day its model's soil dried with the day NASA GLDAS soil
   moisture dried, and shows how often they agree. That agreement sets the confidence badge.

---

## 5. How it answers the challenge

The *Field Shift* challenge asks teams to help farmers adapt what they grow using NASA data. The blueprint recorded
these asks and suggestions from the challenge statement (§15 of the blueprint). Each one maps to a built feature:

| The challenge asks or suggests | How CERES answers | Where |
|---|---|---|
| A decision-support tool using NASA Earth observations | Every answer comes from NASA POWER replays; IMERG, SMAP and GLDAS check them | §8, §9 |
| Combine Earth data with **local soil** information | Soil texture input (5 FAO-56 textures) and field type (lowland paddy / upland) change the soil water each crop can use | F6, §8.2 |
| Use **crop characteristics** | FAO-56 growth stages, crop coefficients, root depth, depletion fraction and heat limits for each crop, with sources | §8.4 |
| Respect **farmer priorities and constraints** | Sowing date, soil, field type, **water available** (waterings), income, risk-first wording | F6, waterings, income |
| **Compare at least three rotation strategies, including the existing one** | Cards A (today: rice → bare), B (rice → best legume), C (rice → best other crop) | F3 |
| For each: **why, evidence, benefits, gaps, risks needing local review** | Odds (why); timeline and soil-water chart (evidence); soil effect and income (benefits); blind spots and confidence badge (gaps and risks); "ask your extension officer" (local review) | F3, F4, F5 |
| **Highlight vulnerable seasons** and bare periods | Timeline marks every failed season; sowing window shows when the risk climbs | F4, F12 |
| **Soil health**: nitrogen fixing, organic matter | Soil-effect line on each card, explained on the About page | F3, F17 |
| **AI or statistical pattern finding**, with uncertainty explained | Look-alike seasons (standardised nearest neighbours); self-check hit rate; confidence badge with reasons | F10, F11 |
| **Harmonise datasets of different resolutions** | POWER cell (0.5° × 0.625°) is the common grid; IMERG (0.1°), SMAP (9 km) and GLDAS (0.25°) are averaged into it | §9.3 |
| **Scenario sliders** for rainfall and temperature | What-if sliders, labelled "not a forecast" | F13 |
| **Support, not replace, farmer judgement** | Confidence badge, blind spots, questions for the officer, About page, disclaimer | F3, F17 |

### 5.1 Why this is a strong answer
- **It answers the farmer's real question** ("will it survive, and what will it take?"), not a generic suitability
  score.
- **It uses NASA data in three distinct roles**: as the engine's input (POWER), as an independent check of that input
  for the season under way (IMERG rain, SMAP soil), and as a validation of the engine across the past (GLDAS).
- **Uncertainty is part of the answer**, not a footnote: every card carries a confidence badge with its reasons, and
  the self-check result is shown as it came out (§16.3), not tuned to look good.
- **It is built to last**: no server, no paid service, data refreshed daily by CI, all of Thailand from day one.
- **It is transparent**: every formula is in readable TypeScript, every crop value cites its FAO-56 table row, every
  number names its source in the footer.

---

## 6. What the user sees (screen by screen)

### 6.1 Home
- Header: CERES logo, "Field Time Machine" / ไทม์แมชชีนแปลงนา, About, EN / ไทย switch.
- Question: *What should you plant after the rice harvest?* and a one-line instruction.
- **Use my location** button.
- A map of Thailand (street map, or a satellite layer from Sentinel-2) with "Tap anywhere in Thailand".
- A tap outside Thailand says the app covers Thailand only.

### 6.2 Field page (after a tap)
Top to bottom:
1. **Your field** with the coordinates and a **Copy link** button.
2. **In short:** the best option in one sentence ("Sunn hemp is the best bet here: it survived 11 of 25 past dry
   seasons"), its sowing deadline and whether it has passed, and the waterings that would make it safe.
3. **This season looks like…** the three most similar past seasons (live from NASA POWER, data to about 3 days ago).
4. **NASA satellite rain (IMERG)** since 1 August, beside the rain the model uses (POWER), over the same days.
5. **Soil now (NASA SMAP):** root-zone water today and whether it is wetter or drier than on the same date in each year
   since 2015.
6. **Inputs:** sowing date (1 Nov to 1 Feb), soil (sand to clay loam), field type (lowland paddy with a shallow water
   table, or upland), times you can water (0 to 8).
7. **Three cards**, A, B, C. Each card shows:
   - the crop, and "survived N of 25 seasons" with a bar split into good, poor and failed;
   - "in years like this: N of 3";
   - waterings needed to survive 4 years in 5, or that the crop needs irrigation;
   - estimated income per rai at a standard price (average and good year), or "no cash income" for sunn hemp;
   - "Plant by [date]" and days left, or "past the date";
   - the effect on the soil (adds nitrogen; adds organic matter; uses soil nutrients; bare);
   - under **More**: the sowing-window chart, the alternative crop, the **confidence badge with every reason**, what
     the data cannot see, and what to ask the extension officer.
8. **Time machine timeline:** a grid of 4 crops × 25 seasons, one icon per season (🌱 good, 🍂 poor, ✖ failed,
   · no data), look-alike years highlighted. Under it: **"Matches NASA GLDAS soil moisture (satellite-informed) in
   N of 25 seasons"**.
9. **Season drawer** (tap any icon): the day-by-day root-zone water chart with the stress line, daily rain bars, and
   the day and cause of failure ("dry soil" or "heat at flowering") in a real calendar date.
10. **If the weather changed (not a forecast):** rain −30 % to +10 %, temperature +0 to +3 °C, applied to every past
    season; every card then says "What-if result".
11. **Sources footer:** every dataset with its resolution, the current-season note, and the method.

### 6.3 About page
How the time machine works, the data used, what the app cannot see, what each crop does to the soil, the use of AI in
building it, and credits. Not affiliated with or endorsed by NASA.

### 6.4 Sharing
The address bar always holds the field and settings (for example `#lat=16.43&lon=102.83&water=2&lang=th`). **Copy
link** puts it on the clipboard, with a fallback for in-app browsers (LINE, Facebook) that block the clipboard. Opening
the link shows the same field, settings and language.

---

## 7. Feature catalogue

Priorities come from the blueprint: **P0** is the minimum viable product, **P1** the full product, **P2** stretch.
"Added" features were not in the blueprint; they came from what the build revealed. Every feature is listed, including
those not built.

### 7.1 Summary table

| ID | Feature | Priority | Status |
|---|---|---|---|
| F1 | Map, tap to cell, outside-Thailand message, my-location button | P0 | Built (my-location not tested on a real GPS) |
| F2 | Replay engine: ET0, crop coefficient, soil water balance, outcomes, odds | P0 | Built |
| F3 | Three strategy cards with odds, soil effect, blind spots, officer questions, badge | P0 | Built |
| F4 | Time-machine timeline (crops × seasons) | P0 | Built |
| F5 | Season drawer with soil-water chart and cause of failure | P0 | Built |
| F6 | Sowing date and soil texture inputs | P0 | Built, plus field type |
| F7 | Thai / English, Buddhist-era years | P0 | Built |
| F8 | Sources footer | P0 | Built |
| F9 | GitHub Pages deploy and POWER history for all Thai cells | P0 | Built (194 cells) |
| F10 | Look-alike seasons and this-season odds | P1 | Built (live fetch instead of a cron) |
| F11 | Self-check against GLDAS, hit rate, High badge | P1 | Built |
| F12 | Sowing window and days left | P1 | Built |
| F13 | What-if sliders | P1 | Built |
| F14 | IMERG rain (Final for history, Late for the current season) | P1 | Current-season half built; history half not built |
| F15 | SMAP root zone, "soil now" | P1 | Built ("soil now" with comparison to past years; not a look-alike feature, by design) |
| F16 | Satellite basemap toggle | P1 | Built |
| F17 | About page | P1 | Built |
| F18 | "Ask why" AI chat calling the engine | P2 | Not built (design in §18) |
| F19 | MODIS NDVI second self-check | P2 | Not built (ORNL service down on 14 and 15 Nov) |
| F20 | SRTM lowland adjustment | P2 | Not built; partly covered by the field-type input |
| A1 | Field type: lowland paddy vs upland, with capillary rise | Added | Built |
| A2 | Times you can water, and waterings needed | Added | Built |
| A3 | "In short" summary at the top | Added | Built |
| A4 | Share link and Copy link | Added | Built |
| A5 | Estimated income per rai | Added | Built |
| A6 | Confidence badge listing every reason | Added | Built |
| A7 | Live fallback when a cell file is missing | Added | Built (path not exercised) |
| A8 | Daily refresh of satellite data with no one on duty | Added | Built |

### 7.2 Each feature in detail

**F1 Map and location.** MapLibre GL map of Thailand with OpenFreeMap street tiles. A tap snaps to the NASA POWER cell
whose box contains it; a tap on an island or border tip that misses the coarse outline takes the nearest cell within
one cell's distance. A tap further out shows "Thailand only". **Use my location** asks the browser for GPS and flies to
it. *Where:* `MapView.tsx`, `App.tsx`, `data.ts` (`cellForPoint`). *Checked:* 3 tests on the real grid.

**F2 Replay engine.** The core: for one crop, one season and one sowing date, a daily FAO-56 root-zone water balance
(§8). Pure TypeScript functions, no network, deterministic. *Where:* `engine/index.ts`, `engine/et0.ts`. *Checked:* 18
tests, including the FAO-56 extraterrestrial radiation example, ET0 = 0 when Tmax = Tmin, the Kc curve at each stage
boundary, the water store never leaving [0, TAW], wet season → good, dry season → failed with a death day, heat →
failed with reason heat, missing days → no data, tie-breaks, identical inputs → identical outputs.

**F3 Strategy cards.** A: keep today's rice → bare field (no risk, no dry-season income). B: the better of mung bean
and peanut. C: the better of sunn hemp and field corn. A tie goes to the first named. The other crop is shown as "a
close alternative". Each card: odds and bar, look-alike odds, waterings needed, income, sowing window, soil effect,
confidence badge, blind spots, officer questions. *Where:* `Results.tsx` (`Card`), `engine/index.ts`
(`buildStrategies`).

**F4 Timeline.** One row per crop, one column per season, icon and colour per outcome, look-alike years highlighted,
crop names fixed on the left while the seasons scroll sideways on a phone. *Where:* `Results.tsx`.

**F5 Season drawer.** Daily root-zone depletion as a line against the stress line and the total available water,
daily rain as bars, and the failure day as a real date in Thai or English calendar format. Hand-built SVG.
*Where:* `Results.tsx` (`Drawer`, `WaterChart`). *Checked:* test that a failed season shows a real Thai date.

**F6 Inputs.** Sowing date (1, 15 Nov; 1, 15 Dec; 1, 15 Jan; 1 Feb; default 15 Nov). Soil texture: sand, loamy sand
(default, typical of Isan), sandy loam, loam, clay loam. Field type (A1). Waterings (A2). All replays re-run instantly
in the browser when an input changes.

**F7 Languages.** Every string in `i18n.ts` in Thai and English; dates and seasons formatted per language; seasons
shown as 2558/59 in Thai (Buddhist era = CE + 543). English is the current default at the team's request; Thai is one
tap away (see §12.4 on making it Thai-first).

**F8 Sources footer.** Every dataset, product and resolution used for the field, plus the live-season note and the
method line.

**F9 Deploy and history data.** `pipeline/build_history.py` fetched NASA POWER daily data for every cell touching
Thailand's outline: 194 cells, 25 seasons each, 1 Aug → 31 Jul, all four variables. Committed as static JSON;
`deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`. *Checked:* run log 194 ok, 0 failed.

**F10 Look-alike seasons.** For the season under way, the browser fetches NASA POWER from 1 Aug to today for the tapped
cell. Three features: rain 1 Aug–31 Oct, rain since 1 Nov (left out before November), root-zone wetness today. Each
feature is standardised across the 25 past seasons; the 3 nearest by Euclidean distance are the look-alike years. Each
card then shows the crop's outcome in those 3 years. *Where:* `engine/analog.ts`, `data.ts`. *Checked:* 5 analog tests
(identical season found first; standardising makes units irrelevant; November feature skipped before November; split
detection) + parse test + 2 component tests; live: cell 16.50, 102.50 → data to 11 Nov 2026, looks like 2008, 2016,
2025.

**F11 Self-check and High badge.** For each past season: the model's dry-down day (mung bean, 15 Nov, the farmer's soil
and field type) versus the GLDAS dry-down day on GLDAS's own scale (§8.7). Agreement within 14 days, or neither drying,
counts as a match. The hit rate is shown under the timeline and feeds the badge. *Where:* `pipeline/build_gldas.py`,
`engine/selfcheck.ts`, `Results.tsx`. *Checked:* 3 pipeline + 7 engine + 2 component tests; 185 cells: median 0.52;
live: cell 16.50, 103.13 shows 20 of 25 and High on both crop cards.

**F12 Sowing window.** Odds for every 7th day from 1 Nov to 1 Feb; the latest date whose odds are within 0.10 of the
best (and that had at least one good season) is "Plant by"; during the dry season the card counts the days left or
says the date has passed. A small chart under More shows the odds across the window. *Checked:* 6 tests, including
"later sowing never raises odds in a steadily drying season".

**F13 What-if sliders.** Rain × (0.7 to 1.1) and temperature + (0 to 3 °C) applied to every past season before the
replay; the sliders stay smooth because the replays run on a deferred value. *Checked:* on the real Khon Kaen cell,
0.7 × rain or +3 °C never raises any crop's odds.

**F14 IMERG satellite rain.** Daily GPM IMERG Late (0.1°) for 1 Aug → yesterday, fetched in CI on every deploy and
every day at 08:30 Thailand time, averaged over the pixels in each cell, shown beside POWER rain over the same days.
*Checked:* 3 pipeline tests on a real server response; 105 days × 194 cells written; live: cell 16.50, 103.13 IMERG
412 mm vs POWER 633 mm. *Not built:* IMERG Final replacing POWER rain in past seasons (about 9,000 daily files; it
would change every result and needs its own review).

**F15 SMAP soil now.** SMAP L4 root-zone soil moisture (9 km, 3-hourly) for the latest complete day, averaged over the
day's 8 granules and the cell's pixels; and the same calendar date in every year since 2015. The app says "the root
zone holds 24 % water by volume · drier than 9 of 11 past years on this date". Not used to pick look-alike years,
because SMAP starts in 2015 and the record must cover 2001 onward. *Checked:* 4 pipeline + 2 component tests; CI wrote
10 Nov 2026 for 194 cells.

**F16 Satellite basemap.** Toggle between the street map and EOX Sentinel-2 cloudless 2016 (CC BY 4.0), with labels
on top. 2017 is blank over Thailand; 2018 onward is non-commercial, so 2016 is used.

**F17 About page.** Method, data, limits, soil effects, use of AI, credits, in both languages.

**F18 AI chat (not built).** A drawer where the farmer asks "why did peanut fail in 2015?" and an LLM answers by
calling the engine's functions (replay, odds, window) and quoting the numbers. Blocked by hosting: GitHub Pages cannot
hold an API key, so it needs a small proxy (for example a Cloudflare Worker with a rate limit). Design in §18.

**F19 MODIS NDVI check (not built).** Compare seasons the replay calls failures with MODIS vegetation greenness from the
ORNL DAAC subset service. The service was down on both 14 and 15 November.

**F20 SRTM lowland adjustment (not built).** Use SRTM elevation to tell low paddies (which stay wet longer) from
uplands automatically. The field-type input (A1) lets the user say this instead.

**A1 Field type and capillary rise.** With the blueprint's model alone, every crop failed in every year in Isan:
leftover moisture alone could not carry them. Lowland paddies keep a shallow water table after the wet season, so the
engine adds FAO-56 capillary rise: up to 3.5 mm/day for a lowland field, scaled by that day's relative NASA root-zone
wetness (so wet years supply more and the supply fades through the dry season); 0 for upland.

**A2 Waterings.** The challenge names water availability as a constraint. The farmer says how many times they can
water (0–8); each watering adds 30 mm when the soil passes the stress line, at most once a week. Each card says how many
waterings the crop needs to survive 4 seasons in 5, or that it needs irrigation. *Checked:* engine and component
tests; cell 16.50, 102.50 near Khon Kaen, default settings: sunn hemp goes from 11 to 22 of 25 seasons with 2
waterings, mung bean from 0 to 7.

**A3 In short.** The answer first: the best crop in one sentence, its deadline, and the waterings that make it safe.

**A4 Share link.** See §6.4. *Checked:* 4 codec + 3 component tests. Not yet tried inside LINE on a real phone.

**A5 Income estimate.** Income per rai at a standard farm-gate price: good season = full standard yield × price, poor
= half, failed = 0, averaged over the seasons with data; plus a good-year figure. Income, not profit (profit needs each
farmer's own costs, which the team ruled out as too personal). Prices and yields cite the Office of Agricultural
Economics (OAE) and TDRI with dates (§8.5).

**A6 Badge with reasons.** The badge lists every reason it is Low, Medium or High (few seasons; self-check below half;
look-alike years split; not yet checked; self-check only some seasons; look-alike years mixed; no current data).

**A7 Live fallback.** If a cell file is missing, the browser fetches the whole POWER history for that point directly
(CORS works). Not exercised in practice because every cell file exists.

**A8 Daily refresh.** IMERG and SMAP are rebuilt by CI every day at 01:30 UTC and on every deploy; if NASA is down the
deploy still goes out and the app hides those lines.

---

## 8. The science

All formulas live in `web/src/engine/`. All tunable numbers live in `engine/constants.ts`.

### 8.1 Reference evapotranspiration (how thirsty the air is)
Hargreaves, FAO-56 equation 52:
```
ET0 = 0.0023 × (Tmean + 17.8) × sqrt(max(Tmax − Tmin, 0)) × 0.408 × Ra        [mm/day]
```
`Ra` is extraterrestrial radiation from latitude and day of year (FAO-56 equation 21), tested against the FAO-56
worked example. Hargreaves needs only temperature, which NASA POWER provides everywhere.

### 8.2 Soil water balance (FAO-56 chapter 8)
```
TAW = 1000 × (θFC − θWP) × Zr          total available water in the root zone (mm)
RAW = p × TAW                          readily available water; past it the crop is stressed
Dr(0) = (1 − wRel) × TAW               starting depletion on the sowing day
wRel = clamp((GWETROOT − p05) / (p95 − p05), 0, 1)
each day:
  Ks  = 1                                    if Dr ≤ RAW
      = (TAW − Dr) / ((1 − p) × TAW)         otherwise          (water-stress factor)
  ETc = Kc(day) × ET0;   ETa = Ks × ETc
  Dr  = clamp(Dr − 0.8 × rain − CR × wRel(day) − watering + ETa, 0, TAW)
```
- θFC, θWP: field capacity and wilting point from FAO-56 Table 19 (midpoints), per soil texture.
- `p05`, `p95`: the cell's 5th and 95th percentiles of POWER root-zone wetness, so "wet" and "dry" are relative to that
  place.
- 0.8: share of rain that reaches the root zone (starting value).
- CR: capillary rise, 3.5 mm/day for lowland paddy, 0 for upland (A1).

| Soil | θFC | θWP |
|---|---|---|
| Sand | 0.12 | 0.045 |
| Loamy sand (default) | 0.15 | 0.065 |
| Sandy loam | 0.23 | 0.11 |
| Loam | 0.25 | 0.12 |
| Clay loam (Table 19's "silt clay loam") | 0.335 | 0.205 |

### 8.3 Outcome of a replay
- **Failed** if 7 days in a row have severe stress (Ks < 0.2) after the initial stage; or if less than half of the
  crop's water demand was met over the season (RET < 0.5); or if 3 days in the flowering window exceed the crop's heat
  limit. The death day and reason (drought or heat) are kept.
- **Good** if not failed and at least 75 % of the demand was met.
- **Poor** otherwise. **No data** if any input day is missing (left out of the odds).
- Sunn hemp is ploughed in at flowering, so its season ends there and the heat rule does not apply.

### 8.4 Crops
| Crop | Stages ini/dev/mid/late (days) | Kc ini/mid/end | Root depth | p | Heat limit | Soil effect |
|---|---|---|---|---|---|---|
| Mung bean (ถั่วเขียว) | 15/20/25/10 (70 days) | 0.40/1.05/0.35 | 0.6 m | 0.45 | 40 °C | Adds nitrogen |
| Peanut (ถั่วลิสง) | 25/35/45/25 (130 days) | 0.40/1.15/0.60 | 0.5 m | 0.50 | 40 °C | Adds nitrogen |
| Field corn (ข้าวโพดเลี้ยงสัตว์) | 20/35/40/30 (125 days) | 0.30/1.20/0.60 | 1.0 m | 0.55 | 38 °C | Uses soil nutrients |
| Sunn hemp (ปอเทือง) | 15/35, ploughed in at flowering (50 days) | 0.40/1.00 | 0.8 m | 0.50 | – | Adds organic matter and nitrogen |

Values come from FAO-56 Tables 11 (stages), 12 (Kc), 22 (root depth and p), checked line by line against the FAO web
edition on 14 Nov. Root depths sit at the low end of each range because paddies have a plough pan. Thai mung bean
stage lengths, all heat limits and every sunn hemp value are assumptions, and the cards say so.

### 8.5 Income
| Crop | Standard yield (kg/rai) | Price (฿/kg) | Price date | Sources |
|---|---|---|---|---|
| Mung bean | 150 (team estimate) | 22.00 | Feb 2026 | OAE weekly price |
| Peanut | 630 (fresh pods) | 26.41 | May 2023 | OAE dry-season study 2022/23 |
| Field corn | 748 (national 2024) | 8.19 | Aug 2025 | TDRI; OAE weekly price |
| Sunn hemp | – | – | – | Green manure: no cash income |

Income per season: good = yield × price; poor = half; failed = 0. Rounded to 10 baht.

### 8.6 Look-alike seasons, sowing window, waterings
See F10, F12, A2 in §7.2.

### 8.7 Self-check against GLDAS
For each past season, with mung bean sown on 15 Nov:
- **Model dry-down day:** the first day the model's root zone passes the stress point (Dr > RAW, i.e. less than
  1 − p of the available water left).
- **GLDAS dry-down day:** the first day GLDAS root-zone moisture, scaled between its own 5th and 95th percentiles for
  that cell, falls below the same level (1 − p).
- Both are looked for only while the crop is in the field, because the model does not run outside it.
- **Agree** if both happen within 14 days of each other, or neither happens.
- **Hit rate** = agreeing seasons ÷ seasons with data.

**Why this rule and not the blueprint's.** The blueprint compared the model's stress point with GLDAS's 25th
percentile of 1 Nov–31 Mar values. That bar is much drier than the stress point, and in many years the model is already
stressed on the sowing day; the median cell agreed in **8 %** of seasons. Putting both on the same relative footing
(the way the engine already reads POWER wetness) gives a median of **52 %**. The rule was changed once, for that stated
reason, and not tuned afterwards. Both numbers are reported.

### 8.8 Confidence badge
| Level | Rule |
|---|---|
| **Low** | fewer than 15 seasons with data, or self-check hit rate below 0.5, or the look-alike years split three ways |
| **High** | hit rate at least 0.75 and all three look-alike years gave this crop the same outcome |
| **Medium** | everything else, including every cell without GLDAS data |

High means the app is confident in its answer, which can be "this crop fails".

### 8.9 Constants (all starting values)
| Name | Value | Meaning |
|---|---|---|
| `RAIN_EFFECTIVE_FRACTION` | 0.8 | Rain reaching the root zone |
| `KILL_KS`, `KILL_DAYS` | 0.2, 7 | Severe stress for a week kills the crop |
| `GOOD_RET`, `FAIL_RET` | 0.75, 0.50 | Share of water demand met for good / below which failed |
| `HEAT_DAYS_FAIL` | 3 | Hot days at flowering that ruin the crop |
| `WINDOW_TOLERANCE`, step | 0.10, 7 days | Sowing window |
| `ANALOG_K` | 3 | Look-alike seasons |
| `SELFCHECK_TOLERANCE_DAYS` | 14 | Self-check agreement window |
| `HIT_RATE_HIGH`, `HIT_RATE_LOW` | 0.75, 0.5 | Badge thresholds |
| `MIN_SEASONS_FOR_MEDIUM` | 15 | Fewer seasons → Low |
| `CAPILLARY_RISE_MAX_MM` | lowland 3.5, upland 0 | Water table supply, mm/day |
| `IRRIGATION_MM`, gap | 30 mm, 7 days | One watering |
| `SAFE_SHARE` | 0.8 | "Safe" = 4 seasons in 5 |
| `POOR_HARVEST_SHARE` | 0.5 | Poor season = half a harvest |
| Defaults | 15 Nov, loamy sand, lowland, 0 waterings | |

---

## 9. NASA data and how it is combined

### 9.1 Sources
| Dataset | Product | Resolution | Period | Role | Access |
|---|---|---|---|---|---|
| **NASA POWER** | Daily `PRECTOTCORR` (rain), `T2M_MAX`, `T2M_MIN`, `GWETROOT` (root-zone wetness, MERRA-2) | 0.5° × 0.625° | 2001–2026; current season live | **Engine input**: every replay; look-alike features | Open API, no login; history pre-built, current season fetched by the browser |
| **GPM IMERG** | Late Run daily V07 (`GPM_3IMERGDL`) | 0.1° | 1 Aug → yesterday | **Check on the input**: satellite rain vs model rain | GES DISC OPeNDAP, Earthdata token, built in CI daily |
| **SMAP** | L4 Global 3-hourly 9 km (`SPL4SMGP` v8), `sm_rootzone` | 9 km | latest day; same date since 2015 | **Check on the season**: soil now vs past years | CMR search + NSIDC cloud OPeNDAP, Earthdata token, built in CI daily |
| **GLDAS** | Noah 2.1 3-hourly (`GLDAS_NOAH025_3H`), `RootMoist_inst` | 0.25° | 2001–2026 | **Validation of the engine** across 25 seasons | Giovanni time-series API, Earthdata token, built once |
| FAO-56 | Allen et al. 1998, Tables 11, 12, 19, 22; eq. 21, 52 | – | – | Crop and soil parameters, ET0 | Public document |
| OAE, TDRI | Farm-gate prices, yields | national | 2023–2026 | Income | Public releases |
| EOX Sentinel-2 cloudless 2016 | Copernicus Sentinel-2 mosaic | 10 m | 2016 | Satellite basemap | WMTS, CC BY 4.0 |
| OpenFreeMap | OpenStreetMap vector tiles | – | – | Street basemap | Open |

### 9.2 Three roles for NASA data
1. **Drive** the model: POWER gives every day of every season.
2. **Check the input now**: IMERG and SMAP say whether this season's rain and soil look like what the model is using.
   On 15 Nov they disagreed in the north-east (IMERG 412 mm vs POWER 633 mm; soil drier than 10 of 11 years), which
   tells the farmer the replays may be optimistic this year.
3. **Validate the model over time**: GLDAS tests whether the model's soil dries when the satellite-driven land model
   says it does.

### 9.3 Harmonising resolutions
The NASA POWER cell (0.5° × 0.625°, about 55 km) is the common unit. Finer data is averaged into it:
- IMERG: every 0.1° pixel whose centre is inside the cell (about 30 pixels), per day.
- SMAP: every 9 km pixel inside the cell, averaged over the day's 8 three-hourly granules.
- GLDAS: the 4–6 land pixels (0.25°) inside the cell, each converted from 3-hourly to daily means first. Nine mostly-sea
  cells have no GLDAS land pixel and get no self-check.
- Fill values and ocean pixels are dropped before averaging.

### 9.4 Volumes
| Data | Requests | Size |
|---|---|---|
| POWER history | 194 point requests (25 years each) | 33 MB committed |
| GLDAS history | about 1,000 point requests (25 years each), 6 parallel CI jobs, ~10 minutes | 10 MB added to the cell files |
| IMERG current season | about 105 daily subsets, 2 at a time | ~90 KB |
| SMAP | about 96 small subsets | small |

---

## 10. Architecture

### 10.1 Shape
```
             GitHub Actions (Python, holds the Earthdata token)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ gldas.yml (manual)      Giovanni GLDAS ──► rootzone in cells/*.json   │
  │ deploy.yml (push, PR, daily 01:30 UTC)                                │
  │   npm test ─► pipeline tests ─► IMERG ─► SMAP ─► vite build ─► Pages  │
  └──────────────────────────────────────────────────────────────────────┘
             one-off, local:  NASA POWER ──► grid.json, cells/*.json
                                      │  static JSON + JS (GitHub Pages)
                                      ▼
             Browser (React app)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ tap ─► snap to cell ─► cells/{id}.json + imerg + smap                 │
  │     ─► NASA POWER live (this season) ─► look-alike years              │
  │     ─► replay engine (TypeScript) ─► cards, timeline, window, check   │
  │ inputs, sliders ─► replay again locally (no network)                  │
  └──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Design decisions and why
| Decision | Why |
|---|---|
| **Static site on GitHub Pages**, no server | Free, fast, nothing to keep running; matches "hosted on GitHub" |
| **Engine in the browser** (TypeScript) | Inputs and sliders answer instantly; one source of truth for the science; anyone can read it |
| **Python pipeline prepares data, never computes outcomes** | No two implementations of the model to drift apart |
| **Data per grid cell, pre-built** | One request per field view (~220 KB); works on slow phone networks |
| **Earthdata token only in GitHub Actions secrets** | Never in the browser bundle or the repo |
| **Satellite steps allowed to fail** | A NASA outage hides one line instead of blocking a deploy |
| **IMERG and SMAP rebuilt per deploy, never committed** | Repo history does not grow daily; data is always fresh |
| **Current season fetched live from POWER** | No daily commit; always up to date; POWER allows browser requests |
| **Standard-library Python** | No dependency installs in CI; fewer things to break |
| **Approaches rejected**: FastAPI + React (needs a server host); Streamlit (needs a server, generic look) | See blueprint §4 |

### 10.3 Data contracts
- `grid.json`: `{version, cellSize {lat, lon}, generated, firstSeason, lastSeason, cells: [{id, lat, lon}]}`.
- `cells/{id}.json`: `{id, lat, lon, sources, wetnessScale {p05, p95}, seasons: [{year, start, rain[], tmax[], tmin[],
  wetness[], rootzone[]?}]}`; arrays run 1 Aug → 31 Jul; missing values are `null`.
- `imerg/current.json`: `{product, start, asOf, generated, cells: {id: [mm|null]}}`.
- `smap/current.json`: `{product, date, years[], generated, cells: {id: {now, past[]}}}`.
- TypeScript types: `engine/types.ts`, `data.ts`.

---

## 11. Technology stack

| Layer | Choice | Version |
|---|---|---|
| UI framework | React | 18.3.1 |
| Language | TypeScript | 5.6.3 |
| Build | Vite | 5.4.11 |
| Map | MapLibre GL JS, OpenFreeMap tiles, EOX WMTS | 4.7.1 |
| Charts | Hand-built SVG | – |
| Styling | Plain CSS with design tokens | – |
| Fonts (bundled, OFL) | Bricolage Grotesque (display), Figtree (text), Noto Sans Thai Looped (Thai) | – |
| Tests | Vitest + Testing Library; Python unittest | 2.1.8 |
| Pipeline | Python 3 standard library only | – |
| CI/CD | GitHub Actions; GitHub Pages | – |
| Data services | NASA POWER API; GES DISC OPeNDAP; NSIDC cloud OPeNDAP; CMR; Giovanni API | – |

No runtime AI, no analytics, no cookies, no login, no paid service.

---

## 12. Interface and experience design

### 12.1 Principles
- **Answer first.** The "In short" box comes before any detail.
- **Every number names its source.** Footer, tooltips, About page.
- **Honest by design.** Badge with reasons, blind spots, "not a forecast", "ask your extension officer".
- **Neutral about today's practice.** Leaving the field bare is shown as a choice with no risk and no income, not as a
  failure.
- **Phone first.** Tested at 375 px: no sideways page scroll; the timeline scrolls in its own box; tap targets 44 px.
- **Colour plus icon** for every outcome (🌱 🍂 ✖ ·), so colour-blind users can read the timeline.

### 12.2 Current look
A light grey ground, white cards, one blue accent, green / amber / red only for outcomes, one type scale
(13 / 14 / 16 / 18 / 28 px), rounded cards (18 px), a sky-and-fields illustration on the home screen. It was adapted
from a teammate's design (Cloof's simple shell) on Saturday night, replacing the blueprint's "warm farm" palette.

### 12.3 Honest review of the current interface (15 Nov)
A review at phone width in Thai found:
- **Little hierarchy.** About 12 blocks of equal weight; the eye has no clear landing point after the summary.
- **Self-contradicting summary.** For Khon Kaen it says sunn hemp is the best bet (11 of 25) and, in the same box, that
  its safe date has passed. True, but confusing without a next step.
- **Settings below the answer.** Changing an input rewrites everything above it, but nothing shows the link.
- **Scientist wording** in the NASA lines (POWER, IMERG, "% by volume"), where one plain sentence would do: "this season
  has had less rain than usual and the soil is drier than in 9 of 11 years".
- **Not yet Thai-first.** English opens by default; a link with only `lang=th` is ignored without a field; the Thai is
  translated English with brackets and acronyms; years appear as "44 45 46" on the timeline.
- **The timeline reads as a wall of red crosses** in dry regions.
- **Generic look:** pastel sky gradient, white rounded cards, soft shadows; nothing from a Thai rice field after
  harvest.

### 12.4 Planned redesign (after submission)
1. **Answer → why → change it:** one answer block in plain Thai (crop, risk level, the one action), then one "how this
   season is going" sentence combining IMERG, SMAP and the look-alike years, then a compact settings summary row at
   the top ("15 พ.ย. · ดินทรายปนร่วน · นาลุ่ม · ไม่รดน้ำ  แก้ไข").
2. **One comparison view:** a row per crop with a 25-dot season strip, odds and waterings needed, instead of three
   cards; today's practice becomes one line.
3. **Thai type system:** looped Thai (Noto Sans Thai Looped is already bundled) as the main face, a real type scale,
   full Buddhist-era years.
4. **A palette from the dry-season paddy:** straw, laterite, canal-water blue, young-rice green; colour fields instead
   of crosses, still colour-blind safe.
5. **One signature element:** the 25-season strip as the visual centre of the answer.
6. **Evidence on demand:** NASA lines and sources in a "see the NASA evidence" section.
7. **Thai by default**, with `lang` honoured in any link.

---

## 13. Quality: tests and verification

### 13.1 Automated tests
| Suite | Tests | Covers |
|---|---|---|
| `engine/engine.test.ts` | 18 | ET0, Ra example, Kc curve, water balance bounds, outcomes, heat, no data, strategies, determinism, waterings |
| `engine/window.test.ts` | 6 | Sowing window, latest safe date, days left |
| `engine/analog.test.ts` | 5 | Look-alike seasons, standardising, feature rules, split detection |
| `engine/income.test.ts` | 4 | Income rules, missing market data, no seasons |
| `engine/selfcheck.test.ts` | 7 | GLDAS scale, agreement, neither dries, missing data, every badge rule |
| `Results.test.tsx` | 20 | Cards, timeline, drawer dates, no-data cell, window, what-if, settings, share, income, IMERG, SMAP, self-check, High badge |
| `share.test.ts`, `data.test.ts`, `imerg.test.ts`, `About.test.tsx` | 10 | Share codec, tap → cell on the real grid, live POWER parsing, IMERG picking, About in both languages |
| Pipeline (`test_build_imerg/smap/gldas.py`) | 10 | Pixel indexing, parsing real server responses, cell means, fill values, season alignment |

All 80 pass on `main`. CI blocks a deploy when any test fails.

### 13.2 Checked by hand
- Each feature was opened in the browser after it was built (dev server and the live site), in English and Thai.
- Live site, 15 Nov after pull request 8: cell 16.50, 103.13 shows the GLDAS line "20 of 25", High on both crop cards,
  the IMERG line and the SMAP line.
- Science sanity checks: the rainy south comes out mostly safe; Isan favours early sowing and short crops; less rain
  or more heat never raises odds.

### 13.3 Not checked
- On a real phone: the share link inside LINE, my-location, the satellite layer rendering.
- Against real farms: no calibration data, no farmer or agronomist review.

---

## 14. How it was built

### 14.1 Method
- **Blueprint first.** A full design (`docs/superpowers/specs/2026-11-14-field-time-machine-design.md`) recorded the
  product, the science, the data contracts, the screens, a milestone plan (M0–M10) and the challenge mapping before
  any code.
- **AI-assisted development under human direction.** The code and documents were written with an AI coding assistant
  (Claude, by Anthropic). The team set the direction, made the product calls, held the Earthdata account, and reviewed
  and merged every change. The app itself uses no AI at run time.
- **Feature branches and pull requests.** Every feature on its own branch, merged to `main` by pull request; CI runs on
  every pull request.
- **Test-driven where it matters.** Engine rules and pipeline parsers were written test-first; bugs got a test that
  fails on the bug.
- **Evidence over assertion.** A feature counts as done when its tests pass and it has been seen working in the
  browser; numbers in the docs come from real runs.
- **Security by construction.** The Earthdata token was created by a human, stored only as a GitHub secret, and never
  typed, pasted or read by the assistant. Every probe of NASA services ran inside CI with the secret.

### 14.2 Timeline (Thailand time)
| When | Step | Pull request |
|---|---|---|
| Sat 14 Nov 19:28 | Project started | – |
| Sat 20:37–20:44 | Blueprint and MVP plan | – |
| Sat 21:02 | Core prototype: pipeline, engine, cards, timeline, drawer | 1 |
| Sat 21:30–21:44 | FAO-56 value check; sowing window, what-if, look-alike seasons; satellite basemap, my location, About | 2 |
| Sat 22:44 | Restyle after the team's design; answer first | 3 |
| Sun 04:24 | Waterings and waterings needed; submission kit | 4 |
| Sun 08:57 | Share links | 5 |
| Sun 09:05 | Income estimate | 6 |
| Sun 09:20–09:43 | Earthdata secret check; IMERG satellite rain; daily refresh | 7 |
| Sun 11:43–12:06 | GLDAS and SMAP probes; GLDAS history; self-check and High badge; SMAP soil now | 8 |
| Sun 12:38 | Full handoff | 9 |
| Sun (this document) | Project document | – |

### 14.3 Problems met and how they were solved
| Problem | Solution |
|---|---|
| With the blueprint's model alone, every crop failed every year in Isan | Added FAO-56 capillary rise for lowland paddies and a field-type input (A1) |
| Even then, three of four crops mostly failed on leftover moisture | Added waterings and "waterings needed" (A2): the honest answer is "this needs water" |
| Mung bean Kc end used the fresh-harvest value | Corrected to 0.35 (dry seed) from FAO-56 Table 12 |
| FAO-56 has no "clay loam" row | Used its nearest row, silt clay loam |
| Sowing window accepted every date when the best odds were tiny | A date now needs at least one good season |
| A re-run of an old deploy put an old build on the live site | Rule: only re-run the latest run on `main` |
| The Earthdata secret was not saved on two tries | A small CI check confirmed when it finally reached GES DISC |
| GES DISC refused six parallel IMERG requests (HTTP 503) | Two at a time with exponential backoff; one missing day becomes a gap |
| GES DISC shut down the Hydrology Data Rods service the blueprint named | Found its replacement, the Giovanni time-series API; one point per request |
| Giovanni refused the token in the header older examples use | `Authorization: Bearer` works |
| SMAP DAP4 CSV came back empty | DAP2 ASCII works |
| The blueprint's self-check rule gave 8 % agreement | Same stress point on each source's own scale; 52 %; changed once and reported |
| Clipboard blocked in in-app browsers | Fallback copy method |

---

## 15. Operations: how it keeps running with no one on duty

- **Deploy:** every push to `main`, and every day at 01:30 UTC (08:30 Thailand), GitHub Actions tests, fetches IMERG
  and SMAP, builds and publishes. 10–15 minutes.
- **Failure mode:** if a NASA service is down, that step fails, the site still deploys, and the app hides that line.
- **Secret:** one GitHub secret, `EARTHDATA_TOKEN`. Earthdata user tokens normally last 60 days, so this one is expected
  to expire around **mid-January 2027**; the account owner then generates a new one and updates the secret.
- **Server move:** GES DISC's on-premises OPeNDAP (used for IMERG) is due to move to Earthdata Cloud; when it does,
  `build_imerg.py` needs the cloud address (as `build_smap.py` already uses).
- **Cost:** none. GitHub Pages and Actions free tiers; NASA services are free.
- Full runbook, troubleshooting and the GLDAS re-run procedure: `docs/HANDOFF.md`.

---

## 16. Results: what the app says about Thailand

These are model outputs with starting values, useful for patterns, not as facts.

### 16.1 Patterns
- **Isan (north-east):** on leftover moisture alone, most crops fail in most seasons on sandy soils; early sowing and
  short crops do best; with one or two waterings, sunn hemp and some legumes become viable. At cell 16.50, 102.50 near
  Khon Kaen with default settings, no crop but sunn hemp survives a single season on leftover moisture (sunn hemp 11
  of 25); with 2 waterings sunn hemp reaches 22 of 25 and mung bean 7 of 25. Peanut and field corn, long-season crops,
  stay at 0.
- **The south** comes out mostly safe, but see the calendar limit in §17.2.
- **Less rain or more heat never raises the odds** (tested).

### 16.2 This season (15 Nov 2026)
- Look-alike years near Khon Kaen: 2008, 2016, 2025.
- IMERG satellite rain since 1 Aug at cell 16.50, 103.13: 412 mm, against 633 mm in POWER.
- SMAP: the root zone there is drier than on the same date in 10 of 11 years since 2015.
- Together: this dry season is starting drier than the model's input suggests.

### 16.3 Self-check across the country
| Measure | Value |
|---|---|
| Cells with GLDAS data | 185 of 194 |
| Median hit rate | 0.52 |
| Middle half of cells | 0.36 – 0.64 |
| Cells at 0.75 or above (High possible) | 16 |
| Cells below 0.5 (Low) | 89 |
| Under the blueprint's original rule | median 0.08 |

High-capable cells: 16.50_103.125, 16.00_103.750, 15.50_103.750, 15.50_104.375, 15.50_105.000, 15.00_103.750,
14.50_103.750 (Isan); 14.00_100.000, 13.50_100.625 (centre); 10.00_98.750, 10.50_98.750, 8.00_99.375, 7.50_99.375,
7.50_100.000, 6.00_101.250, 5.50_101.250 (south).

**How to read it:** the model agrees with an independent NASA land model about half the time. That is a real, modest
result, and the app shows it as such: most cards are Medium or Low, and High appears only where both the self-check and
the look-alike years agree.

---

## 17. Honest limits and risks

### 17.1 Science
- **Uncalibrated.** Every constant is a starting value; no farm data has been used to tune them.
- **55 km average.** A single field can be wetter (low paddy) or drier (sandy rise).
- **Self-check is model against model.** GLDAS is a land model driven by satellite data, not a field measurement.
- **POWER rain may be high this season** in the north-east compared with IMERG; replays use POWER.
- **Crop values** for Thai varieties, heat limits and sunn hemp are assumptions; the mung bean yield is an estimate;
  the peanut price is from 2022/23.
- **Water and heat only.** No pests, disease, labour, markets or prices beyond the standard income figure.
- **Unconfirmed premise.** No farmer has yet confirmed that water risk is the main reason fields stay bare.

### 17.2 One calendar for the whole country
The data covers all of Thailand, but the model uses one crop calendar: seasons start 1 Aug and sowing runs 1 Nov–1 Feb.
That fits rain-fed rice in the north-east, north and much of the centre. It does not fit the **southern east coast**
(Nakhon Si Thammarat, Songkhla, Pattani), where the monsoon peaks October–December and rice is harvested around
February–March, so the app answers the wrong question there; nor the **irrigated central plains**, where many farmers
grow a second rice crop with canal water on clay soils. Fix: regional sowing calendars and defaults (§18).

### 17.3 Operations
Token expiry (mid-January 2027), the GES DISC server move, GES DISC rate limits, a 43 MB data folder, a 1 MB map
bundle. See §15.

### 17.4 Untested in the field
Share link inside LINE, my-location on a real phone, the satellite layer rendering.

---

## 18. Roadmap

### 18.1 Next week (V1 prototype period)
| Item | Effort | Why |
|---|---|---|
| Thai-first redesign (§12.4) | 1–2 days | Clarity for the real user |
| Regional sowing calendars (south to March; defaults by region) | ~2 h + review | Correct answers outside the main-season rice zone |
| Real-phone check: LINE share, location, satellite layer | 15 min | Untested paths |
| IMERG through Earthdata Cloud OPeNDAP | 30 min | Survive the server move |
| Token-expiry alarm (fail loudly or open an issue on 401) | 30 min | Zero-ops |

### 18.2 After the hackathon
- **Talk to farmers and extension officers** in at least one Isan sub-district: confirm the premise, test the wording.
- **Calibrate** against crop-cut or survey data (Department of Agriculture, Land Development Department trials).
- **IMERG Final for past seasons** as the rain input, with a before/after comparison.
- **MODIS NDVI** as a second check (F19).
- **SRTM** to tell low paddies from uplands automatically (F20).
- **"Ask why" chat (F18):** a drawer where an LLM answers questions by calling the engine (replay, odds, window) and
  quoting its numbers; a small serverless proxy holds the API key with a rate limit.
- **More crops:** sesame, soybean, vegetables with irrigation.
- **LINE-native delivery:** a LINE Official Account that returns a field's answer from a shared location.
- **Seasonal outlooks:** combine look-alike years with seasonal rain outlooks, still labelled as uncertain.

---

## 19. Presenting the project

### 19.1 The story in four beats
1. **The gap:** after the rice harvest, fields sit bare; planting again is a gamble on water nobody can see.
2. **The time machine:** tap your field; NASA's 25-year record replays every dry season, day by day, for four crops.
3. **The answer you can act on:** odds, the season you are in, the last safe sowing date, the water you would need,
   the income at stake, the effect on your soil.
4. **Trust, earned:** it checks itself against NASA satellite-based soil moisture, tells you how confident it is and
   why, and tells you what to ask your extension officer.

### 19.2 Demo path (about 2 minutes)
1. Open the live site, switch to ไทย.
2. Tap near Khon Kaen (16.50, 102.50): read "In short".
3. Point at "this season looks like…", the IMERG line and the SMAP line: this year is drier than the model's input.
4. Open the three cards: odds, waterings needed, income, soil effect.
5. Set waterings to 2: sunn hemp jumps from 11 to 22 of 25.
6. Tap a failed season in the timeline: the soil-water chart and the day the crop dies.
7. Move to 16.50, 103.13 (`#lat=16.5&lon=103.125`): the GLDAS line (20 of 25) and the High badge with its reason.
8. Drag the rain slider to −30 %: everything updates, labelled "not a forecast".
9. Close on the About page: what it cannot see; it supports, not replaces, the farmer.

Check the numbers on screen before recording; live data can shift them.

### 19.3 Space Apps judging criteria
Space Apps judges have scored on these five themes in past years; check the 2026 rules page for the exact wording.

| Criterion | Evidence |
|---|---|
| **Impact** | Addresses a real decision for rain-fed rice farmers across Thailand; answers in Thai on a phone; free and zero-ops; designed to be shared with extension officers |
| **Creativity** | The "time machine" framing (seasons the farmer remembers); look-alike seasons; waterings needed as the actionable answer; a self-check that sets the confidence badge |
| **Validity** | FAO-56 method with cited table values; 80 automated tests; independent checks against IMERG, SMAP and GLDAS; limits stated plainly, self-check reported as it came out |
| **Relevance** | Five NASA data streams (POWER, IMERG, SMAP, GLDAS via Earthdata services) in three roles; every challenge ask mapped (§5) |
| **Presentation** | Live site, answer first, share links, About page, this document, a 2-minute video |

### 19.4 Questions to expect
| Question | Answer |
|---|---|
| "How accurate is it?" | Not calibrated against farms yet. Against NASA GLDAS it agrees on the dry-down day in about half of past seasons at the median cell; we show that number and set the confidence badge from it. Use it to compare crops and dates, not as a promise. |
| "Why not a forecast?" | Farmers trust what happened. We show 25 real seasons and which ones this season resembles; the sliders explore change but are labelled "not a forecast". |
| "Why is the resolution so coarse?" | NASA POWER is the long gap-free daily record; 55 km is its grid. Finer NASA data (IMERG 10 km, SMAP 9 km) checks it for this season. |
| "Does it work outside Isan?" | The data covers all of Thailand. The crop calendar fits the main-season rice zone; the southern east coast needs a later calendar, which is on the roadmap. |
| "Where is the AI?" | Pattern matching (look-alike seasons) and a self-check, all transparent statistics. An LLM chat that explains results by calling the engine is designed but not built; we chose not to put an API key in a static site. |
| "Who maintains it?" | Nobody needs to: CI refreshes satellite data daily; the only manual task is renewing one token every 60 days. |

---

## 20. Glossary

| Term | Meaning |
|---|---|
| Cell | One NASA POWER grid box, 0.5° latitude × 0.625° longitude (about 55 km); id like `16.50_102.500` |
| Season | A dry season, named by the year it starts (1 Aug); stored to 31 Jul |
| Replay | Running the soil-water model for one crop, one season, one sowing date |
| Outcome | Good, poor, failed (with day and cause), or no data |
| Odds | Good seasons ÷ seasons with data, "survived N of 25 seasons" |
| Strategy | Card A (rice → bare), B (best legume), C (best other crop) |
| Look-alike season (analog) | A past season whose start resembles the season under way |
| Sowing window | The latest sowing date that keeps the odds near their best |
| Waterings needed | Fewest 30 mm waterings for the crop to survive 4 seasons in 5 |
| Self-check | Model dry-down day vs GLDAS dry-down day, season by season |
| Hit rate | Share of seasons where the two agree |
| Confidence badge | High / Medium / Low with reasons |
| TAW, RAW | Total and readily available soil water in the root zone (FAO-56) |
| Ks | Water-stress factor, 1 = no stress |
| ET0, ETc | Reference and crop evapotranspiration, mm/day |
| p | Share of TAW a crop can use before stress (FAO-56 Table 22) |
| Capillary rise | Water lifted into the root zone from a shallow water table |
| BE | Buddhist Era year = CE + 543 |
| Rai | Thai area unit, 1,600 m² |
| OAE | Office of Agricultural Economics, Thailand |
| Earthdata | NASA's login and data-access system |

---

## 21. Where to find things in the code

```
README.md                           public overview
docs/PROJECT.md                     this document
docs/HANDOFF.md                     operations and troubleshooting
docs/SUBMISSION.md                  project page text, video script, checklist
docs/superpowers/specs/             blueprint; income design
.github/workflows/deploy.yml        test, IMERG, SMAP, build, deploy; daily 01:30 UTC
.github/workflows/gldas.yml         GLDAS history, manual, 6 shards
pipeline/build_history.py           NASA POWER → grid.json, cells/*.json
pipeline/build_gldas.py             Giovanni GLDAS → rootzone in the cells
pipeline/build_imerg.py             GES DISC IMERG → data/imerg/current.json
pipeline/build_smap.py              NSIDC SMAP → data/smap/current.json
pipeline/test_build_*.py            pipeline tests with real server responses
web/public/data/                    grid and 194 cell files
web/src/engine/index.ts             replay, odds, strategies, window, waterings
web/src/engine/et0.ts               Hargreaves ET0 and radiation
web/src/engine/analog.ts            look-alike seasons
web/src/engine/selfcheck.ts         GLDAS self-check and confidence badge
web/src/engine/income.ts            income estimate
web/src/engine/constants.ts         every tunable value
web/src/engine/types.ts             data contract
web/src/data/crops.json             crop values with sources and market prices
web/src/data.ts                     loading, tap → cell, live POWER, IMERG and SMAP
web/src/share.ts                    share links
web/src/Results.tsx                 the field page
web/src/App.tsx, MapView.tsx        shell, map, location, satellite layer
web/src/About.tsx                   About page
web/src/i18n.ts                     all Thai and English text
web/src/styles.css, fonts.css       design tokens, bundled fonts
```
