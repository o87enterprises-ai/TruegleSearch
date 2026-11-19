/**
 * Does a page of web results actually answer the query?
 *
 * WHY THIS EXISTS (2026-11-19). "lane county court house eugene oregon" came back from the
 * mainstream mode as Lane Bryant, Lane Boots, Merriam-Webster "lane" and Park Lane Jewelry: every
 * result matched the first word and nothing else. Truegle sent the right words; the box's only
 * answering engine (Bing — Google/DuckDuckGo/Wikipedia contributed nothing) treated the query as
 * the single word "lane". Nothing downstream noticed, because the page was full and the engine
 * had answered, so quantity and engine-count checks both passed. This measures what those can't:
 * do the results contain the words that were asked for?
 *
 * It is deliberately cheap, local and language-agnostic: no network, no model, no word lists
 * beyond a short stop list. It only decides whether a second look is worth ONE more request; it
 * never removes or reorders anything on its own.
 */

// Words that carry no topic. Kept short on purpose — a long list starts deleting real queries.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with',
  'is', 'are', 'was', 'were', 'be', 'how', 'what', 'why', 'when', 'where', 'who', 'which',
  'do', 'does', 'did', 'can', 'i', 'my', 'me', 'near', 'best', 'top', 'vs', 'about',
]);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// "courts" and "court" are the same ask, and so are "counties" and "county". Plurals only, longer
// words only — the same rule SearchService's own term matcher uses.
const stem = (w) => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  return w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
};

/** The distinct, meaningful words of a query ("lane county court house eugene oregon" → 6). */
function significantTerms(query) {
  const out = [];
  for (const w of norm(query).split(' ')) {
    if (w.length < 2 || STOP.has(w)) continue;
    const s = stem(w);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** How many of `terms` a single result mentions in its title, snippet or address. */
function termHits(result, terms) {
  const text = norm(`${result?.title || ''} ${result?.snippet || ''} ${result?.url || ''}`);
  if (!text) return 0;
  const words = new Set(text.split(' ').map(stem));
  // "court house" in the query matches "courthouse" in a page (and the reverse): also compare
  // against the text with its spaces removed. Only for terms of 4+ letters, so "or"/"mi" can't
  // match inside unrelated words.
  const squashed = text.replace(/ /g, '');
  let hits = 0;
  for (const t of terms) {
    if (words.has(t) || (t.length >= 4 && squashed.includes(t))) hits += 1;
  }
  return hits;
}

/**
 * @param {Array} results  formatted web results, best first
 * @param {string} query   what the user typed
 * @param {{top?: number}} [opts]
 * @returns {{offTopic: boolean, onTopic: number, checked: number, terms: string[]}}
 *   offTopic is only ever true when there are enough words to judge (3+). One- and two-word
 *   queries ("weather", "chat gpt") are navigational or ambiguous, and a wrong guess there would
 *   cost a request on nearly every search.
 */
function assess(results, query, opts = {}) {
  const terms = significantTerms(query);
  const rows = (Array.isArray(results) ? results : []).slice(0, opts.top || 8);
  const base = { offTopic: false, onTopic: 0, checked: rows.length, terms };
  if (terms.length < 3 || rows.length === 0) return base;

  // A result is "on topic" when it holds at least half the query's words (and never fewer than 2).
  const need = Math.max(2, Math.ceil(terms.length / 2));
  const onTopic = rows.filter((r) => termHits(r, terms) >= need).length;
  // A good page has a few of these in its top eight. Fewer than 2 means the answer is missing.
  return { ...base, onTopic, offTopic: onTopic < Math.min(2, rows.length) };
}

module.exports = { assess, significantTerms, termHits };
