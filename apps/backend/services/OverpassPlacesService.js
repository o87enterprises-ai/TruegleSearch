const axios = require('axios');

/**
 * Nearby places from OpenStreetMap, via the Overpass API.
 *
 * WHY THIS EXISTS. Nearby search had exactly one provider — Radar — and Radar
 * needs a key. When that key is absent or its plan does not include the Places
 * API, `/api/maps/local-businesses` returned an empty list, which on the map
 * looks identical to "there is nothing near you". A core feature of the product
 * was one unset environment variable away from silently not existing.
 *
 * Overpass needs no key, no account and no signup, which makes it the only
 * option that fits a $0 budget without a card on file. It queries OpenStreetMap
 * directly, so coverage is genuinely global and, in towns, often better than a
 * commercial POI set.
 *
 * ON PRIVACY. Any nearby search must tell somebody roughly where you are —
 * that is what the question means. What differs is what rides along with the
 * coordinates. A Radar request carries our account key, so the query joins a
 * billing identity. An Overpass request carries neither key nor cookie: it is
 * an anonymous read of a public map. That is strictly better, not perfect, and
 * the coordinates are still rounded before caching below.
 *
 * ON BEING A GOOD CITIZEN. Overpass is donated infrastructure with a published
 * fair-use policy, not a paid service we are entitled to hammer. Hence: a
 * declared User-Agent so operators can identify and contact us, a short server
 * timeout, a hard result cap, and a cache keyed on rounded coordinates so a
 * user panning a map does not issue a new query per frame.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'Truegle Maps/1.0 (+https://truegle.info)';
const SERVER_TIMEOUT_S = 20;   // Overpass's own budget, declared in the query
const HTTP_TIMEOUT_MS = 25000; // ours, slightly longer so the server's wins
const MAX_RESULTS = 60;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;

/**
 * What people type, mapped to what OpenStreetMap actually calls it.
 *
 * OSM tags are not words a person would search for: a petrol station is
 * `amenity=fuel`, a supermarket is `shop=supermarket`. Without this map, "gas
 * station" matches nothing at all, because no OSM object carries that phrase.
 *
 * THE TABLE IS NOT KEPT HERE. The browser map needs exactly the same mapping
 * and had already grown a good one, tuned against real queries. A second copy
 * in this file would drift the first time somebody added a category to one and
 * not the other — and the failure would be silent, because an unmapped word
 * still returns SOMETHING via the name match below. So both read
 * shared/osm-categories.json, and this file owns none of it.
 */
const { categories: CATEGORY_DATA } = require('../../../shared/osm-categories.json');

const CATEGORIES = CATEGORY_DATA.map(({ pattern, tags }) => [
  new RegExp(pattern, 'i'),
  // The shared file stores tags the way OSM writes them, "amenity=cafe", and a
  // bare key like "shop" means "any shop" — a key-existence filter rather than
  // a value match.
  tags.map((t) => {
    const [key, value] = t.split('=');
    return [key, value ?? '*'];
  }),
]);

/** Overpass string literals are quoted; a stray quote or backslash ends the query early. */
function escapeLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The tag filters a phrase implies, or [] when it names no known kind of place.
 * The first match wins, so the shared table's order is load-bearing: specific
 * entries sit before general ones.
 */
function tagsFor(phrase) {
  // The shared table is written in the words a person types, so its patterns
  // are bounded by \b. The map sends CATEGORY NAMES — 'gas_station' — and an
  // underscore is a word character, so \bgas\b cannot match inside it and the
  // whole category sweep came back empty. Underscores become spaces here,
  // where the two naming conventions meet, rather than by loosening 33
  // patterns that are correct as written.
  const text = String(phrase || '').trim().replace(/_/g, ' ');
  if (!text) return [];
  const hit = CATEGORIES.find(([re]) => re.test(text));
  return hit ? hit[1] : [];
}

/**
 * Build the Overpass QL for a nearby lookup. Pure, so it can be asserted
 * without touching the network.
 */
