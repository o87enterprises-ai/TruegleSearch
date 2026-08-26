import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// The map's provider ladder: Mapbox → Radar → TomTom → OpenStreetMap.
//
// ── WHY THIS FILE WAS REWRITTEN ─────────────────────────────────────────────
//
// Every backend map route answers `{ success, data, provider }`. This service
// handed that whole envelope to isValidResult(), which asks questions about the
// PAYLOAD — "is it an array", "does it have .address", "does it have .routes".
// An envelope answers no to all of them, so every Mapbox, Radar and TomTom
// response was thrown away as "invalid result structure" and the ladder fell
// through to OpenStreetMap on every single call. The paid providers were never
// once used; the whole map ran on Nominatim while pretending otherwise, and the
// only visible symptom was that results were poor and "near me" was not near
// anything. Unwrapping is the fix.
//
// ── AND WHY EVERYTHING IS NORMALISED HERE ───────────────────────────────────
//
// The providers do not agree on shape. Mapbox says `position: {lon, lat}`,
// Nominatim says `{lat, lng}`, Radar says `latitude`/`longitude`, TomTom nests
// under `position`. Consumers call `actions.flyTo(result.position)`, and flyTo
// validates `.lat`/`.lng` and silently refuses anything else — so a Mapbox
// result, once it finally reached a consumer, would be dropped on the floor
// with the map never moving. Fixing the unwrap without fixing the shape would
// have swapped one silent failure for another.
//
// So: one shape leaves this file, whatever came in.
//
//   place     { name, address, position: { lat, lng }, type, raw }
//   route     { distance (m), duration (s), geometry: GeoJSON LineString }
//
// Callers keep the { success, provider, data } result they already expect.

const DEBUG = import.meta.env.DEV;
const log = (...a) => { if (DEBUG) console.warn(...a); };

/** Peel the `{ success, data }` envelope the backend routes answer with.
 *  A `success: false` body is a failure even with a 200, which is how Radar
 *  reports "no result" — treating it as data is how empty panels appear. */
function unwrap(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    if (payload.success === false) throw new Error(payload.message || payload.error || 'Provider reported failure');
    return payload.data;
  }
  return payload;
}

/** Pull { lat, lng } out of whichever of the six spellings a provider used.
 *  Returns null rather than a half-filled point — a NaN longitude will crash
 *  Mapbox GL rather than degrade. */
function toPosition(src) {
  if (!src) return null;
  const p = src.position || src.location || src.geometry || src;
  const lat = num(p.lat ?? p.latitude ?? p.y);
  // GeoJSON is [lng, lat] — the reverse of how everything else here reads.
  const coords = Array.isArray(p.coordinates) ? p.coordinates : null;
  const lng = num(p.lng ?? p.lon ?? p.longitude ?? p.x);
  if (coords && coords.length >= 2) {
    const [cLng, cLat] = coords;
    if (isCoord(num(cLat), num(cLng))) return { lat: num(cLat), lng: num(cLng) };
  }
  return isCoord(lat, lng) ? { lat, lng } : null;
}

const num = (v) => (typeof v === 'string' ? parseFloat(v) : v);
const isCoord = (lat, lng) => (
  typeof lat === 'number' && typeof lng === 'number'
  && Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
);

/** One place, however it was spelled. Anything without usable coordinates is
 *  dropped: a suggestion that cannot be flown to is worse than no suggestion. */
function toPlace(raw) {
  const position = toPosition(raw);
  if (!position) return null;
  const address = raw.address || raw.formattedAddress || raw.place_name || raw.display_name || raw.addressLabel || '';
  return {
    name: raw.name || raw.text || raw.poi?.name || (address ? String(address).split(',')[0] : 'Unknown'),
    address: typeof address === 'string' ? address : (address.freeformAddress || ''),
    position,
    type: raw.type || raw.category || raw.categories?.[0] || raw.place_type?.[0] || null,
    // Carried because useLocationDetection gates auto-opening the map on
    // `relevance >= 0.85`. Only Mapbox's is kept: TomTom scores on a different
    // scale entirely and Nominatim's `importance` measures prominence, not
    // match quality, so mapping either onto this number would auto-open the
    // map on a confident-looking value that means something else.
    relevance: typeof raw.relevance === 'number' ? raw.relevance : undefined,
    raw,
  };
}

