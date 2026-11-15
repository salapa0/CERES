# Crop choices, income first, more crops — design

Date: 2026-11-15 · Branch: `ux/crop-choices-income` · Builds on `2026-11-15-thai-first-ux-design.md`

## Why

A tech-lead audit of the live Thai-first page (annotated screenshot, 2026-11-15) found:

- The A/B/C cards decide for the farmer. We don't know what they plan to plant; letting them pick gives a
  stronger sense of control. The card content is good; only its presentation changes.
- The page recommends ปอเทือง because it survives 25/25, but it earns nothing. For a farmer, income is the
  point; a crop with no income must say so loudly.
- "ฤดูแล้ง" as a counting unit is hard to grasp. Farmers think in years ("ปีไหนรอด") and months ("เดือนไหนปลูก").
- The what-if weather sits at the bottom; it is an input, so it belongs with the settings: **pick → set → see**.
- Four crops is too few.

## Goals

1. Journey: ① pick a place on the map → ② set the field and the weather → ③ see the answer.
2. Recommend the crop that earns most among the crops that are safe; say plainly when none is.
3. Show income on every crop; "ไม่มีรายได้" for crops grown for the soil, "ยังไม่มีราคาอ้างอิง" where we have
   no sourced price.
4. Let the farmer pick any crop and see its detail; the recommendation is pre-selected.
5. Count in years; use months for timing (when to sow, when crops die).
6. Ten crops instead of four, each with sourced water data.

## Non-goals / anti-goals

- No yield model. Income stays "standard yield × standard price × share of good years" — income, not profit.
- No second rice (นาปรัง): flooded rice needs a different water model. Say so rather than show a wrong number.
- No invented prices. A crop without a sourced farm-gate price shows "ยังไม่มีราคาอ้างอิง" and is never
  ranked on income.
- The share link format stays compatible (sow dates keep their `MM-DD` values).

## Decisions (tech lead, 2026-11-15)

| Topic | Decision |
|---|---|
| แปลงของคุณ | **พิกัด** (EN "Location") — we only know a point; the data covers ~55 km |
| เลือกนาใหม่ | **เลือกพิกัดใหม่** (EN "Pick another place") |
| เชื่อได้แค่ไหน | **ข้อมูลอ้างอิง** (EN "Reference data"); keep the lead line |
| ไทม์แมชชีน: ถ้าปลูกในปีที่ผ่านมา | **ย้อนดูปีก่อน ๆ ว่ารอดไหม** (EN "Past years: would it have survived?") — not "ผลผลิต", the engine has no yield |
| ถ้าฟ้าเปลี่ยน (ไม่ใช่การพยากรณ์) | **เลือกสภาพอากาศที่ต้องการวิเคราะห์** (EN "Weather to test"), moved into the settings; "ไม่ใช่การพยากรณ์" stays as its hint |
| Recommendation rule | **Safe first, then income** (approach 2 below) |
| New crops | ถั่วเหลือง, งา, แตงโม, ข้าวโพดหวาน, พริก, หอมแดง |

## Approaches for the recommendation

1. **Highest average income.** Simplest; a high-price crop that fails 2 years in 5 can win, and the model
   has no costs, so lost inputs never show.
2. **Safe first, then income — chosen.** Among crops with a price that survived ≥ `SAFE_SHARE` (4 in 5) of
   past years with the farmer's settings, recommend the highest average income. If none: say no cash crop
   is safe without water and give the cheapest watering fix (existing `waterNeeded`).
3. **Highest survival, income shown larger.** Today's rule; ปอเทือง keeps winning — the reported problem.

Average income already counts failed years as ฿0 and poor years as half (`engine/income.ts`).

## The page

```
① เลือกพิกัด      [map]
   พิกัด 14.50, 102.50           [เลือกพิกัดใหม่] [คัดลอกลิงก์]
② คิดจากนาแบบนี้  ปลูก 1 ธ.ค. · ดินทรายปนร่วน · นาลุ่ม · ไม่รดน้ำ · อากาศตามจริง   [เปลี่ยน]
   (panel: soil · position · water · sow · weather: rain −30…+10 %, heat 0…+3 °C)
③ สรุป            ถั่วลิสงได้เงินมากสุดในพืชที่ปลอดภัย ≈ ฿14,000/ไร่ · รอด 22 จาก 25 ปี
                 ปลูกภายใน 17 ม.ค. · เหลืออีก 63 วัน
   คุณจะปลูกอะไร
     ถั่ว บำรุงดิน   [ถั่วเขียว ฿2,050 · 15/25] [ถั่วลิสง ฿14,000 · 22/25 · แนะนำ ✓] [ถั่วเหลือง …]
     พืชขาย         [ข้าวโพดเลี้ยงสัตว์ …] [ข้าวโพดหวาน ยังไม่มีราคาอ้างอิง] [งา …]
     ผัก ต้องรดน้ำ   [แตงโม …] [พริก …] [หอมแดง …]
     ไม่ปลูกเพื่อขาย [ปอเทือง ไม่มีรายได้] [ปล่อยนาว่าง ไม่มีรายได้]
   ┌ detail of the picked crop: income first (big), years survived + marks, plant-by date,
   │ sow-month odds, danger month, water needed, soil effect, "ดูเพิ่มเติม"
   ย้อนดูปีก่อน ๆ ว่ารอดไหม   [year chart; picked crop's row highlighted]
   ข้อมูลอ้างอิง             [analog, GLDAS, IMERG, SMAP]
```

