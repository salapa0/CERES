// The Field Time Machine replay engine (blueprint §9). Pure functions, no network.
import cropsJson from '../data/crops.json';
import {
  CAPILLARY_RISE_MAX_MM, FAIL_RET, GOOD_RET, HEAT_DAYS_FAIL, KILL_DAYS, KILL_KS, RAIN_EFFECTIVE_FRACTION, SOIL_TEXTURES,
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
    daily: a.withDaily ? trace : undefined,
  };
}

export function runTimeline(
  cell: CellData, crops: Crop[], sowMonthDay: string, soil: SoilTexture, position: FieldPosition, whatIf?: WhatIf,
): Timeline {
  const timeline: Timeline = {};
  for (const crop of crops) {
    timeline[crop.id] = cell.seasons.map((season) => replay({ cell, season, crop, sowMonthDay, soil, position, whatIf }));
  }
  return timeline;
}

export function odds(outcomes: Outcome[]): OddsResult {
  const r: OddsResult = { good: 0, poor: 0, failed: 0, nodata: 0, total: 0 };
  for (const o of outcomes) r[o.kind]++;
  r.total = r.good + r.poor + r.failed;
  return r;
}

/** The three cards: A today's rice → bare, B best legume, C best other crop. */
export function buildStrategies(timeline: Timeline, crops: Crop[]): Strategy[] {
  const pick = (first: string, second: string): Strategy => {
    const a = odds(timeline[first] ?? []);
    const b = odds(timeline[second] ?? []);
    const [best, alt, bestOdds] = b.good > a.good ? [second, first, b] : [first, second, a]; // tie → first
    return {
      id: 'B', cropId: best, altCropId: alt, odds: bestOdds,
      soilEffect: crops.find((c) => c.id === best)?.soilEffect ?? 'uses',
    };
  };
  return [
    { id: 'A', cropId: null, altCropId: null, odds: null, soilEffect: 'bare' },
    pick('mungbean', 'peanut'),
    { ...pick('sunnhemp', 'maize'), id: 'C' },
  ];
}

export * from './types';
