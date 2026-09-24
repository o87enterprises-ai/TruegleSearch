/**
 * LocalPackService — "eugene oregon patent lawyers" → the local businesses,
 * each with a phone number you can press.
 *
 * The place panel (PlacePanelService) answers "Rossi's hours": ONE place. This
 * answers the other local question — "who does X in Y" — the way Google's map
 * pack does: several businesses, each a card with Call / Website / Directions,
 * so nobody has to open five sites to find five phone numbers.
 *
 * Data is TomTom's POI search (free tier), which is keyword-driven: it knows
 * "law firm" but not "patent lawyers", and it has no idea which firm does
 * patents. So:
 *   - the service word is mapped to the terms TomTom actually indexes;
 *   - the town is pulled out of the query and geocoded;
 *   - firms the web results ALSO mention rise to the top and are marked, which
 *     is how a specialty ("patent") shows through data that has no specialties.
 *
 * Nothing is invented: every field is TomTom's or absent. No ratings or hours
 * here — getting them costs a scrape per business, and a card with made-up
 * stars is worse than one without.
 */
const TomTomService = require('./TomTomService');
const logger = require('../utils/logger');

// Service word → what to ask TomTom, what its results must look like, and what
// to throw out. `category` matches TomTom's category strings.
const SERVICES = [
  {
    re: /\b(lawyers?|attorneys?|law ?firms?|legal services?|solicitors?)\b/i,
    label: 'Lawyers',
    searches: ['law firm', 'attorney'],
    category: /legal/i,
    exclude: /\b(title|escrow|financial|advis[eo]rs?|bancorp|investments?|insurance|realty)\b/i,
  },
  { re: /\bplumb(er|ers|ing)\b/i, label: 'Plumbers', searches: ['plumber'] },
  { re: /\belectricians?\b/i, label: 'Electricians', searches: ['electrician'] },
  { re: /\b(accountants?|cpas?|bookkeep\w*|tax prep\w*)\b/i, label: 'Accountants', searches: ['accountant', 'cpa'] },
  { re: /\b(realtors?|real estate agents?)\b/i, label: 'Real estate agents', searches: ['real estate agent'] },
  { re: /\b(roofers?|roofing)\b/i, label: 'Roofers', searches: ['roofing'] },
  { re: /\b(contractors?)\b/i, label: 'Contractors', searches: ['contractor'] },
  { re: /\b(hvac|heating|air conditioning)\b/i, label: 'HVAC', searches: ['hvac'] },
  { re: /\blocksmiths?\b/i, label: 'Locksmiths', searches: ['locksmith'] },
  { re: /\b(movers?|moving compan\w+)\b/i, label: 'Movers', searches: ['moving company'] },
  { re: /\b(mechanics?|auto repair|car repair)\b/i, label: 'Auto repair', searches: ['auto repair'] },
  { re: /\bdentists?\b/i, label: 'Dentists', searches: ['dentist'] },
  { re: /\b(doctors?|physicians?|clinics?)\b/i, label: 'Doctors', searches: ['doctor', 'clinic'] },
  { re: /\bchiropractors?\b/i, label: 'Chiropractors', searches: ['chiropractor'] },
  { re: /\b(therapists?|counsel(?:l)?ors?)\b/i, label: 'Therapists', searches: ['therapist'] },
  { re: /\b(vets?|veterinarians?|animal hospitals?)\b/i, label: 'Veterinarians', searches: ['veterinarian'] },
  { re: /\b(restaurants?|places to eat)\b/i, label: 'Restaurants', searches: ['restaurant'] },
  { re: /\b(cafes?|coffee shops?|coffee)\b/i, label: 'Cafés', searches: ['cafe', 'coffee'] },
  { re: /\b(hotels?|motels?)\b/i, label: 'Hotels', searches: ['hotel'] },
  { re: /\b(gyms?|fitness)\b/i, label: 'Gyms', searches: ['gym'] },
  { re: /\b(pharmac(?:y|ies)|drug ?stores?)\b/i, label: 'Pharmacies', searches: ['pharmacy'] },
  { re: /\b(barbers?|barber ?shops?|hair salons?|salons?)\b/i, label: 'Salons & barbers', searches: ['hair salon', 'barber'] },
];

// Words that describe the search, not the place or the specialty.
const FILLER = new Set(['best', 'top', 'rated', 'good', 'cheap', 'affordable', 'local', 'in', 'near', 'around', 'the', 'a', 'for', 'find', 'me', 'my', 'area', 'closest', 'nearby', 'recommended', 'reviews']);
const NEAR_ME = /\b(near me|nearby|near by|around me|close to me|closest|in my area)\b/i;

/**
 * Split a query into { service, rest, nearMe } without touching the network.
 * `rest` is what is left once the service word and filler are gone — the town
 * and/or the specialty, in the order they were typed.
 */
function parseLocalQuery(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const service = SERVICES.find((s) => s.re.test(q));
  if (!service) return null;
  const nearMe = NEAR_ME.test(q);
  const rest = q
    .replace(service.re, ' ')
    .replace(NEAR_ME, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));
  return { service, rest, nearMe };
}

/** Contiguous windows of `words`, longest first, preferring the ends. */
function locationWindows(words) {
  const out = [];
  for (let len = Math.min(words.length, 4); len >= 1; len--) {
    out.push(words.slice(0, len));                       // leading town: "eugene oregon patent …"
    if (words.length > len) out.push(words.slice(-len)); // trailing town: "patent … eugene oregon"
  }
  return out.filter((w, i, a) => a.findIndex((x) => x.join(' ') === w.join(' ')) === i);
}

