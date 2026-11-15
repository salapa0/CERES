import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MapView } from './MapView';

// MapLibre needs WebGL, which jsdom lacks; this stand-in keeps only what MapView touches.
vi.mock('maplibre-gl', () => {
  class FakeMap {
    canvas: HTMLCanvasElement;
    constructor(o: { container: HTMLElement }) {
      this.canvas = document.createElement('canvas');
      this.canvas.tabIndex = 0; // MapLibre makes its canvas focusable, with arrow-key panning
      o.container.appendChild(this.canvas);
    }
    getCanvas() { return this.canvas; }
    getCenter() { return { lat: 16.5, lng: 102.8 }; }
    addControl() {}
    on() {}
    remove() {}
    resize() {}
    getZoom() { return 5; }
    flyTo() {}
    getLayer() { return undefined; }
    setLayoutProperty() {}
  }
  class Marker { setLngLat() { return this; } addTo() { return this; } }
  class NavigationControl {}
  return { default: { Map: FakeMap, Marker, NavigationControl } };
});
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

test('Enter or Space on the focused map picks the spot under the cross at its centre', () => {
  const onPick = vi.fn();
  const { container } = render(<MapView point={null} onPick={onPick} lang="en" />);
  const canvas = container.querySelector('canvas')!;
  fireEvent.keyDown(canvas, { key: 'Enter' });
  expect(onPick).toHaveBeenLastCalledWith(16.5, 102.8);
  fireEvent.keyDown(canvas, { key: ' ' });
  expect(onPick).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(canvas, { key: 'ArrowLeft' }); // panning stays MapLibre's job
  expect(onPick).toHaveBeenCalledTimes(2);
});

test('the map says how to pick by keyboard, and shows the cross while it has focus', () => {
  const { container } = render(<MapView point={null} onPick={() => {}} lang="th" />);
  const canvas = container.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).toMatch(/Enter/);
  expect(screen.getByTestId('map-cross')).not.toBeVisible();
  act(() => canvas.focus()); // as Tab would
  expect(screen.getByTestId('map-cross')).toBeVisible();
  act(() => canvas.blur());
  expect(screen.getByTestId('map-cross')).not.toBeVisible();
});
