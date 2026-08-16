/* The map provider ladder, against what each provider actually returns.
 *
 * WHY THIS EXISTS. Every backend map route answers `{ success, data }`, and
 * the client validated that envelope with questions about the payload — "is it
 * an array", "does it have .address". An envelope answers no, so Mapbox, Radar
 * and TomTom were discarded as invalid on every single call and the ladder fell
 * through to OpenStreetMap every time. Nothing failed loudly; results were just
 * quietly worse than the account was paying for. A test that only checked "did
 * geocode return something" would have passed throughout, because OSM answers.
 *
 * So these assert WHICH provider served the result, not merely that one did.
 *
 * The real endpoints are unreachable from this sandbox (the environment's
 * network policy denies api.mapbox.com, api.tomtom.com, nominatim and OSRM), so
 * axios is stubbed with recorded response shapes. That makes this a test of the
 * plumbing — envelope, normalisation, fallback order, request URLs — and NOT
 * evidence that any provider is up. Those shapes come from each API's docs and
 * from the backend formatters in services/MapboxService.js.
 *
 * Run it:  npm run map:test
 */
// axios is aliased to scripts/stubs/axios.mjs at bundle time; it dispatches
// through this handler, which every section swaps for the shapes it needs.
const calls = [];
let handler = () => { throw new Error('no handler set'); };
globalThis.__mapTestAxios = (call) => { calls.push(call); return handler(call); };

