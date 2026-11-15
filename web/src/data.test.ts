import gridJson from '../public/data/grid.json';
import { cellForPoint, parseCurrentSeason } from './data';
import type { Grid } from './engine';

const grid = gridJson as Grid;

test('a tap near Khon Kaen snaps to its NASA POWER cell', () => {
  expect(cellForPoint(grid, 16.44, 102.83)?.id).toBe('16.50_103.125');
});

test('taps on islands and border tips still land in a Thai cell', () => {
  for (const [lat, lon] of [[7.88, 98.39], [20.43, 99.88], [11.66, 102.57]]) {
    expect(cellForPoint(grid, lat, lon)).not.toBeNull();
  }
});

test('a tap far out at sea or abroad is outside Thailand', () => {
  expect(cellForPoint(grid, 10.0, 96.0)).toBeNull();
  expect(cellForPoint(grid, 21.03, 105.85)).toBeNull(); // Hanoi
});

test('the live season stops at the last day where NASA POWER has every value', () => {
  const day = (v: number) => ({ '20261109': v, '20261110': v, '20261111': -999 });
  const param = { PRECTOTCORR: day(1), T2M_MAX: day(30), T2M_MIN: day(20), GWETROOT: day(0.7) };
  const s = parseCurrentSeason(param, 2026, new Date(Date.UTC(2026, 10, 12)));
  expect(s.asOf).toBe('2026-11-10');
  expect(s.rain).toHaveLength(102); // 1 Aug → 10 Nov
  expect(s.rain[s.rain.length - 1]).toBe(1);
  expect(s.rain[0]).toBeNull(); // days missing from the response stay null
});