const toPlaces = (payload) => (Array.isArray(payload) ? payload : [payload]).map(toPlace).filter(Boolean);

/** Some providers report distance and duration as `{ value, text }` rather
 *  than a bare number. `value` is the machine-readable half. */
const scalar = (v) => (v && typeof v === 'object' && 'value' in v ? num(v.value) : num(v));

/**
 * One route, in metres and SECONDS.
 *
 * Providers return either a single route object or an array of them; the first
 * is the recommended one in every API here. `minutes` is for Radar, which is
 * the one that reports duration in minutes — the panel used to multiply by 60
 * at the call site, which silently produced hour-long estimates the moment any
 * other provider answered.
 */
function toRoute(payload, { minutes = false } = {}) {
  const r = Array.isArray(payload) ? payload[0] : (payload?.routes ? payload.routes[0] : payload);
  if (!r) return null;
  const geom = r.geometry;
  const coordinates = Array.isArray(geom) ? geom : geom?.coordinates;
  const duration = scalar(r.duration ?? r.travelTimeInSeconds);
  return {
    distance: scalar(r.distance ?? r.lengthInMeters),
    duration: Number.isFinite(duration) ? (minutes ? duration * 60 : duration) : undefined,
    geometry: Array.isArray(coordinates) && coordinates.length > 1
      ? { type: 'LineString', coordinates }
      : null,
    // Turn-by-turn lives here when a provider supplies it.
    legs: r.legs || null,
    steps: r.legs?.[0]?.steps || r.steps || null,
    raw: r,
  };
}

const toRadarRoute = (payload) => toRoute(payload, { minutes: true });

/**
 * EVERY route a request returned, not just the first.
 *
 * toRoute() takes `routes[0]` and drops the rest, which is correct for "draw
 * me a line" and fatally wrong for route options: `alternatives=true` puts the
 * candidates in that same array, so the picker in utils/routeOptions had
 * nothing to choose between and four of the five options would have been
 * labels over an identical route.
 */
function toRoutes(payload, opts = {}) {
  const list = Array.isArray(payload) ? payload : (payload?.routes || [payload]);
  return list.map((r) => toRoute(r, opts)).filter((r) => r && r.geometry);
}

const toRadarRoutes = (payload) => toRoutes(payload, { minutes: true });

