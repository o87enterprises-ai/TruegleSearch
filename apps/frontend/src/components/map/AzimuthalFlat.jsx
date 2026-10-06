import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { geoAzimuthalEquidistant, geoPath, geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { useMap } from './context/MapContext';
import { TRUEGLE_BRAND_COLORS } from './config/truegleTheme';
import { AZIMUTHAL_FLAT_CONFIG, MAP_VIEW_MODES } from './config/constants';
import { getMarkerColor } from './utils/helpers';
import { onMapZoomRequest } from './utils/mapZoomBus';
import './styles/AzimuthalGlobe.css';

// ── THE AZIMUTHAL VIEW, DRAWN FOR REAL ──────────────────────────────────────
//
// Owner, 2026-10-06: the first two views "aren't working", with "some kind of
// bug that prevents manual zoom and navigation on mobile". This view was:
//
//   - a FIXED picture. The background was one PNG of a north-pole azimuthal
//     map; dragging moved the pins and the graticule but never the land, so
//     the pins slid across a world that stayed put.
//   - UN-ZOOMABLE. Zoom grew the SVG's viewBox by the same factor it grew the
//     drawing, and the browser scales a viewBox back to fit — every zoom level
//     rendered identically.
//   - mouse-only. No touch handling at all, and the wheel handler was a React
//     onWheel (passive), so its preventDefault never held either.
//   - showing ten hardcoded "traffic" dots over US cities, which were not data.
//
// Now it is an azimuthal equidistant projection (d3-geo) of real coastlines and
// borders (Natural Earth via world-atlas, loaded only when this view opens),
// centred wherever you were looking. Drag / one finger re-centres the world
// under your finger, wheel / pinch / the rail's +/− zoom, double-tap zooms in,
// and zooming in to navigable altitude hands over to the street map.

const MIN_ZOOM = 1;
const MAX_ZOOM = AZIMUTHAL_FLAT_CONFIG.maxZoom;            // the handover sits below this
const HANDOVER_ZOOM = AZIMUTHAL_FLAT_CONFIG.transitionToMapZoom;
// The street-map zoom that roughly matches the handover altitude.
const HANDOVER_MAP_ZOOM = 4.5;

let worldPromise = null;
function loadWorld() {
  // One fetch for the life of the page, shared by every mount.
  worldPromise ||= import('world-atlas/countries-110m.json').then((m) => {
    const topo = m.default || m;
    return {
      land: feature(topo, topo.objects.land),
      borders: mesh(topo, topo.objects.countries, (a, b) => a !== b),
    };
  });
  return worldPromise;
}

const clampLat = (lat) => Math.max(-89.9, Math.min(89.9, lat));
const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

export default function AzimuthalFlat({
  center = { lat: 0, lng: 0 },
  zoom = MIN_ZOOM,
  onMapClick = null,
  onMarkerClick = null,
  markers = [],
  routes = [],
  showGraticule = true,
}) {
  const { state, actions } = useMap();
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [world, setWorld] = useState(null);
  const [view, setView] = useState(() => ({
    lat: clampLat(state.azimuthalFlatCenter?.lat ?? center?.lat ?? 0),
    lng: wrapLng(state.azimuthalFlatCenter?.lng ?? center?.lng ?? 0),
    k: Math.max(MIN_ZOOM, Math.min(HANDOVER_ZOOM - 1, state.azimuthalFlatZoom || zoom || MIN_ZOOM)),
  }));
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => { let live = true; loadWorld().then((w) => live && setWorld(w)).catch(() => {}); return () => { live = false; }; }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(50, e.contentRect.width), h: Math.max(50, e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A whole world (radius π in projected units) fits the shorter side at k=1.
  const baseScale = (Math.min(size.w, size.h) / 2 - 8) / Math.PI;
  const projection = useMemo(() => geoAzimuthalEquidistant()
    .rotate([-view.lng, -view.lat])
    .scale(baseScale * view.k)
    .translate([size.w / 2, size.h / 2])
    .clipAngle(179.9)
    .precision(0.5), [view, baseScale, size]);
  const path = useMemo(() => geoPath(projection), [projection]);

  // Keep the shared state in step, and hand over to the street map once
  // zoomed in far enough to navigate.
  // Debounced: a drag changes the view every frame, and every write to the
  // shared map state re-renders everything that reads it.
  useEffect(() => {
    const t = setTimeout(() => {
      actions.setAzimuthalFlatCenter({ lat: view.lat, lng: view.lng });
      actions.setAzimuthalFlatZoom(view.k);
    }, 150);
    return () => clearTimeout(t);
  }, [actions, view]);
  useEffect(() => {
    if (view.k >= HANDOVER_ZOOM) {
      actions.setCenter({ lat: view.lat, lng: view.lng });
      actions.setZoom(HANDOVER_MAP_ZOOM);
      actions.setMapViewMode(MAP_VIEW_MODES.STANDARD);
    }
  }, [actions, view]);

  // Zoom about a screen point: the place under it stays under it.
  const zoomAt = useCallback((factor, px, py) => {
    const v = viewRef.current;
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.k * factor));
    if (k === v.k) return;
    let next = { ...v, k };
    if (px != null && factor > 1) {
      const before = projection.invert([px, py]);
      if (before) {
        // Move the centre a share of the way towards the pointer, so a zoom
        // aimed at Europe ends up looking at Europe.
        const share = 1 - v.k / k;
        next = { ...next, lat: clampLat(v.lat + (before[1] - v.lat) * share), lng: wrapLng(v.lng + (wrapLng(before[0] - v.lng)) * share) };
      }
    }
    setView(next);
  }, [projection]);

  // The rail's +/− (one control for every view). See utils/mapZoomBus.
  useEffect(() => onMapZoomRequest((dir) => zoomAt(dir > 0 ? 1.6 : 1 / 1.6)), [zoomAt]);

  // WHEEL, non-passive so it zooms the map instead of scrolling the page.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // DRAG and PINCH with pointer events — mouse, pen and touch alike.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const moved = useRef(false);
  const lastTap = useRef(0);
  const local = (e) => { const r = containerRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const onPointerDown = useCallback((e) => {
    containerRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { kind: 'pinch', dist: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), k: viewRef.current.k };
    } else if (pts.length === 1) {
      gesture.current = { kind: 'drag', at: pts[0] };
    }
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    if (g.kind === 'pinch' && pts.length >= 2) {
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (g.dist > 0) {
        moved.current = true;
        const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.k * (d / g.dist)));
        setView((v) => ({ ...v, k }));
      }
      return;
    }
    if (g.kind === 'drag') {
      const [x, y] = pts[0];
      const dx = x - g.at[0]; const dy = y - g.at[1];
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      moved.current = true;
      // The point that WAS at the centre is now dx,dy away: re-centre on what
      // is now under the middle, so the land follows the finger.
      const target = projection.invert([size.w / 2 - dx, size.h / 2 - dy]);
      g.at = [x, y];
      if (target) setView((v) => ({ ...v, lat: clampLat(target[1]), lng: wrapLng(target[0]) }));
    }
  }, [projection, size]);

  const onPointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId);
    const wasMoved = moved.current;
    const left = [...pointers.current.values()];
    gesture.current = left.length === 1 ? { kind: 'drag', at: left[0] } : null;
    if (wasMoved || left.length) return;
    // A tap. Two quick taps zoom in where they landed (like every map app).
    const now = Date.now();
    const [x, y] = local(e);
    if (now - lastTap.current < 320) { lastTap.current = 0; zoomAt(2, x, y); return; }
    lastTap.current = now;
    const ll = projection.invert([x, y]);
    if (ll && onMapClick) onMapClick({ lat: ll[1], lng: ll[0] });
  }, [projection, onMapClick, zoomAt]);

  const projectedMarkers = useMemo(() => markers
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
    .map((m) => {
      const xy = projection([m.lng, m.lat]);
      return xy ? { ...m, x: xy[0], y: xy[1] } : null;
    })
    .filter(Boolean), [markers, projection]);

  const routePaths = useMemo(() => (routes || [])
    .map((r) => (r?.geometry?.coordinates?.length >= 2 ? { id: r.id, d: path({ type: 'LineString', coordinates: r.geometry.coordinates }) } : null))
    .filter((r) => r?.d), [routes, path]);

  const sphere = path({ type: 'Sphere' });
  const graticule = showGraticule ? path(geoGraticule10()) : null;

  return (
    <div
      ref={containerRef}
      className="azimuthal-globe-container"
      data-azimuthal-view=""
      data-zoom={view.k.toFixed(2)}
      data-center={`${view.lat.toFixed(3)},${view.lng.toFixed(3)}`}
      style={{ width: '100%', height: '100%', touchAction: 'none', cursor: gesture.current ? 'grabbing' : 'grab', userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width={size.w} height={size.h} style={{ display: 'block' }} aria-label="Azimuthal equidistant map of the world">
        <path d={sphere} fill="#0b1e3a" stroke={TRUEGLE_BRAND_COLORS.blue} strokeWidth={1.5} />
        {graticule && <path d={graticule} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />}
        {world && <path d={path(world.land)} fill="#2f5d3a" stroke="none" />}
        {world && <path d={path(world.borders)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />}
        {routePaths.map((r) => <path key={r.id} d={r.d} fill="none" stroke="#38bdf8" strokeWidth={3} strokeLinecap="round" />)}
        {projectedMarkers.map((m) => (
          <g
            key={m.id}
            transform={`translate(${m.x}, ${m.y})`}
            style={{ cursor: 'pointer' }}
            onPointerUp={(e) => { e.stopPropagation(); onMarkerClick?.(m); actions.setSelectedMarker(m); }}
          >
            {m.category === 'CURRENT_LOCATION' ? (
              <>
                <circle r={9} fill="#3b82f6" fillOpacity={0.3} />
                <circle r={5} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
              </>
            ) : (
              <circle r={5} fill={getMarkerColor(m.category || 'DEFAULT')} stroke="white" strokeWidth={1.2} />
            )}
          </g>
        ))}
      </svg>
      {!world && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50 pointer-events-none">Drawing the world…</div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 text-[9px] text-white/45 bg-black/40 px-1.5 py-0.5 rounded">
        Azimuthal equidistant · Natural Earth
      </div>
    </div>
  );
}
