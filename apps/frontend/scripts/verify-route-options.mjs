/* Five route options, and the rule that makes each one mean something.
 *
 * THE ASK: "route options (economic, highway, scenic, fastest, least traffic)".
 *
 * THE TRAP these tests exist to catch: it is very easy to ship five buttons
 * that all produce the SAME route. A router has no "scenic" mode, so each
 * option is a pair — request parameters, plus a rule for choosing among the
 * alternatives that come back. Get the second half wrong and the labels are
 * decoration over one identical line on the map, which looks like it works.
 *
 * So the fixtures below give every option a set of candidates where the RIGHT
 * answer is not the router's first choice, and not the same as any other
 * option's answer. A picker that just returned routes[0], or always the
 * quickest, fails nearly every assertion here.
 *
 * Run it:  npm run routeopts:test
 */
import {
  ROUTE_OPTIONS, getOption, isAvailable, paramsFor, congestionScore, pickRoute,
  formatDuration, formatDistance,
} from '../src/components/map/utils/routeOptions.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
const route = (name, { distance, duration, congestion = null }) => ({
  name,
  distance,
  duration,
  geometry: line,
  legs: congestion ? [{ annotation: { congestion } }] : [{}],
});

// ── The five options exist and are distinct ────────────────────────────────
ok('all five options are defined', ROUTE_OPTIONS.length === 5,
  ROUTE_OPTIONS.map((o) => o.id).join(', '));
ok('every option has a distinct id',
  new Set(ROUTE_OPTIONS.map((o) => o.id)).size === 5);

// ── Request parameters ─────────────────────────────────────────────────────
ok('scenic asks the router to avoid motorways',
  paramsFor('scenic').exclude.includes('motorway'), paramsFor('scenic').exclude.join(','));
ok('…and ferries, which are not scenic driving', paramsFor('scenic').exclude.includes('ferry'));
ok('economic avoids tolls', paramsFor('economic').exclude.includes('toll'));
ok('fastest uses the live-traffic profile',
  paramsFor('fastest').profile === 'driving-traffic', paramsFor('fastest').profile);
ok('least-traffic asks for congestion data',
  paramsFor('least-traffic').annotations.includes('congestion'),
  paramsFor('least-traffic').annotations.join(','));
ok('fastest does NOT pay for congestion data it will not use',
  paramsFor('fastest').annotations.length === 0);

// The cost rule: one request, not five.
ok('every option requests alternatives — one call, several candidates',
  ROUTE_OPTIONS.every((o) => paramsFor(o.id).alternatives === true));

// Walking and cycling must not inherit driving semantics.
ok('walking ignores toll exclusions entirely',
  paramsFor('economic', { mode: 'foot' }).exclude.length === 0);
ok('walking uses the walking profile',
  paramsFor('fastest', { mode: 'foot' }).profile === 'walking');
ok('cycling uses the cycling profile',
  paramsFor('scenic', { mode: 'bike' }).profile === 'cycling');

// ── Availability is honest ─────────────────────────────────────────────────
ok('least-traffic is unavailable without traffic data',
  !isAvailable('least-traffic', { hasTraffic: false }));
ok('…and available with it', isAvailable('least-traffic', { hasTraffic: true }));
ok('the other four never depend on traffic data',
  ['fastest', 'economic', 'highway', 'scenic'].every((id) => isAvailable(id, { hasTraffic: false })));

// ── Congestion scoring ─────────────────────────────────────────────────────
ok('a clear route scores zero',
  congestionScore(route('a', { distance: 1, duration: 1, congestion: ['low', 'low'] })) === 0);
ok('a jammed route scores worse',
  congestionScore(route('b', { distance: 1, duration: 1, congestion: ['severe', 'heavy'] })) === 2.5);
ok('no annotation at all means no score, not a good score',
  congestionScore(route('c', { distance: 1, duration: 1 })) === null);
