/**
 * Live road incidents — crashes, closures, roadworks, jams — for the map.
 *
 * Source: TomTom Traffic Incident Details v5 (free tier, same key the local
 * pack already uses). Proxied rather than called from the browser so the key
 * stays server-side and TomTom never sees a visitor's IP or where they are
 * looking.
 *
 * Load: one request per map view at most every two minutes (cached by a
 * rounded bounding box), and only for areas TomTom accepts in one call
 * (10,000 km²). A zoomed-out view is not an error — it is "zoom in to see
 * incidents", which is what the caller is told.
 */
const axios = require('axios');
const config = require('../config/env');
const { createTtlCache } = require('../utils/ttlCache');

const ENDPOINT = 'https://api.tomtom.com/traffic/services/5/incidentDetails';
const MAX_AREA_KM2 = 10000;
const cache = createTtlCache({ ttlMs: 2 * 60 * 1000, max: 300 });

// TomTom's iconCategory → what a person calls it. Unlisted codes are
// "Traffic incident" rather than a guess.
const CATEGORY = {
  1: 'Crash',
  2: 'Fog',
  3: 'Dangerous conditions',
  4: 'Rain',
  5: 'Ice',
  6: 'Traffic jam',
  7: 'Lane closed',
  8: 'Road closed',
  9: 'Roadworks',
  10: 'Wind',
  11: 'Flooding',
  14: 'Broken-down vehicle',
};

// magnitudeOfDelay: 0 unknown, 1 minor, 2 moderate, 3 major, 4 undefined (closures).
const SEVERITY = { 1: 'minor', 2: 'moderate', 3: 'major', 4: 'major' };

const FIELDS = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},startTime,endTime,from,to,length,delay,roadNumbers}}}';

/** "w,s,e,n" → numbers, or null when it is not a usable box. */
function parseBbox(raw) {
  const parts = String(raw || '').split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w >= e || s >= n || s < -90 || n > 90 || w < -180 || e > 180) return null;
  return [w, s, e, n];
}

/** Rough area of a lon/lat box in km² — plenty for a size limit. */
function areaKm2([w, s, e, n]) {
  const kmPerDegLat = 111.32;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  return (e - w) * kmPerDegLat * Math.cos(midLat) * (n - s) * kmPerDegLat;
}

/** One point to pin an incident on: a Point as-is, a line at its middle vertex. */
function anchor(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  const coords = geometry.coordinates;
  return coords.length ? coords[Math.floor(coords.length / 2)] : null;
}

function normalise(raw) {
  const p = raw.properties || {};
  const at = anchor(raw.geometry);
  if (!at) return null;
  const [lng, lat] = at;
  const description = (p.events || []).map((e) => e.description).filter(Boolean).join(' · ') || null;
  return {
    id: p.id || `${lat},${lng}`,
    kind: CATEGORY[p.iconCategory] || 'Traffic incident',
    category: p.iconCategory ?? null,
    severity: SEVERITY[p.magnitudeOfDelay] || null,
    description,
    from: p.from || null,
    to: p.to || null,
    road: (p.roadNumbers || []).join(', ') || null,
    delaySeconds: Number.isFinite(p.delay) ? p.delay : null,
    lengthMeters: Number.isFinite(p.length) ? Math.round(p.length) : null,
    startTime: p.startTime || null,
    endTime: p.endTime || null,
    lat,
    lng,
    // The full line, so the map can draw a closure along the road it closes.
    geometry: raw.geometry,
  };
}

/**
 * @param {string} bboxRaw "w,s,e,n"
 * @returns {Promise<{incidents: object[], tooLarge?: boolean}>}
 */
async function getIncidents(bboxRaw) {
  const bbox = parseBbox(bboxRaw);
  if (!bbox) {
    const err = new Error('bbox must be "west,south,east,north" in degrees');
    err.code = 'BAD_BBOX';
    throw err;
  }
  if (areaKm2(bbox) > MAX_AREA_KM2) return { incidents: [], tooLarge: true };

  const apiKey = config.maps?.tomtom?.apiKey;
  if (!apiKey) {
    const err = new Error('TomTom API key not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  // Rounded to ~1 km so a small pan reuses the same answer instead of asking
  // TomTom again — that is what keeps this inside the free allowance.
  const key = bbox.map((n) => n.toFixed(2)).join(',');
  const incidents = await cache.wrap(key, async () => {
    const res = await axios.get(ENDPOINT, {
      params: {
        key: apiKey,
        bbox: key,
        fields: FIELDS,
        language: 'en-US',
        timeValidityFilter: 'present',
      },
      timeout: 8000,
    });
    return (res.data?.incidents || []).map(normalise).filter(Boolean);
  });
  return { incidents };
}

module.exports = { getIncidents, parseBbox, areaKm2, normalise, MAX_AREA_KM2 };
