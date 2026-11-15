import type { FieldPosition, SoilTexture } from './engine';
import { DEFAULT_POSITION, DEFAULT_SOIL, DEFAULT_SOW, SOIL_TEXTURES } from './engine/constants';
import type { Lang } from './i18n';

/** Sowing dates and watering counts the inputs offer; a shared link may only pick from these. */
export const SOW_DATES = ['11-01', '11-15', '12-01', '12-15', '01-01', '01-15', '02-01'];
export const WATERING_CHOICES = [0, 1, 2, 3, 4, 6, 8];
const POSITIONS: FieldPosition[] = ['lowland', 'upland'];

export interface Settings { sow: string; soil: SoilTexture; position: FieldPosition; waterings: number }
export interface Shared { lat: number; lon: number; lang?: Lang; settings: Partial<Settings> }

// Three decimals is about 100 m: finer than a data cell, coarse enough not to pinpoint a house.
const round = (x: number) => Math.round(x * 1000) / 1000;

/** The link fragment for a field and its settings; defaults are left out to keep it short. */
export function encodeShare({ lat, lon, lang, settings: s }: Shared): string {
  const p = new URLSearchParams({ lat: String(round(lat)), lon: String(round(lon)) });
  if (s.sow && s.sow !== DEFAULT_SOW) p.set('sow', s.sow);
  if (s.soil && s.soil !== DEFAULT_SOIL) p.set('soil', s.soil);
  if (s.position && s.position !== DEFAULT_POSITION) p.set('pos', s.position);
  if (s.waterings) p.set('water', String(s.waterings));
  if (lang && lang !== 'en') p.set('lang', lang);
  return `#${p.toString()}`;
}

/** Reads a link fragment back; null when it has no usable location, and unknown settings are dropped. */
export function decodeShare(hash: string): Shared | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const lat = Number(p.get('lat') ?? NaN);
  const lon = Number(p.get('lon') ?? NaN);
  if (!p.has('lat') || !p.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const settings: Partial<Settings> = {};
  const sow = p.get('sow');
  if (sow && SOW_DATES.includes(sow)) settings.sow = sow;
  const soil = p.get('soil');
  if (soil && soil in SOIL_TEXTURES) settings.soil = soil as SoilTexture;
  const pos = p.get('pos');
  if (pos && (POSITIONS as string[]).includes(pos)) settings.position = pos as FieldPosition;
  const water = Number(p.get('water'));
  if (p.has('water') && WATERING_CHOICES.includes(water)) settings.waterings = water;
  const l = p.get('lang');
  const lang: Lang | undefined = l === 'th' || l === 'en' ? l : undefined;

  return { lat: round(lat), lon: round(lon), lang, settings };
}
