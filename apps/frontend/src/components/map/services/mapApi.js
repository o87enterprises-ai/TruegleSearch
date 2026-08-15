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

  geocodeWithProvider(provider, query, options) {
    switch (provider) {
      case 'mapbox': return this.viaBackend('/api/maps/geocode', { query, options, provider: 'mapbox' }, toPlaces);
      case 'tomtom': return this.viaBackend('/api/maps/geocode', { query, options, provider: 'tomtom' }, toPlaces);
      case 'radar': return this.viaBackend('/api/radar/geocode', { query, options }, toPlaces);
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

  searchPlacesWithProvider(provider, near, options) {
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
    const response = await axios.post(`${BACKEND_URL}${path}`, body);
    return normalise(unwrap(response.data));
  }

  // ── OpenStreetMap, the keyless floor ──────────────────────────────────────

  async geocodeWithOSM(query, options = {}) {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: query, format: 'json', limit: options.limit || 10, addressdetails: 1 },
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
   * "Coffee near me", on Nominatim.
   *
   * The old version passed `lat`, `lon` and `radius`. Nominatim has no such
   * parameters and ignores all three, so every "near me" search was a global
   * one — asking for a hardware store in a small town returned a hardware
   * store on another continent. Bounding is done with `viewbox` plus
   * `bounded=1`, which is the only way this API takes a location.
   */
  async searchPlacesWithOSM(near, options = {}) {
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
    const profile = options.profile || 'driving';
    const pair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const response = await axios.get(`https://router.project-osrm.org/route/v1/${profile}/${pair}`, {
      params: { overview: options.overview ?? 'full', geometries: 'geojson' },
    });
    if (response.data?.code !== 'Ok') throw new Error(response.data?.message || 'OSRM routing failed');
    return toRoute(response.data.routes);
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
