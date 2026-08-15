import { useCallback, useEffect, useRef, useState } from 'react';
import MapApiService from '../services/mapApi';
import { GEOLOCATION_OPTIONS } from '../config/constants';

// Live GPS navigation: follow the road you are actually on.
//
// A route is a static line. Navigation is that line plus a moving dot plus the
// judgement to notice you have left it. This hook owns the third part.
//
// ── HOW IT DECIDES YOU HAVE GONE WRONG ──────────────────────────────────────
//
// Every fix is projected onto the route polyline and the perpendicular distance
// is measured. One bad reading is not a wrong turn — GPS routinely jumps a
// hundred metres in a street canyon or under trees — so a re-route needs
// OFF_ROUTE_M exceeded on OFF_ROUTE_STRIKES consecutive fixes. Re-routing on a
// single spike is how a navigator ends up recalculating at every traffic light.
//
// A `position.coords.accuracy` worse than the off-route threshold is ignored
// for that decision entirely: a fix that admits it could be 150m out cannot
// prove you are 60m off the line.
//
// ── AND WHAT IT NEVER DOES ──────────────────────────────────────────────────
//
// No position is sent anywhere. Re-routing asks the routing provider for a line
// between two points, which is the same request the directions panel already
// makes; nothing is logged, stored or associated with a person. watchPosition
// is released the moment navigation stops, because a live GPS watch left
// running is a battery drain and a privacy problem at the same time.

const OFF_ROUTE_M = 55;          // roughly a wide junction; tighter re-routes constantly
const OFF_ROUTE_STRIKES = 3;     // consecutive bad fixes before believing them
const ARRIVED_M = 30;            // close enough to the destination to be there
const REROUTE_COOLDOWN_MS = 15000;

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

/** Metres between two points. Haversine — the map's own distances use it too. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Shortest distance from a point to a line SEGMENT, in metres.
 *
 * Distance to the nearer endpoint is not the same thing and is badly wrong on
 * long straight stretches: halfway along a 2km motorway segment you are a
 * kilometre from both ends while sitting exactly on the road. The segment is
 * projected in a local flat frame, which is accurate well past the scale of
 * anything a single route segment covers.
 */
export function distanceToSegment(p, a, b) {
  const latRef = rad((a.lat + b.lat) / 2);
  const x = (q) => rad(q.lng) * Math.cos(latRef) * R;
  const y = (q) => rad(q.lat) * R;

  const px = x(p); const py = y(p);
  const ax = x(a); const ay = y(a);
  const bx = x(b); const by = y(b);

  const dx = bx - ax; const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  // Clamped, so the projection cannot land beyond the segment's ends.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance from a point to the whole polyline: the nearest segment wins. */
export function distanceToRoute(point, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [aLng, aLat] = coordinates[i];
    const [bLng, bLat] = coordinates[i + 1];
    const d = distanceToSegment(point, { lat: aLat, lng: aLng }, { lat: bLat, lng: bLng });
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

/**
 * @param {object}   opts
 * @param {object}   opts.route        normalised route ({ geometry, distance, duration })
 * @param {object}   opts.destination  { lat, lng }
 * @param {string}   opts.profile      routing profile for re-routes
 * @param {function} opts.onReroute    called with the new normalised route
 * @param {object}   opts.geolocation  injectable navigator.geolocation, for tests
 */
export function useLiveNavigation({ route, destination, profile = 'driving', onReroute, geolocation } = {}) {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState(null);   // { lat, lng, heading, speed, accuracy }
  const [offRoute, setOffRoute] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState('');
  const [rerouting, setRerouting] = useState(false);

  const watchId = useRef(null);
  const strikes = useRef(0);
  const lastReroute = useRef(0);
  // Read inside the watch callback, which is registered once — reading the
  // state variable there would pin the route it had at subscribe time and
  // measure every later fix against a route that has since been replaced.
  const routeRef = useRef(route);
  const destRef = useRef(destination);
  useEffect(() => { routeRef.current = route; }, [route]);
  useEffect(() => { destRef.current = destination; }, [destination]);

  const geo = geolocation || (typeof navigator !== 'undefined' ? navigator.geolocation : null);

  const reroute = useCallback(async (from) => {
    const dest = destRef.current;
    if (!dest || Date.now() - lastReroute.current < REROUTE_COOLDOWN_MS) return;
    lastReroute.current = Date.now();
    setRerouting(true);
    try {
      const result = await MapApiService.getDirections(from, dest, { profile });
      if (result?.data?.geometry) {
        routeRef.current = result.data;
        strikes.current = 0;
        setOffRoute(false);
        onReroute?.(result.data);
      }
    } catch {
      // Keep the old line on screen. A failed re-route is a worse position to
      // be in than a stale route, and blanking the map mid-drive is the one
      // thing navigation must never do.
      setError('Could not find a new route. Still showing the last one.');
    } finally {
      setRerouting(false);
    }
  }, [profile, onReroute]);

  const onFix = useCallback((fix) => {
    const here = {
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      heading: Number.isFinite(fix.coords.heading) ? fix.coords.heading : null,
      speed: Number.isFinite(fix.coords.speed) ? fix.coords.speed : null,
      accuracy: fix.coords.accuracy,
    };
    setPosition(here);
    setError('');

    const dest = destRef.current;
    if (dest && haversine(here, dest) <= ARRIVED_M) {
      setArrived(true);
      setOffRoute(false);
      return;
    }

    const coords = routeRef.current?.geometry?.coordinates;
    if (!coords) return;

    // A fix that admits it could be further out than the threshold cannot
    // prove anything about being off the line.
    if (here.accuracy != null && here.accuracy > OFF_ROUTE_M) return;

    if (distanceToRoute(here, coords) > OFF_ROUTE_M) {
      strikes.current += 1;
      if (strikes.current >= OFF_ROUTE_STRIKES) {
        setOffRoute(true);
        reroute(here);
      }
    } else {
      strikes.current = 0;
      setOffRoute(false);
    }
  }, [reroute]);

  const stop = useCallback(() => {
    if (watchId.current != null && geo) geo.clearWatch(watchId.current);
    watchId.current = null;
    strikes.current = 0;
    setActive(false);
    setOffRoute(false);
    setRerouting(false);
  }, [geo]);

  const start = useCallback(() => {
    if (!geo) { setError('This browser cannot report your location.'); return; }
    if (watchId.current != null) return;
    setArrived(false);
    setError('');
    strikes.current = 0;
    setActive(true);
    watchId.current = geo.watchPosition(
      onFix,
      (e) => {
        // A timeout is one bad fix, not the end of the drive — the next one may
        // land. Only a refusal is worth stopping for.
        if (e.code === 1) { setError('Location permission is off, so navigation cannot follow you.'); stop(); return; }
        setError('Waiting for a GPS signal…');
      },
      { ...GEOLOCATION_OPTIONS, maximumAge: 0 },   // navigation needs fresh fixes, never cached ones
    );
  }, [geo, onFix, stop]);

  // Release the watch on unmount. A GPS watch that outlives its panel drains
  // the battery of somebody who thinks they closed the map.
  useEffect(() => stop, [stop]);

  return { active, position, offRoute, arrived, rerouting, error, start, stop };
}

export default useLiveNavigation;
