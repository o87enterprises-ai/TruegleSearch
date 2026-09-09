/**
 * OSIRIS live-intelligence layers, normalised to GeoJSON for the map.
 *
 * OSIRIS (osirisai.live, MIT, github.com/simplifaisoul/osiris) aggregates
 * aviation, maritime, seismic, fire, weather, conflict and OSINT feeds and
 * exposes each as a keyless HTTP endpoint. This turns them into one shape the
 * map can draw without caring which feed it came from.
 *
 * ── WHY A SERVER-SIDE PROXY AND NOT A BROWSER FETCH ─────────────────────────
 *
 * This is the whole reason this file exists, and it is not about CORS.
 *
 * A browser fetch to osirisai.live would hand that third party every visitor's
 * IP address, on every map load, plus — through the bounding box in the query
 * string — a running record of WHERE ON EARTH each visitor was looking. That
 * is a location trail, held by someone else, created by a product whose entire
 * claim is that it does not build one. Truegle sets zero cookies and runs no
 * third-party analytics (docs/AD-POLICY.md); quietly leaking a per-user
 * location stream to an upstream would make that claim false while every
 * individual line of code still looked innocent.
 *
 * Proxying fixes it completely: OSIRIS sees this server, once per cache
 * window, and cannot distinguish one visitor from another or tell that there
 * were any. The cache is not a performance nicety here, it is the anonymity
 * set.
 *
 * ── AND IT IS THE SEAM ──────────────────────────────────────────────────────
 *
 * OSIRIS's public instance is one person's free hosting. Depending on it makes
 * their uptime ours. Every feed it serves is itself drawn from a keyless
 * upstream — OpenSky (aviation), USGS (earthquakes), NASA FIRMS (fires), NASA
 * EONET (weather), N2YO (satellites), OpenSanctions (sanctions, CC-BY 4.0) —
 * so the durable arrangement is to go direct.
 *
 * This file is where that swap happens. The frontend asks Truegle for
 * `flights`; whether that is answered by OSIRIS, by a self-hosted OSIRIS
 * (OSIRIS_BASE_URL), or one day by OpenSky directly is decided HERE and
 * nowhere else. Nothing above this file learns which.
 *
 * ── ON GUESSING SHAPES ──────────────────────────────────────────────────────
 *
 * The adapters below list CANDIDATE field names rather than one hard-coded
 * path, because the upstream shapes were not verifiable when this was written
 * (the sandbox cannot reach the host). A layer whose rows match none of the
 * candidates does NOT return an empty collection — an empty map with no error
 * is the unreportable failure this codebase keeps re-learning about. It
 * returns `unrecognised` and a sample of the keys it actually saw, so the fix
 * is a one-line candidate addition rather than an investigation.
 *
 * Run `npm run osiris:probe` against a reachable network to capture the real
 * shapes and trim the candidate lists to what is actually served.
 */
const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = (process.env.OSIRIS_BASE_URL || 'https://osirisai.live').replace(/\/+$/, '');

/** Upstream is a courtesy, not a dependency: a slow feed must not hold a map
 *  request open. Short enough that a stalled layer fails while the others draw. */
const TIMEOUT_MS = 12_000;

/**
 * One entry per drawable layer.
 *
 * `ttl` is chosen from how fast the underlying thing actually moves, not from
 * a house default: aircraft positions are stale in under a minute, an
 * earthquake that happened is still where it happened. A longer TTL is also a
 * bigger anonymity set (see above), so it is only shortened where the data
 * genuinely demands it.
 */
