// Starting values chosen by the designer (blueprint §9.5). Tune here, in one place.
import type { FieldPosition, SoilTexture } from './types';

export const RAIN_EFFECTIVE_FRACTION = 0.8; // share of rain that reaches the root zone
export const KILL_KS = 0.2; // water-stress factor below this is "severe"
export const KILL_DAYS = 7; // consecutive severe days that kill the crop
export const GOOD_RET = 0.75; // share of water demand met for a "good" season
export const FAIL_RET = 0.5; // below this the season failed
export const HEAT_DAYS_FAIL = 3; // hot days at flowering that ruin the crop

// Most water a shallow water table can lift into the root zone (FAO-56 "CR"), mm/day.
// Lowland paddies keep a shallow water table after the wet season; that is what makes
// residual-moisture crops possible. The daily amount is this value × that day's relative
// NASA root-zone wetness, so wet years supply more and the supply fades through the dry season.
export const CAPILLARY_RISE_MAX_MM: Record<FieldPosition, number> = { upland: 0, lowland: 3.5 };

export const DEFAULT_SOW = '11-15';
export const DEFAULT_SOIL: SoilTexture = 'loamySand';
export const DEFAULT_POSITION: FieldPosition = 'lowland';

// Field capacity and wilting point (m³/m³): midpoints of the ranges in FAO-56 Table 19.
export const SOIL_TEXTURES: Record<SoilTexture, { fc: number; wp: number }> = {
  sand: { fc: 0.12, wp: 0.045 },
  loamySand: { fc: 0.15, wp: 0.065 },
  sandyLoam: { fc: 0.23, wp: 0.11 },
  loam: { fc: 0.25, wp: 0.12 },
  clayLoam: { fc: 0.33, wp: 0.2 },
};
