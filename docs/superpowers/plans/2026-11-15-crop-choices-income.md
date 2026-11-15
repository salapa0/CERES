# Crop choices and income first — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the A/B/C cards into crop choices led by income, add six crops, move weather into the settings, and count in years with months for timing.

**Architecture:** Engine gains pure functions (`recommend`, `monthOdds`, `dangerMonth`) and a `group` on each crop; `Results.tsx` swaps `Summary`/`Card` for `Summary` + `CropPicker` + `CropDetail`; `FieldSettings` takes the what-if weather as a fifth setting.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-15-crop-choices-income-design.md`

## Global Constraints

- Copy (TH/EN): พิกัด/Location · เลือกพิกัดใหม่/Pick another place · ข้อมูลอ้างอิง/Reference data · ย้อนดูปีก่อน ๆ ว่ารอดไหม/Past years: would it have survived? · เลือกสภาพอากาศที่ต้องการวิเคราะห์/Weather to test (hint keeps "ไม่ใช่การพยากรณ์"/"not a forecast").
- Counts say ปี/years, never ฤดู/seasons, in user-facing odds lines.
- "Safe" = good/total ≥ `SAFE_SHARE` (0.8). Recommendation: highest `incomeEstimate(...).average` among safe crops that have a `market`.
- No invented prices: only soybean and shallot get new `market` entries (values in the spec table).
- Share-link `sow` values stay `MM-DD` from `SOW_DATES`.
- Run in `web/`: `npx vitest --run`, `npx tsc --noEmit -p .` (then delete `tsconfig*.tsbuildinfo`), `npm run build`.

## Review Focus

- All seasons `nodata` → no recommendation, no "0 of 0", picker still renders.
- No crop safe and no priced crop safe → summary says so and gives the cheapest watering fix, never names an unsafe crop as "best".
- Picking a crop, then changing settings → the farmer's pick stays; without a pick, the selection follows the new recommendation.
- A crop that never failed → no danger-month line.
- Sowing sweep month with no data → month shown as "–", not NaN.

---

### Task 1: Labels and years

**Files:** Modify `web/src/i18n.ts`, `web/src/Results.tsx` (no logic), `web/src/Results.test.tsx`.

- [ ] Update keys: `field.title`, `field.change`, `check.title`, `timeline.title`, `card.odds`, `summary.*`, `selfcheck.line`, `about.how.4` to the constraint copy, ฤดู→ปี / seasons→years in odds lines.
- [ ] Update tests that match old copy (`How sure is this?` → `Reference data`, `survived 2 of 2` stays numeric, `16 of 16 seasons` → `16 of 16 years`).
- [ ] Run vitest: all pass. Commit "Rename the field, check and timeline headings in plain words".

### Task 2: Weather in the settings

**Files:** Modify `web/src/FieldSettings.tsx`, `web/src/Results.tsx`, `web/src/i18n.ts`, test.

**Interfaces:** `FieldSettings({ value, onChange, lang, weather, onWeather })` where `weather: WhatIf`, `onWeather: (w: WhatIf) => void`.

- [ ] Test: open "Change" → 6 radiogroups (soil, position, water, sow, rain, heat); the summary line ends with `อากาศตามจริง` by default and `ฝน −30%` after picking −30%; no `data-testid="whatif"` at the page bottom.
- [ ] Move `RAIN_STEPS`, `HEAT_STEPS`, `describeWhatIf` usage into FieldSettings; delete `WhatIfPanel`.
- [ ] Vitest pass; commit "Move the weather choice up into the field settings".

### Task 3: Engine — groups, recommend, month odds, danger month

**Files:** Modify `web/src/engine/types.ts`, `web/src/engine/index.ts`, `web/src/data/crops.json` (add `group` to 4 crops); Create `web/src/engine/recommend.ts`, `web/src/engine/recommend.test.ts`.

**Interfaces (produces):**
- `Crop.group: 'legume' | 'cash' | 'veg' | 'manure'`
- `recommend(timeline: Timeline, crops: Crop[]): Recommendation` with `Recommendation = { cropId: string | null; reason: 'safeIncome' | 'noneSafe' | 'noData' }`
- `monthOdds(w: SowingWindow): { month: number; good: number; total: number }[]` (month 1–12, in sweep order; mean over that month's sweep dates, rounded; total 0 when no data)
- `dangerMonth(outcomes: Outcome[], seasons: SeasonData[]): { month: number; count: number; failed: number } | null`

- [ ] Tests: safe+priced highest-average wins over a safer lower-income crop; unsafe high-income crop is not picked; no safe priced crop → `noneSafe`; all nodata → `noData`; monthOdds groups Nov/Dec/Jan/Feb; dangerMonth picks the modal death month and is null with no failures.
- [ ] Implement; remove `buildStrategies` and its test.
- [ ] Vitest + tsc pass; commit "Recommend the best-earning safe crop".

### Task 4: Crop choices replace the cards

**Files:** Modify `web/src/Results.tsx`, `web/src/i18n.ts`, `web/src/styles.css`, test.

**Interfaces:** consumes Task 3. Components `Summary({ rec, ... })`, `CropPicker({ crops, picked, rec, onPick, odds, income })` (radiogroup, chips grouped with headings), `CropDetail({ crop | null(fallow), ... })` with `data-testid="detail"`.

- [ ] Tests: a radiogroup named "คุณจะปลูกอะไร"/"What will you plant?" with one radio per crop plus fallow; the recommended radio is checked and carries "แนะนำ"/"Recommended"; sunn hemp chip says "ไม่มีรายได้"; a crop with no market says "ยังไม่มีราคาอ้างอิง"; picking peanut shows its detail with income first; the picked row in the year chart has `aria-current`/class `is-picked`; the summary names the income and years.
- [ ] Phone collapse: rows that are neither picked nor recommended get class `minor`; a "ดูทุกพืช" button toggles `.show-all` (CSS hides `.minor` ≤640 px).
- [ ] Vitest pass, browser check; commit "Let the farmer pick a crop, led by income".

### Task 5: Six new crops

**Files:** Modify `web/src/data/crops.json`, engine test, i18n (group headings), About crop list if it names four crops.

- [ ] Test: 10 crops load, each with `group` and ≥1 source; soybean market 264 × 18.97; shallot market 4212 × 12.5; sesame, watermelon, sweet corn, chili have no market.
- [ ] Add entries exactly as in the spec table, with sources citing FAO-56 rows and the market pages.
- [ ] Vitest pass; commit "Add soybean, sesame, watermelon, sweet corn, chili and shallot".

### Task 6: Months

**Files:** Modify `web/src/i18n.ts` (month chip labels), `web/src/FieldSettings.tsx`, `web/src/Results.tsx`, test.

- [ ] Tests: sow chips read "ต้น พ.ย.", "กลาง พ.ย." … ; detail shows "ปลูก พ.ย. รอด n/N" for the picked crop; a crop that fails shows the danger-month line; a crop that never fails has none.
- [ ] Implement with `monthOdds` and `dangerMonth`.
- [ ] Vitest pass; commit "Say when to sow and when crops die, by month".

### Task 7: Verify

- [ ] `npx vitest --run`, `npx tsc --noEmit -p .`, `npm run build` all green; browser check at 360 px and desktop, TH and EN; README feature list updated.