const LAYERS = {
  flights: {
    path: '/api/flights',
    ttl: 30_000,
    label: 'Aircraft',
    kind: 'point',
    // Colour and icon live with the layer definition so the frontend renders
    // any layer generically instead of carrying a switch per feed.
    colour: '#38bdf8',
    describe: (p) => p.callsign || p.icao24 || p.registration || 'Aircraft',
  },
  satellites: {
    path: '/api/satellites',
    ttl: 60_000,
    label: 'Satellites',
    kind: 'point',
    colour: '#a78bfa',
    describe: (p) => p.name || p.satname || `NORAD ${p.noradId || p.satid || '?'}`,
  },
  earthquakes: {
    path: '/api/earthquakes',
    ttl: 5 * 60_000,
    label: 'Earthquakes',
    kind: 'point',
    colour: '#f97316',
    describe: (p) => p.place || p.title || (p.magnitude != null ? `M${p.magnitude}` : 'Earthquake'),
  },
  fires: {
    path: '/api/fires',
    ttl: 10 * 60_000,
    label: 'Fires',
    kind: 'point',
    colour: '#ef4444',
    // Parenthesised deliberately: `a || b != null ? x : y` parses as
    // `(a || (b != null)) ? x : y`, which renders every titled fire as
    // "Fire (undefined)".
    describe: (p) => p.title || (p.brightness != null ? `Fire (${p.brightness})` : 'Active fire'),
  },
  maritime: {
    path: '/api/maritime',
    ttl: 60_000,
    label: 'Vessels',
    kind: 'point',
    colour: '#22d3ee',
    describe: (p) => p.name || p.shipname || p.mmsi || 'Vessel',
  },
  weather: {
    path: '/api/weather',
    ttl: 10 * 60_000,
    label: 'Weather events',
    kind: 'point',
    colour: '#34d399',
    describe: (p) => p.title || p.event || 'Weather event',
  },
  cctv: {
    path: '/api/cctv',
    ttl: 30 * 60_000,
    label: 'Public cameras',
    kind: 'point',
    colour: '#facc15',
    describe: (p) => p.title || p.name || 'Camera',
  },
  conflict: {
    path: '/api/gdelt',
    ttl: 15 * 60_000,
    label: 'Conflict reports',
    kind: 'point',
    colour: '#fb7185',
    describe: (p) => p.title || p.headline || 'Report',
  },
};

/** Where a row might keep its latitude. Ordered by how likely, and checked
 *  per-row rather than per-feed, because a feed can mix shapes. */
const LAT_KEYS = ['lat', 'latitude', 'Latitude', 'LAT', 'y'];
const LON_KEYS = ['lon', 'lng', 'long', 'longitude', 'Longitude', 'LON', 'x'];

/** Where a feed might keep its array of rows, when it is not simply an array. */
const ROWS_KEYS = ['features', 'data', 'results', 'items', 'rows', 'states', 'list'];

const num = (v) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** Pull [lon, lat] out of a row whatever it calls them, or null if it has none.
 *  Null rather than [0,0]: null island is a real place and a row plotted there
 *  is a lie the map tells confidently. */
function coordsOf(row) {
  if (!row || typeof row !== 'object') return null;

  // Already GeoJSON — trust its own geometry rather than re-deriving one.
  if (row.geometry?.coordinates) {
    const [lon, lat] = row.geometry.coordinates;
    return num(lon) != null && num(lat) != null ? [num(lon), num(lat)] : null;
  }
  // A bare [lon, lat] pair, the shape OpenSky-style state vectors use.
  if (Array.isArray(row.coordinates) && row.coordinates.length >= 2) {
    const [lon, lat] = row.coordinates;
    return num(lon) != null && num(lat) != null ? [num(lon), num(lat)] : null;
  }

  let lat = null;
  let lon = null;
  for (const k of LAT_KEYS) if (lat == null && k in row) lat = num(row[k]);
  for (const k of LON_KEYS) if (lon == null && k in row) lon = num(row[k]);
  if (lat == null || lon == null) return null;
  // Out-of-range means we matched the wrong field (an `x` that was a pixel
  // offset, say), not that the aircraft is off the planet.
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lon, lat];
}

/** Find the array of rows in whatever envelope the feed used. */
function rowsOf(body) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return null;
  for (const k of ROWS_KEYS) if (Array.isArray(body[k])) return body[k];
  return null;
}

/** What a row is carrying, minus the geometry — kept for the popup and for
 *  OSINT filtering. Trimmed to keep a 10,000-aircraft payload sane, and
 *  deliberately shallow: nested objects are where feeds hide megabytes. */
function propsOf(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (v == null) continue;
    if (typeof v === 'object') continue;
    if (LAT_KEYS.includes(k) || LON_KEYS.includes(k)) continue;
    out[k] = typeof v === 'string' ? v.slice(0, 240) : v;
  }
  // GeoJSON input keeps its own properties, which is where everything real is.
  if (row?.properties && typeof row.properties === 'object') {
    for (const [k, v] of Object.entries(row.properties)) {
      if (v == null || typeof v === 'object') continue;
      out[k] = typeof v === 'string' ? v.slice(0, 240) : v;
    }
  }
  return out;
}

/** [west, south, east, north] — the map sends what it can actually see, so a
 *  city-level view does not ship the whole planet's aircraft to a phone. */