// ── OVERPASS: the part that makes "near me" a real question ─────────────────
//
// Overpass is OpenStreetMap's query API. It is the only keyless thing here
// that can answer "what CATEGORY of place is within N metres of this point" —
// a geocoder can only answer "where is this NAME".
//
// The public instance is rate-limited and occasionally busy; a failure here is
// caught by the caller and falls through to Nominatim rather than costing the
// user their search.
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// What people type → what OpenStreetMap calls it.
//
// The left-hand side is the word a person uses ("gas", "chemist", "coffee");
// the right-hand side is the tag that actually finds it. Matching on tags
// rather than names is the whole point: a cafe called "Blue Bottle" has the
// word "coffee" nowhere in its name, and a name search misses every one of
// them.
//
// Unlisted subjects are not a failure — they fall through to a name match,
// which is what makes searching for a specific business work.
const OSM_CATEGORIES = [
  [/\b(coffee|cafe|café|espresso|coffee\s*shop)\b/i, ['amenity=cafe']],
  [/\b(restaurant|food|eat|dinner|lunch|dining)\b/i, ['amenity=restaurant', 'amenity=fast_food']],
  [/\b(fast\s*food|burger|pizza|takeaway|takeout)\b/i, ['amenity=fast_food']],
  [/\b(bar|pub|brewery|tavern|drinks)\b/i, ['amenity=bar', 'amenity=pub']],
  [/\b(gas|petrol|fuel|gas\s*station|filling\s*station)\b/i, ['amenity=fuel']],
  [/\b(ev\s*charg\w*|charging\s*station|supercharger)\b/i, ['amenity=charging_station']],
  [/\b(grocery|groceries|supermarket|market|food\s*store)\b/i, ['shop=supermarket', 'shop=convenience']],
  [/\b(pharmacy|chemist|drugstore|drug\s*store)\b/i, ['amenity=pharmacy']],
  [/\b(hospital|emergency\s*room|\ber\b)\b/i, ['amenity=hospital']],
  [/\b(doctor|clinic|urgent\s*care|physician)\b/i, ['amenity=clinic', 'amenity=doctors']],
  [/\b(dentist|dental)\b/i, ['amenity=dentist']],
  [/\b(vet|veterinar\w+)\b/i, ['amenity=veterinary']],
  [/\b(bank|credit\s*union)\b/i, ['amenity=bank']],
  [/\b(atm|cash\s*machine|cashpoint)\b/i, ['amenity=atm']],
  [/\b(hotel|motel|inn|lodging|hostel|place\s*to\s*stay)\b/i, ['tourism=hotel', 'tourism=motel', 'tourism=hostel']],
  [/\b(park|playground|green\s*space)\b/i, ['leisure=park', 'leisure=playground']],
  [/\b(gym|fitness|workout)\b/i, ['leisure=fitness_centre']],
  [/\b(library|libraries)\b/i, ['amenity=library']],
  [/\b(school|schools)\b/i, ['amenity=school']],
  [/\b(police|police\s*station)\b/i, ['amenity=police']],
  [/\b(fire\s*station|fire\s*department)\b/i, ['amenity=fire_station']],
  [/\b(post\s*office|mail)\b/i, ['amenity=post_office']],
  [/\b(hardware|home\s*improvement|diy)\b/i, ['shop=hardware', 'shop=doityourself']],
  [/\b(barber|salon|hairdress\w*|haircut)\b/i, ['shop=hairdresser']],
  [/\b(mechanic|car\s*repair|auto\s*repair|garage)\b/i, ['shop=car_repair']],
  [/\b(parking|car\s*park)\b/i, ['amenity=parking']],
  [/\b(laundry|laundromat|launderette|dry\s*clean\w*)\b/i, ['shop=laundry', 'shop=dry_cleaning']],
  [/\b(cinema|movie\s*theat\w+|movies)\b/i, ['amenity=cinema']],
  [/\b(toilet|restroom|bathroom|public\s*toilet)\b/i, ['amenity=toilets']],
  [/\b(atm|bank)\b/i, ['amenity=atm', 'amenity=bank']],
  [/\b(taxi|taxis|taxi\s*stand|cab|cabs|cab\s*company|minicab)\b/i, ['amenity=taxi']],
  [/\b(bus\s*stop|bus\s*station|transit|train\s*station|rail\s*station)\b/i, ['highway=bus_stop', 'amenity=bus_station', 'railway=station']],
  [/\b(shop|shops|store|stores|shopping)\b/i, ['shop']],
];

/**
 * THE GENERAL SWEEP — "what is around here", asked with no subject.
 *
 * This is not a search TERM, and the bug was treating it as one. The caller
 * used to pass the literal string "restaurant cafe shop", which is a question
 * no geocoder can answer: Mapbox and TomTom match it as free text and return
 * zero features, Nominatim likewise, and Overpass took the FIRST category
 * whose regex hit anywhere in it — `cafe` — so it searched for cafes alone.
 * A town with no cafe inside the radius therefore came back empty from all
 * four providers at once, and the ladder reported "no usable result" for
 * every one of them: a map with nothing on it and no way to tell that from
 * an outage.
 *
 * A sweep is a UNION OF MAP TAGS, and Overpass is the only provider here that
 * accepts one. The keyed geocoders decline it in searchPlacesWithProvider
 * rather than answering it emptily.
 */
const SWEEP_TAGS = [
  'amenity=cafe', 'amenity=restaurant', 'amenity=fast_food',
  'shop=supermarket', 'shop=convenience', 'amenity=fuel',
  'amenity=pharmacy', 'amenity=bank',
];

