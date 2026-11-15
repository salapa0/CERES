// The Field Time Machine replay engine (blueprint §9). Pure functions, no network.
import cropsJson from '../data/crops.json';
import {
  CAPILLARY_RISE_MAX_MM, IRRIGATION_MIN_GAP_DAYS, IRRIGATION_MM, SAFE_SHARE, WATERINGS_SEARCH_MAX, FAIL_RET, GOOD_RET, HEAT_DAYS_FAIL, KILL_DAYS, KILL_KS, RAIN_EFFECTIVE_FRACTION, SOIL_TEXTURES,
  WINDOW_FIRST, WINDOW_LAST, WINDOW_STEP_DAYS, WINDOW_TOLERANCE,
} from './constants';
import { extraterrestrialRadiation, hargreavesEt0 } from './et0';
import type {
  CellData, Crop, FieldPosition, OddsResult, Outcome, ReplayArgs, SeasonData, SoilTexture, Strategy, Timeline, WhatIf,
} from './types';

const DAY_MS = 86_400_000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function loadCrops(): Crop[] {
  return cropsJson as Crop[];
}

const startMs = (season: SeasonData) => Date.parse(`${season.start}T00:00:00Z`);

export function dayIndexToDate(season: SeasonData, index: number): Date {
  return new Date(startMs(season) + index * DAY_MS);
}

/** Index of a 'MM-DD' sowing date: Aug–Dec fall in the start year, Jan–Jul in the next. */
export function sowIndex(season: SeasonData, sowMonthDay: string): number {
  const [month, day] = sowMonthDay.split('-').map(Number);
  const year = month >= 8 ? season.year : season.year + 1;
  // Date.UTC rolls 29 Feb over to 1 Mar in a non-leap year.
  return Math.round((Date.UTC(year, month - 1, day) - startMs(season)) / DAY_MS);
}

