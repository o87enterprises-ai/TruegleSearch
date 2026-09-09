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
const { query } = require('../db/connection');

const BASE_URL = (process.env.OSIRIS_BASE_URL || 'https://osirisai.live').replace(/\/+$/, '');

/** MEASURED. The probe found the heavy layers — aircraft, satellites, vessels,
 *  cameras — exceed 12s against the public host, while weather returned in
 *  10.6s. This upstream is simply slow with a large payload, not broken, so a
 *  12s ceiling was rejecting healthy feeds.
 *
 *  Raised, but the real fix is `serveStale` below: after the first successful
 *  fetch nothing waits on this at all, so the timeout only ever governs a cold
 *  cache.
 *
 *  Overridable via OSIRIS_TIMEOUT_MS so the out-of-band warmer
 *  (`npm run osiris:warm`) can wait far longer than any web request should.
 *  That is the actual answer for the feeds that exceed even 25s: fetch them on
 *  a schedule into the shared cache, and serve every visitor from it. */
const TIMEOUT_MS = Number(process.env.OSIRIS_TIMEOUT_MS) || 25_000;

/** How long PAST ITS TTL an entry may still be served while a refresh runs
 *  behind it. Generous on purpose: an aircraft position from four minutes ago,
 *  clearly labelled as such, beats a spinner or an empty map.
 *
 *  RELATIVE TO THE TTL, not absolute. As a flat 5-minute ceiling this was dead
 *  code for half the layers: cameras have a 30-minute TTL, so an entry went
 *  straight from fresh to older-than-the-stale-window and every expiry paid
 *  the full upstream wait — the exact cost stale-while-revalidate exists to
 *  avoid, in the layers that need it most. Caught by the cache tests. */
const STALE_GRACE_MS = 10 * 60_000;

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
    // FIVE ARRAYS, NOT ONE — measured:
    // { commercial_flights, private_flights, private_jets, military_flights,
    //   gps_jamming, total, source, providers, timestamp }
    // Reading `commercial_flights` alone would have silently dropped the
    // military traffic and the GPS-jamming zones, which for anything
    // resembling OSINT are the most valuable rows in the whole feed. Each row
    // keeps `_group`, so "military" stays distinguishable from "airline" on
    // the map and in the popup.
    rowsKeys: ['commercial_flights', 'private_flights', 'private_jets', 'military_flights', 'gps_jamming'],
    describe: (p) => p.callsign || p.icao24 || p.registration || p.name
      || (p._group === 'gps_jamming' ? 'GPS interference' : 'Aircraft'),
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
    label: 'Maritime',
    kind: 'point',
    colour: '#22d3ee',
    // NOT ONE ARRAY. The probe found this feed is three:
    // { ships, ports, chokepoints, total_* , timestamp }. Taking only `ships`
    // would silently drop the ports and the chokepoints — and for anything
    // resembling maritime analysis the chokepoints are the most interesting
    // rows in the response. All three are drawn, each tagged with which it is.
    rowsKeys: ['ships', 'ports', 'chokepoints'],
    describe: (p) => p.name || p.shipname || p.mmsi || p.port || 'Maritime',
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
    // Measured: { cameras, total, sources, regions, timestamp }.
    rowsKeys: ['cameras'],
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

/** Where a feed might keep its array of rows, when it is not simply an array.
 *
 *  MEASURED, no longer guessed. `npm run osiris:probe` against the live host
 *  found every OSIRIS feed wraps its rows in one of two things: a key named
 *  after the layer itself (`{earthquakes, total, timestamp}`,
 *  `{fires, total, source, timestamp}`) or the generic `events`
 *  (weather, gdelt). The layer-named case is handled in rowsOf by trying the
 *  layer id before this list, which covers the feeds not yet probed as well. */