// The category word(s) a query OPENS with — "taxi" in "taxi cottage grove
// oregon" — or null.
//
// "<what> <where>" with no preposition between the halves cannot be split by
// grammar, and we have no gazetteer to recognise "cottage grove" as a town.
// But we do know every category we are able to search FOR, and that list is
// directly above. If the query starts with one of them, the remainder is the
// where. Anything else stays unsplit and is handled as a plain place name,
// which is the existing behaviour.
//
// The LONGEST leading phrase wins, and it is found by testing whole-word
// prefixes rather than by letting the regex pick.
//
// The alternations above were written for `test()`, where order does not
// matter, so "gas" sits ahead of "gas station". A regex anchored only at the
// start returns the first alternative that can succeed — "gas" — which would
// make the subject "gas" and hand "station cottage grove oregon" to the
// geocoder. Matching each candidate prefix in FULL, longest first, is immune
// to how the alternations happen to be ordered.
const WHOLE_CATEGORY = OSM_CATEGORIES.map(([re]) => new RegExp(`^(?:${re.source})$`, 'i'));
const MAX_CATEGORY_WORDS = 4;   // "filling station", "place to stay", "movie theater"

export function leadingCategory(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  for (let n = Math.min(MAX_CATEGORY_WORDS, words.length); n >= 1; n--) {
    const prefix = words.slice(0, n).join(' ');
    if (WHOLE_CATEGORY.some((re) => re.test(prefix))) return prefix;
  }
  return null;
}

