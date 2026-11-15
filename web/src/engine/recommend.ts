import { SAFE_SHARE } from './constants';
import { incomeEstimate } from './income';
import { dayIndexToDate, odds, type SowingWindow } from './index';
import type { Crop, Outcome, SeasonData, Timeline } from './types';

export interface Recommendation {
  /** The crop to recommend; null when no priced crop is safe, or there is no data. */
  cropId: string | null;
  reason: 'safeIncome' | 'noneSafe' | 'noData';
  /** The priced crop that survived most often: the fallback to show when none is safe. */
  closest: string | null;
}

const share = (outcomes: Outcome[] = []) => {
  const o = odds(outcomes);
  return o.total ? o.good / o.total : null;
};

/**
 * Safe first, then income: among crops with a price that survived at least SAFE_SHARE of past years,
 * the one with the highest average income (failed years count as ฿0, poor ones as half).
 */
export function recommend(timeline: Timeline, crops: Crop[]): Recommendation {
  if (crops.every((c) => share(timeline[c.id]) == null)) return { cropId: null, reason: 'noData', closest: null };
  const priced = crops.filter((c) => c.market && share(timeline[c.id]) != null);
  const avg = (c: Crop) => incomeEstimate(timeline[c.id] ?? [], c.market)?.average ?? 0;
  const byShare = [...priced].sort((a, b) => share(timeline[b.id])! - share(timeline[a.id])!);
  const closest = byShare[0]?.id ?? null;
  const safe = priced.filter((c) => share(timeline[c.id])! >= SAFE_SHARE - 1e-9);
  if (!safe.length) return { cropId: null, reason: 'noneSafe', closest };
  const best = safe.reduce((a, b) => (avg(b) > avg(a) ? b : a)); // tie → earlier in the crop list
  return { cropId: best.id, reason: 'safeIncome', closest: best.id };
}

export interface MonthOdds { month: number; good: number; total: number }

/** Years survived by sowing month: the mean over that month's sweep dates, rounded; months in sweep order. */
export function monthOdds(w: SowingWindow): MonthOdds[] {
  const groups = new Map<number, { good: number; total: number }[]>();
  for (const p of w.points) {
    const month = Number(p.sowMonthDay.slice(0, 2));
    if (!groups.has(month)) groups.set(month, []);
    if (p.odds.total > 0) groups.get(month)!.push({ good: p.odds.good, total: p.odds.total });
  }
  const mean = (xs: number[]) => Math.round(xs.reduce((a, x) => a + x, 0) / xs.length);
  return [...groups].map(([month, pts]) => (pts.length
    ? { month, good: mean(pts.map((p) => p.good)), total: mean(pts.map((p) => p.total)) }
    : { month, good: 0, total: 0 }));
}

export interface DangerMonth { month: number; count: number; failed: number }

/** The calendar month (1–12) in which most failed years died; null when the crop never failed with a known day. */
export function dangerMonth(outcomes: Outcome[], seasons: SeasonData[]): DangerMonth | null {
  const counts = new Map<number, number>();
  let failed = 0;
  outcomes.forEach((o, i) => {
    if (o.kind !== 'failed') return;
    failed++;
    if (o.deathDay == null || !seasons[i]) return;
    const month = dayIndexToDate(seasons[i], o.deathDay).getUTCMonth() + 1;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  });
  if (!counts.size) return null;
  const seasonOrder = (m: number) => (m + 4) % 12; // Aug first, so a tie goes to the earlier month in the season
  const [month, count] = [...counts].sort((a, b) => b[1] - a[1] || seasonOrder(a[0]) - seasonOrder(b[0]))[0];
  return { month, count, failed };
}