const ROWS_KEYS = ['events', 'features', 'data', 'results', 'items', 'rows', 'states', 'list'];

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
function rowsOf(body, layerId) {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return null;

  // A layer that declared its own keys wins, because it was MEASURED. This is
  // also the only way to read a composite feed: maritime is three arrays in
  // one response (ships, ports, chokepoints) and picking any single one of
  // them would drop the other two without a word.
  const declared = LAYERS[layerId]?.rowsKeys;
  if (declared) {
    const merged = [];
    for (const k of declared) {
      if (!Array.isArray(body[k])) continue;
      // Tagged with which array it came from, so a chokepoint is
      // distinguishable from a container ship after they are merged — on the
      // map, in the popup, and to anything filtering later.
      for (const row of body[k]) merged.push(row && typeof row === 'object' ? { _group: k, ...row } : row);
    }
    return merged.length ? merged : null;
  }

  // The layer's own name next: OSIRIS names the array after what is in it
  // (`{earthquakes: [...]}`), so this one rule reads every such feed without
  // an entry per layer — including the ones nobody has probed yet.
  if (layerId && Array.isArray(body[layerId])) return body[layerId];
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

// ── TWO TIERS, AND THE SECOND ONE IS THE IMPORTANT ONE ──────────────────────
//
// L1 is this process's memory: free, instant, and on Vercel usually empty,
// because every invocation may be a fresh process.
//
// L2 is Postgres (migration 022), shared by every instance. That is what makes
// the cache real in production — and the cache is not a performance nicety
// here, it is the privacy mechanism. These feeds are proxied rather than
// fetched from the browser so the upstream cannot correlate visitors; the
// cache is what collapses many visitors into one upstream call. A cache that
// is usually cold means close to one call per visitor, which hands back the
// rate-and-timing signal the proxy exists to destroy.
//
// L2 is best-effort in every direction. No DATABASE_URL, an unmigrated
// database, a dropped connection — all fall back to L1 and a working map. A
// caching layer that can take the feature down is not a caching layer.
const cache = new Map();     // layer -> { at, body }
const refreshing = new Map(); // layer -> Promise, so N callers cause 1 fetch

// Latches off after the first failure that looks structural (no table, no
// database), so a deployment without migration 022 does not pay a failing
// query on every single request.
let sharedCacheUsable = true;

async function readShared(id) {
  if (!sharedCacheUsable) return null;
  try {
    const { rows } = await query(
      'SELECT body, source, fetched_at FROM osiris_cache WHERE layer = $1',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    // A body cached from a different upstream is not this deployment's data.
    // Repointing OSIRIS_BASE_URL at a self-hosted instance must not keep
    // serving the public host's answers.
    if (row.source && row.source !== BASE_URL) return null;
    return { at: new Date(row.fetched_at).getTime(), body: row.body };
  } catch (error) {
    if (/relation .*osiris_cache.* does not exist|DATABASE_URL|ECONNREFUSED|getaddrinfo/i.test(error.message)) {
      logger.warn('OSIRIS shared cache unavailable, using per-instance memory only', { message: error.message });
      sharedCacheUsable = false;
    }
    return null;
  }
}

async function writeShared(id, body) {
  if (!sharedCacheUsable) return;
  try {
    await query(
      `INSERT INTO osiris_cache (layer, body, source, fetched_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (layer) DO UPDATE
         SET body = EXCLUDED.body, source = EXCLUDED.source, fetched_at = NOW()`,
      [id, JSON.stringify(body), BASE_URL],
    );
  } catch (error) {
    // Never fatal: the caller already has the data it needs.
    logger.warn(`OSIRIS shared cache write failed for ${id}`, { message: error.message });
  }
}

function requestUpstream(id) {
  const def = LAYERS[id];
  return axios.get(`${BASE_URL}${def.path}`, {
    timeout: TIMEOUT_MS,
    headers: { Accept: 'application/json', 'User-Agent': 'TruegleSearch/1.0 (+https://truegle.info)' },
    // A feed that answers with 30MB of history would blow the lambda; refuse
    // rather than fall over.
    maxContentLength: 25 * 1024 * 1024,
  }).then(({ data }) => {
    cache.set(id, { at: Date.now(), body: data });
    // Deliberately not awaited: the shared write is for the NEXT instance, and
    // making this request wait on it would put a database round trip in front
    // of a response that is already complete.
    writeShared(id, data);
    return data;
  });
}

/** One in-flight fetch per layer, however many callers are waiting.
 *  Without this, a cold cache and ten simultaneous map loads make ten
 *  25-second requests to an upstream that is slow precisely because it is
 *  under load. */
function refresh(id) {
  if (!refreshing.has(id)) {
    const p = requestUpstream(id).finally(() => refreshing.delete(id));
    refreshing.set(id, p);
  }
  return refreshing.get(id);
}

/**
 * STALE WHILE REVALIDATE, because this upstream is slow and that is a fact to
 * design around rather than wait on.
 *
 * The probe measured the heavy feeds past 12 seconds. Making every visitor
 * whose request happens to land on an expired entry wait that long — while
 * newer requests queue behind it — turns one slow upstream into a slow map for
 * everybody. Instead: an expired entry is served immediately and refreshed
 * behind the request, so exactly one visitor ever pays, and only when the
 * cache is completely cold.
 *
 * The response says which it got (`meta.stale`, `meta.ageSeconds`), because a
 * four-minute-old aircraft position is fine and a four-minute-old aircraft
 * position presented as live is not.
 */
async function fetchLayer(id) {
  const def = LAYERS[id];
  let hit = cache.get(id);
  let age = hit ? Date.now() - hit.at : Infinity;

  if (hit && age < def.ttl) return { body: hit.body, cached: true, stale: false, age };

  // L1 could not answer. Ask the shared tier BEFORE the network — on a fresh
  // instance this is the difference between a database round trip and a
  // 25-second upstream fetch, and it is what stops each instance from making
  // its own call to an upstream that must not be able to count visitors.
  const shared = await readShared(id);
  if (shared && shared.at > (hit?.at || 0)) {
    cache.set(id, shared);       // hydrate L1 so the rest of this instance's life is free
    hit = shared;
    age = Date.now() - shared.at;
    if (age < def.ttl) return { body: hit.body, cached: true, stale: false, age };
  }

  if (hit && age < def.ttl + STALE_GRACE_MS) {
    // Kick the refresh off and deliberately do not await it. A rejection here
    // is not this request's problem — it still has data to serve — but an
    // unhandled rejection would take the process down.
    refresh(id).catch((err) => logger.warn(`OSIRIS ${id} background refresh failed`, { message: err.message }));
    return { body: hit.body, cached: true, stale: true, age };
  }

  // Nothing usable cached: this one genuinely has to wait. If it fails and we
  // hold anything at all, serve that rather than nothing — an old map beats a
  // broken one, and `stale` says which it is.
  try {
    const body = await refresh(id);
    return { body, cached: false, stale: false, age: 0 };
  } catch (error) {
    if (hit) {
      logger.warn(`OSIRIS ${id} unreachable, serving ${Math.round(age / 1000)}s-old data`, { message: error.message });
      return { body: hit.body, cached: true, stale: true, age };
    }
    throw error;
  }
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

  const { body, cached, stale, age } = await fetchLayer(id);
  const rows = rowsOf(body, id);

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
      // Said out loud rather than implied. A four-minute-old aircraft position
      // is useful; the same position presented as live is a small lie, and the
      // map labels it from here.
      stale: !!stale,
      ageSeconds: Number.isFinite(age) ? Math.round(age / 1000) : null,
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