function dayOfYear(d: Date): number {
  return Math.round((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY_MS);
}

/** Crop coefficient on day d after sowing (FAO-56 single-Kc curve). */
export function kcOnDay(crop: Crop, d: number): number {
  const { ini, dev, mid, late } = crop.stages;
  const { kc } = crop;
  if (d < ini) return kc.ini;
  if (d < ini + dev) return kc.ini + ((kc.mid - kc.ini) * (d - ini)) / dev;
  if (d < ini + dev + mid || late === 0) return kc.mid;
  return kc.mid + (kc.end - kc.mid) * Math.min(1, (d - ini - dev - mid) / late);
}

/** Days from sowing to harvest; green manure is ploughed in at flowering. */
export function seasonLength(crop: Crop): number {
  const { ini, dev, mid, late } = crop.stages;
  return crop.greenManure ? ini + dev + (crop.incorporateAfterDevDays ?? 0) : ini + dev + mid + late;
}

/** One crop, one season, one sowing date, day by day (FAO-56 root-zone water balance). */
export function replay(a: ReplayArgs): Outcome {
  const { cell, season, crop } = a;
  const whatIf = a.whatIf ?? { rainFactor: 1, dT: 0 };
  const sow = sowIndex(season, a.sowMonthDay);
  const length = seasonLength(crop);
  const nodata: Outcome = { kind: 'nodata', ret: null, deathDay: null, reason: null, sowIndex: sow };
  const w0 = season.wetness[sow];
  if (sow < 0 || sow + length > season.rain.length || w0 == null) return nodata;

  const { fc, wp } = SOIL_TEXTURES[a.soil];
  const taw = 1000 * (fc - wp) * crop.rootDepthM;
  const raw = crop.p * taw;
  const { p05, p95 } = cell.wetnessScale;
  const riseMax = CAPILLARY_RISE_MAX_MM[a.position ?? 'upland'];
  const relWet = (w: number) => clamp((w - p05) / (p95 - p05 || 1), 0, 1);
  let wet = relWet(w0);
  const critStart = crop.stages.ini + crop.stages.dev;
  const critEnd = critStart + crop.stages.mid / 2;

  let dr = (1 - wet) * taw;
  let sumEta = 0;
  let sumEtc = 0;
  let stressRun = 0;
  let heatDays = 0;
  let deathDay: number | null = null;
  let reason: Outcome['reason'] = null;
  let waterLeft = a.waterings ?? 0;
  let lastWatered = -Infinity;
  const trace = { dr: [] as number[], taw, raw, rain: [] as number[] };

  for (let d = 0; d < length; d++) {
    const i = sow + d;
    const rain0 = season.rain[i];
    const tmax0 = season.tmax[i];
    const tmin0 = season.tmin[i];
    if (rain0 == null || tmax0 == null || tmin0 == null) return nodata;
    const rain = rain0 * whatIf.rainFactor;
    const tmax = tmax0 + whatIf.dT;
    const tmin = tmin0 + whatIf.dT;

    const et0 = hargreavesEt0(tmax, tmin, extraterrestrialRadiation(cell.lat, dayOfYear(dayIndexToDate(season, i))));
    // The farmer waters when the crop starts to stress, while waterings remain.
    if (waterLeft > 0 && dr > raw && d - lastWatered >= IRRIGATION_MIN_GAP_DAYS) {
      dr = Math.max(0, dr - IRRIGATION_MM);
      waterLeft--;
      lastWatered = d;
    }
    const ks = dr <= raw ? 1 : (taw - dr) / ((1 - crop.p) * taw);
    const etc = kcOnDay(crop, d) * et0;
    const eta = ks * etc;
    const w = season.wetness[i];
    if (w != null) wet = relWet(w); // a gap keeps the last known wetness
    dr = clamp(dr - RAIN_EFFECTIVE_FRACTION * rain - riseMax * wet + eta, 0, taw);
    sumEta += eta;
    sumEtc += etc;

    if (d >= crop.stages.ini && ks < KILL_KS) {
      stressRun++;
      if (stressRun >= KILL_DAYS && deathDay == null) {
        deathDay = i - KILL_DAYS + 1;
        reason = 'drought';
      }
    } else stressRun = 0;

    if (!crop.greenManure && d >= critStart && d < critEnd && tmax > crop.heatC) {
      heatDays++;
      if (heatDays >= HEAT_DAYS_FAIL && deathDay == null) {
        deathDay = i;
        reason = 'heat';
      }
    }
    if (a.withDaily) {
      trace.dr.push(dr);
      trace.rain.push(rain);
    }
  }

  const ret = sumEtc > 0 ? sumEta / sumEtc : 1;
  const failed = deathDay != null || ret < FAIL_RET;
  return {
    kind: failed ? 'failed' : ret >= GOOD_RET ? 'good' : 'poor',
    ret,
    deathDay,
    reason: failed ? (reason ?? 'drought') : null,
    sowIndex: sow,
    watered: (a.waterings ?? 0) - waterLeft,
    daily: a.withDaily ? trace : undefined,
  };
}

export function runTimeline(
  cell: CellData, crops: Crop[], sowMonthDay: string, soil: SoilTexture, position: FieldPosition, whatIf?: WhatIf,
  waterings = 0,
): Timeline {
  const timeline: Timeline = {};
  for (const crop of crops) {
    timeline[crop.id] = cell.seasons.map((season) => replay({ cell, season, crop, sowMonthDay, soil, position, whatIf, waterings }));
  }
  return timeline;
}

export function odds(outcomes: Outcome[]): OddsResult {
  const r: OddsResult = { good: 0, poor: 0, failed: 0, nodata: 0, total: 0 };
  for (const o of outcomes) r[o.kind]++;
  r.total = r.good + r.poor + r.failed;
  return r;
}

/** Sowing dates the window sweep tries: WINDOW_FIRST to WINDOW_LAST every WINDOW_STEP_DAYS days. */
export function windowDates(): string[] {
  const at = (md: string) => {
    const [m, d] = md.split('-').map(Number);
    return Date.UTC(m >= 8 ? 2001 : 2002, m - 1, d); // any non-leap season works as a calendar
  };
  const out: string[] = [];
  for (let t = at(WINDOW_FIRST); t <= at(WINDOW_LAST); t += WINDOW_STEP_DAYS * DAY_MS) {
    const d = new Date(t);
    out.push(`${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return out;
}

export interface WindowPoint { sowMonthDay: string; odds: OddsResult; share: number | null }
export interface SowingWindow { points: WindowPoint[]; best: number | null; latest: string | null }

/**
 * Latest date whose share of good seasons is within WINDOW_TOLERANCE of the best; null if nothing ever worked.
 * A date where no season was good never counts, even when the best is itself below the tolerance.
 */
export function latestSafe(points: { sowMonthDay: string; share: number | null }[]): string | null {
  const shares = points.map((p) => p.share).filter((s): s is number => s != null);
  const best = shares.length ? Math.max(...shares) : 0;
  if (best <= 0) return null;
  let latest: string | null = null;
  for (const p of points) {
    if (p.share != null && p.share > 0 && p.share >= best - WINDOW_TOLERANCE - 1e-9) latest = p.sowMonthDay;
  }
  return latest;
}

/** Odds for one crop at every sweep date, and the latest safe sowing date (blueprint §9.9). */
export function sowingWindow(
  cell: CellData, crop: Crop, soil: SoilTexture, position: FieldPosition, whatIf?: WhatIf, waterings = 0,
): SowingWindow {
  const points = windowDates().map((sowMonthDay) => {
    const o = odds(cell.seasons.map((season) => replay({ cell, season, crop, sowMonthDay, soil, position, whatIf, waterings })));
    return { sowMonthDay, odds: o, share: o.total > 0 ? o.good / o.total : null };
  });
  const shares = points.map((p) => p.share).filter((s): s is number => s != null);
  return { points, best: shares.length ? Math.max(...shares) : null, latest: latestSafe(points) };
}

/**
 * Whole days from `today` (local calendar date) to the latest safe date of the dry season under way.
 * Negative when the date has passed; null from March to July, when no dry-season planting is under way.
 */
export function daysLeft(latest: string, today: Date): number | null {
  const m = today.getMonth();
  if (m >= 2 && m <= 6) return null;
  const seasonYear = m >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const [lm, ld] = latest.split('-').map(Number);
  const target = Date.UTC(lm >= 8 ? seasonYear : seasonYear + 1, lm - 1, ld);
  return Math.round((target - Date.UTC(today.getFullYear(), m, today.getDate())) / DAY_MS);
}

/**
 * Fewest waterings (0..WATERINGS_SEARCH_MAX) with which the crop survived at least SAFE_SHARE of past
 * seasons; null when even the maximum is not enough, or there is no data.
 */
export function waterNeeded(
  cell: CellData, crop: Crop, sowMonthDay: string, soil: SoilTexture, position: FieldPosition, whatIf?: WhatIf,
): number | null {
  for (let waterings = 0; waterings <= WATERINGS_SEARCH_MAX; waterings++) {
    const o = odds(cell.seasons.map((season) => replay({ cell, season, crop, sowMonthDay, soil, position, whatIf, waterings })));
    if (o.total === 0) return null;
    if (o.good / o.total >= SAFE_SHARE) return waterings;
  }
  return null;
}

/**
 * The three cards: A today's rice → bare, B the best legume, C the best other crop.
 * "Best" is the most surviving seasons; a tie goes to the crop listed first in crops.json.
 * The runner-up of each group is shown as the close alternative.
 */
export function buildStrategies(timeline: Timeline, crops: Crop[]): Strategy[] {
  const pick = (group: Crop[], id: 'B' | 'C'): Strategy => {
    const ranked = group
      .map((c, i) => ({ crop: c, odds: odds(timeline[c.id] ?? []), i }))
      .sort((a, b) => b.odds.good - a.odds.good || a.i - b.i);
    const [best, alt] = ranked;
    return {
      id, cropId: best?.crop.id ?? null, altCropId: alt?.crop.id ?? null, odds: best?.odds ?? null,
      soilEffect: best?.crop.soilEffect ?? 'uses',
    };
  };
  const legumes = crops.filter((c) => c.soilEffect === 'nitrogen');
  const others = crops.filter((c) => c.soilEffect !== 'nitrogen');
  return [
    { id: 'A', cropId: null, altCropId: null, odds: null, soilEffect: 'bare' },
    pick(legumes, 'B'),
    pick(others, 'C'),
  ];
}

export * from './types';
