import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'; // OpenFreeMap, no key needed
const THAILAND_CENTER: [number, number] = [101.0, 13.2];

export function MapView({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const map = new maplibregl.Map({ container: box.current!, style: STYLE, center: THAILAND_CENTER, zoom: 4.6 });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    const marker = new maplibregl.Marker({ color: '#B5523B' });
    map.on('click', (e) => {
      marker.setLngLat(e.lngLat).addTo(map);
      pick.current(e.lngLat.lat, e.lngLat.lng);
    });
    return () => map.remove();
  }, []);

  return <div ref={box} className="map" />;
}
