import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { circleAround, GeoError, GIVE_UP_MS, GOOD_ACCURACY_M, locate, SETTLE_MS, zoomForAccuracy } from './geo';

type Ok = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Bad = (e: { code: number }) => void;

/** A fake device: the test decides when fixes or errors arrive. */
function fakeGeo() {
  const g = { ok: null as Ok | null, bad: null as Bad | null, options: null as PositionOptions | null, cleared: [] as number[] };
  const api = {
    watchPosition: (ok: Ok, bad: Bad, options: PositionOptions) => { g.ok = ok; g.bad = bad; g.options = options; return 7; },
    clearWatch: (id: number) => { g.cleared.push(id); },
  };
  const fix = (latitude: number, longitude: number, accuracy: number) => g.ok!({ coords: { latitude, longitude, accuracy } });
  return { g, api: api as unknown as Geolocation, fix };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('asks for a fresh high-accuracy fix, never a cached one', () => {
  const { g, api } = fakeGeo();
  void locate(api, true).catch(() => {});
  expect(g.options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
});

test('a tight fix is returned at once, exactly as the device reported it', async () => {
  const { g, api, fix } = fakeGeo();
  const p = locate(api, true);
  fix(14.123456, 101.654321, GOOD_ACCURACY_M - 1);
  await expect(p).resolves.toEqual({ lat: 14.123456, lon: 101.654321, accuracy: GOOD_ACCURACY_M - 1 });
  expect(g.cleared).toEqual([7]);
});

test('a coarse first guess is refined: the tightest fix within the settle time wins', async () => {
  const { api, fix } = fakeGeo();
  const p = locate(api, true);
  fix(13.0, 100.0, 4000); // IP-style guess
  await vi.advanceTimersByTimeAsync(2000);
  fix(14.5, 101.5, 120); // Wi-Fi
  fix(14.6, 101.6, 300); // a worse one later does not replace it
  await vi.advanceTimersByTimeAsync(SETTLE_MS);
  await expect(p).resolves.toEqual({ lat: 14.5, lon: 101.5, accuracy: 120 });
});

test('permission denied fails at once, with its own reason', async () => {
  const { g, api } = fakeGeo();
  const p = locate(api, true);
  g.bad!({ code: 1 });
  await expect(p).rejects.toMatchObject({ reason: 'denied' });
  expect(g.cleared).toEqual([7]);
});

test('no fix by the deadline reports why: unavailable, or timeout', async () => {
  const a = fakeGeo();
  const unavailable = locate(a.api, true);
  const caught = unavailable.catch((e) => e);
  a.g.bad!({ code: 2 });
  await vi.advanceTimersByTimeAsync(GIVE_UP_MS);
  expect(await caught).toMatchObject({ reason: 'unavailable' });

  const b = fakeGeo();
  const timeout = locate(b.api, true).catch((e) => e);
  await vi.advanceTimersByTimeAsync(GIVE_UP_MS);
  expect(await timeout).toMatchObject({ reason: 'timeout' });
});

test('an error followed by a fix still succeeds', async () => {
  const { g, api, fix } = fakeGeo();
  const p = locate(api, true);
  g.bad!({ code: 2 });
  fix(15, 102, 30);
  await expect(p).resolves.toMatchObject({ lat: 15, lon: 102 });
});

test('no geolocation support, or a page that is not https, is reported before asking', async () => {
  await expect(locate(undefined, true)).rejects.toBeInstanceOf(GeoError);
  await expect(locate(undefined, true)).rejects.toMatchObject({ reason: 'unsupported' });
  await expect(locate(fakeGeo().api, false)).rejects.toMatchObject({ reason: 'insecure' });
});

test('the accuracy circle has the stated radius', () => {
  const ring = circleAround(14, 101, 1000).geometry.coordinates[0];
  expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
  const north = Math.max(...ring.map((c) => c[1]));
  expect((north - 14) * 111_195).toBeCloseTo(1000, -1); // about 1 km
});

test('tight fixes zoom to the field, loose ones stay wide', () => {
  expect(zoomForAccuracy(20)).toBeGreaterThan(zoomForAccuracy(800));
  expect(zoomForAccuracy(800)).toBeGreaterThan(zoomForAccuracy(20_000));
});