- Crop choices are one radio group (chips), grouped by `group` with a heading per group. Each chip shows
  the name, the average income or the no-income wording, and "รอด n/25".
- The recommended crop is selected on load and carries an "แนะนำ" tag. Changing settings re-selects the
  recommendation only if the farmer has not picked one themselves.
- Phones (≤ 640 px): the year chart shows the picked and the recommended crop; "ดูทุกพืช" shows the rest.
  Desktop shows all rows.

## Years and months

- Every "จาก N ฤดู" becomes "จาก N ปี" ("of N years"). Each season is one year's dry season, so numbers don't change.
- Sow-date chips read as months: "ต้น พ.ย." (1 Nov), "กลาง พ.ย." (15 Nov), … — same `MM-DD` values.
- Detail panel, **sow-month odds**: for each month in the sowing sweep (Nov–Jan, plus 1 Feb), the mean
  years survived over the sweep dates in that month: "ปลูก พ.ย. รอด 20/25 · ธ.ค. 15/25 · ม.ค. 8/25".
- Detail panel, **danger month**: among failed years, the month in which most crops died (from
  `Outcome.deathDay`): "ปีที่ไม่รอด ส่วนใหญ่แห้งตายช่วง ก.พ. (7 จาก 9 ปี)".

## New crop data

Water values from FAO-56 (Tables 11, 12, 22), read 2026-11-15. Stage lengths pick the tropical/hot row
where one exists. Zr takes the low end (plough pan), as for the existing crops.

| Crop | Stages (ini/dev/mid/late) | Kc ini/mid/end | Zr, p | Group | Market |
|---|---|---|---|---|---|
| ถั่วเหลือง soybean | 15/15/40/15 (Tropics, Dec) | 0.4/1.15/0.50 | 0.6, 0.50 | legume | 264 kg/rai (OAE, 6 northern provinces 2025/26) × 18.97 ฿/kg (mixed grade, 30 Nov 2025, OAE) |
| งา sesame | 20/30/40/20 (China, June) | 0.35/1.10/0.25 | 1.0, 0.60 | cash | none sourced |
| แตงโม watermelon | 10/20/20/30 (Near East, hot) | 0.4/1.00/0.75 | 0.8, 0.40 | veg | none sourced (only 2019 or anecdotal prices) |
| ข้าวโพดหวาน sweet corn | 20/20/30/10 (Philippines) | 0.3/1.15/1.05 | 0.8, 0.50 | cash | none sourced |
| พริก chili | 25/35/40/20 (sweet pepper, Medit.) | 0.6/1.05/0.90 | 0.5, 0.30 | veg | none sourced; values borrowed from sweet pepper (no chili row in FAO-56) |
| หอมแดง shallot | 25/30/10/5 (Onion green, Medit.; ~70 days like Sisaket shallot) | 0.7/1.05/0.75 (Onions, dry) | 0.3, 0.30 | veg | 4,212 kg/rai (Sisaket, 11 Dec 2025, opsmoac) × 12.5 ฿/kg (10–15 fresh, farm gate, 16 Dec 2025, Sisaket Provincial Commerce Office) |

Heat limits are assumptions (40 °C; 38 °C for sweet corn, as field corn). All new crops are `assumption: true`.

## Engine changes

- `Crop.group: 'legume' | 'cash' | 'veg' | 'manure'`.
- `recommend(timeline, crops)` → `{ cropId, reason: 'safeIncome' | 'noneSafe', ... }` (approach 2).
- `monthOdds(window)` and `dangerMonth(outcomes, seasons)`.
- `buildStrategies` and the A/B/C copy are removed.

## Left to the builder

Exact wording of new strings, chip layout details, and test names. The self-check stays on mung bean.
