/* Five ways of asking for the same journey.
 *
 * "Route options (economic, highway, scenic, fastest, least traffic)" — the
 * ask. What follows is the translation from those five words into parameters a
 * router actually understands, plus the rule for choosing between the routes it
 * sends back.
 *
 * WHY BOTH HALVES ARE NEEDED. A router has no "scenic" flag. What it has is
 * `exclude` and `alternatives`: ask it to avoid motorways and to return up to
 * three candidates, then pick the candidate that best fits what was asked. Two
 * options can send identical parameters and still differ entirely in which
 * route they choose — "fastest" and "least traffic" both request live traffic,
 * and then disagree about what to do with it.
 *
 * COST. `alternatives=true` is still ONE request against the Directions API's
 * 100,000/month free tier — the alternatives ride along in the same response.
 * Five options therefore cost exactly what one option cost. Do not "optimise"
 * this by firing a request per option; that turns one call into five.
 *
 * HONESTY ABOUT WHAT WE KNOW. Congestion data only exists on the
 * driving-traffic profile, which needs a Mapbox key. On the keyless OSRM floor
 * there is no traffic data at all, so "least traffic" cannot mean anything —
 * `isAvailable` says so, and the UI is expected to disable the option rather
 * than quietly return the fastest route under a label promising something else.
 */

/** How bad each congestion class is. Lower total is a calmer route. */
const CONGESTION_WEIGHT = {
  low: 0,
  moderate: 1,
  heavy: 2,
  severe: 3,
  // Not "no congestion" — genuinely no data. Scoring it as clear would make a
  // route the router knows nothing about look like the best one.
  unknown: null,
};

export const ROUTE_OPTIONS = [
  {
    id: 'fastest',
    label: 'Fastest',
    hint: 'Shortest time, using live traffic',
    // driving-traffic is the profile that folds current speeds into the
    // estimate. Without it "fastest" means fastest on an empty road.
    profile: 'driving-traffic',
    exclude: [],
    needs: null,
  },
  {
    id: 'least-traffic',
    label: 'Least traffic',
    hint: 'Avoids the worst congestion, even if slightly longer',
    profile: 'driving-traffic',
    exclude: [],
    // Same request as `fastest`; a completely different choice from the result.
    needs: 'congestion',
  },
  {
    id: 'economic',
    label: 'Economic',
    hint: 'No tolls, least distance',
    profile: 'driving',
    // Fuel burnt tracks distance, and tolls are the other thing a journey
    // costs. "Cheapest" is those two together, not a separate router mode.
    exclude: ['toll'],
    needs: null,
  },
  {
    id: 'highway',
    label: 'Highways',
    hint: 'Prefers major roads',
    profile: 'driving',
    exclude: [],
    // No router has "prefer motorway". Motorways are where the sustained speed
    // is, so the fastest-moving candidate is the one that used them most.
    needs: null,
  },
  {
    id: 'scenic',
    label: 'Scenic',
    hint: 'Avoids motorways and ferries',
    profile: 'driving',
    exclude: ['motorway', 'ferry'],
    needs: null,
  },
];

export const DEFAULT_OPTION = 'fastest';

const byId = new Map(ROUTE_OPTIONS.map((o) => [o.id, o]));
export const getOption = (id) => byId.get(id) || byId.get(DEFAULT_OPTION);

/**
 * Can this option mean anything, given what the provider can tell us?
 * @param {string} id
 * @param {{hasTraffic?: boolean}} capabilities
 */
export function isAvailable(id, { hasTraffic = false } = {}) {
  const option = getOption(id);
  if (option.needs === 'congestion') return !!hasTraffic;
  return true;
}

/**
 * Request parameters for an option.
 *
 * Walking and cycling ignore the driving options entirely: excluding tolls
 * from a walk is meaningless, and driving-traffic has no walking equivalent.
 */
