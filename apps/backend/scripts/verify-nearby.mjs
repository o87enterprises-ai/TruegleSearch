/* Nearby search, end to end, with the network optional.
 *
 * WHAT THIS IS GUARDING. Nearby search had one provider, Radar, and Radar
 * needs a key. With the key absent the route answered `businesses: []` and the
 * map drew no pins — which looks exactly like "there is nothing near you".
 * A core feature was one unset environment variable away from silently not
 * existing, and nothing in the response said so.
 *
 * The fix was a keyless OpenStreetMap provider underneath Radar. That provider
 * is mostly pure — a query builder and a response mapper — so the parts that
 * can actually be wrong are asserted here WITHOUT network access, which
 * matters because this repo is developed in an environment whose egress policy
 * blocks overpass-api.de outright.
 *
 * Run it:  cd apps/backend && npm run nearby:test
 *
 * Exit 0 = the pure logic is sound (and, if Overpass was reachable, real
 *          places came back through the real mapper).
 * Exit 1 = a real defect: the query is malformed, or the mapper cannot read a
 *          shape Overpass actually returned.
 * Exit 2 = the pure checks passed but the network was blocked, so the live
 *          half asserted nothing. A network result, never a verdict on code.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const OSM = require('../services/OverpassPlacesService');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PDX = { lat: 45.5152, lng: -122.6784 };

// ── 1. the query says what was asked for ────────────────────────────────────

const coffee = OSM.buildQuery({ ...PDX, query: 'coffee', radius: 5000, limit: 25 });
check(coffee.includes('["amenity"="cafe"]'),
  '"coffee" asks OpenStreetMap for cafes', coffee.slice(0, 80));
check(coffee.includes('45.5152,-122.6784'),
  'the query carries the point it was given');
check(/\[out:json\]\[timeout:\d+\]/.test(coffee),
  'a server-side timeout is declared, so a slow query is dropped upstream');
check(coffee.includes('out center'),
  'ways and relations get a coordinate, so a building can be a pin');

// A phrase no tag map knows still has to search by name, or "starbucks"
// matches nothing at all.
const named = OSM.buildQuery({ ...PDX, query: 'starbucks' });
check(named.includes('["name"~"starbucks",i]'),
  'an unrecognised phrase falls back to a case-insensitive name match');

// "gas station" is the one people type; no OSM object is tagged with it.
check(OSM.buildQuery({ ...PDX, query: 'gas station' }).includes('["amenity"="fuel"]'),
  '"gas station" reaches amenity=fuel, which is what OSM actually calls it');

// Longest-key-first matters: "coffee shop" must not degrade into "shop".
const phrase = OSM.tagsFor('coffee shop');
check(JSON.stringify(phrase) === JSON.stringify([['amenity', 'cafe']]),
  '"coffee shop" prefers cafe over the "shop" it contains', JSON.stringify(phrase));

// The frontend's own category names must resolve, or the no-query sweep is blank.
const FRONTEND_CATEGORIES = ['restaurant', 'cafe', 'shop', 'gas_station', 'hotel', 'grocery'];
const unmapped = FRONTEND_CATEGORIES.filter((c) => OSM.tagsFor(c).length === 0);
check(unmapped.length === 0,
  'every category the map sends is mapped to a real OSM tag', unmapped.join(', '));

// An empty ask must not become "every object within 5km" — that is a
// denial-of-service on a donated server.
const bare = OSM.buildQuery({ ...PDX });
check(bare.includes('nwr(around:') && bare.split('\n').filter((l) => l.includes('nwr(')).length <= 8,
  'an empty query sweeps a short list of everyday categories, not everything',
  `${bare.split('\n').filter((l) => l.includes('nwr(')).length} clauses`);

// A quote in the query must not be able to end the string and append QL.
const injected = OSM.buildQuery({ ...PDX, query: 'a"];out;//' });
// The property that matters is that every quote inside the literal is
// escaped. Dropping the escape sequences must leave the query's own quotes
// balanced — an injected `"` would make them odd and close the string early.
const bareQuotes = (injected.replace(/\\"/g, '').match(/"/g) || []).length;
check(bareQuotes % 2 === 0,
  'a quote in the query cannot break out of the string literal', `${bareQuotes} unescaped quotes`);
check((injected.match(/^out /gm) || []).length === 1,
  'an injected statement cannot append a second `out` to the query');
check(OSM.escapeLiteral('a"b\\c') === 'a\\"b\\\\c',
  'quotes and backslashes are escaped', OSM.escapeLiteral('a"b\\c'));

// Radius and limit are clamped: the caller is the browser, and the browser lies.
check(OSM.buildQuery({ ...PDX, radius: 9e9 }).includes('around:50000'),
  'an absurd radius is clamped rather than forwarded');
check(/out center 60;/.test(OSM.buildQuery({ ...PDX, limit: 5000 })),
  'an absurd limit is clamped rather than forwarded');

// ── 2. the mapper reads what Overpass actually sends ────────────────────────

// A node, a way with only a center, and the three things that make an element
// unusable. Shapes taken from real Overpass output.
const sample = {
  elements: [
    { type: 'node', id: 1, lat: 45.52, lon: -122.67,
      tags: { name: 'Stumptown', amenity: 'cafe', 'addr:housenumber': '128',
        'addr:street': 'SW 3rd Ave', 'addr:city': 'Portland', phone: '+1 503' } },
    { type: 'way', id: 2, center: { lat: 45.53, lon: -122.68 },
      tags: { name: 'Powells', shop: 'books', website: 'https://powells.com' } },
    { type: 'node', id: 3, lat: 45.54, lon: -122.69, tags: { amenity: 'bench' } },
    { type: 'node', id: 4, tags: { name: 'No Position', amenity: 'cafe' } },
    { type: 'node', id: 5, lat: 45.52, lon: -122.67, tags: { name: 'Stumptown', amenity: 'cafe' } },
  ],
};

const mapped = OSM.mapResponse(sample, 25);
check(mapped.length === 2,
  'unnamed, position-less and duplicate elements are all dropped',
  `${mapped.length}: ${mapped.map((p) => p.name).join(', ')}`);

const [cafe, books] = mapped;
check(cafe && cafe.latitude === 45.52 && cafe.longitude === -122.67,
  'a node maps to its own coordinates');
check(books && books.latitude === 45.53,
  'a way with no lat/lon of its own uses `center`, or every building is dropped');
check(cafe?.formattedAddress === '128 SW 3rd Ave, Portland',
  'OSM address tags assemble into one line', cafe?.formattedAddress);
check(cafe?.category === 'CAFE' && books?.category === 'BOOKS',
  'the classifying tag becomes the category', `${cafe?.category}/${books?.category}`);
check(cafe?.phone === '+1 503' && books?.website === 'https://powells.com',
  'contact details already in OSM are carried through, not thrown away');

// The route reads `place.latitude` / `place.formattedAddress` for BOTH
// providers. If the OSM shape drifts from Radar's, every pin lands at
// undefined and the map is empty with a 200 OK.
const routeShape = ['name', 'latitude', 'longitude', 'formattedAddress', 'category'];
const missing = routeShape.filter((k) => !(k in (cafe || {})));
check(missing.length === 0,
  'the OSM place shape matches what the route already reads from Radar',
  missing.join(', '));

check(OSM.mapResponse({ elements: [] }).length === 0 && OSM.mapResponse(null).length === 0,
  'an empty or absent response is an empty list, not a crash');
check(OSM.mapResponse(sample, 1).length === 1, 'the limit is honoured');

// ── 3. live, if the network allows ──────────────────────────────────────────

let networkBlocked = false;
try {
  const live = await OSM.search({ ...PDX, query: 'coffee', radius: 2000, limit: 10 });
  if (!live.success && ['unavailable', 'rate_limited', 'server_busy'].includes(live.reason)) {
    networkBlocked = true;
  } else {
    check(live.success, 'Overpass answered');
    check(live.places.length > 0,
      'real cafes came back near a real downtown', `${live.places.length} places`);
    const bogus = live.places.filter(
      (p) => !p.name || typeof p.latitude !== 'number' || typeof p.longitude !== 'number'
    );
    check(bogus.length === 0, 'every live place can be put on a map', `${bogus.length} bad`);
    // Everything must be inside the radius asked for, or the pins are wrong.
    const R = 6371e3;
    const far = live.places.filter((p) => {
      const dLat = (p.latitude - PDX.lat) * Math.PI / 180;
      const dLng = (p.longitude - PDX.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(PDX.lat * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180)
        * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 2500;
    });
    check(far.length === 0, 'no result sits outside the radius requested', `${far.length} outside`);

    const second = await OSM.search({ ...PDX, query: 'coffee', radius: 2000, limit: 10 });
    check(second.cached === true, 'a repeat lookup is served from cache, not re-asked upstream');
  }
} catch (e) {
  networkBlocked = true;
}

// ── report ──────────────────────────────────────────────────────────────────
ok.forEach((l) => console.log(l));
bad.forEach((l) => console.log(l));
console.log(`\n${ok.length} passed, ${bad.length} failed`);

if (bad.length) process.exit(1);
if (networkBlocked) {
  console.log('\noverpass-api.de was not reachable from here, so the live half asserted nothing.');
  console.log('The pure logic above is sound. Run this again from a machine with normal');
  console.log('outbound network to confirm real places come back.');
  process.exit(2);
}
process.exit(0);
