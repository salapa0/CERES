import { analogOdds, analogsSplit, findAnalogs, seasonFeatures, type CurrentSeason } from './analog';
import type { Outcome, SeasonData } from './types';

/** A past season with its own rain level, a wet spell in November and a wetness level. */
function season(year: number, rain: number, novRain: number, wetness: number): SeasonData {
  const n = new Date(Date.UTC(year + 1, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const idx = Array.from({ length: n }, (_, i) => i);
  return {
    year, start: `${year}-08-01`,
    rain: idx.map((i) => (i < 92 ? rain : i < 122 ? novRain : 0)),
    tmax: idx.map(() => 32), tmin: idx.map(() => 20), wetness: idx.map(() => wetness),
  };
}
const past = Array.from({ length: 20 }, (_, k) => season(2001 + k, 2 + (k % 7), (k * 3) % 5, 0.4 + ((k * 7) % 10) / 25));

/** The current season as NASA POWER returns it up to `asOf`, copied from a past season's numbers. */
function currentLike(s: SeasonData, asOf: string, year = 2026): CurrentSeason {
  const days = Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${year}-08-01T00:00:00Z`)) / 86_400_000) + 1;
  return {
    year, start: `${year}-08-01`, asOf,
    rain: s.rain.slice(0, days), tmax: s.tmax.slice(0, days), tmin: s.tmin.slice(0, days), wetness: s.wetness.slice(0, days),
  };
}

describe('analog seasons (blueprint §9.7)', () => {
  test('a season identical to a past one picks that one first', () => {
    const a = findAnalogs(past, currentLike(past[9], '2026-11-20'));
    expect(a).toHaveLength(3);
    expect(a[0]).toEqual({ year: 2010, distance: 0 });
  });

  test('the November rain feature is left out before 1 Nov', () => {
    expect(seasonFeatures(past[0], '10-20')).toHaveLength(2);
    expect(seasonFeatures(past[0], '11-10')).toHaveLength(3);
  });

  test('features are standardised: changing the units of rain does not change the match', () => {
    const scaled = past.map((s) => ({ ...s, rain: s.rain.map((r) => r! * 25.4) }));
    const cur = currentLike(past[4], '2026-11-25');
    const curScaled = { ...cur, rain: cur.rain.map((r) => r! * 25.4) };
    expect(findAnalogs(scaled, curScaled).map((a) => a.year)).toEqual(findAnalogs(past, cur).map((a) => a.year));
  });

  test('the current season is never its own analog, and seasons with gaps are skipped', () => {
    const withSelf = [...past, { ...past[2], year: 2026, start: '2026-08-01' }];
    const gappy = { ...past[2], rain: past[2].rain.map((r, i) => (i === 50 ? null : r)) };
    const years = findAnalogs([...withSelf.slice(0, 2), gappy, ...withSelf.slice(3)], currentLike(past[2], '2026-11-20'))
      .map((a) => a.year);
    expect(years).not.toContain(2026);
    expect(years).not.toContain(2003);
  });

  test('analog odds count only the analog years; a 1-1-1 split is flagged', () => {
    const o = (kind: Outcome['kind']): Outcome => ({ kind, ret: null, deathDay: null, reason: null, sowIndex: 0 });
    const outcomes = [o('good'), o('poor'), o('failed'), o('good')];
    const seasons = past.slice(0, 4);
    const r = analogOdds(outcomes, seasons, [{ year: 2001, distance: 0 }, { year: 2002, distance: 1 }, { year: 2003, distance: 2 }]);
    expect(r).toMatchObject({ good: 1, poor: 1, failed: 1, total: 3 });
    expect(analogsSplit(r)).toBe(true);
    expect(analogsSplit({ good: 2, poor: 0, failed: 1, nodata: 0, total: 3 })).toBe(false);
  });
});
