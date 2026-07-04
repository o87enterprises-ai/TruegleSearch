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
  levenshtein,
  OFFICIAL_SITE,
};
