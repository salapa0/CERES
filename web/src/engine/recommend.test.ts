import { dangerMonth, monthOdds, recommend } from './recommend';
import type { Crop, Outcome, OutcomeKind, SeasonData, SowingWindow, Timeline } from './index';

const crop = (id: string, market?: { yieldKgPerRai: number; priceBahtPerKg: number }): Crop => ({
  id, nameTh: id, nameEn: id, group: market ? 'cash' : 'manure',
  stages: { ini: 10, dev: 10, mid: 10, late: 10 }, kc: { ini: 0.4, mid: 1, end: 0.5 },
  rootDepthM: 0.6, p: 0.5, heatC: 40, soilEffect: 'uses', sources: ['test'], assumption: true,
  market: market && { ...market, asOf: '2025-12', sources: ['test'] },
});
const out = (kind: OutcomeKind, deathDay: number | null = null): Outcome =>
  ({ kind, ret: kind === 'nodata' ? null : 0.8, deathDay, reason: deathDay == null ? null : 'drought', sowIndex: 100 });
/** n outcomes: `good` survived, the rest failed. */
const years = (good: number, n = 10): Outcome[] =>
  Array.from({ length: n }, (_, i) => out(i < good ? 'good' : 'failed', i < good ? null : 150));

describe('recommend: safe first, then income', () => {
  const cheap = crop('cheap', { yieldKgPerRai: 100, priceBahtPerKg: 10 }); // ฿1,000 in a good year
  const rich = crop('rich', { yieldKgPerRai: 1000, priceBahtPerKg: 10 }); // ฿10,000 in a good year
  const manure = crop('manure');

  test('the safe crop that earns most wins', () => {
    const tl: Timeline = { cheap: years(10), rich: years(9), manure: years(10) };
    expect(recommend(tl, [cheap, rich, manure])).toEqual({ cropId: 'rich', reason: 'safeIncome', closest: 'rich' });
  });

  test('a high-income crop that fails too often is not recommended', () => {
    const tl: Timeline = { cheap: years(9), rich: years(6), manure: years(10) };
    expect(recommend(tl, [cheap, rich, manure]).cropId).toBe('cheap');
  });

  test('a crop with no income is never recommended, however safe', () => {
    const tl: Timeline = { cheap: years(3), rich: years(2), manure: years(10) };
    expect(recommend(tl, [cheap, rich, manure])).toEqual({ cropId: null, reason: 'noneSafe', closest: 'cheap' });
  });

  test('no data at all gives no recommendation', () => {
    const none = Array.from({ length: 3 }, () => out('nodata'));
    expect(recommend({ cheap: none, rich: none, manure: none }, [cheap, rich, manure]))
      .toEqual({ cropId: null, reason: 'noData', closest: null });
  });
});

describe('monthOdds', () => {
  const pt = (sowMonthDay: string, good: number, total: number) =>
    ({ sowMonthDay, odds: { good, poor: 0, failed: total - good, nodata: 0, total }, share: total ? good / total : null });

  test('averages the sweep dates of each month, in sweep order', () => {
    const w: SowingWindow = {
      points: [pt('11-01', 20, 25), pt('11-15', 18, 25), pt('12-06', 15, 25), pt('01-03', 8, 25), pt('02-01', 2, 25)],
      best: 0.8, latest: '11-15',
    };
    expect(monthOdds(w)).toEqual([
      { month: 11, good: 19, total: 25 }, { month: 12, good: 15, total: 25 },
      { month: 1, good: 8, total: 25 }, { month: 2, good: 2, total: 25 },
    ]);
  });

  test('a month with no data has a total of 0, never NaN', () => {
    const w: SowingWindow = { points: [pt('11-01', 0, 0)], best: null, latest: null };
    expect(monthOdds(w)).toEqual([{ month: 11, good: 0, total: 0 }]);
  });
});

describe('dangerMonth', () => {
  const seasons = [2015, 2016, 2017].map((year): SeasonData =>
    ({ year, start: `${year}-08-01`, rain: [], tmax: [], tmin: [], wetness: [] }));
  // Day index from 1 Aug: 190 ≈ 7 Feb, 160 ≈ 8 Jan.
  test('names the month in which most failed years died', () => {
    expect(dangerMonth([out('failed', 190), out('failed', 192), out('failed', 160)], seasons))
      .toEqual({ month: 2, count: 2, failed: 3 });
  });
  test('is null when the crop never failed', () => {
    expect(dangerMonth([out('good'), out('poor'), out('good')], seasons)).toBeNull();
  });
});