/** Overpass QL is regex-quoted with double quotes; a stray one breaks the query. */
const overpassEscape = (v) => String(v).replace(/["\\]/g, '\\$&');

/**
 * The body of an Overpass union — the `(...)` in `[out:json];(...);out center;`
 *
 * Both `node` and `way` are asked for, because a cafe is a point in some
 * places and a building outline in others; `out center` gives a way its
 * centroid so both come back with usable coordinates.
 */
function overpassClauses(subject, near, radius, { sweep = false } = {}) {
  const at = `(around:${Math.round(radius)},${near.lat},${near.lng})`;
  const clausesFor = (tags) => tags.flatMap((tag) => {
    const [key, value] = tag.split('=');
    const filter = value ? `["${key}"="${value}"]` : `["${key}"]`;
    return [`node${filter}${at}`, `way${filter}${at}`];
  }).join(';');

  // A sweep asks for everything worth pinning at once — see SWEEP_TAGS.
  if (sweep) return clausesFor(SWEEP_TAGS);

  const matched = OSM_CATEGORIES.find(([re]) => re.test(subject));

  if (matched) {
    return clausesFor(matched[1]);
  }

  // Not a category we know — treat it as a name. `~` is a case-insensitive
  // regex match, so "trader joe" finds "Trader Joe's".
  const name = overpassEscape(subject);
  return [
    `node["name"~"${name}",i]${at}`,
    `way["name"~"${name}",i]${at}`,
  ].join(';');
}

/** Metres between two points. Only used to sort, so the spherical law of
 *  cosines is plenty — no need for haversine's precision at these distances. */
export function metresBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** One Overpass element → the same place shape everything else here produces. */
function toOverpassPlace(el, near) {
  const lat = num(el.lat ?? el.center?.lat);
  const lng = num(el.lon ?? el.center?.lon);
  if (!isCoord(lat, lng)) return null;
  const t = el.tags || {};
  // An unnamed node tagged `amenity=cafe` is real data, but "Unnamed cafe" is
  // not a result anybody asked for — it is a pin you cannot act on.
  if (!t.name) return null;
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const address = [street, t['addr:city'], t['addr:state'], t['addr:postcode']]
    .filter(Boolean).join(', ');
  return {
    name: t.name,
    address,
    position: { lat, lng },
    type: t.amenity || t.shop || t.tourism || t.leisure || null,
    distance: metresBetween(near, { lat, lng }),
    // Carried through so a result card can show them without a second lookup.
    phone: t.phone || t['contact:phone'] || null,
    website: t.website || t['contact:website'] || null,
    hours: t.opening_hours || null,
    raw: el,
  };
}

class MapApiService {
  constructor() {
    this.providers = ['mapbox', 'radar', 'tomtom', 'leaflet'];
    this.currentProvider = null;
    this.requestCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  setProvider(provider) {
    this.currentProvider = provider;
  }

  async geocode(query, options = {}) {
    return this.cached(`geocode:${query}:${JSON.stringify(options)}`, () => this.tryProviders(
      (provider) => this.geocodeWithProvider(provider, query, options), 'geocode',
    ));
  }

  async reverseGeocode(latitude, longitude, options = {}) {
    return this.cached(`reverse:${latitude}:${longitude}:${JSON.stringify(options)}`, () => this.tryProviders(
      (provider) => this.reverseGeocodeWithProvider(provider, latitude, longitude, options), 'reverse-geocode',
    ));
  }

  async getDirections(origin, destination, options = {}) {
    return this.cached(
      `directions:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${JSON.stringify(options)}`,
      () => this.tryProviders(
        (provider) => this.getDirectionsWithProvider(provider, origin, destination, options), 'directions',
      ),
    );
  }

  /**
   * Places near a point. `options.query` is the free-text part ("coffee",
   * "hardware store") and `near` is what makes it near.
   */
  /**
   * All candidate routes for a journey, for the route-option picker.
   *
   * Deliberately a SEPARATE method rather than a flag on getDirections: the
   * two have different return shapes (one route vs many), and every existing
   * caller of getDirections wants exactly one.
   */
  async getRoutes(origin, destination, options = {}) {
    return this.cached(
      `routes:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${JSON.stringify(options)}`,
      () => this.tryProviders(
        (provider) => this.getRoutesWithProvider(provider, origin, destination, options), 'routes',
      ),
    );
  }

  async searchPlaces(near, options = {}) {
    return this.cached(`places:${near.lat},${near.lng}:${JSON.stringify(options)}`, () => this.tryProviders(
      (provider) => this.searchPlacesWithProvider(provider, near, options), 'places',
    ));
  }

  async getDistance(origin, destination, options = {}) {
    return this.cached(
      `distance:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${JSON.stringify(options)}`,
      () => this.tryProviders(
        (provider) => this.getDistanceWithProvider(provider, origin, destination, options), 'distance',
      ),
    );
  }

  /** Cache around a producer. Only successes are cached — caching a failure
   *  means a provider that was briefly down stays "down" for five minutes. */
  async cached(key, produce) {
    const hit = this.getCached(key);
    if (hit) return hit;
    const result = await produce();
    this.setCache(key, result);
    return result;
  }

  /**
   * Is this NORMALISED result usable? These questions are asked of the shape
   * this file produces, not of whatever a provider happened to send.
   */
  isValidResult(result, operation) {
    if (!result) return false;
    switch (operation) {
      case 'geocode':
      case 'places':
        return Array.isArray(result) && result.length > 0 && !!result[0].position;
      case 'reverse-geocode':
        return !!(result.address || result.position);
      case 'directions':
        // A route without a line cannot be drawn, so it is not a route.
        return !!(result.geometry && result.geometry.coordinates?.length > 1);
      case 'routes':
        // At least one drawable route. Zero is a failed provider, not an
        // answer — otherwise the ladder would stop at the first provider that
        // politely returned nothing.
        return Array.isArray(result) && result.length > 0
          && !!result[0].geometry?.coordinates?.length;
      case 'distance':
        return Number.isFinite(result.distance);
      default:
        return true;
    }
  }

  async tryProviders(asyncFn, operation = 'unknown') {
    const ordered = this.currentProvider
      ? [this.currentProvider, ...this.providers.filter((p) => p !== this.currentProvider)]
      : [...this.providers];
    if (!ordered.includes('leaflet')) ordered.push('leaflet');   // OSM is the floor

    const failures = [];
    for (const provider of ordered) {
      try {
        const result = await asyncFn(provider);
        if (this.isValidResult(result, operation)) return { success: true, provider, data: result };
        failures.push(`${provider}: no usable result`);
      } catch (error) {
        failures.push(`${provider}: ${error.message}`);
      }
    }

    log(`All map providers failed for ${operation}:`, failures.join(' · '));
    // Carries WHICH provider failed and how. "All providers failed" on its own
    // cannot distinguish a missing API key from a network outage.
    const err = new Error(`All map providers failed for ${operation}`);
    err.failures = failures;
    throw err;
  }

  // ── dispatch ──────────────────────────────────────────────────────────────

  // `options.near` biases a geocode toward the user. Every provider below can
  // take the hint in its own dialect; none of them is FILTERED by it, so a
  // query with no nearby match still answers.
  geocodeWithProvider(provider, query, options) {
    const { near = null, ...rest } = options || {};
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/geocode', { query, options: rest, near, provider: 'mapbox' }, toPlaces);
      case 'tomtom': return this.viaBackend('/api/maps/geocode', { query, options: rest, near, provider: 'tomtom' }, toPlaces);
      case 'radar': return this.viaBackend('/api/radar/geocode', { query, options: rest, near }, toPlaces);
      case 'leaflet': return this.geocodeWithOSM(query, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  reverseGeocodeWithProvider(provider, latitude, longitude, options) {
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/reverse-geocode', { latitude, longitude, options, provider: 'mapbox' }, (d) => toPlace(Array.isArray(d) ? d[0] : d) || { address: d?.address, position: null });
      case 'tomtom': return this.viaBackend('/api/maps/reverse-geocode', { latitude, longitude, options, provider: 'tomtom' }, (d) => toPlace(Array.isArray(d) ? d[0] : d) || { address: d?.address, position: null });
      case 'radar': return this.viaBackend('/api/radar/reverse-geocode', { latitude, longitude, options }, (d) => toPlace(Array.isArray(d) ? d[0] : d) || { address: d?.address, position: null });
      case 'leaflet': return this.reverseGeocodeWithOSM(latitude, longitude, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  getDirectionsWithProvider(provider, origin, destination, options) {
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/directions', { origin, destination, options, provider: 'mapbox' }, toRoute);
      case 'tomtom': return this.viaBackend('/api/maps/directions', { origin, destination, options, provider: 'tomtom' }, toRoute);
      case 'radar': return this.viaBackend('/api/radar/directions', { origin, destination, options }, toRadarRoute);
      case 'leaflet': return this.routeWithOSRM(origin, destination, { ...options, overview: 'full' });
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  getRoutesWithProvider(provider, origin, destination, options) {
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/directions', { origin, destination, options, provider: 'mapbox' }, toRoutes);
      case 'tomtom': return this.viaBackend('/api/maps/directions', { origin, destination, options, provider: 'tomtom' }, toRoutes);
      case 'radar': return this.viaBackend('/api/radar/directions', { origin, destination, options }, toRadarRoutes);
      // OSRM's public server DOES return alternatives, so the keyless floor
      // still offers a choice — it just has no congestion data, which is why
      // routeOptions marks "least traffic" unavailable without a key.
      case 'leaflet': return this.routeWithOSRM(origin, destination, { ...options, overview: 'full', all: true })
        .then((r) => (Array.isArray(r) ? r : [r].filter(Boolean)));
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  searchPlacesWithProvider(provider, near, options) {
    // Declining is not the same as failing, but it must not look like an empty
    // answer either: a geocoder handed a sweep returns zero rows, and zero rows
    // is exactly what a broken provider returns. Saying so keeps the on-screen
    // reason honest and costs three pointless upstream calls less.
    if (options?.sweep && provider !== 'leaflet') {
      return Promise.reject(new Error('a general sweep needs OpenStreetMap tags'));
    }
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/places', { near, options, provider: 'mapbox' }, toPlaces);
      case 'tomtom': return this.viaBackend('/api/maps/places', { near, options, provider: 'tomtom' }, toPlaces);
      case 'radar': return this.viaBackend('/api/radar/search-places', { near, options }, toPlaces);
      case 'leaflet': return this.searchPlacesWithOSM(near, options);
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  getDistanceWithProvider(provider, origin, destination, options) {
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/distance', { origin, destination, options, provider: 'mapbox' }, toRoute);
      case 'tomtom': return this.viaBackend('/api/maps/distance', { origin, destination, options, provider: 'tomtom' }, toRoute);
      case 'radar': return this.viaBackend('/api/radar/distance', { origin, destination, options }, toRadarRoute);
      // No overview: a distance question does not need the shape of the road.
      case 'leaflet': return this.routeWithOSRM(origin, destination, { ...options, overview: 'false' });
      default: throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /** POST to one of our own routes, peel the envelope, normalise the payload. */
  async viaBackend(path, body, normalise) {
    try {
      const response = await axios.post(`${BACKEND_URL}${path}`, body);
      return normalise(unwrap(response.data));
    } catch (error) {
      // The backend explains itself in the body. This string is printed
      // straight onto the map by MapViewWrapper, and "Radar live secret key is
      // not set" is something you can act on where "Request failed with status
      // code 503" sends you looking for an outage that is not there.
      const said = error.response?.data?.message || error.response?.data?.error;
      if (said) throw new Error(said);
      throw error;
    }
  }

  // ── OpenStreetMap, the keyless floor ──────────────────────────────────────

  async geocodeWithOSM(query, options = {}) {
    // Nominatim's proximity is a `viewbox` — and deliberately WITHOUT
    // `bounded=1`, which would turn the hint into a hard filter and make a
    // query with nothing in the box return nothing at all. Unbounded, the box
    // only lifts what is inside it up the ranking.
    const near = options.near;
    const box = near && Number.isFinite(near.lat) && Number.isFinite(near.lng)
      // ~1 degree ≈ 111 km: wide enough to cover a rural trip to town.
      ? { viewbox: [near.lng - 1, near.lat + 1, near.lng + 1, near.lat - 1].join(','), bounded: 0 }
      : {};
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query, format: 'json', limit: options.limit || 10, addressdetails: 1, ...box,
      },
      headers: { 'User-Agent': 'Truegle/1.0' },
    });
    return toPlaces(response.data);
  }

  async reverseGeocodeWithOSM(latitude, longitude) {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat: latitude, lon: longitude, format: 'json', addressdetails: 1 },
      headers: { 'User-Agent': 'Truegle/1.0' },
    });
    return toPlace(response.data) || { address: response.data?.display_name || '', position: null };
  }

  /**
   * "Coffee near me" — Overpass first, Nominatim second.
   *
   * WHY OVERPASS AT ALL. Nominatim is a GEOCODER: it turns a name into a
   * point. Ask it for "coffee" and it looks for places literally NAMED
   * "coffee", so in most towns it answers with nothing at all — which is
   * exactly what "coffee near me pulled no results" was. Nothing further up
   * the ladder covers it either: Mapbox, Radar and TomTom all need keys the
   * deployment does not have, so the keyless floor IS the search.
   *
   * Overpass is OpenStreetMap's own query engine and answers the question
   * actually being asked — "everything tagged as a cafe within 5km of this
   * point". Keyless, free, no account, and the data is the same OSM data the
   * basemap is drawn from, so the pins land on the buildings under them.
   *
   * Two shapes of question, in order:
   *   1. A CATEGORY the tag table below knows ("coffee", "pharmacy", "gas") →
   *      matched on tags, which finds the shop whether or not its name
   *      contains the word.
   *   2. A NAME, or a category we have no tag for → matched on the `name` tag,
   *      case-insensitively. This is what makes "Name of Location" work as
   *      well as "coffee".
   * Nominatim stays as the last resort, unchanged, for anything Overpass
   * cannot answer or when Overpass is busy (it is a volunteer service and
   * returns 429 under load).
   */
  async searchPlacesWithOSM(near, options = {}) {
    try {
      const found = await this.searchPlacesWithOverpass(near, options);
      if (found.length) return found;
    } catch (error) {
      log('Overpass unavailable, falling back to Nominatim:', error.message);
    }
    // Nominatim searches TEXT. A sweep has no text to search — handing it one
    // is how "restaurant cafe shop" reached a geocoder in the first place —
    // so a failed sweep stays failed rather than becoming a nonsense query.
    if (options.sweep) return [];
    return this.searchPlacesWithNominatim(near, options);
  }

  async searchPlacesWithOverpass(near, options = {}) {
    const radius = Math.min(options.radius || 5000, 50000);
    const limit = options.limit || 20;
    const subject = String(options.query || '').trim();
    const sweep = !!options.sweep;
    // No subject and no sweep is not a question; it used to be answered with
    // a hardcoded category string, which is what broke.
    if (!subject && !sweep) return [];

    const clauses = overpassClauses(subject, near, radius, { sweep });
    if (!clauses) return [];

    const ql = `[out:json][timeout:20];(${clauses});out center ${limit};`;
    const response = await axios.post(
      OVERPASS_ENDPOINT,
      new URLSearchParams({ data: ql }),
      { timeout: 20000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return (response.data?.elements || [])
      .map((el) => toOverpassPlace(el, near))
      .filter(Boolean)
      // Nearest first. Overpass returns in element order, which is arbitrary,
      // and "near me" that lists the far one first is not answering the ask.
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * The geocoder, bounded to a box around a point.
   *
   * The old version passed `lat`, `lon` and `radius`. Nominatim has no such
   * parameters and ignores all three, so every "near me" search was a global
   * one — asking for a hardware store in a small town returned a hardware
   * store on another continent. Bounding is done with `viewbox` plus
   * `bounded=1`, which is the only way this API takes a location.
   */
  async searchPlacesWithNominatim(near, options = {}) {
    const radius = options.radius || 5000;
    // Degrees per metre. Longitude degrees shrink as you leave the equator, so
    // a fixed box is far too narrow at high latitude without the cos() term.
    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.max(Math.cos((near.lat * Math.PI) / 180), 0.01));

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: options.query || 'shop',
        format: 'json',
        addressdetails: 1,
        limit: options.limit || 10,
        // left,top,right,bottom
        viewbox: [near.lng - dLng, near.lat + dLat, near.lng + dLng, near.lat - dLat].join(','),
        bounded: 1,
      },
      headers: { 'User-Agent': 'Truegle/1.0' },
    });
    return toPlaces(response.data);
  }

  /**
   * OSRM, for both routing and distance.
   *
   * The coordinates go in the PATH — `/route/v1/driving/{lng},{lat};{lng},{lat}`.
   * The old version sent them as `start` and `end` query parameters, which
   * OSRM does not have: the request 400s every time. Directions therefore
   * failed on the last provider in the ladder as well as the first three, so
   * routing never worked at all.
   */
  async routeWithOSRM(origin, destination, options = {}) {
    // OSRM has no driving-traffic profile — it is a static road graph — so a
    // request for one has to be flattened or the demo server 400s.
    const profile = (options.profile || 'driving').replace('driving-traffic', 'driving');
    const pair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const exclude = Array.isArray(options.exclude)
      // OSRM's car profile knows `motorway`, `toll` and `ferry`; anything else
      // is rejected outright rather than ignored, so the list is filtered.
      ? options.exclude.filter((e) => ['motorway', 'toll', 'ferry'].includes(e))
      : [];
    const response = await axios.get(`https://router.project-osrm.org/route/v1/${profile}/${pair}`, {
      params: {
        overview: options.overview ?? 'full',
        geometries: 'geojson',
        ...(options.alternatives ? { alternatives: 'true' } : {}),
        ...(exclude.length ? { exclude: exclude.join(',') } : {}),
      },
    });
    if (response.data?.code !== 'Ok') throw new Error(response.data?.message || 'OSRM routing failed');
    // `all` asks for every candidate; the single-route callers still get one.
    return options.all ? toRoutes(response.data.routes) : toRoute(response.data.routes);
  }

  // ── cache ─────────────────────────────────────────────────────────────────

  getCached(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.requestCache.delete(key);
      return null;
    }
    return cached.data;
  }

  setCache(key, data) {
    this.requestCache.set(key, { data, timestamp: Date.now() });
  }

  clearCache() {
    this.requestCache.clear();
  }
}

export { toPlace, toPlaces, toRoute, toRadarRoute, toPosition, unwrap };
export default new MapApiService();
