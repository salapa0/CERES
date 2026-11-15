import { POOR_HARVEST_SHARE } from './constants';
import type { Market, Outcome } from './types';

export interface IncomeEstimate { goodYear: number; average: number; seasons: number }

/** Income per rai at a standard price: average over past seasons with data, and in a good year. Null without a price or data. */
export function incomeEstimate(outcomes: Outcome[], market: Market | undefined): IncomeEstimate | null {
  if (!market) return null;
  const seasons = outcomes.filter((o) => o.kind !== 'nodata');
  if (!seasons.length) return null;
  const goodYear = market.yieldKgPerRai * market.priceBahtPerKg;
  const share = (o: Outcome) => (o.kind === 'good' ? 1 : o.kind === 'poor' ? POOR_HARVEST_SHARE : 0);
  const average = (seasons.reduce((sum, o) => sum + share(o), 0) / seasons.length) * goodYear;
  return { goodYear, average, seasons: seasons.length };
}
