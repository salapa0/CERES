// Loads per-cell NASA POWER history: prebuilt static files first, live NASA POWER API as a fallback.
import type { CellData, Grid, GridCell, Num, SeasonData } from './engine';

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

/** Same shape as the prebuilt files, built in the browser from the NASA POWER API. */
async function fetchLiveCell(cell: GridCell): Promise<CellData> {
  const now = new Date();
  const lastSeason = now.getUTCMonth() >= 7 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
  const url =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${Object.values(POWER_PARAMS).join(',')}` +
    `&community=AG&latitude=${cell.lat}&longitude=${cell.lon}&start=${FIRST_SEASON}0801&end=${lastSeason + 1}0731&format=JSON`;
  const r = await fetch(url);
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