const hostOf = (url) => {
  if (!url) return '';
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
};
const GENERIC_NAME_WORDS = new Set(['law', 'office', 'offices', 'attorney', 'attorneys', 'legal', 'group', 'firm', 'llp', 'llc', 'pc', 'inc', 'and', 'the', 'of', 'at']);

/**
 * Did the web results mention this business? Its site among the result
 * domains, or its distinctive name words in a result title.
 */
function mentionedIn(place, { domains = [], titles = [] }, queryWords = []) {
  const host = hostOf(place.url);
  if (host && domains.some((d) => d && (host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`)))) return true;
  // Words from the query itself are in every title by construction — "Eugene
  // DUI Attorneys" matched a search for Eugene lawyers on "eugene" alone.
  const ignore = new Set(queryWords.map((w) => w.toLowerCase()));
  const words = String(place.name || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !GENERIC_NAME_WORDS.has(w) && !ignore.has(w));
  if (!words.length) return false;
  const text = titles.join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
}

const cache = new Map();
const TTL_MS = 60 * 60 * 1000;

async function geocodeTown(words) {
  for (const win of locationWindows(words)) {
    // eslint-disable-next-line no-await-in-loop
    const hits = await TomTomService.geocode(win.join(' '), { limit: 1 }).catch(() => []);
    const hit = hits && hits[0];
    if (hit && hit.type === 'Geography') return { words: win, hit };
  }
  return null;
}

async function lookup(service, rest, nearMe, pos) {
  let center = null;
  let where = null;
  let specialty = rest;
  const town = rest.length ? await geocodeTown(rest) : null;
  if (town) {
    center = { lat: town.hit.position.lat, lng: town.hit.position.lon };
    where = town.hit.address;
    specialty = rest.filter((w) => !town.words.includes(w));
  } else if (pos) {
    center = { lat: pos.lat, lng: pos.lng };
    where = nearMe ? 'Near you' : null;
  }
  // No town in the query and no position offered: nothing honest to show.
  if (!center) return null;

  const terms = [...service.searches];
  if (specialty.length) terms.unshift(`${specialty.join(' ')} ${service.searches[0]}`);
  const lists = await Promise.all(terms.map((t) => TomTomService.searchPlaces(t, {
    lat: center.lat, lon: center.lng, radius: 25000, limit: 15,
  }).catch((err) => { logger.warn('local pack: search failed', { term: t, error: err.message }); return []; })));
  const seen = new Set();
  const candidates = lists.flat().filter((p) => {
    if (!p || !p.name || !p.phone || p.name === p.address) return false;
    const cats = (p.category || []).join(' ');
    if (service.category && !service.category.test(cats)) return false;
    if (service.exclude && service.exclude.test(p.name)) return false;
    const k = p.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return candidates.length ? { center, where, specialty, candidates } : null;
}

/**
 * @param {string} query
 * @param {{lat?:number,lng?:number,domains?:string[],titles?:string[]}} ctx
 * @returns {Promise<null|{label:string,where:string,center:{lat:number,lng:number},places:object[]}>}
 */
async function resolve(query, ctx = {}) {
  const parsed = parseLocalQuery(query);
  if (!parsed) return null;
  const { service, rest, nearMe } = parsed;
  const hasPos = Number.isFinite(ctx.lat) && Number.isFinite(ctx.lng);

  // One cache entry per query (+ rough position): geocoding and the searches
  // are up to eight TomTom calls, and the free tier is metered per day.
  const key = `${String(query).toLowerCase().trim()}|${hasPos ? `${ctx.lat.toFixed(2)},${ctx.lng.toFixed(2)}` : ''}`;
  let found = cache.get(key);
  if (!found || Date.now() - found.at >= TTL_MS) {
    found = { at: Date.now(), value: await lookup(service, rest, nearMe, hasPos ? ctx : null) };
    cache.set(key, found);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
  }
  if (!found.value) return null;
  const { center, where, specialty, candidates } = found.value;

  const spec = specialty.map((w) => w.toLowerCase());
  const places = candidates
    .map((p) => ({
      name: p.name,
      address: p.address || null,
      phone: p.phone,
      website: p.url ? (/^https?:/i.test(p.url) ? p.url : `https://${p.url}`) : null,
      lat: p.position?.lat ?? null,
      lng: p.position?.lon ?? null,
      distanceMeters: typeof p.distance === 'number' ? Math.round(p.distance) : null,
      category: (p.category || []).filter((c) => c !== 'company').map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase()))[0] || service.label,
      mentioned: mentionedIn(p, ctx, parsed.rest),
      specialtyMatch: spec.length > 0 && spec.some((w) => p.name.toLowerCase().includes(w)),
    }))
    .sort((a, b) => (Number(b.mentioned) - Number(a.mentioned))
      || (Number(b.specialtyMatch) - Number(a.specialtyMatch))
      || ((a.distanceMeters ?? 1e9) - (b.distanceMeters ?? 1e9)))
    .slice(0, 6);

  const title = [spec.join(' '), service.label.toLowerCase()].filter(Boolean).join(' ');
  return {
    label: title.charAt(0).toUpperCase() + title.slice(1),
    where,
    center,
    places,
  };
}

module.exports = { resolve, _internals: { parseLocalQuery, locationWindows, mentionedIn, SERVICES } };
