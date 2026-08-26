/* "Walmart" must mean the nearest one, not the most famous one.
 *
 * THE REPORTED BUG, used as the fixture. Searching the map for a brand name
 * returned whichever branch a global geocoder ranks highest — the same result
 * for every user in the country. Two causes, and BOTH had to go:
 *
 *   1. The nearby search was pinned at a 5 km radius. That is a city
 *      assumption. In Cottage Grove the nearest Walmart is tens of kilometres
 *      out, so the nearby search found nothing at all.
 *   2. Finding nothing fell through to a plain geocode that DISCARDED the
 *      user's position, so the only ranking left was global prominence.
 *
 * The asymmetry that shapes the fix: a hint must never become a filter. A
 * rural user searching for something genuinely far away has to still get it,
 * so `near` reorders results and never removes them. The tests below pin both
 * directions — that the near thing wins, and that the far thing still arrives.
 *
 * Run it:  npm run mapsearch:test
 */
import { searchMapQuery } from '../src/components/map/utils/mapSearch.js';
import MapApiService from '../src/components/map/services/mapApi.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

// Cottage Grove, Oregon — the reporting user's town, and rural enough that the
// old 5 km ring genuinely could not reach a Walmart.
const HOME = { lat: 43.7976, lng: -123.0592 };
const EUGENE_WALMART = { lat: 44.0521, lng: -123.0868 };   // ~28 km north
const FLORIDA_WALMART = { lat: 30.4383, lng: -84.2807 };   // the prominent one

/** Install a stub and record every call the search makes. */
function harness({ places = () => [], geocodes = () => [] } = {}) {
  // The service memoises every lookup for five minutes and is a module
  // singleton, so without this each block after the first would silently
  // assert against the PREVIOUS block's cached answer and make no request at
  // all. That is not a quirk of the test: it is the same cache production
  // uses, and it hid four real failures on the first run.
  MapApiService.clearCache();
  const calls = [];
  globalThis.__mapTestAxios = ({ method, url, body, params }) => {
    calls.push({ url, body, params });
    if (method === 'post' && url.includes('/api/maps/places')) {
      return { data: { success: true, data: places(body) } };
    }
    if (method === 'post' && (url.includes('/api/maps/geocode') || url.includes('/api/radar/geocode'))) {
      return { data: { success: true, data: geocodes(body) } };
    }
    // Nominatim serves BOTH roles — places and geocode — and `bounded` is the
    // only thing that tells them apart (searchPlacesWithNominatim bounds its
    // box, geocodeWithOSM deliberately does not). Serving the geocode fixture
    // to both made the keyless floor answer the nearby ring, so the ladder
    // never reached the rung under test.
    if (method === 'get' && url.includes('nominatim')) {
      return { data: params?.bounded === 1 ? places({ options: params }) : geocodes({ query: params?.q, params }) };
    }
    // Anything else (radar places, tomtom) answers empty so the ladder walks on.
    return { data: { success: true, data: [] } };
  };
  return calls;
}

const place = (name, position, extra = {}) => ({ name, position, address: name, ...extra });

// ── 1. The radius ladder climbs until something answers ────────────────────
{
  const calls = harness({
    // Nothing within 25 km; the Eugene store appears once the ring reaches it.
    places: (body) => (body?.options?.radius >= 80000 ? [place('Walmart Supercenter', EUGENE_WALMART)] : []),
  });
  const { rows, kind } = await searchMapQuery('Walmart', { near: HOME });
  const radii = calls.filter((c) => c.url.includes('/api/maps/places'))
    .map((c) => c.body?.options?.radius);

  ok('the ring widens rather than giving up at 5 km',
    radii.includes(5000) && radii.includes(25000) && radii.includes(80000),
    radii.join(' → '));
  ok('the rural store is found', rows[0]?.name === 'Walmart Supercenter', rows[0]?.name);
  ok('…as a nearby hit, not a global geocode', kind === 'nearby-name', kind);
}

// ── 2. A city keeps its tight first ring ───────────────────────────────────
// Widening for everyone would rank three suburbs above the shop on the corner.
{
  const calls = harness({ places: () => [place('Corner Cafe', { lat: 43.7980, lng: -123.0590 })] });
  await searchMapQuery('coffee', { near: HOME });
  const radii = calls.filter((c) => c.url.includes('/api/maps/places'))
    .map((c) => c.body?.options?.radius);
  ok('the ladder stops at the first ring that answers', radii.length === 1 && radii[0] === 5000,
    radii.join(' → '));
}

