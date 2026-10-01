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

const words = (text) => String(text || '').toLowerCase()
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
  const matched = keywords.filter((k) => have.has(k)).length;
  const inTitle = keywords.filter((k) => titleHave.has(k)).length;

  const flat = ` ${text.join(' ')} `;
  const pairs = [];
  for (let i = 0; i + 1 < keywords.length; i += 1) pairs.push(`${keywords[i]} ${keywords[i + 1]}`);
  const pairShare = pairs.length ? pairs.filter((p) => flat.includes(` ${p} `)).length / pairs.length : 0;
  const phrase = total > 1 && flat.includes(` ${keywords.join(' ')} `) ? 1 : 0;
  return { total, matched, inTitle, together: Math.min(1, pairShare * 0.7 + phrase * 0.3) };
}

/**
 * Order results most-exact first. Ties fall back to `fallback` (the existing
 * blended score), so freshness, site variety and source weighting still decide
 * between two results that match equally well.
 */
function orderByExactMatch(query, results, fallback = (r) => r.finalScore || 0) {
  const keywords = queryKeywords(query);
  if (!keywords.length) return results;
  return results
    .map((r) => ({ r, m: exactMatch(query, r, keywords) }))
    .sort((a, b) => (b.m.matched - a.m.matched)
      || (b.m.inTitle - a.m.inTitle)
      || (b.m.together - a.m.together)
      || (fallback(b.r) - fallback(a.r)))
    .map(({ r, m }) => ({ ...r, keywordMatch: { matched: m.matched, of: m.total, inTitle: m.inTitle } }));
}

module.exports = { queryKeywords, exactMatch, orderByExactMatch };
