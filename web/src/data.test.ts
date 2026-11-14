import gridJson from '../public/data/grid.json';
import { cellForPoint } from './data';
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
