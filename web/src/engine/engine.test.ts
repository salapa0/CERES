import { extraterrestrialRadiation, hargreavesEt0 } from './et0';
import { dayIndexToDate, kcOnDay, loadCrops, odds, replay, runTimeline, seasonLength, sowIndex, waterNeeded } from './index';
import type { CellData, Crop, Outcome, SeasonData } from './types';

const crop: Crop = {
  id: 'test', nameTh: 'ทดสอบ', nameEn: 'Test', group: 'legume',
  stages: { ini: 10, dev: 20, mid: 30, late: 20 }, kc: { ini: 0.4, mid: 1.1, end: 0.6 },
  rootDepthM: 0.6, p: 0.5, heatC: 38, soilEffect: 'nitrogen', sources: ['test'], assumption: false,
};

function season(year: number, rain: number, wetness: number, tmax = 33): SeasonData {
  const leap = new Date(Date.UTC(year + 1, 1, 29)).getUTCMonth() === 1;
  const n = leap ? 366 : 365;
  const fill = (v: number) => Array.from({ length: n }, () => v);
  return { year, start: `${year}-08-01`, rain: fill(rain), tmax: fill(tmax), tmin: fill(22), wetness: fill(wetness) };
}
const cell = (seasons: SeasonData[]): CellData => ({
  id: '16.50_102.500', lat: 16.5, lon: 102.5, sources: {}, wetnessScale: { p05: 0.3, p95: 0.8 }, seasons,
});
const run = (s: SeasonData, c: Crop = crop, extra = {}) =>
  replay({ cell: cell([s]), season: s, crop: c, sowMonthDay: '12-01', soil: 'loamySand', ...extra });

describe('ET0', () => {
  test('Ra at 20°S on 3 Sep matches FAO-56 example 8', () => {
    expect(extraterrestrialRadiation(-20, 246)).toBeCloseTo(32.2, 1);
  });
  test('ET0 is 0 when tmax equals tmin and never negative', () => {
    expect(hargreavesEt0(30, 30, 30)).toBe(0);
    expect(hargreavesEt0(20, 25, 30)).toBe(0);
  });
});

describe('crop curve and dates', () => {
  test('Kc follows the four stages', () => {
    expect(kcOnDay(crop, 0)).toBe(0.4);
    expect(kcOnDay(crop, 20)).toBeCloseTo(0.75);
    expect(kcOnDay(crop, 30)).toBeCloseTo(1.1);
    expect(kcOnDay(crop, 79)).toBeCloseTo(0.6, 1);
  });
  test('green manure season stops after development', () => {
    expect(seasonLength({ ...crop, greenManure: true })).toBe(30);
    expect(seasonLength(crop)).toBe(80);
  });
  test('sowing dates index into the right calendar year', () => {
    const s = season(2015, 0, 0.5);
    expect(sowIndex(s, '12-01')).toBe(122);
    expect(dayIndexToDate(s, 0).toISOString().slice(0, 10)).toBe('2015-08-01');
    expect(dayIndexToDate(s, sowIndex(s, '01-15')).toISOString().slice(0, 10)).toBe('2016-01-15');
    const nonLeap = season(2016, 0, 0.5);
    expect(dayIndexToDate(nonLeap, sowIndex(nonLeap, '02-29')).toISOString().slice(0, 10)).toBe('2017-03-01');
  });
});

describe('replay', () => {
  test('a wet season is good', () => {
    expect(run(season(2015, 5, 0.8)).kind).toBe('good');
  });
  test('a dry start with no rain fails from drought after the initial stage', () => {
    const o = run(season(2015, 0, 0.3));
    expect(o.kind).toBe('failed');
    expect(o.reason).toBe('drought');
    expect(o.deathDay).toBeGreaterThanOrEqual(o.sowIndex + crop.stages.ini);
  });
  test('heat at flowering fails with heat, but not for green manure', () => {
    expect(run(season(2015, 8, 0.8, 41)).reason).toBe('heat');
    expect(run(season(2015, 8, 0.8, 41), { ...crop, greenManure: true }).reason).not.toBe('heat');
  });
  test('missing data inside the crop season gives nodata', () => {
    const s = season(2015, 5, 0.8);
    s.rain[150] = null;
    expect(run(s).kind).toBe('nodata');
  });
  test('a crop running past the end of the data gives nodata', () => {
    expect(run(season(2015, 5, 0.8), crop, { sowMonthDay: '07-01' }).kind).toBe('nodata');
  });
  test('depletion stays within 0..TAW and less rain is never better', () => {
    const s = season(2015, 1, 0.6);
    const o = run(s, crop, { withDaily: true });
    expect(Math.min(...o.daily!.dr)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...o.daily!.dr)).toBeLessThanOrEqual(o.daily!.taw);
    const dry = run(s, crop, { whatIf: { rainFactor: 0, dT: 0 } });
    expect(dry.ret!).toBeLessThanOrEqual(o.ret!);
  });
  test('a lowland field does at least as well as an upland one', () => {
    const s = season(2015, 0, 0.6);
    expect(run(s, crop, { position: 'lowland' }).ret!).toBeGreaterThanOrEqual(run(s, crop, { position: 'upland' }).ret!);
  });
});

describe('odds and strategies', () => {
  const o = (kind: Outcome['kind']): Outcome => ({ kind, ret: null, deathDay: null, reason: null, sowIndex: 0 });
  test('odds exclude nodata from the total', () => {
    expect(odds([o('good'), o('poor'), o('failed'), o('nodata')])).toEqual({ good: 1, poor: 1, failed: 1, nodata: 1, total: 3 });
    expect(odds([o('nodata')]).total).toBe(0);
  });
  test('four crops load, each with a source', () => {
    const crops = loadCrops();
    expect(crops.map((c) => c.id).sort()).toEqual(['maize', 'mungbean', 'peanut', 'sunnhemp']);
    expect(crops.every((c) => c.sources.length > 0)).toBe(true);
  });
  test('timeline has one outcome per season per crop', () => {
    const c = cell([season(2015, 5, 0.8), season(2016, 5, 0.8)]);
    const tl = runTimeline(c, loadCrops(), '12-01', 'loamySand', 'upland');
    expect(Object.keys(tl)).toHaveLength(loadCrops().length);
    expect(tl.mungbean).toHaveLength(2);
  });
});

describe('waterings', () => {
  test('watering a dry season raises the water the crop gets and keeps it alive longer', () => {
    const s = season(2015, 0, 0.3);
    const dry = run(s);
    const watered = run(s, crop, { waterings: 8 });
    expect(dry.kind).toBe('failed');
    expect(watered.ret!).toBeGreaterThan(dry.ret!);
    expect(watered.deathDay === null || watered.deathDay > dry.deathDay!).toBe(true);
    expect(watered.watered).toBe(8);
  });
  test('no waterings are used when the soil never dries past the stress line', () => {
    const wet = season(2015, 5, 0.8);
    expect(run(wet, crop, { waterings: 4 }).ret).toBeCloseTo(run(wet).ret!, 10);
  });
  test('waterNeeded is 0 for a wet field and more than 0 for a dry one', () => {
    expect(waterNeeded(cell([season(2015, 5, 0.8), season(2016, 5, 0.8)]), crop, '12-01', 'loamySand', 'upland')).toBe(0);
    const need = waterNeeded(cell([season(2015, 0, 0.3), season(2016, 0, 0.3)]), crop, '12-01', 'loamySand', 'upland');
    expect(need === null || need > 0).toBe(true);
  });
});
