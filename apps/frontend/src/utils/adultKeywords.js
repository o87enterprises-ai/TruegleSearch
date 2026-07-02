// Adult content keyword detection — used to gate 18+ ad zones.
// Only called when user is authenticated AND safe search is explicitly off
// AND the user has confirmed their age (honor system) this session.
const ADULT_TERMS = new Set([
  // General adult intent
  'porn', 'porno', 'xxx', 'nsfw', 'nude', 'naked', 'nudes',
  'hentai', 'adult video', 'adult content', 'adult film', 'adult site',
  'sex tape', 'sex video', 'sex cam', 'sexting',
  'erotic', 'erotica', 'erotic story',
  // Body / body types (common search terms)
  'bbw', 'milf', 'dilf', 'mature women', 'granny sex',
  'threesome', 'gangbang', 'orgy', 'creampie', 'cumshot', 'blowjob',
  'handjob', 'squirt', 'bbc',
  // Fetish / kink
  'fetish', 'bdsm', 'bondage', 'kinky', 'foot fetish', 'lingerie model',
  // Cam / live
  'cam girl', 'camgirl', 'live cam', 'cam site', 'onlyfans',
  'only fans', 'escort',
  // Major tube sites / brands
  'pornhub', 'xvideos', 'redtube', 'xhamster', 'youporn', 'brazzers',
  'naughty america', 'bang bros', 'mofos', 'playboy', 'penthouse', 'hustler',
  // Strip club / sex work
  'strip club', 'stripper', 'sex worker',
  // Toys / physical (clear adult purchase intent)
  'dildo', 'vibrator', 'butt plug', 'fleshlight', 'sex toy',
]);

// Terms that require a word-boundary match to avoid false positives
// e.g. "sex" would match "sextant", "anal" would match "analysis"
const WORD_BOUNDARY_TERMS = new Set(['sex', 'anal', 'dp']);

/**
 * Returns true if the query contains at least one adult keyword.
 * Short/ambiguous terms use word-boundary matching; multi-word phrases use substring.
 */
export function isAdultQuery(query = '') {
  if (!query) return false;
  const lower = query.toLowerCase().trim();
  for (const term of ADULT_TERMS) {
    if (WORD_BOUNDARY_TERMS.has(term)) {
      const re = new RegExp(`(?:^|[\\s,])${term}(?:[\\s,]|$)`);
      if (re.test(lower)) return true;
    } else if (lower.includes(term)) {
      return true;
    }
  }
  return false;
}
