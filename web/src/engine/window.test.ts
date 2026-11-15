import khonKaen from '../../public/data/cells/16.50_103.125.json';
import { daysLeft, latestSafe, loadCrops, odds, runTimeline, sowingWindow, windowDates } from './index';
import type { CellData, Crop, FieldPosition, SeasonData } from './types';

const realCell = khonKaen as CellData;

const crop: Crop = {
  id: 'test', nameTh: 'ทดสอบ', nameEn: 'Test', group: 'legume',
  stages: { ini: 10, dev: 20, mid: 30, late: 20 }, kc: { ini: 0.4, mid: 1.1, end: 0.6 },
  rootDepthM: 0.6, p: 0.5, heatC: 45, soilEffect: 'nitrogen', sources: ['test'], assumption: false,
};

/** A season that rains every day until `stopIndex`, then dries out steadily. */
function dryingSeason(year: number, stopIndex: number): SeasonData {
  const n = new Date(Date.UTC(year + 1, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const idx = Array.from({ length: n }, (_, i) => i);
  return {
    year, start: `${year}-08-01`,
    rain: idx.map((i) => (i < stopIndex ? 6 : 0)),
    tmax: idx.map(() => 32), tmin: idx.map(() => 20),
    wetness: idx.map((i) => Math.max(0.3, 0.8 - 0.003 * Math.max(0, i - stopIndex))),
  };
}

describe('sowing window (blueprint §9.9)', () => {
  test('the sweep runs from 1 Nov to 1 Feb in 7-day steps', () => {
    const d = windowDates();
    expect(d[0]).toBe('11-01');
    expect(d[1]).toBe('11-08');
    expect(d[d.length - 1]).toBe('01-31');
    expect(d).toHaveLength(14);
  });

  test('in steadily drying seasons, later sowing never raises the odds', () => {
    // Rain stops on a different day each year, between 15 Oct and 3 Jan.
    const seasons = Array.from({ length: 12 }, (_, k) => dryingSeason(2001 + k, 75 + k * 7));
    const cell: CellData = { id: 'x', lat: 16.5, lon: 102.5, sources: {}, wetnessScale: { p05: 0.3, p95: 0.8 }, seasons };
    for (const position of ['upland', 'lowland'] as FieldPosition[]) {
      const shares = sowingWindow(cell, crop, 'loamySand', position).points.map((p) => p.share!);
      expect(shares[0]).toBeGreaterThan(shares[shares.length - 1]); // the sweep really spans good and bad dates
      for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeLessThanOrEqual(shares[i - 1]);
    }
  });

  test('the latest safe date is the latest one within the tolerance of the best odds', () => {
    const pts = [0.8, 0.8, 0.75, 0.72, 0.5, 0.71, 0.2].map((share, i) => ({ sowMonthDay: `d${i}`, share }));
    expect(latestSafe(pts)).toBe('d5');
    expect(latestSafe([{ sowMonthDay: 'a', share: 0 }, { sowMonthDay: 'b', share: null }])).toBeNull();
    expect(latestSafe([{ sowMonthDay: 'a', share: null }])).toBeNull();
    // Best odds below the tolerance: dates where nothing survived must not stretch the window.
    const low = [0, 0.04, 0, 0].map((share, i) => ({ sowMonthDay: `d${i}`, share }));
    expect(latestSafe(low)).toBe('d1');
  });

  test('days left counts to the latest safe date in the season under way', () => {
    expect(daysLeft('12-20', new Date(2026, 10, 14))).toBe(36);
    expect(daysLeft('11-01', new Date(2026, 10, 14))).toBe(-13);
    expect(daysLeft('01-31', new Date(2027, 0, 10))).toBe(21);
    expect(daysLeft('12-20', new Date(2027, 4, 15))).toBeNull(); // May: no dry season under way
  });
});

describe('what-if (blueprint §9.3) on real Khon Kaen data', () => {
  const crops = loadCrops();
  const good = (rainFactor: number, dT: number, position: FieldPosition, sow: string) => {
    const tl = runTimeline(realCell, crops, sow, 'loamySand', position, { rainFactor, dT });
    return Object.fromEntries(crops.map((c) => [c.id, odds(tl[c.id]).good]));
  };

  test('30 % less rain or 3 °C more heat never raises any crop\'s odds', () => {
    for (const position of ['upland', 'lowland'] as FieldPosition[]) {
      for (const sow of ['11-01', '11-15', '12-15']) {
        const base = good(1, 0, position, sow);
        const drier = good(0.7, 0, position, sow);
        const hotter = good(1, 3, position, sow);
        for (const c of crops) {
          expect(drier[c.id]).toBeLessThanOrEqual(base[c.id]);
          expect(hotter[c.id]).toBeLessThanOrEqual(base[c.id]);
        }
      }
    }
  });

  test('a full window sweep for all crops is fast enough for a slider', () => {
    const t0 = performance.now();
    for (const c of crops) sowingWindow(realCell, c, 'loamySand', 'lowland', { rainFactor: 0.9, dT: 1 });
    expect(performance.now() - t0).toBeLessThan(1000); // generous for slow CI runners; the page needs only two
  });
});