// ── 3. The geocode fallback carries the position ───────────────────────────
// This is the rung that produced the bug: it used to throw `near` away.
{
  const calls = harness({
    places: () => [],                                     // every ring empty
    geocodes: () => [place('Walmart', FLORIDA_WALMART)],
  });
  const { rows } = await searchMapQuery('Walmart', { near: HOME });
  const geo = calls.find((c) => c.url.includes('/api/maps/geocode'));
  ok('the last rung still sends the user position',
    !!geo?.body?.near && geo.body.near.lat === HOME.lat,
    JSON.stringify(geo?.body?.near));
  ok('…and a far result is still returned rather than filtered away',
    rows.length === 1 && rows[0].name === 'Walmart', `${rows.length} rows`);
  ok('…with its distance worked out for the row', typeof rows[0].distance === 'number',
    String(rows[0]?.distance));
}

// ── 4. Nearest first ───────────────────────────────────────────────────────
// A geocoder returns no distances, so without an explicit sort the list stays
// in the provider's order — which is prominence, the very thing being fixed.
{
  harness({
    places: () => [],
    geocodes: () => [
      place('Walmart Tallahassee', FLORIDA_WALMART),
      place('Walmart Eugene', EUGENE_WALMART),
    ],
  });
  const { rows } = await searchMapQuery('Walmart', { near: HOME });
  ok('the closer store is first even when the provider listed it second',
    rows[0]?.name === 'Walmart Eugene', rows.map((r) => r.name).join(' , '));
  ok('…and the far one is kept, not dropped', rows.length === 2, `${rows.length} rows`);
}

// ── 5. With no position, nothing changes ───────────────────────────────────
// Not every visitor grants location, and the search has to keep working.
{
  const calls = harness({ geocodes: () => [place('Walmart', FLORIDA_WALMART)] });
  const { rows } = await searchMapQuery('Walmart', { near: null });
  const geo = calls.find((c) => c.url.includes('/api/maps/geocode'));
  ok('no position means no proximity hint is sent', !geo?.body?.near,
    JSON.stringify(geo?.body?.near ?? null));
  ok('…and the search still answers', rows.length === 1 && rows[0].name === 'Walmart');
  ok('…and no nearby ring is attempted at all',
    !calls.some((c) => c.url.includes('/api/maps/places')));
}

// ── 6. Addresses are biased too ────────────────────────────────────────────
// "123 Main St" exists in thousands of towns; the geocoder needs the hint.
{
  const calls = harness({ geocodes: () => [place('123 Main St', EUGENE_WALMART)] });
  const { kind } = await searchMapQuery('123 Main St', { near: HOME });
  const geo = calls.find((c) => c.url.includes('/api/maps/geocode'));
  ok('an address search sends the position', !!geo?.body?.near, JSON.stringify(geo?.body?.near));
  ok('…and is still treated as an address', kind === 'address', kind);
}

// ── 7. The keyless floor gets the hint in its own dialect ──────────────────
// Nominatim has no `proximity`; its equivalent is a viewbox. For a GEOCODE it
// must NOT be bounded — bounded turns the hint into a hard filter, and a
// rural user searching for something genuinely far away would get nothing.
{
  const seen = [];
  globalThis.__mapTestAxios = ({ method, url, params }) => {
    if (method === 'get' && url.includes('nominatim')) {
      seen.push(params);
      // The nearby rings find nothing, so the ladder walks on to the geocode.
      return { data: params?.bounded === 1 ? [] : [{ display_name: 'Walmart', lat: '44.05', lon: '-123.08' }] };
    }
    // Every keyed provider is unconfigured, which is what puts the keyless
    // floor in play at all.
    if (method === 'post') return { data: { success: false, message: 'no key' } };
    return { data: [] };
  };
  MapApiService.clearCache();
  await searchMapQuery('Walmart', { near: HOME });

  // Identified by ORDER, not by the value being asserted: the bounded place
  // rings are always attempted before the geocode rung.
  const geocodeCall = seen[seen.length - 1];
  ok('the geocode is given a viewbox', !!geocodeCall?.viewbox, geocodeCall?.viewbox);
  ok('…and it is NOT bounded, so a far match still returns',
    !geocodeCall?.bounded, String(geocodeCall?.bounded));
  ok('…while the nearby ring before it WAS bounded, as it should be',
    seen.length > 1 && seen[0]?.bounded === 1, `${seen.length} calls, first bounded=${seen[0]?.bounded}`);
}

// ── 8. An empty query asks nothing at all ──────────────────────────────────
{
  const calls = harness();
  const { rows, kind } = await searchMapQuery('   ', { near: HOME });
  ok('whitespace is not a search', kind === 'empty' && rows.length === 0 && calls.length === 0);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
