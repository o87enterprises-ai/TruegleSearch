import MapApiService from '../services/mapApi';
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

const nearby = async (near, query, limit) => rowsFrom(
  await MapApiService.searchPlaces(near, { query, radius: 5000, limit }),
);

const geocode = async (query, limit) => rowsFrom(
  await MapApiService.geocode(query, { limit }),
);

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
    const anchors = await geocode(parsed.place, 1).catch(() => []);
    const anchor = anchors[0]?.position;
    if (anchor) {
      const rows = await nearby(anchor, parsed.subject, limit).catch(() => []);
      if (rows.length) return { rows, needsLocation: false, kind: 'in-place' };
      // Nothing of that kind there, but the place itself is a real answer.
      return { rows: anchors, needsLocation: false, kind: 'in-place' };
    }
  }

  // A street address or a postcode is a geocoder question, full stop.
  if (looksLikeAddress(q)) {
    const rows = await geocode(q, limit).catch(() => []);
    if (rows.length) return { rows, needsLocation: false, kind: 'address' };
    // Fall through: an "address" that geocodes to nothing may just be a name.
  }

  // A bare name. If we know where the user is, look there FIRST — somebody
  // typing "Blue Bottle" into a map wants the one they can walk to, not the
  // one a global geocoder happens to rank first.
  if (near) {
    const rows = await nearby(near, q, limit).catch(() => []);
    if (rows.length) return { rows, needsLocation: false, kind: 'nearby-name' };
  }

  return { rows: await geocode(q, limit).catch(() => []), needsLocation: false, kind: 'geocode' };
}

/** "450 m" / "2.3 km" — for the dropdown, when the distance is known. */
export function formatDistance(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres)) return '';
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

export default searchMapQuery;
