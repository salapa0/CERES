# Thai-first UX redesign: design

Date: 15 Nov 2026. Branch: `ux/thai-first-redesign`. Status: design approved by the team lead's "GO"; builder calls
are marked *(my call)*.

## Why

The engine is sound, but the page reads like a report for scientists. The 15 Nov critique found these problems:

1. **Not Thai-first.** The page opens in English for everyone, including farmers whose phones are set to Thai.
2. **Contradictory answer.** On the pilot field the summary says "Risky here… leave it bare" in red, and the next line
   in green says sunn hemp survives with two waterings. Below that, three grey lines of NASA jargon (IMERG, POWER,
   SMAP) come before anything the farmer can act on.
3. **Settings sit below the answer.** The answer depends on four settings (sowing date, soil, field type, waterings)
   that the farmer has not seen yet. The settings are dropdowns, and "Lowland pad…" gets cut off on a phone.
4. **A wall of red ✖.** On a dry cell the timeline and the meters are almost all red. That reads as alarm, not as
   information. The ✖ glyph is the only cue that tells failed and poor seasons apart at that size.
5. **Generic look.** It's a blue SaaS shell (white cards, one blue accent) that could belong to any product.

## Who it is for (empathy notes)

- **The farmer** is often over 50 and reads Thai. They open the link from LINE (the in-app browser) on a mid-range
  Android phone, 360–412 px wide, outdoors in bright sun, on a patchy mobile connection. They count better than they
  read percentages, and they have large fingertips.
- **The extension officer** reads the detail, checks the assumptions, and sends the link to farmers.
- **The judge** uses an English desktop browser and wants to see the NASA data at work and the honesty about limits.

## References (evidence, not templates)

| Reference | What we take |
|---|---|
| GOV.UK design principles and the question-pages pattern | Start with what the user needs. Do less. Plain words. Avoid range sliders, or offer a choice that needs no dragging. One thing at a time. |
| Google Maps / Grab (the apps Thai users know best) | Tap a place, and a result panel comes in. On desktop the panel sits beside the map. |
| Phone weather apps | One big verdict you can read at a glance, then detail tiles. |
| Google Flights search summary | The settings as a one-line summary at the top ("15 Nov · Loamy sand · Lowland · No water") with Change. Options ranked, the best one tagged. |
| Icon arrays from risk-communication research (Galesic, Garcia-Retamero & Gigerenzer 2009) | Show "7 of 25" as 25 marks you can count. Icon arrays help readers with low numeracy understand risk. |

We reject: dropdowns for short choices, sliders, a red wall for failure, jargon before action, and English by default.

## Goals, non-goals, anti-goals

- **Goals:**
  - the answer is readable in 5 seconds on a phone, in Thai;
  - the farmer sees and can change the assumptions *before* the verdict;
  - one verdict with no contradictions;
  - the NASA checks are grouped under "How sure is this?";
  - it works in the LINE in-app browser, on iOS Safari 14+ and Chrome 87+;
  - it is keyboard- and screen-reader friendly.
- **Non-goals:**
  - changing the engine or the numbers;
  - new data;
  - dark mode (the page is used outdoors, so it stays light; *my call*);
  - place names (that would need a geocoding service).
- **Anti-goals:**
  - a prettier page that hides the limits;
  - adding any number the engine does not compute;
  - breaking share links.

## Approaches considered

1. **Restyle only:** new palette and type, same layout. It is cheap, but it fixes none of problems 2–4.
2. **Re-order and re-voice in place (chosen):**
   - keep the components and the engine;
   - move the settings above the verdict as a summary you can edit, and replace the dropdowns with tap choices;
   - rewrite the verdict logic for words only;
   - add the icon array;
   - group the satellite checks;
   - add a two-column desktop layout and a new identity.

   This fixes every problem without touching the engine, and the existing tests keep guarding the numbers.
3. **Step-by-step wizard** (one question per screen, then the answer): truest to GOV.UK, but it hides the map-first
   "time machine" idea, which judges value, and it adds taps for a farmer who only wants the answer. Rejected.

## The design

### Identity *(my call)*

The subject is an Isan paddy after harvest: straw stubble, dry clay, young green bean shoots, and indigo cloth
(ผ้าย้อมคราม from Sakon Nakhon). It is local and specific, unlike a stock blue.

