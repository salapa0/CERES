// Loads per-cell NASA POWER history: prebuilt static files first, live NASA POWER API as a fallback.
import type { CellData, Grid, GridCell, Num, SeasonData } from './engine';
import type { CurrentSeason } from './engine/analog';

const FIRST_SEASON = 2001;
const POWER_PARAMS = { rain: 'PRECTOTCORR', tmax: 'T2M_MAX', tmin: 'T2M_MIN', wetness: 'GWETROOT' } as const;
const POWER_FILL = -900; // POWER marks missing values as -999

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

export async function loadGrid(): Promise<Grid> {
  const r = await fetch(dataUrl('grid.json'));
  if (!r.ok) throw new Error('grid.json missing');
  return r.json();
}

/**
 * Snap a tap to its grid cell. The Thailand outline behind grid.json is coarse, so a tap on an
 * island or border tip may miss; it then takes the nearest cell within one cell's distance.
 * Null when no Thai cell is that close.
 */
export function cellForPoint(grid: Grid, lat: number, lon: number): GridCell | null {
  const { lat: dLat, lon: dLon } = grid.cellSize;
  let best: GridCell | null = null;
  let bestDist = Infinity;
  for (const c of grid.cells) {
    const y = Math.abs(c.lat - lat) / dLat;
    const x = Math.abs(c.lon - lon) / dLon;
    if (y <= 1 && x <= 1 && x * x + y * y < bestDist) {
      best = c;
      bestDist = x * x + y * y;
    }
  }
  return best;
}

export async function loadCell(cell: GridCell, onLive?: () => void): Promise<CellData> {
  try {
    const r = await fetch(dataUrl(`cells/${cell.id}.json`));
    if (r.ok) return await r.json();
  } catch {
    // fall through to the live API
  }
  onLive?.();
  return fetchLiveCell(cell);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const powerUrl = (cell: GridCell, start: string, end: string) =>
  `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${Object.values(POWER_PARAMS).join(',')}` +
  `&community=AG&latitude=${cell.lat}&longitude=${cell.lon}&start=${start}&end=${end}&format=JSON`;

/**
 * The dry season under way (1 Aug → the last day NASA POWER has, usually 2–4 days ago), fetched live.
 * Seasons start on 1 Aug, so from January to July this is the season that began last August.
 */
export async function fetchCurrentSeason(cell: GridCell, today = new Date()): Promise<CurrentSeason> {
  const year = today.getUTCMonth() >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const r = await fetch(powerUrl(cell, `${year}0801`, ymd(today)));
  if (!r.ok) throw new Error(`NASA POWER ${r.status}`);
  return parseCurrentSeason((await r.json()).properties.parameter, year, today);
}

/** POWER's daily JSON → arrays from 1 Aug to the last day where every parameter has a value. */
export function parseCurrentSeason(param: Record<string, Record<string, number>>, year: number, today: Date): CurrentSeason {
  const s: CurrentSeason = { year, start: `${year}-08-01`, asOf: '', rain: [], tmax: [], tmin: [], wetness: [] };
  let last = -1;
  for (let d = new Date(Date.UTC(year, 7, 1)), i = 0; d <= today; d.setUTCDate(d.getUTCDate() + 1), i++) {
    let complete = true;
    for (const [name, code] of Object.entries(POWER_PARAMS) as [keyof typeof POWER_PARAMS, string][]) {
      const v = param[code]?.[ymd(d)];
      const clean: Num = v == null || v < POWER_FILL ? null : v;
      s[name].push(clean);
      if (clean == null) complete = false;
    }
    if (complete) {
      last = i;
      s.asOf = d.toISOString().slice(0, 10);
    }
  }
  if (last < 0) throw new Error('NASA POWER has no data for this season yet');
  for (const k of ['rain', 'tmax', 'tmin', 'wetness'] as const) s[k] = s[k].slice(0, last + 1);
  return s;
}

/** Same shape as the prebuilt files, built in the browser from the NASA POWER API. */
async function fetchLiveCell(cell: GridCell): Promise<CellData> {
  const now = new Date();
  const lastSeason = now.getUTCMonth() >= 7 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
  const r = await fetch(powerUrl(cell, `${FIRST_SEASON}0801`, `${lastSeason + 1}0731`));
  if (!r.ok) throw new Error(`NASA POWER ${r.status}`);
  const param: Record<string, Record<string, number>> = (await r.json()).properties.parameter;

  const seasons: SeasonData[] = [];
  const wet: number[] = [];
  for (let year = FIRST_SEASON; year <= lastSeason; year++) {
    const s: SeasonData = { year, start: `${year}-08-01`, rain: [], tmax: [], tmin: [], wetness: [] };
    for (let d = new Date(Date.UTC(year, 7, 1)); d < new Date(Date.UTC(year + 1, 7, 1)); d.setUTCDate(d.getUTCDate() + 1)) {
      for (const [name, code] of Object.entries(POWER_PARAMS) as [keyof typeof POWER_PARAMS, string][]) {
        const v = param[code]?.[ymd(d)];
        const clean: Num = v == null || v < POWER_FILL ? null : v;
        s[name].push(clean);
        if (name === 'wetness' && clean != null) wet.push(clean);
      }
    }
    seasons.push(s);
  }
  wet.sort((a, b) => a - b);
  const pct = (q: number) => wet[Math.min(wet.length - 1, Math.floor(q * wet.length))] ?? 0;
  return {
    ...cell,
    sources: {
      rain: 'NASA POWER PRECTOTCORR (0.5°×0.625°)',
      temp: 'NASA POWER T2M_MAX/T2M_MIN (0.5°×0.625°)',
      wetness: 'NASA POWER GWETROOT (MERRA-2)',
    },
    wetnessScale: { p05: pct(0.05), p95: pct(0.95) },
    seasons,
  };
}

/** IMERG satellite rain for the current season, built daily by pipeline/build_imerg.py (F14). */
export interface ImergFile { product: string; start: string; asOf: string; generated: string; cells: Record<string, (number | null)[]> }
export interface ImergCell { start: string; asOf: string; rain: (number | null)[] }

export function pickImerg(file: ImergFile, id: string): ImergCell | null {
  const rain = file.cells[id];
  return rain ? { start: file.start, asOf: file.asOf, rain } : null;
}

/** SMAP L4 root-zone soil moisture (m³/m³) on one day, and the same date in past years; pipeline/build_smap.py (F15). */
export interface SmapFile {
  product: string; date: string; years: number[]; generated: string;
  cells: Record<string, { now: number; past: (number | null)[] }>;
}
export interface SmapCell { date: string; now: number; past: { year: number; value: number }[] }

export function pickSmap(file: SmapFile, id: string): SmapCell | null {
  const c = file.cells[id];
  if (!c || c.now == null) return null;
  const past = file.years
    .map((year, i) => ({ year, value: c.past[i] }))
    .filter((p): p is { year: number; value: number } => p.value != null);
  return { date: file.date, now: c.now, past };
}

let smapFile: Promise<SmapFile | null> | null = null;
/** Null when the file is missing: the app then hides the soil-now line. */
export function loadSmap(id: string): Promise<SmapCell | null> {
  smapFile ??= fetch(dataUrl('smap/current.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return smapFile.then((f) => (f ? pickSmap(f, id) : null));
}

let imergFile: Promise<ImergFile | null> | null = null;
/** Null when the file is missing (pipeline not run, NASA down): the app then simply hides the satellite line. */
export function loadImerg(id: string): Promise<ImergCell | null> {
  imergFile ??= fetch(dataUrl('imerg/current.json')).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return imergFile.then((f) => (f ? pickImerg(f, id) : null));
}
