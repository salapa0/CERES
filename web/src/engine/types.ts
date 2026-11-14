export type Num = number | null;

export interface SeasonData {
  year: number; // CE year the season starts in (1 Aug)
  start: string; // ISO date of index 0
  rain: Num[];
  tmax: Num[];
  tmin: Num[];
  wetness: Num[];
}

export interface CellData {
  id: string;
  lat: number;
  lon: number;
  sources: Record<string, string>;
  wetnessScale: { p05: number; p95: number };
  seasons: SeasonData[];
}

export interface GridCell { id: string; lat: number; lon: number }
export interface Grid { cellSize: { lat: number; lon: number }; cells: GridCell[] }

export type SoilTexture = 'sand' | 'loamySand' | 'sandyLoam' | 'loam' | 'clayLoam';
export type SoilEffect = 'nitrogen' | 'organic' | 'uses' | 'bare';
export type FieldPosition = 'upland' | 'lowland';

export interface Crop {
  id: string;
  nameTh: string;
  nameEn: string;
  stages: { ini: number; dev: number; mid: number; late: number };
  kc: { ini: number; mid: number; end: number };
  rootDepthM: number;
  p: number; // depletion fraction before stress (FAO-56 Table 22)
  heatC: number;
  soilEffect: SoilEffect;
  greenManure?: boolean;
  incorporateAfterDevDays?: number;
  sources: string[];
  assumption: boolean;
}

export interface WhatIf { rainFactor: number; dT: number }
export type OutcomeKind = 'good' | 'poor' | 'failed' | 'nodata';

export interface DailyTrace { dr: number[]; taw: number; raw: number; rain: number[] }

export interface Outcome {
  kind: OutcomeKind;
  ret: number | null; // actual / potential crop water use over the season
  deathDay: number | null; // index into the season arrays
  reason: 'drought' | 'heat' | null;
  sowIndex: number;
  daily?: DailyTrace;
}

export interface ReplayArgs {
  cell: CellData;
  season: SeasonData;
  crop: Crop;
  sowMonthDay: string; // 'MM-DD'
  soil: SoilTexture;
  position?: FieldPosition;
  whatIf?: WhatIf;
  withDaily?: boolean;
}

export interface OddsResult { good: number; poor: number; failed: number; nodata: number; total: number }
export type Timeline = Record<string, Outcome[]>; // cropId -> one Outcome per season

export interface Strategy {
  id: 'A' | 'B' | 'C';
  cropId: string | null;
  altCropId: string | null;
  odds: OddsResult | null;
  soilEffect: SoilEffect;
}
