// Query Interpreter — understands a raw search string before it hits the
// providers, the way Google/DuckDuckGo recognize brand names, site keywords,
// and acronyms instead of matching them as literal text.
//
// This module is intentionally provider-agnostic and side-effect free so each
// piece can be unit-tested in isolation and composed in SearchService:
//   1. Self-brand recognition  — pin truegle.info #1 for brand queries      (live)
//   2. Site-keyword shortcuts   — "… yt" → boost YouTube results to the top  (next)
//   3. Acronym expansion        — "dea" → "drug enforcement administration"  (next)

const OFFICIAL_SITE = {
  domain: 'truegle.info',
  url: 'https://truegle.info',
  title: 'Truegle — Unbiased Search Engine',
  snippet:
    'Truegle is an unbiased search engine that shows comprehensive results from ' +
    'multiple perspectives — search the web without algorithmic filter bubbles.',
};

// Brand phrases that always resolve to Truegle, after normalization strips
// trailing words like "search" / "search engine" and TLDs like ".info".
const BRAND_TERMS = new Set([
  'truegle',
  'truegle ai',
  'truegle engine',
  'truegle browser',
]);

// Curated common misspellings that sit >1 edit from "truegle" (transpositions,
// double letters) and so aren't reliably caught by the edit-distance check.
const BRAND_MISSPELLINGS = new Set([
  'trugle',
  'truggle',
  'truegel',
  'truigle',
  'trueagle',
  'trugel',
  'treugle',
  'truelge',
  'truogle',
  'truengle',
]);

// Site-keyword shortcuts. When one of these appears as a standalone leading or
// trailing token — "darkwaters 9 yt", "caveman git" — Truegle strips it and
// boosts results from the mapped site to the top (Google-style), so a bare
// keyword behaves like DuckDuckGo's !bangs without the punctuation.
//
// Deliberately conservative: only keywords that signal site-intent and are
// rarely the actual search subject. Common English words ("so", "x", "on") and
// ambiguous brand words ("amazon", "apple", "target") are intentionally left
// out so we don't hijack an ordinary query.
const SITE_KEYWORDS = {
  yt: 'youtube.com',
  youtube: 'youtube.com',
  git: 'github.com',
  github: 'github.com',
  reddit: 'reddit.com',
  wiki: 'wikipedia.org',
  wikipedia: 'wikipedia.org',
  imdb: 'imdb.com',
  stackoverflow: 'stackoverflow.com',
  npm: 'npmjs.com',
  mdn: 'developer.mozilla.org',
  quora: 'quora.com',
  soundcloud: 'soundcloud.com',
};

/**
 * Detect a site-keyword shortcut in a leading or trailing standalone token.
 * Returns `{ domain, keyword, cleanedQuery }` with the keyword removed, or null.
 *
 * Requires at least two tokens so a bare "youtube" stays a normal navigational
 * query instead of collapsing to an empty search. Trailing position wins over
 * leading, since "<query> yt" is the more common intent. Mid-sentence matches
 * (e.g. "the git repository") are ignored on purpose to avoid false positives.
 */
function detectSiteKeyword(query) {
  const raw = (query || '').trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/);
  if (tokens.length < 2) return null;

  const clean = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = clean(tokens[tokens.length - 1]);
  const first = clean(tokens[0]);

  if (SITE_KEYWORDS[last]) {
    return { domain: SITE_KEYWORDS[last], keyword: last, cleanedQuery: tokens.slice(0, -1).join(' ') };
  }
  if (SITE_KEYWORDS[first]) {
    return { domain: SITE_KEYWORDS[first], keyword: first, cleanedQuery: tokens.slice(1).join(' ') };
  }
  return null;
}

// Curated acronym/initialism dictionary. Keys are lowercased; values are the
// most common full form. Used to run a supplemental search for the expansion so
// the authoritative entity surfaces (typing "dea" should find the DEA).
const ACRONYMS = {
  dea: 'drug enforcement administration',
  fbi: 'federal bureau of investigation',
  cia: 'central intelligence agency',
  nsa: 'national security agency',
  nasa: 'national aeronautics and space administration',
  irs: 'internal revenue service',
  fda: 'food and drug administration',
  cdc: 'centers for disease control and prevention',
  atf: 'bureau of alcohol tobacco firearms and explosives',
  doj: 'department of justice',
  dod: 'department of defense',
  dhs: 'department of homeland security',
  epa: 'environmental protection agency',
  faa: 'federal aviation administration',
  fcc: 'federal communications commission',
  ftc: 'federal trade commission',
  tsa: 'transportation security administration',
  fema: 'federal emergency management agency',
  usps: 'united states postal service',
  nato: 'north atlantic treaty organization',
  wto: 'world trade organization',
  imf: 'international monetary fund',
  // Ambiguous with an ordinary English word — only expanded when the user
  // typed it in uppercase (see AMBIGUOUS_ACRONYMS guard in detectAcronym).
  who: 'world health organization',
  sec: 'securities and exchange commission',
  un: 'united nations',
};

// Acronyms that collide with a common lowercase word, so we only expand them
// when the raw token is uppercase (a deliberate "WHO", not the word "who").
const AMBIGUOUS_ACRONYMS = new Set(['who', 'sec', 'un']);

