import { describe, expect, it } from 'vitest';
import { loadCrops, type Outcome } from '.';
import { incomeEstimate } from './income';

const o = (kind: Outcome['kind']): Outcome => ({ kind, ret: null, deathDay: null, reason: null, sowIndex: 0 });
const market = { yieldKgPerRai: 100, priceBahtPerKg: 20, asOf: '2026-02', sources: ['test'] };

describe('incomeEstimate', () => {
  it('counts a good harvest in full, a poor one as half and a failed one as nothing', () => {
    const r = incomeEstimate([o('good'), o('poor'), o('failed'), o('failed')], market);
    expect(r).toEqual({ goodYear: 2000, average: (2000 + 1000) / 4, seasons: 4 });
  });

  it('leaves out seasons without data', () => {
    expect(incomeEstimate([o('good'), o('nodata')], market)).toEqual({ goodYear: 2000, average: 2000, seasons: 1 });
  });

  it('gives nothing for a crop without a market price or without seasons', () => {
    expect(incomeEstimate([o('good')], undefined)).toBeNull();
    expect(incomeEstimate([o('nodata')], market)).toBeNull();
  });
});

describe('crop market data', () => {
  it('has a sourced yield and price for each cash crop, and none for sunn hemp', () => {
    const crops = loadCrops();
    for (const id of ['mungbean', 'peanut', 'maize']) {
      const m = crops.find((c) => c.id === id)!.market!;
      expect(m.yieldKgPerRai).toBeGreaterThan(0);
      expect(m.priceBahtPerKg).toBeGreaterThan(0);
      expect(m.asOf).toMatch(/^\d{4}-\d{2}$/);
      expect(m.sources.length).toBeGreaterThan(0);
    }
    expect(crops.find((c) => c.id === 'sunnhemp')!.market).toBeUndefined();
  });
});