function inBbox(coords, bbox) {
  if (!bbox) return true;
  const [lon, lat] = coords;
  const [w, s, e, n] = bbox;
  // A box crossing the antimeridian has west > east; both halves are valid.
  const lonOk = w <= e ? lon >= w && lon <= e : lon >= w || lon <= e;
  return lonOk && lat >= s && lat <= n;
}

function parseBbox(raw) {
  if (!raw) return null;
  const parts = String(raw).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (s > n || s < -90 || n > 90) return null;
  return [w, s, e, n];
}

const cache = new Map(); // layer -> { at, body }

async function fetchLayer(id) {
  const def = LAYERS[id];
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < def.ttl) return { body: hit.body, cached: true };

  const { data } = await axios.get(`${BASE_URL}${def.path}`, {
    timeout: TIMEOUT_MS,
    headers: { Accept: 'application/json', 'User-Agent': 'TruegleSearch/1.0 (+https://truegle.info)' },
    // A feed that answers with 30MB of history would blow the lambda; refuse
    // rather than fall over.
    maxContentLength: 25 * 1024 * 1024,
  });
  cache.set(id, { at: Date.now(), body: data });
  return { body: data, cached: false };
}

/**
 * @param {string} id one of LAYERS
 * @param {object} [opts]
 * @param {string} [opts.bbox] "w,s,e,n"
 * @param {number} [opts.limit] hard cap on returned features
 * @returns {Promise<{type:'FeatureCollection', features:Array, meta:object}>}
 */
async function getLayer(id, { bbox, limit = 2000 } = {}) {
  const def = LAYERS[id];
  if (!def) {
    const err = new Error(`Unknown OSIRIS layer: ${id}`);
    err.code = 'UNKNOWN_LAYER';
    throw err;
  }

  const { body, cached } = await fetchLayer(id);
  const rows = rowsOf(body);

  if (!rows) {
    // Say what was actually seen. "No features" with no explanation is the
    // failure mode that gets reported as "the map is broken" with nothing to
    // act on.
    const err = new Error(`OSIRIS layer "${id}" returned no recognisable row array`);
    err.code = 'UNRECOGNISED_SHAPE';
    err.sample = { topLevelKeys: Object.keys(body || {}).slice(0, 20) };
    throw err;
  }

  const box = parseBbox(bbox);
  const features = [];
  let skipped = 0;
  for (const row of rows) {
    const coords = coordsOf(row);
    if (!coords) { skipped += 1; continue; }
    if (!inBbox(coords, box)) continue;
    const properties = propsOf(row);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        ...properties,
        _layer: id,
        _label: (() => { try { return def.describe(properties); } catch { return def.label; } })(),
      },
    });
    if (features.length >= limit) break;
  }

  // Rows arrived but not one of them had coordinates we could read: the
  // candidate key lists are wrong for this feed. Distinguished from "the
  // upstream is empty right now", which is a legitimate answer.
  if (!features.length && rows.length) {
    const err = new Error(`OSIRIS layer "${id}": ${rows.length} rows, none with readable coordinates`);
    err.code = 'UNRECOGNISED_SHAPE';
    err.sample = { rowKeys: Object.keys(rows[0] || {}).slice(0, 25) };
    throw err;
  }

  return {
    type: 'FeatureCollection',
    features,
    meta: {
      layer: id,
      label: def.label,
      colour: def.colour,
      cached,
      total: rows.length,
      returned: features.length,
      // Rows the upstream served that carried no position. Surfaced rather
      // than swallowed: a number climbing here is the early warning that a
      // feed changed shape.
      withoutCoords: skipped,
      truncated: features.length >= limit,
    },
  };
}

/** The catalogue the map's layer switcher is built from, so adding a feed is
 *  a change to LAYERS alone and the UI follows. */
function listLayers() {
  return Object.entries(LAYERS).map(([id, d]) => ({
    id, label: d.label, colour: d.colour, kind: d.kind, ttlSeconds: Math.round(d.ttl / 1000),
  }));
}

logger.info(`OsirisService using ${BASE_URL}`);

module.exports = {
  getLayer,
  listLayers,
  LAYERS,
  BASE_URL,
  // Exported for the unit tests: these are the parts with real logic in them,
  // and testing them directly beats testing them through an HTTP call that
  // cannot run without a network.
  _internals: { coordsOf, rowsOf, propsOf, inBbox, parseBbox },
};