const { default: MapApi } = await import('../src/components/map/services/mapApi.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const reset = (h) => { calls.length = 0; handler = h; MapApi.clearCache(); MapApi.setProvider(null); };

// ── recorded shapes ─────────────────────────────────────────────────────────
// Exactly what routes/maps.js sends: the formatter output inside an envelope.
const MAPBOX_GEOCODE = { success: true, provider: 'mapbox', data: [
  { address: '1 Infinite Loop, Cupertino', position: { lon: -122.03, lat: 37.33 }, type: 'address' },
] };
const OSM_GEOCODE = [
  { display_name: 'Cupertino, California', lat: '37.3230', lon: '-122.0322', type: 'city' },
];
const MAPBOX_DIRECTIONS = { success: true, provider: 'mapbox', data: [
  { distance: 4200, duration: 600, geometry: { type: 'LineString', coordinates: [[-122.03, 37.33], [-122.01, 37.35]] } },
] };
const OSRM_ROUTE = { code: 'Ok', routes: [
  { distance: 4300, duration: 640, geometry: { type: 'LineString', coordinates: [[-122.03, 37.33], [-122.01, 37.35]] } },
] };

// ── 1. the paid providers are actually used ─────────────────────────────────
// The bug in one line: this used to come back from 'leaflet'.
reset(({ url }) => {
  if (url.includes('/api/maps/geocode')) return { data: MAPBOX_GEOCODE };
  throw new Error('should not have been asked');
});
const g = await MapApi.geocode('cupertino');
check(g.provider === 'mapbox', 'a Mapbox result is used rather than discarded as invalid', `served by ${g.provider}`);
check(calls.length === 1, '…and no other provider is contacted once one answers', `${calls.length} calls`);

// ── 2. one shape, whatever answered ─────────────────────────────────────────
// Mapbox says position.lon; Nominatim says lon as a STRING; flyTo validates
// .lat/.lng and silently refuses anything else — so an un-normalised Mapbox
// result reaches the map and the map does not move.
check(g.data[0].position.lng === -122.03, 'Mapbox lon is normalised to lng', JSON.stringify(g.data[0].position));
check(typeof g.data[0].position.lat === 'number', '…as a number', typeof g.data[0].position.lat);

reset(({ url }) => {
  if (url.includes('/api/maps/geocode') || url.includes('/api/radar/geocode')) throw new Error('provider down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
const g2 = await MapApi.geocode('cupertino');
check(g2.provider === 'leaflet', 'OSM still catches everything when the rest are down', `served by ${g2.provider}`);
check(g2.data[0].position.lng === -122.0322 && g2.data[0].position.lat === 37.3230,
  '…and its string coordinates come out as the same numeric shape',
  JSON.stringify(g2.data[0].position));

// ── 3. a provider that says success:false has not succeeded ─────────────────
reset(({ url }) => {
  if (url.includes('/api/maps/geocode')) return { data: { success: false, message: 'no key configured' } };
  if (url.includes('/api/radar/geocode')) throw new Error('down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
const g3 = await MapApi.geocode('cupertino');
check(g3.provider === 'leaflet', 'a 200 carrying success:false falls through instead of rendering nothing', g3.provider);

// ── 4. directions come from Mapbox when Mapbox can serve them ───────────────
// Mapbox answers with an ARRAY of routes inside the envelope; the recommended
// one is first. Handing that array straight to a consumer expecting one route
// is the same class of bug as the envelope itself.
reset(({ url }) => {
  if (url.includes('/api/maps/directions')) return { data: MAPBOX_DIRECTIONS };
  throw new Error('should not have been asked');
});
const mbRoute = await MapApi.getDirections({ lat: 37.33, lng: -122.03 }, { lat: 37.35, lng: -122.01 });
check(mbRoute.provider === 'mapbox', 'Mapbox directions are used', mbRoute.provider);
check(mbRoute.data.distance === 4200 && mbRoute.data.duration === 600,
  '…unwrapped from the array to a single route', JSON.stringify({ d: mbRoute.data.distance, t: mbRoute.data.duration }));
check(mbRoute.data.geometry?.type === 'LineString', '…with a line the map can draw', mbRoute.data.geometry?.type);

// ── 5. OSRM is called the way OSRM works ────────────────────────────────────
// Coordinates go in the PATH. The old code sent `start`/`end` query params,
// which OSRM does not have — so routing 400d on every request, on the only
// provider that needs no key. Directions never worked at all.
reset(({ url }) => {
  if (url.includes('/api/maps/directions') || url.includes('/api/radar/directions')) throw new Error('down');
  if (url.includes('router.project-osrm.org')) return { data: OSRM_ROUTE };
  throw new Error(`unexpected ${url}`);
});
const r = await MapApi.getDirections({ lat: 37.33, lng: -122.03 }, { lat: 37.35, lng: -122.01 });
const osrm = calls.find((c) => c.url.includes('osrm'));
check(/\/route\/v1\/driving\/-122\.03,37\.33;-122\.01,37\.35$/.test(osrm.url),
  'OSRM gets its coordinates in the path, lng first', osrm.url);
check(!('start' in (osrm.params || {})), '…and not as the query parameters it does not have', JSON.stringify(osrm.params));
check(r.data.geometry?.coordinates?.length === 2, 'the route comes back drawable', JSON.stringify(r.data.geometry));

// ── 6. a route with no line is not a route ──────────────────────────────────
// It cannot be drawn, so accepting it means a "route found" with nothing on
// the map — worse than falling through to a provider that has the geometry.
reset(({ url }) => {
  if (url.includes('/api/maps/directions')) return { data: { success: true, data: [{ distance: 100, duration: 20 }] } };
  if (url.includes('/api/radar/directions')) throw new Error('down');
  if (url.includes('osrm')) return { data: OSRM_ROUTE };
  throw new Error(`unexpected ${url}`);
});
const r2 = await MapApi.getDirections({ lat: 37.33, lng: -122.03 }, { lat: 37.35, lng: -122.01 });
check(r2.provider === 'leaflet', 'a geometry-less route falls through to one that can be drawn', r2.provider);

// ── 7. "near me" is actually near you ───────────────────────────────────────
// Nominatim has no lat/lon/radius parameters and ignored all three, so every
// "near me" search was global — a hardware store on another continent scored
// as well as the one down the road. viewbox+bounded is the only location this
// API takes.
reset(({ url }) => {
  if (url.includes('/api/maps/places') || url.includes('/api/radar/search-places')) throw new Error('down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
await MapApi.searchPlaces({ lat: 37.33, lng: -122.03 }, { query: 'hardware store', radius: 5000 });
const nom = calls.find((c) => c.url.includes('nominatim'));
check(!!nom.params.viewbox && String(nom.params.bounded) === '1',
  'a nearby search is bounded to a box around you', JSON.stringify({ viewbox: nom.params.viewbox, bounded: nom.params.bounded }));
check(nom.params.q === 'hardware store', '…for what was actually asked for', nom.params.q);
const [left, top, right, bottom] = String(nom.params.viewbox).split(',').map(Number);
check(left < -122.03 && right > -122.03 && bottom < 37.33 && top > 37.33,
  '…with the point inside the box', nom.params.viewbox);

// The box has to widen with latitude or it is far too narrow near the poles:
// a degree of longitude is 111km at the equator and 19km at 80°N.
reset(({ url }) => {
  if (url.includes('/api/')) throw new Error('down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
await MapApi.searchPlaces({ lat: 78.2, lng: 15.6 }, { query: 'shop', radius: 5000 });
const arctic = calls.find((c) => c.url.includes('nominatim'));
const [aLeft, , aRight] = String(arctic.params.viewbox).split(',').map(Number);
check((aRight - aLeft) > (right - left) * 3,
  '…and the box widens with latitude rather than covering a sliver',
  `equator ${(right - left).toFixed(3)}° vs arctic ${(aRight - aLeft).toFixed(3)}°`);

// ── 7b. "coffee near me" asks a question a geocoder can answer ──────────────
// This is the bug the owner reported: coffee near me pulled no results.
// Nominatim is a GEOCODER — ask it for "coffee" and it looks for a place NAMED
// coffee, which in most towns is nothing. Overpass is OSM's query engine and
// answers "everything TAGGED as a cafe within 5km", which is the actual
// question. Every rung above it needs an API key the deployment does not have,
// so this rung is the whole search, not a nicety.
const OVERPASS_CAFES = { elements: [
  { type: 'node', id: 1, lat: 37.3312, lon: -122.0301, tags: { name: 'Near Cafe', amenity: 'cafe', 'addr:street': 'Main St' } },
  { type: 'way', id: 2, center: { lat: 37.36, lon: -122.06 }, tags: { name: 'Far Cafe', amenity: 'cafe' } },
  { type: 'node', id: 3, lat: 37.34, lon: -122.04, tags: { amenity: 'cafe' } },   // unnamed
] };
reset(({ url }) => {
  // Overpass's own path contains "/api/", so it is matched first.
  if (url.includes('overpass')) return { data: OVERPASS_CAFES };
  if (url.includes('/api/')) throw new Error('no key configured');
  if (url.includes('nominatim')) return { data: [] };
  throw new Error(`unexpected ${url}`);
});
const coffee = await MapApi.searchPlaces({ lat: 37.33, lng: -122.03 }, { query: 'coffee', radius: 5000 });
const overpass = calls.find((c) => c.url.includes('overpass'));
check(!!overpass, '"coffee near me" reaches Overpass at all');
// The body is form-encoded (`data=<query>`): percent-escapes AND `+` for
// spaces, which decodeURIComponent alone does not undo.
const readForm = (b) => decodeURIComponent(String(b || '').replace(/\+/g, '%20'));
const ql = readForm(overpass?.body);
check(ql.includes('"amenity"="cafe"'),
  'coffee is asked for as the TAG that finds it, not as a name', ql.slice(ql.indexOf('node'), ql.indexOf('node') + 40));
check(ql.includes('around:5000,37.33,-122.03'), '…around the point, at the radius asked for');
check(ql.includes('node[') && ql.includes('way['),
  '…as both a point and a building outline, since OSM maps cafes as either');
check(coffee.data.length === 2, 'the named cafes come back and the unnamed node does not', `${coffee.data.length} results`);
check(coffee.data[0].name === 'Near Cafe', 'nearest first — "near me" that lists the far one first has not answered');
check(coffee.data[0].address === 'Main St', '…carrying the address OSM had for it', coffee.data[0].address);

// An unknown subject is a NAME, which is what makes searching for one business
// work rather than only the categories we happen to have listed.
reset(({ url }) => {
  if (url.includes('overpass')) return { data: { elements: [] } };
  if (url.includes('/api/')) throw new Error('down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
await MapApi.searchPlaces({ lat: 37.33, lng: -122.03 }, { query: 'trader joe', radius: 5000 });
const named = calls.find((c) => c.url.includes('overpass'));
check(readForm(named.body).includes('"name"~"trader joe",i'),
  'an unlisted subject is matched on name, case-insensitively');
check(!!calls.find((c) => c.url.includes('nominatim')),
  '…and an empty Overpass answer still falls through to the geocoder');

// Overpass is a volunteer service that 429s under load. That must cost the
// search nothing.
reset(({ url }) => {
  if (url.includes('overpass')) throw new Error('429 Too Many Requests');
  if (url.includes('/api/')) throw new Error('down');
  if (url.includes('nominatim')) return { data: OSM_GEOCODE };
  throw new Error(`unexpected ${url}`);
});
const busy = await MapApi.searchPlaces({ lat: 37.33, lng: -122.03 }, { query: 'coffee', radius: 5000 });
check(busy.data.length > 0, 'a busy Overpass falls through to Nominatim rather than returning nothing');

// ── 8. failures say which provider and why ──────────────────────────────────
// "All map providers failed" alone cannot tell a missing API key from an
// outage, which is the difference between a config fix and waiting.
reset(() => { throw new Error('ECONNREFUSED'); });
let caught = null;
try { await MapApi.geocode('nowhere'); } catch (e) { caught = e; }
check(!!caught?.failures && caught.failures.length >= 4,
  'a total failure reports every provider it tried and why',
  caught?.failures?.join(' · '));

// ── 9. only successes are cached ────────────────────────────────────────────
// Caching a failure keeps a provider "down" for five minutes after it recovers.
reset(() => { throw new Error('down'); });
try { await MapApi.geocode('flaky'); } catch { /* expected */ }
handler = ({ url }) => {
  if (url.includes('/api/maps/geocode')) return { data: MAPBOX_GEOCODE };
  throw new Error('should not reach');
};
const recovered = await MapApi.geocode('flaky');
check(recovered.provider === 'mapbox', 'a recovered provider is asked again rather than staying failed', recovered.provider);

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
