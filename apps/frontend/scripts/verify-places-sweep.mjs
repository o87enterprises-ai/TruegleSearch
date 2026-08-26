/* The nearby sweep — "what is around here", asked with no subject.
 *
 * WHY THIS EXISTS. Opening the map without typing a business name ran a
 * search for the literal words "restaurant cafe shop". That is not a question
 * any geocoder can answer: Mapbox and TomTom match it as free text and return
 * zero features, Nominatim likewise, and Overpass took the FIRST category
 * whose regex hit anywhere in the string — `cafe` — so it looked for cafes
 * alone. In a town with no cafe inside the radius all four providers returned
 * nothing, and the ladder reported:
 *
 *   mapbox: no usable result · radar: Request failed with status code 500 ·
 *   tomtom: no usable result · leaflet: no usable result
 *
 * Three "no usable result"s that looked like three dead providers, and one
 * 500 that was only Radar having no key. Neither was fixed by new API keys,
 * because neither was ever about the keys.
 *
 * A sweep is now a UNION OF TAGS that only OpenStreetMap is asked for. These
 * assert that, plus that a real subject still reaches the keyed providers.
 *
 * The real endpoints are unreachable from this sandbox (the environment's
 * network policy denies api.mapbox.com, overpass and nominatim), so axios is
 * stubbed. This tests the plumbing — who is asked, and for what — and is NOT
 * evidence that any provider is up.
 *
 * Run it:  npm run places:test
 */
const calls = [];
let handler = () => { throw new Error('no handler set'); };
globalThis.__mapTestAxios = (call) => { calls.push(call); return handler(call); };

const { default: MapApi } = await import('../src/components/map/services/mapApi.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const reset = (h) => { calls.length = 0; handler = h; MapApi.clearCache(); MapApi.setProvider(null); };

const NEAR = { lat: 43.797, lng: -123.059 };   // Cottage Grove, OR
const OVERPASS_HIT = { data: { elements: [
  { type: 'node', lat: 43.7975, lon: -123.0595, tags: { name: 'Blue Bird Cafe', amenity: 'cafe' } },
  { type: 'node', lat: 43.7981, lon: -123.0601, tags: { name: 'Bi-Mart', shop: 'supermarket' } },
] } };
const MAPBOX_PLACES = { success: true, provider: 'mapbox', data: [
  { name: 'Cottage Grove Coffee', address: 'Main St', position: { lon: -123.059, lat: 43.797 }, type: 'poi' },
] };

const isOverpass = (c) => /overpass/.test(c.url);
const isNominatim = (c) => /nominatim/.test(c.url);
const isBackendPlaces = (c) => /\/api\/(maps\/places|radar\/search-places)/.test(c.url);

// ── 1. a sweep is served by OpenStreetMap alone ─────────────────────────────
reset((c) => (isOverpass(c) ? OVERPASS_HIT : (() => { throw new Error(`unexpected ${c.url}`); })()));
const sweep = await MapApi.searchPlaces(NEAR, { sweep: true, radius: 5000, limit: 20 });
check(sweep.provider === 'leaflet', 'sweep is served by OpenStreetMap', `got ${sweep.provider}`);
check(sweep.data.length === 2, 'sweep returns the places Overpass found', `got ${sweep.data.length}`);
check(!calls.some(isBackendPlaces), 'sweep spends no keyed-provider request',
  calls.filter(isBackendPlaces).map((c) => c.url).join(','));

// ── 2. the union, not whichever category matched first ──────────────────────
// The Overpass body is a URLSearchParams — read the `data` field back out
// rather than string-matching its percent-encoded form.
const ql = new URLSearchParams(String(calls.find(isOverpass)?.body || '')).get('data') || '';
// Overpass QL spells a tag filter ["key"="value"], so assert the emitted form.
for (const [key, value] of [['amenity', 'cafe'], ['amenity', 'restaurant'], ['shop', 'supermarket'], ['amenity', 'fuel']]) {
  check(ql.includes(`["${key}"="${value}"]`), `sweep asks Overpass for ${key}=${value}`);
}
check(!/restaurant cafe shop/.test(ql), 'the words "restaurant cafe shop" are not sent as a search term');

// ── 3. a failed sweep does not decay into a text query ──────────────────────
reset((c) => {
  if (isOverpass(c)) throw new Error('Overpass 504');
  throw new Error(`unexpected ${c.url}`);
});
let swept = null;
try { swept = await MapApi.searchPlaces(NEAR, { sweep: true, radius: 5000 }); } catch (e) { swept = e; }
check(swept instanceof Error, 'a sweep with no Overpass fails rather than inventing a query');
check(!calls.some(isNominatim), 'a failed sweep never reaches Nominatim',
  calls.filter(isNominatim).map((c) => c.url).join(','));

// ── 4. a real subject still uses the keyed providers ────────────────────────
reset((c) => (/\/api\/maps\/places/.test(c.url) ? { data: MAPBOX_PLACES } : (() => { throw new Error(`unexpected ${c.url}`); })()));
const subject = await MapApi.searchPlaces(NEAR, { query: 'coffee', radius: 5000, limit: 20 });
check(subject.provider === 'mapbox', 'a named subject is served by Mapbox', `got ${subject.provider}`);
check(subject.data[0]?.position?.lat === 43.797, 'the keyed result normalises to a position');

// ── 5. the backend's reason reaches the screen ──────────────────────────────
reset((c) => {
  if (/\/api\/radar\/search-places/.test(c.url)) {
    const err = new Error('Request failed with status code 503');
    err.response = { status: 503, data: { success: false, error: 'Radar not configured', message: 'Radar live secret key is not set' } };
    throw err;
  }
  throw new Error(`unexpected ${c.url}`);
});
MapApi.setProvider('radar');
let said = null;
try { await MapApi.searchPlaces(NEAR, { query: 'coffee', radius: 5000 }); } catch (e) { said = e; }
const radarFailure = (said?.failures || []).find((f) => f.startsWith('radar:')) || '';
check(radarFailure.includes('Radar live secret key is not set'),
  'an unconfigured Radar says so instead of "status code 503"', radarFailure);

// ── report ──────────────────────────────────────────────────────────────────
for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
