// Adult content keyword detection — used to gate 18+ ad zones.
// Only called when user is authenticated AND safe search is explicitly off.
const ADULT_TERMS = new Set([
  'porn', 'xxx', 'nsfw', 'nude', 'naked', 'hentai', 'adult video',
  'adult content', 'sex', 'erotic', 'lingerie model', 'onlyfans',
  'cam girl', 'camgirl', 'strip club', 'escort', 'milf', 'fetish',
  'bdsm', 'adult film', 'adult site', 'pornhub', 'xvideos', 'redtube',
  'xhamster', 'youporn', 'brazzers', 'playboy', 'penthouse', 'hustler',
]);

/**
 * Returns true if the query contains at least one adult keyword.
 * Intentionally coarse — false positives are fine (an extra ad showing
 * is better than a missed impression); false negatives mean lost revenue.
 */
export function isAdultQuery(query = '') {
  if (!query) return false;
  const lower = query.toLowerCase();
  for (const term of ADULT_TERMS) {
    if (lower.includes(term)) return true;
  }
  return false;
}
