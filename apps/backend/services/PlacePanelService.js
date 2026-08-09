/**
 * PlacePanelService — a query, turned into one real place, or nothing.
 *
 * The quick-answer card handles "how tall is the Eiffel Tower". It is the
 * wrong shape for "dentist near me" or "Rossi's hours": what someone wants
 * there is not a sentence, it is a phone number, a set of opening hours and a
 * Directions button. That is the local panel every other engine shows, and
 * every piece of it already existed here — TomTom for the search, the
 * BusinessEnrichmentService for phone/website/hours/rating. Nothing was
 * putting them together.
 *
 * THE ONE RULE THIS SERVICE ENFORCES: a half-filled panel is worse than no
 * panel. A card with a name and five empty rows looks broken, and it pushes
 * the organic results — which probably DID answer the question — below the
 * fold to do it. So `resolve` returns null unless the result is worth the
 * space, and the caller renders the ordinary page.
 *
 * Nothing here is invented. Every field comes from a provider or is absent;
 * there are deliberately no stock photos, because a photo of "a restaurant"
 * presented next to a specific restaurant's name is a picture of somewhere
 * else, and the whole point of the panel is that it is about THIS place.
 */
const TomTomService = require('./TomTomService');
const BusinessEnrichmentService = require('./BusinessEnrichmentService');
const logger = require('../utils/logger');

// A panel earns its place with a name, somewhere to go, and at least one thing
// you could ACT on. Name plus address alone is what the first organic result
// already gives you.
const ACTIONABLE = ['phone', 'website', 'hours', 'rating'];

// Resolved places change on the scale of days; opening hours change on the
// scale of never. Cached per query+area so a page refresh, a back button or a
// second visitor doesn't re-spend the provider quota.
const cache = new Map();
const TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 300;

const keyFor = (q, lat, lng) => `${q.toLowerCase().trim()}|${lat ? lat.toFixed(2) : ''}|${lng ? lng.toFixed(2) : ''}`;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) { cache.delete(key); return undefined; }
  return hit.value;
}

function cacheSet(key, value) {
  // Plain FIFO trim. An LRU would be more correct and this map holds a few
  // hundred small objects on one process — not worth the machinery.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

// TomTom returns category slugs like 'RESTAURANT' or 'cafe/pub'. Show the most
// specific one, in words a person would use.
function prettyCategory(categories) {
  const first = Array.isArray(categories) ? categories[0] : categories;
  if (!first || typeof first !== 'string') return null;
  return first
    .split('/')
    .pop()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Turn a search query into the panel payload, or null.
 *
 * @param {string} query
 * @param {{lat?:number, lng?:number}} [near] the visitor's rough position, when
 *   they have offered it. "near me" is unanswerable without it, so that phrasing
 *   returns null rather than silently showing a place in another country.
 */
async function resolve(query, near = {}) {
  const q = String(query || '').trim();
  if (!q) return null;

  const lat = Number.isFinite(near.lat) ? near.lat : null;
  const lng = Number.isFinite(near.lng) ? near.lng : null;

  // "near me" with no position is not a question we can answer. Guessing from
  // an IP would put a dentist three cities away behind a Directions button.
  if (/\b(near me|nearby|around me|close to me|closest|in my area)\b/i.test(q) && lat === null) return null;

  const key = keyFor(q, lat, lng);
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  let place = null;
  try {
    const results = await TomTomService.searchPlaces(q, {
      limit: 3,
      ...(lat !== null && lng !== null ? { lat, lon: lng, radius: 25000 } : {}),
    });
    // The first result that is an actual POI. A bare address match has no name,
    // no hours and no phone — it is a pin, not a business.
    place = (results || []).find((r) => r && r.name && r.name !== r.address) || null;
  } catch (err) {
    logger.warn('place panel: search failed', { error: err.message });
    cacheSet(key, null);
    return null;
  }
  if (!place) { cacheSet(key, null); return null; }

  let enriched = {};
  try {
    enriched = await BusinessEnrichmentService.enrichLocation(
      place.name,
      place.address || '',
      place.position?.lat,
      place.position?.lon,
      prettyCategory(place.category) || 'DEFAULT',
    ) || {};
  } catch (err) {
    logger.warn('place panel: enrichment failed', { error: err.message });
  }

  const panel = {
    name: place.name,
    address: place.address || enriched.address || null,
    category: prettyCategory(place.category),
    lat: place.position?.lat ?? null,
    lng: place.position?.lon ?? null,
    // TomTom's own phone is more reliable than one scraped out of a snippet,
    // so it wins when both exist.
    phone: place.phone || enriched.phone || null,
    website: place.url || enriched.website || null,
    hours: enriched.hours || null,
    isOpen: typeof enriched.isOpen === 'boolean' ? enriched.isOpen : null,
    rating: typeof enriched.rating === 'number' ? enriched.rating : null,
    reviewCount: enriched.reviewCount || 0,
    priceRange: enriched.priceRange || null,
    distanceMeters: typeof place.distance === 'number' ? place.distance : null,
    sources: enriched.sources || [],
  };

  const useful = ACTIONABLE.some((f) => panel[f] !== null && panel[f] !== undefined);
  const value = useful ? panel : null;
  if (!useful) {
    logger.info('place panel: resolved but too thin to show', { name: panel.name });
  }
  cacheSet(key, value);
  return value;
}

module.exports = { resolve, _internals: { prettyCategory, cache, ACTIONABLE } };
