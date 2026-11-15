import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { CellData, SeasonData } from './engine';
import { Results } from './Results';

// Only mung bean (has a price) and sweet corn (no verified price) are on offer, so card C is sweet corn.
vi.mock('./engine', async (importOriginal) => {
  const m = await importOriginal<typeof import('./engine')>();
  const keep = ['mungbean', 'sweetcorn'];
  return { ...m, loadCrops: () => m.loadCrops().filter((c) => keep.includes(c.id)) };
});

function season(year: number): SeasonData {
  const n = new Date(Date.UTC(year + 1, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const fill = (v: number) => Array.from({ length: n }, () => v);
  return { year, start: `${year}-08-01`, rain: fill(5), tmax: fill(33), tmin: fill(22), wetness: fill(0.8) };
}
const cell: CellData = {
  id: '16.50_102.500', lat: 16.5, lon: 102.5, sources: { rain: 'NASA POWER' },
  wetnessScale: { p05: 0.3, p95: 0.8 }, seasons: [season(2015), season(2016)],
};

test('a crop with no verified price says so instead of showing an income or "no cash income"', () => {
  render(<Results cell={cell} lang="en" />);
  const lines = screen.getAllByTestId('income').map((e) => e.textContent ?? '');
  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatch(/Estimated income ≈ ฿[\d,]+ per rai/); // mung bean
  expect(lines[1]).toBe('No verified standard price yet, so no income estimate'); // sweet corn
});

test('the same line in Thai', () => {
  render(<Results cell={cell} lang="th" />);
  const lines = screen.getAllByTestId('income').map((e) => e.textContent ?? '');
  expect(lines[1]).toBe('ยังไม่มีราคากลางที่ตรวจสอบได้ จึงยังไม่ประมาณรายได้');
});