export function paramsFor(id, { mode = 'car' } = {}) {
  if (mode === 'foot') return { profile: 'walking', alternatives: true, exclude: [], annotations: [] };
  if (mode === 'bike') return { profile: 'cycling', alternatives: true, exclude: [], annotations: [] };

  const option = getOption(id);
  return {
    profile: option.profile,
    // Always on, always one request. This is what gives every option something
    // to choose BETWEEN — without it each option would get the router's single
    // favourite route and four of the five labels would be decoration.
    alternatives: true,
    exclude: option.exclude,
    annotations: option.needs === 'congestion' ? ['congestion', 'duration'] : [],
  };
}

/**
 * Average congestion over a route, or null when there is no data.
 * Segments the router knows nothing about are LEFT OUT of the average rather
 * than counted as clear — see CONGESTION_WEIGHT.
 */
export function congestionScore(route) {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  let total = 0;
  let counted = 0;
  for (const leg of legs) {
    const classes = leg?.annotation?.congestion;
    if (!Array.isArray(classes)) continue;
    for (const c of classes) {
      const w = CONGESTION_WEIGHT[c];
      if (w === null || w === undefined) continue;
      total += w;
      counted += 1;
    }
  }
  return counted ? total / counted : null;
}

/** Metres per second over the whole route — the proxy for "used big roads". */
const averageSpeed = (route) => (
  route?.duration > 0 ? (route.distance || 0) / route.duration : 0
);

/**
 * Choose among the routes a single request returned.
 *
 * @param {string} id      one of ROUTE_OPTIONS
 * @param {Array} routes   normalised routes ({distance, duration, legs, …})
 * @returns {{route: object, reason: string}|null}
 *   `reason` says WHY this one, in words a person can check against the map.
 */
export function pickRoute(id, routes) {
  const list = (Array.isArray(routes) ? routes : []).filter((r) => r && r.geometry);
  if (list.length === 0) return null;
  if (list.length === 1) return { route: list[0], reason: 'Only route found' };

  const option = getOption(id);

  if (option.id === 'least-traffic') {
    const scored = list
      .map((r) => ({ r, score: congestionScore(r) }))
      .filter((x) => x.score !== null);
    // No congestion data anywhere means the option cannot be honoured. Say so
    // rather than returning the fastest route wearing a "least traffic" label.
    if (scored.length === 0) {
      const quickest = [...list].sort((a, b) => a.duration - b.duration)[0];
      return { route: quickest, reason: 'No live traffic data — showing the quickest route' };
    }
    scored.sort((a, b) => (a.score - b.score) || (a.r.duration - b.r.duration));
    return { route: scored[0].r, reason: 'Least congestion of the routes found' };
  }

  if (option.id === 'economic') {
    const shortest = [...list].sort((a, b) => (a.distance - b.distance) || (a.duration - b.duration))[0];
    return { route: shortest, reason: 'Shortest distance, avoiding tolls' };
  }

  if (option.id === 'highway') {
    const fastestMoving = [...list].sort((a, b) => averageSpeed(b) - averageSpeed(a))[0];
    return { route: fastestMoving, reason: 'Keeps to the fastest-moving roads' };
  }

  if (option.id === 'scenic') {
    // Motorways are already excluded by the request, so every candidate
    // qualifies; among back-road routes the quickest is the least tedious.
    const quickest = [...list].sort((a, b) => a.duration - b.duration)[0];
    return { route: quickest, reason: 'Avoids motorways and ferries' };
  }

  const quickest = [...list].sort((a, b) => a.duration - b.duration)[0];
  return { route: quickest, reason: 'Quickest of the routes found' };
}

/** "1 hr 12 min" / "18 min" — durations in seconds. */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}

/** "12.4 mi" / "800 ft" — metres in, imperial out. */
export function formatDistance(metres, imperial = true) {
  if (!Number.isFinite(metres) || metres < 0) return '';
  if (imperial) {
    const miles = metres / 1609.344;
    if (miles < 0.2) return `${Math.round(metres * 3.28084)} ft`;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10000 ? 1 : 0)} km`;
}

export default ROUTE_OPTIONS;
