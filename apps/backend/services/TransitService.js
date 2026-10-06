/**
 * Public transit directions — Transitous (https://transitous.org).
 *
 * Owner, 2026-10-06: "add a local public transit option to the Truegle maps
 * directions." Every keyless router the map already uses (OSRM, the providers
 * in MapApiService) does car / walk / bike only; transit needs timetables.
 * Transitous is a free, community-run, worldwide transit planner (MOTIS, built
 * on the agencies' own published GTFS timetables). No key, no account, $0.
 *
 * WHY THROUGH OUR SERVER: a trip request is two precise coordinates — usually
 * the person's home and where they are going. Proxying it means Transitous
 * sees Truegle's server, never the person's IP, and nothing here logs the
 * coordinates (same rule as search queries; see noQueryInLogs).
 *
 * Coverage is the agencies'. Where a city's timetable is not in Transitous
 * there is simply no itinerary, and the panel says so rather than inventing
 * one (tested 2026-10-06: New York returns bus + ferry trips; a Eugene, OR
 * trip returned none).
 */
const axios = require('axios');

const BASE = 'https://api.transitous.org/api/v1/plan';
const TIMEOUT_MS = 15000;

/** Google's encoded-polyline format at any precision (Transitous uses 7). */
function decodePolyline(str, precision = 7) {
  const factor = 10 ** precision;
  const out = [];
  let i = 0; let lat = 0; let lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0; let result = 0; let b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (which === 0) lat += d; else lng += d;
    }
    out.push([lng / factor, lat / factor]);   // GeoJSON order
  }
  return out;
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const validPoint = (p) => p && finite(p.lat) && finite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

const place = (p) => ({
  name: p?.name && !/^(START|END)$/.test(p.name) ? p.name : null,
  lat: p?.lat ?? null,
  lng: p?.lon ?? null,
  time: p?.departure || p?.arrival || null,
});

function normaliseLeg(l) {
  let geometry = [];
  try {
    if (l.legGeometry?.points) geometry = decodePolyline(l.legGeometry.points, l.legGeometry.precision || 7);
  } catch { geometry = []; }
  return {
    mode: l.mode,                                   // WALK, BUS, TRAM, SUBWAY, RAIL, FERRY, …
    transit: l.mode !== 'WALK' && l.mode !== 'BIKE' && l.mode !== 'CAR',
    route: l.routeShortName || l.routeLongName || null,
    headsign: l.headsign || null,
    agency: l.agencyName || null,
    color: l.routeColor ? `#${String(l.routeColor).replace(/^#/, '')}` : null,
    from: { ...place(l.from), time: l.startTime || null },
    to: { ...place(l.to), time: l.endTime || null },
    duration: l.duration ?? null,                   // seconds
    distance: l.distance ?? null,                   // metres (walk legs)
    stops: Array.isArray(l.intermediateStops) ? l.intermediateStops.length : null,
    geometry,
  };
}

function normalise(payload) {
  const its = Array.isArray(payload?.itineraries) ? payload.itineraries : [];
  return its
    .map((it) => {
      const legs = (it.legs || []).map(normaliseLeg);
      return {
        duration: it.duration ?? null,
        startTime: it.startTime || null,
        endTime: it.endTime || null,
        transfers: it.transfers ?? Math.max(0, legs.filter((l) => l.transit).length - 1),
        legs,
      };
    })
    // An "itinerary" with no transit leg is just a walk — the walking mode
    // already does that better. Only real transit trips are offered here.
    .filter((it) => it.legs.some((l) => l.transit));
}

/**
 * @param {{lat,lng}} from
 * @param {{lat,lng}} to
 * @param {{time?: string, arriveBy?: boolean}} opts
 */
async function plan(from, to, opts = {}) {
  if (!validPoint(from) || !validPoint(to)) {
    const e = new Error('from and to must be valid coordinates'); e.status = 400; throw e;
  }
  const when = opts.time && !Number.isNaN(Date.parse(opts.time)) ? new Date(opts.time).toISOString() : new Date().toISOString();
  const params = {
    fromPlace: `${from.lat},${from.lng}`,
    toPlace: `${to.lat},${to.lng}`,
    time: when,
    arriveBy: opts.arriveBy ? 'true' : 'false',
  };
  const { data } = await axios.get(BASE, {
    params,
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': 'Truegle (https://truegle.info)', Accept: 'application/json' },
  });
  return normalise(data).slice(0, 5);
}

module.exports = { plan, decodePolyline, normalise };
