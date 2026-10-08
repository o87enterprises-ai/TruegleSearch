// When to say "Safe search on. For 18+ search click here" (owner, 2026-10-08).
//
// The search engines Truegle asks do not report what Safe Search removed, so
// this goes on the two signals that are actually reliable:
//   1. the search is plainly FOR adult material — a short list of
//      unambiguous terms, matched as whole words (no "essex", no "sussex");
//   2. a `site:` search came back with nothing — under strict Safe Search the
//      engines drop some whole sites (site:4chan.org returned 0; on Moderate,
//      10 — the 2026-10-08 audit).
// Never shown with Safe Search already off.
const ADULT = /\b(porn\w*|xxx|nsfw|nudes?|nudity|naked|hentai|onlyfans|camgirls?|erotic\w*|sex\s?(tape|video|cam)s?|milf|r34|rule\s?34|fetish\w*|bdsm|stripper\w*|escorts?|playboy|xvideos|pornhub|xhamster|redtube|chaturbate)\b/i;

export const isAdultQuery = (q) => ADULT.test(String(q || ''));
export const isSiteQuery = (q) => /(^|\s)site:\S+/i.test(String(q || ''));

export function safeSearchMayHaveFiltered({ query, resultCount, safeSearch }) {
  if (!query || safeSearch === 'off') return false;
  if (isAdultQuery(query)) return true;
  return isSiteQuery(query) && resultCount === 0;
}
