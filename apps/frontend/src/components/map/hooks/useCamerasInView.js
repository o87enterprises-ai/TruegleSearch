import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';

// Cameras as a MAP LAYER (owner, 2026-10-06: the traffic-cam menu "removed and
// instead it become a map overlay. Anywhere a traffic camera is available on
// the map there should be a little camera icon").
//
// Two sources, merged:
//   - the "Public cameras" live layer (OSIRIS cctv) — DOT and public webcams
//     with a still-image feed_url, nationwide
//   - OpenTrafficCamMap via /api/maps/traffic-cameras/bbox — state DOT cameras
//     (California, Colorado, Ohio, …) with image and sometimes video
//
// Only from a zoom where an icon per camera is readable. Below it the layer
// says "zoom in" rather than drawing two thousand icons on a continent.

export const CAMERA_MIN_ZOOM = 8;
const MAX_ICONS = 250;
const DEBOUNCE_MS = 400;

const fromOsiris = (f) => {
  const [lng, lat] = f?.geometry?.coordinates || [];
  const p = f?.properties || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !p.feed_url) return null;
  return { id: `cctv-${p.id || `${lat},${lng}`}`, lat, lng, name: p.name || p._label || 'Camera', address: [p.city, p.source].filter(Boolean).join(' · '), imageUrl: p.feed_url, streamUrl: null, category: 'CAMERA' };
};
const fromOtc = (c) => {
  const lat = c?.location?.lat; const lng = c?.location?.lng;
  const image = c?.urls?.image || c?.imageUrl || null;
  const video = c?.urls?.video || c?.streamUrl || null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (!image && !video)) return null;
  return { id: `otc-${c.id}`, lat, lng, name: c.name || 'Traffic camera', address: c.metadata?.description || c.source || '', imageUrl: image, streamUrl: video, category: 'CAMERA' };
};

/**
 * @param {{enabled:boolean, bbox:number[]|null, zoom:number, osirisFeatures:Array}} p
 *   bbox is [west, south, east, north]
 */
export default function useCamerasInView({ enabled, bbox, zoom, osirisFeatures = [] }) {
  const [otc, setOtc] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const close = enabled && zoom >= CAMERA_MIN_ZOOM;
  const key = bbox ? bbox.map((n) => n.toFixed(2)).join(',') : '';

  useEffect(() => {
    clearTimeout(timer.current);
    if (!close || !bbox) { setOtc([]); return undefined; }
    let cancelled = false;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [w, s, e, n] = bbox;
        const { data } = await api.get(`/maps/traffic-cameras/bbox/${s}/${w}/${n}/${e}`);
        if (!cancelled) setOtc(Array.isArray(data?.data) ? data.data : []);
      } catch {
        if (!cancelled) setOtc([]);   // the other source still draws
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer.current); };
    // key stands in for bbox: same numbers, same request.
  }, [close, key]);

  const cameras = useMemo(() => {
    if (!close || !bbox) return [];
    const [w, s, e, n] = bbox;
    const inView = (c) => c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e;
    const seen = new Set();
    const out = [];
    for (const c of [...osirisFeatures.map(fromOsiris), ...otc.map(fromOtc)]) {
      if (!c || !inView(c)) continue;
      const k = c.imageUrl || c.streamUrl;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    // Nearest the middle first, so a cap drops the edges, not the centre.
    const cx = (w + e) / 2; const cy = (s + n) / 2;
    out.sort((a, b) => ((a.lat - cy) ** 2 + (a.lng - cx) ** 2) - ((b.lat - cy) ** 2 + (b.lng - cx) ** 2));
    return out.slice(0, MAX_ICONS);
  }, [close, key, osirisFeatures, otc]);

  return { cameras, loading, needZoom: enabled && zoom < CAMERA_MIN_ZOOM };
}