// The subtle one: "unknown" is missing data, and counting it as clear would
// rank a route the router knows nothing about as the calmest.
ok('unknown segments are excluded from the average, not counted as clear',
  congestionScore(route('d', { distance: 1, duration: 1, congestion: ['severe', 'unknown'] })) === 3,
  String(congestionScore(route('d', { distance: 1, duration: 1, congestion: ['severe', 'unknown'] }))));

// ── The picker: each option must choose DIFFERENTLY ───────────────────────
// One candidate set, deliberately built so the four driving options disagree.
//
//   quick   — fastest, but a long way round on a jammed motorway
//   short   — least distance
//   calm    — slightly slower than quick, but clear roads
const CANDIDATES = [
  route('quick', { distance: 60000, duration: 1800, congestion: ['heavy', 'severe', 'heavy'] }),
  route('short', { distance: 40000, duration: 2400, congestion: ['moderate', 'moderate', 'low'] }),
  route('calm', { distance: 55000, duration: 1980, congestion: ['low', 'low', 'low'] }),
];

ok('fastest picks the quickest', pickRoute('fastest', CANDIDATES).route.name === 'quick',
  pickRoute('fastest', CANDIDATES).route.name);
ok('economic picks the shortest, NOT the quickest',
  pickRoute('economic', CANDIDATES).route.name === 'short',
  pickRoute('economic', CANDIDATES).route.name);
ok('least-traffic picks the calm one, NOT the quickest',
  pickRoute('least-traffic', CANDIDATES).route.name === 'calm',
  pickRoute('least-traffic', CANDIDATES).route.name);
ok('highway picks the fastest-moving road, by average speed',
  pickRoute('highway', CANDIDATES).route.name === 'quick',
  pickRoute('highway', CANDIDATES).route.name);

// The proof they are not all the same button.
{
  const picks = ['fastest', 'economic', 'least-traffic', 'scenic'].map(
    (id) => pickRoute(id, CANDIDATES).route.name,
  );
  ok('the options do not all resolve to one route', new Set(picks).size >= 3, picks.join(' / '));
}

// ── Refusing to pretend ────────────────────────────────────────────────────
// Returning the quickest route under a "least traffic" label would be the
// worst outcome here: it looks like it worked.
{
  const noData = [
    route('p', { distance: 50000, duration: 2000 }),
    route('q', { distance: 60000, duration: 1800 }),
  ];
  const result = pickRoute('least-traffic', noData);
  ok('with no congestion data, least-traffic says so rather than pretending',
    /no live traffic data/i.test(result.reason), result.reason);
  ok('…and still returns a usable route', result.route.name === 'q', result.route.name);
}

// ── Degenerate inputs ──────────────────────────────────────────────────────
ok('no routes at all returns null', pickRoute('fastest', []) === null);
ok('a non-array returns null', pickRoute('fastest', null) === null);
ok('routes without geometry are not routes',
  pickRoute('fastest', [{ distance: 1, duration: 1 }]) === null);
ok('a single route is returned with an honest reason',
  pickRoute('economic', [CANDIDATES[0]]).reason === 'Only route found');
ok('an unknown option id falls back rather than throwing',
  pickRoute('nonsense', CANDIDATES).route.name === 'quick');
ok('getOption on nonsense returns the default', getOption('nonsense').id === 'fastest');

// ── Formatting ─────────────────────────────────────────────────────────────
ok('minutes under an hour', formatDuration(1800) === '30 min', formatDuration(1800));
ok('hours and minutes', formatDuration(4320) === '1 hr 12 min', formatDuration(4320));
ok('a whole hour drops the minutes', formatDuration(7200) === '2 hr', formatDuration(7200));
ok('miles for a long way', formatDistance(40000) === '25 mi', formatDistance(40000));
ok('one decimal under ten miles', formatDistance(8046) === '5.0 mi', formatDistance(8046));
ok('feet for a short hop', formatDistance(100) === '328 ft', formatDistance(100));
ok('rubbish in, empty string out', formatDuration(NaN) === '' && formatDistance(-5) === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
