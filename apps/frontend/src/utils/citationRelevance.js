/* ── Don't cite a clothing brand for a history question ─────────────────────
 *
 * THE BUG. Chat fetches citations by running the user's question through
 * /api/search and attaching whatever comes back under "Sources:". There is no
 * check that the results have anything to do with the question. Asked about
 * Tartaria, the search latched onto the common word "theory" and the answer
 * shipped citing:
 *
 *     Theory Official Site | Contemporary Clothing for Women and Men
 *     THEORY Definition & Meaning - Merriam-Webster
 *
 * — a fashion retailer and a dictionary entry, presented beneath a detailed
 * history answer as though they were its sources. The model had written from
 * its own knowledge; the citations were decorative.
 *
 * WHY THAT IS SERIOUS rather than untidy. The answer is signed "Research
 * Provided by TrueGLE" and carries a source list. A reader takes that list as
 * the evidence base. Attaching unrelated links to a confident answer is
 * misleading in exactly the way Mandate B forbids — nothing was fabricated,
 * but the IMPRESSION is false, and an unsourced answer honestly labelled is
 * far better than a sourced-looking one that isn't.
 *
 * THE RULE, deliberately set as low a bar as possible: a citation must share at
 * least one DISTINCTIVE word with the question. Not any word — distinctive.
 * "theory", "what", "history" are carried by half the web; "tartaria" is not.
 * Matching on common words is precisely how the fashion retailer got in.
 *
 * Conservative on purpose. This is meant to drop obvious non-sequiturs, not to
 * curate. Losing a real source costs the user evidence they could have checked,
 * which is worse than one loose link surviving — so when in doubt it keeps the
 * result.
 */

// Words too common to prove a result is on-topic. Deliberately includes the
// vocabulary of ASKING (what/why/how/explain) and of enquiry itself
// (theory/history/facts/evidence) — those describe the question's shape, not
// its subject, and they are what the bad match keyed on.
const COMMON = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do',
  'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'so', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'to', 'up', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who',
  'why', 'will', 'with', 'would', 'you', 'your',
  // The vocabulary of enquiry — describes the question, not the subject.
  'about', 'actual', 'actually', 'claim', 'claims', 'evidence', 'explain',
  'fact', 'facts', 'false', 'history', 'idea', 'info', 'information', 'known',
  'mean', 'meaning', 'proof', 'real', 'really', 'research', 'source',
  'sources', 'story', 'theories', 'theory', 'true', 'truth',
]);

const MIN_LEN = 3;

/** Distinctive words in a string: lowercase, de-punctuated, common words out. */
export function distinctiveTerms(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= MIN_LEN && !COMMON.has(w)),
  )];
}

// Length of the common opening run of two words.
const sharedPrefix = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
};

// How much of an opening two words must share to count as the same subject.
//
// SIX WOULD HAVE BEEN WRONG, and the test caught it: "Tartaria" and "Tartary"
// are the same place — Tartary is the spelling actually printed on the maps —
// but they diverge at position 7 ("tartari" vs "tartary"), so neither is a
// prefix of the other and a strict prefix rule threw the primary historical
// source away. They share six characters ("tartar"), so the stem is what
// matches, not the prefix.
//
// Five is low enough for ordinary morphology (plurals, -an, -ian, -ic) and
// still long enough that unrelated words do not collide: "president" and
// "press" share only four.
const STEM = 5;

/**
 * Does this result plausibly belong to this question?
 *
 * Compares STEMS, not whole words, so "tartaria" reaches "tartarian" AND
 * "tartary". Short distinctive words below the stem length must match exactly.
 */
export function isRelevant(result, terms) {
  // No distinctive terms at all (e.g. "what is a theory?") means there is
  // nothing to filter ON. Keep everything rather than silently emptying the
  // source list — see the header: dropping real evidence is the worse error.
  if (!terms || terms.length === 0) return true;

  const hay = distinctiveTerms(
    `${result?.title || ''} ${result?.snippet || ''} ${result?.domain || ''} ${result?.url || ''}`,
  );
  if (hay.length === 0) return true; // nothing to judge; do not punish it

  return terms.some((t) => hay.some((h) => h === t || sharedPrefix(t, h) >= STEM));
}

// Asset and icon hosts. A citation "image" pointing at an SVG icon CDN is
// never content — the Tartaria answer illustrated itself with
// lucide-static/icons/ampersands.svg, which is a UI glyph from our own icon
// set that happened to be indexed.
const ASSET_HOSTS = /(^|\.)(jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fontawesome\.com|gstatic\.com)$/i;
const ICON_PATH = /\.(svg|ico)(\?|$)|\/icons?\/|\/sprite/i;

/** Is this "image" actually a UI asset rather than a picture of something? */
export function isAssetImage(result) {
  const url = result?.image || result?.url || '';
  if (!url) return true;
  if (ICON_PATH.test(url)) return true;
  try { return ASSET_HOSTS.test(new URL(url).hostname); } catch { return false; }
}

/**
 * Filter a fetched citation set against the question.
 * @returns {{links, videos, pics, dropped}} dropped = how many were removed,
 *   so a caller can tell "no sources found" from "sources found, none relevant".
 */
export function filterCitations(citations, query) {
  if (!citations) return citations;
  const terms = distinctiveTerms(query);
  const keep = (arr) => (Array.isArray(arr) ? arr.filter((r) => isRelevant(r, terms)) : []);

  const links = keep(citations.links);
  const videos = keep(citations.videos);
  const pics = keep(citations.pics).filter((p) => !isAssetImage(p));

  const before = (citations.links?.length || 0) + (citations.videos?.length || 0) + (citations.pics?.length || 0);
  const after = links.length + videos.length + pics.length;

  return { ...citations, links, videos, pics, dropped: before - after };
}

export default filterCitations;
