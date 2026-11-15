import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { t, type Lang } from './i18n';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap, no key needed
const THAILAND_CENTER: [number, number] = [101.0, 13.2];

// EOX Sentinel-2 cloudless: 2016 is the global year under CC BY 4.0 (2017 is CC BY too but blank over
// Thailand; 2018 onward is non-commercial only). Checked against EOX's WMTS capabilities on 14 Nov 2026.
const SATELLITE_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';
const SATELLITE_CREDIT =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2016</a> by EOX IT Services GmbH ' +
  '(contains modified Copernicus Sentinel data 2016), CC BY 4.0';

export interface MapPoint { lat: number; lon: number; fly?: boolean }

export function MapView({ point, onPick, lang, hint }: {
  point: MapPoint | null; onPick: (lat: number, lon: number) => void; lang: Lang; hint?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [satellite, setSatellite] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, style: STYLE, center: THAILAND_CENTER, zoom: 4.6, attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    markerRef.current = new maplibregl.Marker({ color: '#1F5FBF' });
    map.on('click', (e) => pick.current(e.lngLat.lat, e.lngLat.lng));
    map.on('load', () => {
      map.addSource('satellite', { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 14, attribution: SATELLITE_CREDIT });
      // Under the first label layer, so place names stay readable on the photo.
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } }, firstLabel);
      setReady(true);
    });
    // The map can be hidden (About page) and shown again; keep its canvas the size of its box.
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(box.current!);
    mapRef.current = map;
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    markerRef.current!.setLngLat([point.lon, point.lat]).addTo(map);
    if (point.fly) map.flyTo({ center: [point.lon, point.lat], zoom: Math.max(map.getZoom(), 8) });
  }, [point]);

  useEffect(() => {
    // The layer check guards a map that was recreated (hot reload) while `ready` stayed true.
    const map = mapRef.current;
    if (ready && map?.getLayer('satellite')) map.setLayoutProperty('satellite', 'visibility', satellite ? 'visible' : 'none');
  }, [satellite, ready]);

  return (
    <div className="map-wrap">
      <div ref={box} className="map" />
      {hint && !point && <p className="map-hint">{hint}</p>}
      <div className="basemap-toggle" role="group" aria-label={`${t(lang, 'map.satellite')} / ${t(lang, 'map.streets')}`}>
        <button aria-pressed={satellite} disabled={!ready} onClick={() => setSatellite(true)}>{t(lang, 'map.satellite')}</button>
        <button aria-pressed={!satellite} onClick={() => setSatellite(false)}>{t(lang, 'map.streets')}</button>
      </div>
    </div>
  );
}