function buildQuery({ lat, lng, radius = 5000, query = '', categories = [], limit = 25 }) {
  const r = Math.max(50, Math.min(50000, Math.round(Number(radius) || 5000)));
  const cap = Math.max(1, Math.min(MAX_RESULTS, Math.round(Number(limit) || 25)));
  const at = `${Number(lat)},${Number(lng)}`;

  const clauses = [];
  const seen = new Set();
  const addTag = ([k, v]) => {
    // `shop=*` means "any shop", which in Overpass is a key-existence filter
    // rather than a value match.
    const filter = v === '*' ? `["${k}"]` : `["${k}"="${v}"]`;
    const line = `  nwr(around:${r},${at})${filter};`;
    if (!seen.has(line)) { seen.add(line); clauses.push(line); }
  };

  const wanted = [
    ...tagsFor(query),
    ...categories.flatMap((c) => tagsFor(c)),
  ];
  wanted.forEach(addTag);

  // A typed query also matches by name, so "starbucks" or "st vincent" finds
  // the place itself and not merely its category. `~` is a regex match and `i`
  // makes it case-insensitive.
  const text = String(query || '').trim();
  if (text) {
    const line = `  nwr(around:${r},${at})["name"~"${escapeLiteral(text)}",i];`;
    if (!seen.has(line)) { seen.add(line); clauses.push(line); }
  }

  // Nothing recognised and nothing typed: sweep the everyday categories rather
  // than asking for every object within 5km, which is a denial-of-service on a
  // donated server and useless on a map besides.
  if (!clauses.length) {
    [['amenity', 'restaurant'], ['amenity', 'cafe'], ['amenity', 'fuel'],
      ['shop', 'supermarket'], ['tourism', 'hotel'], ['amenity', 'pharmacy']].forEach(addTag);
  }

  // `out center` gives ways and relations — most buildings are not single
  // nodes — a single representative coordinate, so every result can be a pin.
  return `[out:json][timeout:${SERVER_TIMEOUT_S}];\n(\n${clauses.join('\n')}\n);\nout center ${cap};`;
}

/** OSM's address tags, assembled into one line. Pure. */
function addressOf(tags = {}) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  return [street, tags['addr:city'], tags['addr:state'], tags['addr:postcode']]
    .filter(Boolean)
    .join(', ');
}

/** The human-facing category, from whichever tag classified the object. */
function categoryOf(tags = {}) {
  const raw = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.office;
  return raw ? String(raw).toUpperCase() : 'BUSINESS';
}

/**
 * One Overpass element in the shape the route already handles, matching what
 * RadarService.searchPlaces returns so both providers feed the same code.
 * Returns null for anything unusable. Pure.
 */
function mapElement(el) {
  if (!el) return null;
  const tags = el.tags || {};
  const name = tags.name || tags['name:en'] || tags.brand || tags.operator;
  // An unnamed node is a real map object but not a usable search result: a pin
  // reading "BUSINESS" with no name is noise on the map and nothing to tap.
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  return {
    id: `osm-${el.type || 'node'}-${el.id}`,
    name,
    latitude: lat,
    longitude: lon,
    formattedAddress: addressOf(tags),
    category: categoryOf(tags),
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    source: 'openstreetmap',
  };
}

/** Whole response → places, de-duplicated by name+position. Pure. */
function mapResponse(data, limit = 25) {
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const out = [];
  const seen = new Set();
  for (const el of elements) {
    const place = mapElement(el);
    if (!place) continue;
    // The union above can match the same object twice — once by tag, once by
    // name — and Overpass returns it once per clause it satisfied.
    const key = `${place.name.toLowerCase()}@${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
    if (out.length >= limit) break;
  }
  return out;
}

// ── cache ───────────────────────────────────────────────────────────────────
// Coordinates are rounded to ~11m before they become a key, so a map that
// drifts by a metre reuses the answer instead of asking again. It also means
// the key cannot be used to reconstruct an exact position.
const cache = new Map();
const cacheKey = ({ lat, lng, radius, query, categories }) =>
  [Number(lat).toFixed(4), Number(lng).toFixed(4), radius,
    String(query || '').toLowerCase(), [...(categories || [])].sort().join('|')].join('~');

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.places;
}

function cacheSet(key, places) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), places });
}

/**
 * Nearby places around a point. Never throws: a nearby search that fails
 * should show the map without pins, not take the request down with it.
 */
async function search({ lat, lng, radius = 5000, query = '', categories = [], limit = 25 } = {}) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return { success: false, places: [], reason: 'bad_location' };
  }

  const key = cacheKey({ lat, lng, radius, query, categories });
  const cached = cacheGet(key);
  if (cached) return { success: true, places: cached.slice(0, limit), cached: true };

  const ql = buildQuery({ lat, lng, radius, query, categories, limit });
  try {
    const response = await axios.post(ENDPOINT, `data=${encodeURIComponent(ql)}`, {
      timeout: HTTP_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
    });
    const places = mapResponse(response.data, limit);
    cacheSet(key, places);
    return { success: true, places };
  } catch (error) {
    // 429 and 504 are Overpass saying it is busy — expected on a free shared
    // endpoint, and worth naming so a caller can tell it apart from a bug.
    const status = error.response?.status;
    const reason = status === 429 ? 'rate_limited' : status === 504 ? 'server_busy' : 'unavailable';
    console.error(`Overpass places lookup failed (${reason}):`, error.message);
    return { success: false, places: [], reason };
  }
}

module.exports = {
  search,
  // exported for the verifier — every one of these is pure
  buildQuery,
  mapElement,
  mapResponse,
  addressOf,
  categoryOf,
  tagsFor,
  escapeLiteral,
  CATEGORIES,
};