// Short tokens that look acronym-shaped but should never trigger the AI
// fallback — common words, pronouns, and chat/text abbreviations.
const ACRONYM_STOPWORDS = new Set([
  'the', 'and', 'for', 'not', 'you', 'are', 'was', 'his', 'her', 'she', 'him',
  'has', 'had', 'can', 'may', 'why', 'how', 'who', 'all', 'any', 'one', 'out',
  'new', 'now', 'our', 'get', 'got', 'lol', 'omg', 'wtf', 'idk', 'imo', 'btw',
  'fyi', 'diy', 'faq', 'ceo', 'cfo', 'usa', 'usb',
]);

/**
 * Detect a curated acronym token in the query and return
 * `{ token, key, expansion }`, or null. Ambiguous acronyms (WHO/SEC/UN) only
 * match when the user typed them in uppercase, so "who is president" is left
 * alone while "WHO guidelines" expands.
 */
function detectAcronym(query) {
  const tokens = (query || '').trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const key = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ACRONYMS[key]) continue;
    if (AMBIGUOUS_ACRONYMS.has(key) && token !== token.toUpperCase()) continue;
    return { token, key, expansion: ACRONYMS[key] };
  }
  return null;
}

/**
 * Return an uppercase, acronym-shaped single token eligible for AI expansion, or
 * null. Deliberately narrow — a bare 2–6 letter ALL-CAPS token the curated list
 * doesn't cover and that isn't a known stopword — so the AI fallback stays
 * bounded and only fires when the user clearly typed an acronym.
 */
function looksLikeUnknownAcronym(query) {
  const tokens = (query || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 1) return null;
  const token = tokens[0];
  const letters = token.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2 || letters.length > 6) return null;
  if (token !== token.toUpperCase()) return null;
  const key = letters.toLowerCase();
  if (ACRONYMS[key] || ACRONYM_STOPWORDS.has(key)) return null;
  return letters;
}

/**
 * Replace the acronym token in `query` with its expansion, case-insensitively,
 * to build the supplemental search string. "DEA history" with expansion "drug
 * enforcement administration" → "drug enforcement administration history".
 */
function buildExpandedQuery(query, { token, expansion }) {
  if (!token || !expansion) return query;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (query || '').replace(new RegExp(`\\b${escaped}\\b`, 'i'), expansion).trim();
}

/**
 * Levenshtein edit distance between two short strings. Iterative two-row
 * implementation — allocation-light and more than fast enough for a query token.
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Normalize a query for brand matching: lowercase, drop punctuation, strip
 * filler/navigational words and TLDs so "go to Truegle.info search engine"
 * and "TRUEGLE!" both collapse to "truegle".
 */
function normalizeForBrand(query) {
  return (query || '')
    .toLowerCase()
    // Strip TLDs first, while the dot is still attached, so "truegle.info"
    // collapses to "truegle" instead of leaving a stray "info" token.
    .replace(/\.(info|com|org|net|ai|io)\b/g, ' ')
    .replace(/[.,!?"']/g, ' ')
    .replace(/\b(go to|open|visit|the|www|please)\b/g, ' ')
    .replace(/\b(search engine|search|browser|website|web site|site|homepage|home page)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the query is asking for Truegle itself — the brand name, a close
 * misspelling, or a branded phrase. Used to pin the official site at #1 so
 * Truegle recognizes its own name the way Google surfaces your homepage for a
 * brand query, instead of burying it beneath third-party mentions.
 */
function isBrandQuery(query) {
  const norm = normalizeForBrand(query);
  if (!norm) return false;

  if (BRAND_TERMS.has(norm) || BRAND_MISSPELLINGS.has(norm)) return true;

  // Single-token typo tolerance, scoped tightly to avoid false positives on
  // ordinary words: "true" starts with "true" but is 3 edits away; "truffle"
  // starts with "tru" but is 2 edits away (only the ≤1 branch applies to it).
  if (!norm.includes(' ')) {
    const d = levenshtein(norm, 'truegle');
    if (norm.startsWith('true') && d <= 2) return true;
    if (norm.startsWith('tru') && d <= 1) return true;
  }
  return false;
}

/**
 * Build the canonical, pinned Truegle result. Shaped to match provider results
 * (see SearchService.formatGoogleResults) with categorize-by-bias fields already
 * set and an `isOfficial` flag the frontend can badge. `finalScore` is set above
 * the normal 0–1 range so it stays first if anything re-sorts downstream.
 */
function buildOfficialResult() {
  return {
    title: OFFICIAL_SITE.title,
    url: OFFICIAL_SITE.url,
    snippet: OFFICIAL_SITE.snippet,
    source: 'truegle',
    sourceName: 'Truegle',
    date: new Date().toISOString(),
    image: null,
    favicon: 'https://truegle.info/favicon.ico',
    domain: OFFICIAL_SITE.domain,
    category: 'web',
    verified: true,
    bias: 'unbiased',
    biasLabel: 'Official Site',
    isOfficial: true,
    finalScore: 1.5,
  };
}

module.exports = {
  isBrandQuery,
  buildOfficialResult,
  normalizeForBrand,
  detectSiteKeyword,
  detectAcronym,
  looksLikeUnknownAcronym,
  buildExpandedQuery,
  levenshtein,
  OFFICIAL_SITE,
  SITE_KEYWORDS,
  ACRONYMS,
};
