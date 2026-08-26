import MapApiService, { metresBetween } from '../services/mapApi';
import { parseLocalQuery } from '../../../hooks/useLocationDetection';

// What the map's search bar does with what you typed.
//
// It used to do exactly one thing: MapApiService.geocode(). A geocoder turns a
// NAME into a POINT, so the bar could find "1600 Pennsylvania Ave" and could
// not find "coffee near me", "pharmacy", or a business by name — those all
// came back empty, because there is no place called "coffee near me" to
// geocode.
//
// Three questions get asked at that bar and they need three different answers:
//
//   "coffee near me"        → things of a KIND, around the user
//   "coffee in austin"      → things of a KIND, around somewhere else
//   "1600 Pennsylvania Ave" → one specific POINT
//   "Blue Bottle"           → a NAMED place, nearby if we know where you are
//
// parseLocalQuery already knows how to tell the first three apart — it is the
// same parser the results page uses to decide whether to open the map at all,
// so the bar and the page now agree about what a local query is instead of
// each having their own idea.

/** Looks like a street address or a postcode rather than a thing to look for. */
const ADDRESSY = [
  /^\s*\d+\s+\S/,                       // "221B Baker St", "1600 Pennsylvania"
  /\b\d{5}(?:-\d{4})?\b/,               // US ZIP
  /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, // UK postcode
  /\b(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|hwy|highway|way|pkwy|parkway|suite|ste|apt)\b\.?\s*$/i,
];
const looksLikeAddress = (q) => ADDRESSY.some((re) => re.test(q));

/** Normalise both result shapes into what the dropdown and the map need. */
const toRow = (p) => ({
  name: p.name || p.address || 'Unknown',
  address: p.address || '',
  position: p.position,
  distance: typeof p.distance === 'number' ? p.distance : null,
  type: p.type || null,
});

const rowsFrom = (result) => (result?.data || []).map(toRow).filter((r) => r.position);

// HOW FAR "NEAR" IS depends entirely on where you live, and 5 km was a city
// assumption baked in as a constant.
//
// That is the "Walmart means the most popular one nationally" bug. In Cottage
// Grove the nearest Walmart is tens of kilometres away, so the 5 km search
// found nothing, the code fell through to a plain geocode with no position
// attached, and a global geocoder ranks a bare brand name by prominence — the
// same Walmart for everybody in the country.
//
// Widening the ring to 80 km for everyone would be worse, not better: a city
// user typing "coffee" would get results across three suburbs ranked above the
// shop on their corner. So the radius CLIMBS, and stops at the first ring that
// answers. A city keeps its tight first result; a rural user keeps searching
// until the answer is real.
const RADII_M = [5000, 25000, 80000];

const nearby = async (near, query, limit) => {
  for (const radius of RADII_M) {
    // PER-RING, not around the loop. searchPlaces THROWS when no provider
    // returns a usable result, and an empty ring is the normal case here — so
    // a single try/catch around the whole loop would let the first empty ring
    // abort the climb, which is the exact failure the ladder exists to fix.
    try {
      const rows = rowsFrom(
        await MapApiService.searchPlaces(near, { query, radius, limit }),
      );
      if (rows.length) return rows;
    } catch { /* this ring found nothing; try a wider one */ }
  }
  return [];
};

// `near` is a RANKING HINT, never a filter — see mapApi.geocodeWithProvider.
// Passing it means a name that exists in many places resolves to the closest
// one; omitting it (because we do not know where the user is) behaves exactly
// as before.
const geocode = async (query, limit, near = null) => rowsFrom(
  await MapApiService.geocode(query, near ? { limit, near } : { limit }),
);

// Closest first, when we know where the user is and the provider did not
// already say. A geocoder returns no distances at all, so without this a
// proximity-ranked list still arrives in the provider's order — which is the
// order it thinks is most PROMINENT, not the order that is nearest.
function byDistanceFrom(near, rows) {
  if (!near) return rows;
  return rows
    .map((r) => ({
      ...r,
      distance: typeof r.distance === 'number' ? r.distance
        : (r.position ? metresBetween(near, r.position) : null),
    }))
    .sort((a, b) => {
      if (a.distance == null) return b.distance == null ? 0 : 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
}

/**
 * Resolve what was typed into places to show.
 *
 * @param {string} query   raw text from the search bar
 * @param {object} opts
 * @param {{lat:number,lng:number}|null} opts.near  the user's position, if known
 * @param {number} opts.limit
 * @returns {Promise<{rows: Array, needsLocation: boolean, kind: string}>}
 *   `needsLocation` is true when the query only makes sense with a position
 *   and we do not have one — the bar says so rather than returning an empty
 *   list, because "no results" and "I don't know where you are" are different
 *   problems with different fixes.
 */
export async function searchMapQuery(query, { near = null, limit = 10 } = {}) {
  const q = String(query || '').trim();
  if (!q) return { rows: [], needsLocation: false, kind: 'empty' };

  const parsed = parseLocalQuery(q);

  // "coffee near me" / "pharmacy nearby" / "closest atm"
  if (parsed?.type === 'geolocation') {
    if (!near) return { rows: [], needsLocation: true, kind: 'near-me' };
    // An empty subject means the query was ONLY "near me" — centre on the user
    // rather than searching for nothing.
    if (!parsed.subject) {
      return { rows: [toRow({ name: 'Your location', address: '', position: near })], needsLocation: false, kind: 'near-me' };
    }
    return { rows: await nearby(near, parsed.subject, limit), needsLocation: false, kind: 'near-me' };
  }

  // "coffee in austin" — resolve the WHERE, then search for the WHAT around it.
  if (parsed?.type === 'place' && parsed.subject) {
    const anchors = await geocode(parsed.place, 1, near).catch(() => []);
    const anchor = anchors[0]?.position;
    if (anchor) {
      const rows = await nearby(anchor, parsed.subject, limit).catch(() => []);
      if (rows.length) return { rows, needsLocation: false, kind: 'in-place' };
      // Nothing of that kind there, but the place itself is a real answer.
      return { rows: anchors, needsLocation: false, kind: 'in-place' };
    }
  }

  // A street address or a postcode is a geocoder question, full stop — but
  // still a biased one: "123 Main St" exists in thousands of towns.
  if (looksLikeAddress(q)) {
    const rows = await geocode(q, limit, near).catch(() => []);
    if (rows.length) return { rows: byDistanceFrom(near, rows), needsLocation: false, kind: 'address' };
    // Fall through: an "address" that geocodes to nothing may just be a name.
  }

  // A bare name. If we know where the user is, look there FIRST — somebody
  // typing "Blue Bottle" into a map wants the one they can walk to, not the
  // one a global geocoder happens to rank first.
  if (near) {
    const rows = await nearby(near, q, limit).catch(() => []);
    if (rows.length) return { rows: byDistanceFrom(near, rows), needsLocation: false, kind: 'nearby-name' };
  }

  // The last rung. It used to throw the position away entirely, which is what
  // turned "Walmart" into whichever Walmart the geocoder likes best.
  const rows = await geocode(q, limit, near).catch(() => []);
  return { rows: byDistanceFrom(near, rows), needsLocation: false, kind: 'geocode' };
}

/** "450 m" / "2.3 km" — for the dropdown, when the distance is known. */
export function formatDistance(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres)) return '';
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export default searchMapQuery;
