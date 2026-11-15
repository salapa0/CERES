// Starting values chosen by the designer (blueprint §9.5). Tune here, in one place.
import type { FieldPosition, SoilTexture } from './types';

export const RAIN_EFFECTIVE_FRACTION = 0.8; // share of rain that reaches the root zone
export const KILL_KS = 0.2; // water-stress factor below this is "severe"
export const KILL_DAYS = 7; // consecutive severe days that kill the crop
export const GOOD_RET = 0.75; // share of water demand met for a "good" season
export const FAIL_RET = 0.5; // below this the season failed
export const HEAT_DAYS_FAIL = 3; // hot days at flowering that ruin the crop
export const WINDOW_TOLERANCE = 0.1; // odds drop allowed when finding the latest safe sowing date
export const WINDOW_FIRST = '11-01'; // sowing window sweep: 1 Nov to 1 Feb in 7-day steps
export const WINDOW_LAST = '02-01';
export const WINDOW_STEP_DAYS = 7;
export const ANALOG_K = 3; // nearest past seasons used for "this season looks like…"
export const SELFCHECK_TOLERANCE_DAYS = 14; // model and satellite dry-down dates within two weeks agree
export const HIT_RATE_HIGH = 0.75; // self-check needed for a High badge
export const HIT_RATE_LOW = 0.5; // below this the badge is Low
export const MIN_SEASONS_FOR_MEDIUM = 15; // fewer seasons with data make the badge Low

// Most water a shallow water table can lift into the root zone (FAO-56 "CR"), mm/day.
// Lowland paddies keep a shallow water table after the wet season; that is what makes
// residual-moisture crops possible. The daily amount is this value × that day's relative
// NASA root-zone wetness, so wet years supply more and the supply fades through the dry season.
export const CAPILLARY_RISE_MAX_MM: Record<FieldPosition, number> = { upland: 0, lowland: 3.5 };

// Extra water the farmer can give (pond, shallow well, canal). One watering is applied when the soil
// passes the stress line, at most once every IRRIGATION_MIN_GAP_DAYS days.
export const IRRIGATION_MM = 30; // one watering, as depth of water over the field
export const IRRIGATION_MIN_GAP_DAYS = 7;
export const WATERINGS_SEARCH_MAX = 8; // "how many waterings to be safe" looks no further than this
export const SAFE_SHARE = 0.8; // "safe" = survived at least 4 of 5 past seasons

export const DEFAULT_SOW = '11-15';
export const DEFAULT_SOIL: SoilTexture = 'loamySand';
export const DEFAULT_POSITION: FieldPosition = 'lowland';

// Field capacity and wilting point (m³/m³): midpoints of the ranges in FAO-56 Table 19
// (checked against the FAO web edition, chapter 7, on 14 Nov 2026).
export const SOIL_TEXTURES: Record<SoilTexture, { fc: number; wp: number }> = {
  sand: { fc: 0.12, wp: 0.045 }, // 0.07–0.17, 0.02–0.07
  loamySand: { fc: 0.15, wp: 0.065 }, // 0.11–0.19, 0.03–0.10
  sandyLoam: { fc: 0.23, wp: 0.11 }, // 0.18–0.28, 0.06–0.16
  loam: { fc: 0.25, wp: 0.12 }, // 0.20–0.30, 0.07–0.17
  // Table 19 has no "clay loam" row; this uses its nearest row, "Silt clay loam" (0.30–0.37, 0.17–0.24).
  clayLoam: { fc: 0.335, wp: 0.205 },
};

// Income: a 'poor' season (crop survived but stressed) is counted as half a normal harvest. Assumption, not measured.
export const POOR_HARVEST_SHARE = 0.5;
