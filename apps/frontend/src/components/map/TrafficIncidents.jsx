import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/maplibre';

// Live road incidents (crashes, closures, roadworks) on the map, and the
// "Live here" line on a place's card. Data: GET /api/maps/incidents — TomTom,
// proxied by the backend so the key and the visitor's location stay there.

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Below this zoom the visible area is bigger than TomTom answers in one call;
// the backend would say "too large" anyway, so don't ask.
const MIN_ZOOM = 9;

const ICON = {
  Crash: '💥',
  'Road closed': '⛔',
  'Lane closed': '🚧',
  Roadworks: '🚧',
  'Traffic jam': '🚗',
  'Broken-down vehicle': '🛻',
  Flooding: '🌊',
  Ice: '🧊',
  Fog: '🌫️',
  Rain: '🌧️',
  Wind: '💨',
  'Dangerous conditions': '⚠️',
};
export const incidentIcon = (kind) => ICON[kind] || '⚠️';

const SEVERITY_RING = { major: '#ef4444', moderate: '#f59e0b', minor: '#eab308' };

const glMap = (ref) => {
  const m = ref?.current;
  return m && typeof m.getMap === 'function' ? m.getMap() : m;
};

async function fetchIncidents(bbox, signal) {
  const res = await fetch(`${BACKEND}/api/maps/incidents?bbox=${bbox.map((n) => n.toFixed(4)).join(',')}`, { signal });
  if (!res.ok) return { incidents: [], unavailable: true };
  return res.json();
}

/**
 * Incidents for whatever the map shows, refreshed when the view settles.
 * Only while `enabled` (the traffic layer is on) — nobody asked otherwise.
 * @returns {{ incidents: object[], note: string }}
 */
export function useViewportIncidents(mapRef, { enabled, mapLoaded }) {
  const [incidents, setIncidents] = useState([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const map = glMap(mapRef);
    if (!enabled || !mapLoaded || !map?.getBounds) { setIncidents([]); setNote(''); return undefined; }
    let controller = null;
    let timer = null;
    const load = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (map.getZoom() < MIN_ZOOM) { setIncidents([]); setNote('Zoom in to see incidents'); return; }
        const b = map.getBounds();
        controller?.abort();
        controller = new AbortController();
        try {
          const out = await fetchIncidents([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], controller.signal);
          setIncidents(out.incidents || []);
          setNote(out.tooLarge ? 'Zoom in to see incidents' : out.unavailable ? 'Incidents unavailable right now' : '');
        } catch (e) {
          if (e.name !== 'AbortError') { setIncidents([]); setNote('Incidents unavailable right now'); }
        }
      }, 400);
    };
    load();
    map.on('moveend', load);
    return () => { map.off('moveend', load); clearTimeout(timer); controller?.abort(); };
  }, [mapRef, enabled, mapLoaded]);

  return { incidents, note };
}

/** One pin per incident; tapping it hands the incident up for its card. */
export function IncidentMarkers({ incidents, onSelect }) {
  return incidents.map((inc) => (
    <Marker key={inc.id} longitude={inc.lng} latitude={inc.lat} anchor="center">
      <button
        type="button"
        className="truegle-incident-pin"
        style={{ borderColor: SEVERITY_RING[inc.severity] || '#94a3b8' }}
        title={inc.kind}
        aria-label={`${inc.kind}${inc.road ? ` on ${inc.road}` : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect?.(inc); }}
      >
        <span aria-hidden="true">{incidentIcon(inc.kind)}</span>
      </button>
    </Marker>
  ));
}

const minutes = (s) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

/** The card body for a tapped incident. */
export function IncidentDetails({ incident }) {
  const where = [incident.road, incident.from && incident.to ? `${incident.from} → ${incident.to}` : incident.from].filter(Boolean).join(' · ');
  return (
    <div className="truegle-popup">
      <div className="name">{incidentIcon(incident.kind)} {incident.kind}</div>
      {where && <div className="address">{where}</div>}
      {incident.description && incident.description.toLowerCase() !== incident.kind.toLowerCase() && <div className="detail">{incident.description}</div>}
      {incident.delaySeconds > 0 && <div className="detail">Delay about {minutes(incident.delaySeconds)}</div>}
    </div>
  );
}

// About 3 km either side — "near this place", not "in this city".
const NEAR_DEG = 0.027;

/**
 * "Live here" for a selected place: incidents within ~3 km (always — it is
 * one cached request) and, when the traffic layer is drawn, how busy the
 * roads right around it are, read straight off the rendered traffic lines.
 * @returns {string} one line, or '' while unknown
 */
export function useLiveHere(mapRef, place, trafficOn) {
  const [line, setLine] = useState('');

  useEffect(() => {
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) { setLine(''); return undefined; }
    const controller = new AbortController();
    const dLng = NEAR_DEG / Math.max(Math.cos((place.lat * Math.PI) / 180), 0.2);
    const bbox = [place.lng - dLng, place.lat - NEAR_DEG, place.lng + dLng, place.lat + NEAR_DEG];

    (async () => {
      let incidentPart = '';
      try {
        const out = await fetchIncidents(bbox, controller.signal);
        if (out.unavailable) incidentPart = '';
        else if (!out.incidents?.length) incidentPart = 'No reported incidents nearby';
        else {
          const kinds = [...new Set(out.incidents.map((i) => i.kind))].slice(0, 2).join(', ');
          incidentPart = `${out.incidents.length} incident${out.incidents.length > 1 ? 's' : ''} nearby (${kinds})`;
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
      }

      let trafficPart = '';
      const map = glMap(mapRef);
      if (trafficOn && map?.getLayer?.('traffic')) {
        const pt = map.project([place.lng, place.lat]);
        const r = 80;
        const feats = map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers: ['traffic'] });
        const count = { low: 0, moderate: 0, heavy: 0, severe: 0 };
        feats.forEach((f) => { const c = f.properties?.congestion; if (c in count) count[c] += 1; });
        const total = Object.values(count).reduce((a, b) => a + b, 0);
        if (total) {
          const busy = count.heavy + count.severe;
          trafficPart = busy / total >= 0.25 ? 'Heavy traffic around it'
            : (count.moderate + busy) / total >= 0.25 ? 'Moderate traffic around it'
              : 'Traffic is light around it';
        }
      }
      setLine([trafficPart, incidentPart].filter(Boolean).join(' · '));
    })();
    return () => controller.abort();
  }, [mapRef, place?.lat, place?.lng, trafficOn]);

  return line;
}
