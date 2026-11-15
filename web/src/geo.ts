// "Use my location": the device's real position, not a stale or coarse one.

export interface Fix { lat: number; lon: number; accuracy: number } // accuracy: radius in metres
export type GeoFailure = 'unsupported' | 'insecure' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
  constructor(readonly reason: GeoFailure) {
    super(reason);
  }
}

export const GOOD_ACCURACY_M = 50; // stop waiting as soon as a fix is this tight
export const SETTLE_MS = 8_000; // otherwise keep listening this long after the first fix and take the tightest
export const GIVE_UP_MS = 20_000; // no fix at all by then
export const ROUGH_ACCURACY_M = 1_000; // a fix looser than this is shown as approximate

type Geo = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;

/**
 * Asks for a fresh high-accuracy fix (never a cached one: maximumAge 0). Phones and laptops often
 * answer first with a coarse Wi-Fi or IP guess and refine it a few seconds later, so this listens
 * until a fix is tight enough or SETTLE_MS has passed, and returns the tightest fix seen.
 */
export function locate(
  geo: Geo | undefined = typeof navigator === 'undefined' ? undefined : navigator.geolocation,
  secure: boolean = typeof window === 'undefined' || window.isSecureContext !== false,
): Promise<Fix> {
  if (!geo) return Promise.reject(new GeoError('unsupported'));
  if (!secure) return Promise.reject(new GeoError('insecure')); // browsers refuse location on plain http

  return new Promise((resolve, reject) => {
    let best: Fix | null = null;
    let lastFailure: GeoFailure = 'timeout';
    let watchId: number | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let finished = false;

    const finish = (end: () => void) => {
      if (finished) return;
      finished = true;
      if (watchId !== undefined) geo.clearWatch(watchId);
      clearTimeout(settle);
      clearTimeout(giveUp);
      end();
    };
    const giveUp = setTimeout(
      () => finish(() => (best ? resolve(best) : reject(new GeoError(lastFailure)))), GIVE_UP_MS);

    watchId = geo.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (best.accuracy <= GOOD_ACCURACY_M) return finish(() => resolve(best!));
        settle ??= setTimeout(() => finish(() => resolve(best!)), SETTLE_MS);
      },
      (e) => {
        if (e.code === 1) return finish(() => reject(new GeoError('denied'))); // PERMISSION_DENIED
        lastFailure = e.code === 3 ? 'timeout' : 'unavailable'; // TIMEOUT : POSITION_UNAVAILABLE; keep listening
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GIVE_UP_MS },
    );
    if (finished) geo.clearWatch(watchId); // a fix that arrived before watchPosition returned
  });
}

const EARTH_RADIUS_M = 6_371_000;

/** A circle of `radiusM` metres around a point, as a GeoJSON polygon (64 sides is smooth at any zoom here). */
export function circleAround(lat: number, lon: number, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** Zoom that keeps a location's accuracy circle in view: tight fixes zoom to the field, loose ones stay wide. */
export function zoomForAccuracy(accuracyM: number): number {
  return accuracyM <= 100 ? 15 : accuracyM <= 500 ? 14 : accuracyM <= 2_000 ? 12 : accuracyM <= 10_000 ? 10 : 8;
}
