# Income estimate — short design (approved 15 Nov 2026)

**Intent.** Each strategy card shows what the harvest would sell for at a standard market price, so a farmer can weigh the odds against money. Same for every user.

**Goals.** Average income per rai over the 25 replayed seasons, plus income in a good year; updates with sowing date, soil, field type and waterings.

**Non-goals.** Profit (needs each farmer's own costs: rejected as too personal), live prices, farmer-entered prices.

**Anti-goals.** Numbers without a source and date; income shown more prominently than survival odds.

**Approaches.** (1) Fixed price/yield table with source and date — chosen: static, zero-ops. (2) Live price feed — no open CORS source; a proxy breaks zero-ops. (3) Farmer enters price — per-user input, rejected.

**Design.**
- `crops.json`: `market { yieldKgPerRai, priceBahtPerKg, sources[], asOf }` for mung bean, peanut, field corn. Sunn hemp has none (green manure, no cash).
- Engine `incomeEstimate(outcomes, market)`: good = full yield × price, poor = half (builder's call), failed = 0, nodata excluded; returns average and good-year figure, or null without market data or seasons.
- Card: "Estimated income ≈ ฿X per rai on average (฿Y in a good year) · price <source>, <date>". Card A: no dry-season income (already says so). Sunn hemp: "No cash income: grown to feed the soil".
- Blind spots and About: "Income at a standard price, not profit. Prices and yields vary."
- "In short" box unchanged.
