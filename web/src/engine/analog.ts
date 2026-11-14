// "This season looks like…": past seasons nearest to the current one (blueprint §9.7).
import { ANALOG_K } from './constants';
import { odds, sowIndex } from './index';
import type { Num, OddsResult, Outcome, SeasonData } from './types';

/** The dry season under way, from 1 Aug to `asOf` (the last day NASA POWER has data for). */
export interface CurrentSeason {
  year: number;
  start: string;
  asOf: string; // ISO date
  rain: Num[];
  tmax: Num[];
  tmin: Num[];
  wetness: Num[];
}

export interface Analog { year: number; distance: number }

type SeasonLike = Pick<SeasonData, 'year' | 'start' | 'rain' | 'wetness'>;

function total(xs: Num[], from: number, to: number): number | null {
  let s = 0;
  for (let i = from; i <= to; i++) {
    const v = xs[i];
    if (v == null) return null;
    s += v;
  }
  return s;
}

/**
 * Features up to the month-day `asOf` ('MM-DD'): f1 rain 1 Aug → 31 Oct (or → asOf if earlier),
 * f2 rain 1 Nov → asOf (left out before 1 Nov), f3 root-zone wetness on asOf. Null if a value is missing.
 */
export function seasonFeatures(s: SeasonLike, asOf: string): number[] | null {
  const season = s as SeasonData;
  const end = sowIndex(season, asOf);
  const nov1 = sowIndex(season, '11-01');
  if (end < 0 || end >= s.rain.length) return null;
  const f1 = total(s.rain, 0, Math.min(end, nov1 - 1));
  const f2 = end >= nov1 ? total(s.rain, nov1, end) : undefined;
  const f3 = s.wetness[end];
  if (f1 == null || f2 === null || f3 == null) return null;
  return f2 === undefined ? [f1, f3] : [f1, f2, f3];
}

/** The ANALOG_K past seasons closest to `current`, after standardising each feature by the past seasons. */
export function findAnalogs(past: SeasonData[], current: CurrentSeason, k = ANALOG_K): Analog[] {
  const asOf = current.asOf.slice(5, 10);
  const now = seasonFeatures(current, asOf);
  if (!now) return [];
  const rows = past
    .filter((s) => s.year !== current.year)
    .map((s) => ({ year: s.year, f: seasonFeatures(s, asOf) }))
    .filter((r): r is { year: number; f: number[] } => r.f != null && r.f.length === now.length);
  if (!rows.length) return [];

  const sd = now.map((_, j) => {
    const mean = rows.reduce((a, r) => a + r.f[j], 0) / rows.length;
    return Math.sqrt(rows.reduce((a, r) => a + (r.f[j] - mean) ** 2, 0) / rows.length);
  });
  return rows
    .map((r) => ({
      year: r.year,
      // A feature with no spread across the past seasons cannot tell them apart, so it is skipped.
      distance: Math.sqrt(now.reduce((a, v, j) => a + (sd[j] > 0 ? ((r.f[j] - v) / sd[j]) ** 2 : 0), 0)),
    }))
    .sort((a, b) => a.distance - b.distance || b.year - a.year)
    .slice(0, k);
}

/** Outcomes of one crop in the analog years only ("ปีแบบนี้"). */
export function analogOdds(outcomes: Outcome[], seasons: SeasonData[], analogs: Analog[]): OddsResult {
  const years = new Set(analogs.map((a) => a.year));
  return odds(outcomes.filter((_, i) => years.has(seasons[i].year)));
}

/** True when the analogs disagree: no outcome is shared by at least two of them (blueprint §9.10). */
export function analogsSplit(o: OddsResult): boolean {
  return o.total > 0 && Math.max(o.good, o.poor, o.failed) < Math.min(2, o.total);
}
