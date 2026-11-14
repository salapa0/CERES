/** Extraterrestrial radiation, MJ m⁻² day⁻¹ (FAO-56 eq. 21). */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
}

/** Reference evapotranspiration, mm/day (Hargreaves, FAO-56 eq. 52). */
export function hargreavesEt0(tmax: number, tmin: number, ra: number): number {
  const range = Math.max(tmax - tmin, 0);
  return Math.max(0, 0.0023 * ((tmax + tmin) / 2 + 17.8) * Math.sqrt(range) * 0.408 * ra);
}