| Token | Hex | Use |
|---|---|---|
| `--paper` | #F4F6F1 | page ground, a faint paddy-mist green-grey |
| `--card` | #FFFFFF | panels |
| `--ink` | #1C2620 | text |
| `--kram` | #24407A | indigo: actions, links, focus, selection |
| `--sprout` | #2F7D46 | survived |
| `--straw` | #B9851C (ink #7A5408) | poor, caution |
| `--clay` | #A65A3F (ink #8A3F27) | failed; soft fill #F6E7E0 |

- **Fonts:** the existing self-hosted fonts stay (Noto Sans Thai Looped, Bricolage Grotesque, Figtree). The looped
  Thai style is already the right choice for older readers, and new font files would cost data.
- **The memorable element:** the 25-mark season array on every crop card. Survived = a filled sprout-green dot,
  poor = a half-filled straw dot, failed = an empty clay ring, no data = a dash. Shape carries the meaning as well as
  colour.

### Page order (phone)

1. Top bar: brand, About, ไทย/EN.
2. Hero, until a field is picked: the question, "Use my location", then the map.
3. After a pick, the results panel. The map stays above it, with its height reduced to 240 px.
   1. **Field line:** the coordinates chip, Change field (scrolls to the map) and Copy link.
   2. **Your field summary:** one line, for example "Sow 15 Nov · Loamy sand · Lowland paddy · No watering", with a
      Change button that opens the settings in place:
      - Soil: 5 tap choices.
      - Field type: 2 choices with a one-line hint.
      - Waterings: tap choices for 0 1 2 3 4 6 8.
      - Sowing date: 7 tap choices.
      - All choices are radio groups with tap targets of at least 44 px.
   3. **Verdict:** one heading-level sentence, coloured by tone, with one "next step" line. The three cases:
      - **good/mid:** "{Crop} is the best bet: survived {g} of {t} seasons." Next step: "Plant by {date} · {n} days
        left".
      - **low, and water helps:** "Risky without water." Next step: "With about {n} waterings, {crop} survives 4 years
        in 5." The two lines stop contradicting each other: the first states the condition, the second the fix.
      - **low, and water doesn't help:** "Risky here. Leaving the field bare is the safe choice."
   4. **Option cards** (A, B, C, same data):
      - crop name;
      - the 25-mark array;
      - "Survived 7 of 25";
      - plant-by date;
      - water need;
      - income;
      - soil effect;
      - the "More" fold holds the window chart, the confidence badge with its reasons, the blind spots and what to
        ask the extension officer.
   5. **How sure is this?** One card that holds:
      - "This season looks like…";
      - satellite rain vs model rain;
      - soil now (SMAP);
      - the model check (GLDAS).

      Each item gets a plain one-line headline. The product names are kept in small text for officers and judges.
   6. **Every past season** (the timeline), using the same mark shapes.
   7. **If the weather changed:** the sliders become tap choices. Rain: −30 −20 −10 0 +10 %. Heat: 0 +1 +2 +3 °C
      (the GOV.UK advice on sliders).
   8. Sources.

### Desktop (≥ 1024 px)

Two columns: the map is sticky on the left (about 42%) and the results scroll on the right, like a maps app.

### Behaviour

- **Language:**
  - a `lang` in a share link wins;
  - then a saved choice (localStorage, wrapped in try/catch);
  - then `navigator.languages`: any `th*` → Thai, otherwise English.
- **After a pick:** focus moves to the results heading (`tabIndex=-1`) as well as scrolling, so screen readers
  announce it.
- **Skip link:** "Skip to results" and "Skip to map".
- **Compatibility:**
  - `touch-action: manipulation`;
  - tap highlight off with our own `:active` styles;
  - `env(safe-area-inset-*)` padding;
  - inputs at ≥ 16 px (no iOS zoom);
  - no `:has()`, no container queries, no `dvh`;
  - `text-wrap: balance` only as a progressive extra;
  - `prefers-reduced-motion` is respected.
- **Contrast:** body text ≥ 7:1 on paper, for reading in sunlight; small text ≥ 4.5:1.

## Left to the builder

- exact spacing values on a 4 px scale;
- icon drawings;
- the Thai wording, which must keep the existing keys' meaning;
- updating the tests that address the old controls (dropdowns, sliders, ✖ names) to the new roles. The tests keep
  their intent.
