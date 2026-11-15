import { expect, it } from 'vitest';
import { pickImerg } from './data';

it('picks one cell out of the IMERG file, or nothing when the cell is missing', () => {
  const file = { product: 'p', start: '2026-08-01', asOf: '2026-08-02', generated: 'g', cells: { a: [1, null] } };
  expect(pickImerg(file, 'a')).toEqual({ start: '2026-08-01', asOf: '2026-08-02', rain: [1, null] });
  expect(pickImerg(file, 'b')).toBeNull();
});
