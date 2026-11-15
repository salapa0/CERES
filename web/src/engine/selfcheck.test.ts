import { describe, expect, test } from 'vitest';
import { loadCrops, replay, sowIndex } from './index';
import { badge, rootzoneScale, selfCheck } from './selfcheck';
import type { CellData, SeasonData } from './types';

const mungbean = loadCrops().find((c) => c.id === 'mungbean')!;

/** A season with no rain after October, so the model's soil dries steadily after sowing. */
function season(year: number, rootzone: (i: number) => number | null): SeasonData {
  const idx = Array.from({ length: 365 }, (_, i) => i);
  return {
    year, start: `${year}-08-01`,
    rain: idx.map((i) => (i < 92 ? 8 : 0)), tmax: idx.map(() => 33), tmin: idx.map(() => 21),
    wetness: idx.map(() => 0.6), rootzone: idx.map(rootzone),
  };
}
const cellOf = (seasons: SeasonData[]): CellData => ({
  id: 't', lat: 16.5, lon: 102.5, sources: {}, wetnessScale: { p05: 0.3, p95: 0.8 }, seasons,
});

/** Day after sowing when the model's root zone first passes the stress point (Dr > RAW). */
function modelDryDay(s: SeasonData): number {
  const o = replay({ cell: cellOf([s]), season: s, crop: mungbean, sowMonthDay: '11-15', soil: 'loamySand', position: 'lowland', withDaily: true });
  return o.daily!.dr.findIndex((dr) => dr > o.daily!.raw);
}

describe('self-check against GLDAS (blueprint §9.8)', () => {
  test('GLDAS is scaled between its 5th and 95th percentiles, as the model scales POWER wetness', () => {
    const s = season(2010, (i) => i); // 365 values 0..364
    expect(rootzoneScale([s])).toEqual({ p05: Math.floor(0.05 * 365), p95: Math.floor(0.95 * 365) });
  });

  test('dry-down days within the tolerance agree; far apart they do not', () => {
    const base = season(2010, () => 300);
    const sow = sowIndex(base, '11-15');
    const dry = modelDryDay(base);
    expect(dry).toBeGreaterThan(0);
    // GLDAS drops from the top to the bottom of its range 10 days after the model dries: agree. 30 days: disagree.
    const near = season(2010, (i) => (i >= sow + dry + 10 ? 100 : i < 92 || i > 242 ? 300 : 300));
    const far = season(2011, (i) => (i >= sow + dry + 30 ? 100 : 300));
    const check = selfCheck(cellOf([near, far]), mungbean, 'loamySand', 'lowland')!;
    expect(check.seasons.map((r) => r.agree)).toEqual([true, false]);
    expect(check.seasons[0].satellite).toBe(dry + 10);
    expect(check.seasons[0].model).toBe(dry);
    expect(check).toMatchObject({ agree: 1, total: 2 });
  });

  test('a season where neither dries during the crop counts as agreement', () => {
    // Steady rain keeps the model wet; GLDAS stays at the top of its range all season.
    const wet = season(2012, () => 300);
    wet.rain = wet.rain.map(() => 12);
    const other = season(2013, (i) => (i < 150 ? 300 : 50)); // gives GLDAS a range the wet season stays on top of
    const check = selfCheck(cellOf([wet, other]), mungbean, 'loamySand', 'lowland')!;
    expect(check.seasons[0]).toMatchObject({ model: null, satellite: null, agree: true });
  });

  test('no rootzone data gives no hit rate', () => {
    const s = season(2010, () => 300);
    delete s.rootzone;
    expect(selfCheck(cellOf([s]), mungbean, 'loamySand', 'lowland')).toBeNull();
    const gap = season(2011, (i) => (i === 120 ? null : 300));
    expect(selfCheck(cellOf([gap]), mungbean, 'loamySand', 'lowland')).toMatchObject({ total: 0 });
  });
});

describe('confidence badge (blueprint §9.10)', () => {
  const same = { good: 3, poor: 0, failed: 0, nodata: 0, total: 3 };
  const twoOne = { good: 2, poor: 1, failed: 0, nodata: 0, total: 3 };
  const split = { good: 1, poor: 1, failed: 1, nodata: 0, total: 3 };

  test('High needs a hit rate of at least 0.75 and look-alike years that all agree', () => {
    expect(badge({ seasons: 25, analog: same, hitRate: 0.8 })).toEqual({ level: 'high', why: ['high'] });
    expect(badge({ seasons: 25, analog: twoOne, hitRate: 0.8 })).toEqual({ level: 'medium', why: ['analogsMixed'] });
    expect(badge({ seasons: 25, analog: null, hitRate: 0.8 })).toEqual({ level: 'medium', why: ['noAnalogs'] });
  });

  test('without a self-check the badge stays at most Medium', () => {
    expect(badge({ seasons: 25, analog: same, hitRate: null })).toEqual({ level: 'medium', why: ['unchecked'] });
    expect(badge({ seasons: 25, analog: same, hitRate: 0.6 })).toEqual({ level: 'medium', why: ['checkMid'] });
  });

  test('Low lists every reason: few seasons, a poor self-check, split look-alike years', () => {
    expect(badge({ seasons: 10, analog: split, hitRate: 0.4 })).toEqual({ level: 'low', why: ['few', 'checkLow', 'split'] });
    expect(badge({ seasons: 25, analog: null, hitRate: 0.49 })).toEqual({ level: 'low', why: ['checkLow'] });
  });
});
