/**
 * EXACT KEYWORD MATCHING — the first thing a generic search is ordered by.
 *
 * Owner, 2026-10-01: "I type something very clearly and the results … drop
 * keywords … I want the actual keywords … organized by relevance … EXACT
 * keyword matches … most accurate first and least last." Live example: for
 * "duck sauce quack album bandcamp", "Spandex | Duck Sauce - Bandcamp" ranked
 * above "Quack - Duck Sauce - Bandcamp".
 *
 * calculateRelevance stems words and folds synonyms ("lawyers" = "attorney"),
 * which is right for a blended score and wrong for "did it contain what I
 * typed". This is the literal version: whole words, as typed, lower-cased.
 *
 * Pure — no network — so __tests__/exactMatch.test.js pins it.
 */

// Words that carry no meaning of their own in a search. Short on purpose:
// anything more and a name or title loses words people do type on purpose.
const FILLER = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from',
  'is', 'it', 'by', 'as', 'be', 'that', 'this', 'what', 'how', 'why', 'who', 'are',
  'was', 'were', 'you', 'your', 'can', 'does', 'did', 'about', 'into',
]);

// Accent folding: "dvorak" must meet "Dvořák". NFD splits letters from their marks;
// the few letters that do not decompose are mapped by hand.
const EXTRA_FOLD = { 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ı': 'i', 'ð': 'd', 'þ': 'th' };
const fold = (text) => String(text || '').toLowerCase()
  .normalize('NFD').replace(/\p{M}+/gu, '')
  .replace(/[øæœßłđıðþ]/g, (c) => EXTRA_FOLD[c]);

const words = (text) => fold(text)
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter(Boolean);

/**
 * The words a person actually asked for. Search operators are instructions to
 * the engine, not words to find: site:/inurl:/filetype:…, a -negated word, a
 * !bang, and bare OR/AND are all dropped.
 */
function queryKeywords(query) {
  const plain = String(query || '')
    .replace(/(^|\s)[a-z]+:\S+/gi, ' ')     // site:x.com, intitle:foo, filetype:pdf
    .replace(/(^|\s)-\S+/g, ' ')             // -excluded
    .replace(/(^|\s)!\S+/g, ' ')             // !bang
    .replace(/\b(OR|AND)\b/g, ' ');          // operators, which are upper-case
  return [...new Set(words(plain).filter((w) => !FILLER.has(w) && (w.length > 1 || /\d/.test(w))))];
}

/**
 * "rapid api sign up" -> { brand: "rapidapi", query: "rapidapi sign up" }. Brands are
 * often two words typed apart; an engine that reads "rapid" as the dictionary word never
 * returns the site. Only for plain 3-7 word queries (no operators or quotes). The caller
 * searches this variant only when no result's domain already holds the brand.
 */
function compoundVariant(query) {
  const q = String(query || '').trim();
  if (/["'():!\-]/.test(q) || /\b(OR|AND)\b/.test(q)) return null;
  const w = q.split(/\s+/);
  if (w.length < 3 || w.length > 7) return null;
  const [a, b] = w.map((x) => fold(x));
  if (!/^[a-z0-9]{2,}$/.test(a) || !/^[a-z0-9]{2,}$/.test(b) || FILLER.has(a) || FILLER.has(b)) return null;
  return { brand: a + b, query: [a + b, ...w.slice(2)].join(' ') };
}

const MAX_BRAND_PROMOTED = 4;
const hostLabels = (r) => {
  try { return new URL(r.url).hostname.toLowerCase().replace(/^www\./, '').split('.').slice(0, -1); } catch { return []; }
};

/**
 * "rapid api sign up" names RapidAPI. When the first two words, joined, are a site's own
 * domain label (rapidapi.com, docs.rapidapi.com), that site's pages lead — ahead of clips
 * and of pages that only share a word. At most MAX_BRAND_PROMOTED, in their existing order;
 * nothing is removed. A domain that merely contains the brand in a longer name does not count.
 */
function promoteBrandDomain(query, results) {
  const cv = compoundVariant(query);
  if (!cv || !Array.isArray(results)) return results;
  const own = results.filter((r) => !isClip(r) && hostLabels(r).includes(cv.brand)).slice(0, MAX_BRAND_PROMOTED);
  if (!own.length) return results;
  const lead = new Set(own);
  return [...own, ...results.filter((r) => !lead.has(r))];
}

/** The URL's path read as words: /album/quack says "album quack". */
function urlWords(url) {
  try {
    const u = new URL(url);
    return words(`${u.hostname.replace(/^www\./, '')} ${decodeURIComponent(u.pathname)}`);
  } catch {
    return [];
  }
}

/**
 * How exactly a result matches the query.
 * @returns {{ total:number, matched:number, inTitle:number, together:number }}
 *   matched  — distinct query words found anywhere (title, snippet or URL)
 *   inTitle  — of those, how many are in the title
 *   together — 0..1, how much of the query appears as written: the share of
 *              adjacent word pairs found side by side, plus a full-phrase bonus
 */
function exactMatch(query, result, keywords = queryKeywords(query)) {
  const total = keywords.length;
  if (!total) return { total: 0, matched: 0, inTitle: 0, together: 0 };
  const titleWords = words(result?.title);
  const text = [...titleWords, ...words(result?.snippet), ...urlWords(result?.url)];
  const have = new Set(text);
  const titleHave = new Set(titleWords);
  // "rapid api" typed, "RapidAPI" written: a joined pair counts as both words.
  for (let i = 0; i + 1 < keywords.length; i += 1) {
    const joined = keywords[i] + keywords[i + 1];
    if (have.has(joined)) { have.add(keywords[i]); have.add(keywords[i + 1]); }
    if (titleHave.has(joined)) { titleHave.add(keywords[i]); titleHave.add(keywords[i + 1]); }
  }
  const matched = keywords.filter((k) => have.has(k)).length;
  const inTitle = keywords.filter((k) => titleHave.has(k)).length;

  const flat = ` ${text.join(' ')} `;
  const pairs = [];
  for (let i = 0; i + 1 < keywords.length; i += 1) pairs.push(`${keywords[i]} ${keywords[i + 1]}`);
  const pairShare = pairs.length ? pairs.filter((p) => flat.includes(` ${p} `)).length / pairs.length : 0;
  const phrase = total > 1 && flat.includes(` ${keywords.join(' ')} `) ? 1 : 0;
  return { total, matched, inTitle, together: Math.min(1, pairShare * 0.7 + phrase * 0.3) };
}

// Videos/clips: the "all" page should not be ten of them unless that is what was asked.
const VIDEO_INTENT = /\b(videos?|watch|trailers?|clips?|mv|official|live|concert|episodes?|reaction|interview|tutorials?|lessons?|how to|lyrics|song|music|stream(ing)?)\b/i;
const isClip = (r) => r?.category === 'videos' || r?.category === 'social' || r?.bias === 'platform';
const TOP = 10;
const MAX_CLIPS_IN_TOP = 3;

/**
 * Keep video/social platforms from filling the whole first page of a plain query.
 * Order is untouched except that clips beyond MAX_CLIPS_IN_TOP in the top ten are
 * moved behind the next pages that match at least one query word. Nothing is removed.
 */
function balanceSources(query, results) {
  if (VIDEO_INTENT.test(String(query || '')) || !Array.isArray(results)) return results;
  const keywords = queryKeywords(query);
  // A page is worth lifting over a clip only if it holds at least half the words typed
  // ("rapid" alone, from a dictionary, is not an answer to "rapid api sign up").
  const qualifies = (r) => !isClip(r) && keywords.length > 0
    && exactMatch(query, r, keywords).matched / keywords.length >= 0.5;
  const out = [];
  const rest = results.slice();
  let clips = 0;
  while (out.length < TOP && rest.length) {
    const r = rest.shift();
    if (isClip(r) && clips >= MAX_CLIPS_IN_TOP) {
      const i = rest.findIndex(qualifies);
      if (i >= 0) { out.push(rest.splice(i, 1)[0]); rest.unshift(r); continue; }
    }
    if (isClip(r)) clips += 1;
    out.push(r);
  }
  return [...out, ...rest];
}

/**
 * Order results most-exact first. Ties fall back to `fallback` (the existing
 * blended score), so freshness, site variety and source weighting still decide
 * between two results that match equally well.
 */
function orderByExactMatch(query, results, fallback = (r) => r.finalScore || 0) {
  const keywords = queryKeywords(query);
  if (!keywords.length) return results;
  // Rarity: a word few results contain ("jaaybo") says more than one nearly all do
  // ("new"). Each query word weighs log-odds of how rare it is in THIS result set;
  // a result's weight is the sum of what it holds. Equal words weigh equal, so this
  // only changes the order when results hold DIFFERENT words.
  const sets = results.map((r) => new Set([...words(r?.title), ...words(r?.snippet), ...urlWords(r?.url)]));
  const n = results.length;
  const weight = Object.fromEntries(keywords.map((k) => {
    const df = sets.filter((s) => s.has(k)).length;
    return [k, 1 + Math.log((n + 1) / (df + 1)) / Math.log(n + 1)];
  }));
  const score = (i) => keywords.reduce((a, k) => a + (sets[i].has(k) ? weight[k] : 0), 0);
  return results
    .map((r, i) => ({ r, m: exactMatch(query, r, keywords), w: Math.round(score(i) * 100) }))
    .sort((a, b) => (b.w - a.w)
      || (b.m.matched - a.m.matched)
      || (b.m.inTitle - a.m.inTitle)
      || (b.m.together - a.m.together)
      || (fallback(b.r) - fallback(a.r)))
    .map(({ r, m }) => ({ ...r, keywordMatch: { matched: m.matched, of: m.total, inTitle: m.inTitle } }));
}

module.exports = { promoteBrandDomain, compoundVariant, fold, balanceSources, queryKeywords, exactMatch, orderByExactMatch };
