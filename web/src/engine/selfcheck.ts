// Self-check against NASA GLDAS soil moisture, and the confidence badge (blueprint §9.8, §9.10).
import {
  DEFAULT_SOW, HIT_RATE_HIGH, HIT_RATE_LOW, MIN_SEASONS_FOR_MEDIUM, SELFCHECK_TOLERANCE_DAYS,
} from './constants';
import { replay } from './index';
import type { CellData, Crop, FieldPosition, OddsResult, SeasonData, SoilTexture } from './types';

/**
 * 5th and 95th percentiles of all GLDAS values in the cell, the same way the pipeline scales POWER wetness
 * (`wetnessScale`); null without data.
 */
export function rootzoneScale(seasons: SeasonData[]): { p05: number; p95: number } | null {
  const values = seasons.flatMap((s) => (s.rootzone ?? []).filter((v): v is number => v != null));
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const pct = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))];
  return { p05: pct(0.05), p95: pct(0.95) };
}

/** Days after sowing; null when that side never dried during the crop season. */
export interface SelfCheckSeason { year: number; model: number | null; satellite: number | null; agree: boolean }
export interface SelfCheck { agree: number; total: number; seasons: SelfCheckSeason[] }

/**
 * For each past season, the day the model's root zone first passes the crop's stress point (Dr > RAW, i.e. less than
 * 1 − p of the available water left) and the day GLDAS first does the same on its own scale (between its 5th and
 * 95th percentiles, as the model reads POWER wetness). Both are counted from the default sowing date and looked for
 * only while the crop is in the field, since the model does not run outside it. Null when the cell has no GLDAS data.
 *
 * The blueprint's first draft used GLDAS's 25th percentile instead; that is a much drier bar than the model's stress
 * point, so the two were not measuring the same thing (median hit rate 0.08 over 185 cells).
 */
export function selfCheck(
  cell: CellData, crop: Crop, soil: SoilTexture, position: FieldPosition, sowMonthDay = DEFAULT_SOW,
): SelfCheck | null {
  const scale = rootzoneScale(cell.seasons);
  if (scale == null) return null;
  const span0 = scale.p95 - scale.p05 || 1;
  const stressed = (v: number) => (v - scale.p05) / span0 < 1 - crop.p;
  const seasons: SelfCheckSeason[] = [];
  for (const season of cell.seasons) {
    const rz = season.rootzone;
    if (!rz) continue;
    const o = replay({ cell, season, crop, sowMonthDay, soil, position, withDaily: true });
    if (o.kind === 'nodata' || !o.daily) continue;
    const span = rz.slice(o.sowIndex, o.sowIndex + o.daily.dr.length);
    if (span.length < o.daily.dr.length || span.some((v) => v == null)) continue;
    const firstOrNull = (i: number) => (i < 0 ? null : i);
    const model = firstOrNull(o.daily.dr.findIndex((dr) => dr > o.daily!.raw));
    const satellite = firstOrNull(span.findIndex((v) => stressed(v!)));
    const agree = model == null || satellite == null
      ? model == null && satellite == null
      : Math.abs(model - satellite) <= SELFCHECK_TOLERANCE_DAYS;
    seasons.push({ year: season.year, model, satellite, agree });
  }
  return { agree: seasons.filter((s) => s.agree).length, total: seasons.length, seasons };
}

export type BadgeLevel = 'high' | 'medium' | 'low';
export type BadgeWhy = 'high' | 'few' | 'checkLow' | 'split' | 'unchecked' | 'checkMid' | 'analogsMixed' | 'noAnalogs';

/** High / Medium / Low with every reason that set it. `analog` is the card's crop in the look-alike years. */
export function badge({ seasons, analog, hitRate }: {
  seasons: number; analog: OddsResult | null; hitRate: number | null;
}): { level: BadgeLevel; why: BadgeWhy[] } {
  const low: BadgeWhy[] = [];
  if (seasons < MIN_SEASONS_FOR_MEDIUM) low.push('few');
  if (hitRate != null && hitRate < HIT_RATE_LOW) low.push('checkLow');
  if (analog && analog.total > 0 && Math.max(analog.good, analog.poor, analog.failed) < Math.min(2, analog.total)) {
    low.push('split');
  }
  if (low.length) return { level: 'low', why: low };
  if (hitRate == null) return { level: 'medium', why: ['unchecked'] };
  if (hitRate < HIT_RATE_HIGH) return { level: 'medium', why: ['checkMid'] };
  if (!analog || analog.total === 0) return { level: 'medium', why: ['noAnalogs'] };
  const unanimous = Math.max(analog.good, analog.poor, analog.failed) === analog.total;
  return unanimous ? { level: 'high', why: ['high'] } : { level: 'medium', why: ['analogsMixed'] };
}
