import React, { useEffect, useRef, useState } from 'react';

/**
 * The map, for devices that cannot draw WebGL.
 *
 * MapLibre, Globe3D and AzimuthalFlat all need a WebGL context. When one
 * cannot be created there is nothing to fall back TO — the "standard map" the
 * old WebGL error boundary promised is itself MapLibre. This is a real map
 * built on raster tiles, which are ordinary images and need no GPU at all: it
 * pans, zooms, shows the places that were found and draws a route line.
 *
 * WHY PLAIN LEAFLET AND NOT react-leaflet. Both are already dependencies, but
 * react-leaflet couples to a React major and this file exists precisely to run
 * where things are already going wrong. The imperative API has no such
 * coupling, and the whole component is one effect.
 *
 * WHY IT IS LOADED LAZILY. Leaflet is imported inside the effect, so a visitor
 * whose device has WebGL — nearly all of them — never downloads it. Nothing
 * about this file is in the main bundle.
 */
export default function RasterMapFallback({
  viewState,
  markers = [],
  routes = [],
  reason = '',
  onMarkerClick,
  onMoveEnd,
}) {
  const holder = useRef(null);
  const map = useRef(null);
  const layers = useRef([]);
  const [failed, setFailed] = useState('');

  // ── create the map once ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let created = null;

    (async () => {
      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        if (cancelled || !holder.current) return;

        created = L.map(holder.current, {
          center: [viewState?.latitude ?? 0, viewState?.longitude ?? 0],
          zoom: viewState?.zoom ?? 12,
          // The GL build draws its own; these are the raster equivalents.
          zoomControl: true,
          attributionControl: true,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          // Required by the OSM tile usage policy, and true regardless.
          attribution: '© OpenStreetMap contributors',
        }).addTo(created);

        if (onMoveEnd) {
          created.on('moveend', () => {
            const c = created.getCenter();
            // Same envelope MapLibre emits, so TruegleMap's handleMoveEnd —
            // which reads evt.viewState — works unchanged for both maps.
            onMoveEnd({ viewState: { longitude: c.lng, latitude: c.lat, zoom: created.getZoom() } });
          });
        }

        map.current = created;
        // Tiles are laid out against the container's size, which is zero until
        // the browser has laid this out at least once.
        setTimeout(() => created.invalidateSize(), 0);
      } catch (error) {
        if (!cancelled) setFailed(error?.message || 'the fallback map could not load');
      }
    })();

    return () => {
      cancelled = true;
      if (created) created.remove();
      map.current = null;
    };
    // Created once. Position changes are handled by the effect below, because
    // tearing the map down on every pan would fight the user for the viewport.
  }, []);

  // ── markers and routes, redrawn when they change ──────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!map.current) return;

      for (const layer of layers.current) layer.remove();
      layers.current = [];

      for (const marker of markers) {
        if (!Number.isFinite(marker?.lat) || !Number.isFinite(marker?.lng)) continue;
        // A divIcon is styled HTML rather than an image, which sidesteps
        // Leaflet's default icon paths breaking under a bundler — and means
        // the pin needs no asset request of its own.
        const pin = L.marker([marker.lat, marker.lng], {
          title: marker.name || '',
          icon: L.divIcon({
            className: 'truegle-raster-pin',
            html: '<span aria-hidden="true"></span>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        }).addTo(m);

        const label = [marker.name, marker.address].filter(Boolean).join('<br>');
        if (label) pin.bindPopup(label);
        if (onMarkerClick) pin.on('click', () => onMarkerClick(marker));
        layers.current.push(pin);
      }

      for (const route of routes) {
        const coords = route?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) continue;
        // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
        const line = L.polyline(coords.map(([lng, lat]) => [lat, lng]), {
          color: '#38bdf8',
          weight: 4,
        }).addTo(m);
        layers.current.push(line);
      }
    })();
  }, [markers, routes, onMarkerClick]);

  // ── follow the app's view when it moves the map itself ────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !viewState) return;
    if (!Number.isFinite(viewState.latitude) || !Number.isFinite(viewState.longitude)) return;
    m.setView([viewState.latitude, viewState.longitude], viewState.zoom ?? m.getZoom());
  }, [viewState]);

  return (
    <div className="truegle-raster-map" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={holder} style={{ width: '100%', height: '100%' }} data-testid="raster-map" />
      {/* Say what happened, once, without covering the map. A blank rectangle
          and a working-but-plainer map look the same to somebody who does not
          know their device refused WebGL. */}
      <div
        className="truegle-raster-note"
        role="status"
        style={{
          position: 'absolute', left: 8, top: 8, zIndex: 500,
          maxWidth: 'min(320px, calc(100% - 16px))',
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(10,10,10,0.78)', color: '#e5e7eb',
          fontSize: 12, lineHeight: 1.35, pointerEvents: 'none',
        }}
      >
        {failed
          ? `Map unavailable — ${failed}`
          : `Simplified map: ${reason || 'this device cannot draw the 3D map'}.`}
      </div>
    </div>
  );
}
