/* Live GPS navigation: the geometry, and the judgement built on it.
 *
 * The geometry is the part that is easy to get quietly wrong. "Am I still on
 * the route" is not "how far am I from the nearest shape point" — halfway along
 * a 2km motorway segment you are a kilometre from both endpoints while sitting
 * exactly on the road, so a nearest-point check would re-route you off a
 * straight motorway. It has to be distance to the SEGMENT.
 *
 * The judgement matters just as much: GPS jumps. A navigator that re-routes on
 * one bad fix recalculates at every traffic light, and one that trusts a fix
 * reporting ±150m accuracy will believe a phone that has no idea where it is.
 *
 * Pure functions and a fake geolocation — no browser, no network, no GPS.
 *
 * Run it:  npm run nav:test
 */
const calls = [];
let handler = () => { throw new Error('no handler set'); };
globalThis.__mapTestAxios = (call) => { calls.push(call); return handler(call); };

const { distanceToSegment, distanceToRoute, haversine } = await import('../src/components/map/hooks/useLiveNavigation.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── 1. haversine against a known distance ───────────────────────────────────
// One degree of latitude is ~111.19km anywhere on Earth.
check(near(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111195, 200),
  'a degree of latitude measures ~111.2km', `${Math.round(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))} m`);
// A degree of longitude shrinks with the cosine of the latitude: ~half at 60°.
check(near(haversine({ lat: 60, lng: 0 }, { lat: 60, lng: 1 }), 55597, 300),
  '…and a degree of longitude halves by 60° north',
  `${Math.round(haversine({ lat: 60, lng: 0 }, { lat: 60, lng: 1 }))} m`);

// ── 2. distance to a SEGMENT, not to its ends ───────────────────────────────
// A 2km east-west segment. Stand on it, 1km from either end, 20m to the north.
const a = { lat: 51.5000, lng: -0.1000 };
const b = { lat: 51.5000, lng: -0.0712 };            // ~2km east
const onRoad = { lat: 51.50018, lng: -0.0856 };      // ~20m north of the middle
const dSeg = distanceToSegment(onRoad, a, b);
check(near(dSeg, 20, 6), 'a point beside the middle of a segment measures its true offset', `${dSeg.toFixed(1)} m`);
const dEnd = Math.min(haversine(onRoad, a), haversine(onRoad, b));
check(dEnd > 900, '…where nearest-endpoint would have called the same point a kilometre off the route',
  `endpoint distance ${Math.round(dEnd)} m`);

// ── 3. past the end of a segment, the end is the answer ─────────────────────
// The projection is clamped, so a point beyond the segment cannot report a
// distance to an imaginary extension of the road.
const beyond = { lat: 51.5000, lng: -0.0612 };       // ~700m past b
check(near(distanceToSegment(beyond, a, b), haversine(beyond, b), 5),
  'a point past the end measures to the end, not to the line extended',
  `${distanceToSegment(beyond, a, b).toFixed(0)} m vs ${haversine(beyond, b).toFixed(0)} m`);

// ── 4. the polyline takes the nearest segment ───────────────────────────────
// An L-shaped route. A point near the corner of the second leg must not be
// judged against the first.
const route = [[-0.1000, 51.5000], [-0.0712, 51.5000], [-0.0712, 51.5200]];
check(near(distanceToRoute({ lat: 51.5100, lng: -0.0710 }, route), 14, 10),
  'a point beside the second leg is measured against the second leg',
  `${distanceToRoute({ lat: 51.5100, lng: -0.0710 }, route).toFixed(1)} m`);
check(distanceToRoute({ lat: 51.5000, lng: -0.0856 }, route) < 5,
  'a point on the line reads as on the line');
check(distanceToRoute({ lat: 51.4000, lng: -0.0856 }, route) > 10000,
  'a point 11km away reads as far off',
  `${Math.round(distanceToRoute({ lat: 51.4000, lng: -0.0856 }, route))} m`);
check(distanceToRoute({ lat: 51.5, lng: -0.08 }, [[-0.1, 51.5]]) === Infinity,
  'a route with one point is not a line to measure against');

// ── 5. the hook: strikes, accuracy and re-routing ───────────────────────────
// React is not available here, so the decision logic is replayed with the same
// constants and the same order of checks the hook uses. What is being pinned is
// the POLICY — one spike is not a wrong turn, a vague fix proves nothing — not
// React's plumbing, which the browser tests cover.
const OFF_ROUTE_M = 55; const OFF_ROUTE_STRIKES = 3;
function replay(fixes, coords) {
  let strikes = 0; let reroutes = 0;
  for (const f of fixes) {
    if (f.accuracy != null && f.accuracy > OFF_ROUTE_M) continue;
    if (distanceToRoute(f, coords) > OFF_ROUTE_M) {
      strikes += 1;
      if (strikes >= OFF_ROUTE_STRIKES) { reroutes += 1; strikes = 0; }
    } else {
      strikes = 0;
    }
  }
  return reroutes;
}

const online = { lat: 51.5000, lng: -0.0856, accuracy: 8 };
const wayOff = { lat: 51.5060, lng: -0.0856, accuracy: 8 };   // ~660m north

check(replay([online, wayOff, online, wayOff, online], route) === 0,
  'a single GPS spike does not trigger a re-route');
check(replay([wayOff, wayOff, wayOff], route) === 1,
  'three consecutive fixes off the line do');
check(replay([wayOff, wayOff, online, wayOff, wayOff], route) === 0,
  '…and the count resets the moment you are back on it');

// A fix that admits it could be 150m out cannot prove you are 60m off.
check(replay([{ ...wayOff, accuracy: 150 }, { ...wayOff, accuracy: 150 }, { ...wayOff, accuracy: 150 }], route) === 0,
  'fixes too vague to prove anything are not counted against you');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
