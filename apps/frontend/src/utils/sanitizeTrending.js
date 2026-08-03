// Sanitizer for anything user-submitted that Truegle republishes publicly —
// today that's the live "Trending on Truegle" feed on the landing page, which
// is built from real visitors' search queries.
//
// Somebody else's search is not our content to broadcast verbatim. A single
// query containing an email address, a phone number, or a slur would be shown
// to every visitor on the front page. So: detect, then mask with asterisks.
//
// Two different failure modes, handled differently on purpose:
//   • Profanity / adult terms → masked for display. The query itself is still
//     a legitimate thing to search, it just isn't something to print on the
//     landing page, so the pill stays clickable.
//   • Personal information → the whole entry is dropped (`blocked`). Masking
//     an email to `*****@*****.com` still advertises that someone searched a
//     person, and leaving the pill clickable would run that search for anyone
//     who taps it. There is no version of this worth showing.
//
// This is display-side defence. It is deliberately conservative: it will miss
// things (a full name in plain text is not detectable this way), so it is a
// filter, not a guarantee.

// ── personal information ──────────────────────────────────────────────────
// Only high-confidence patterns. Anything fuzzier produces false positives on
// ordinary searches, and a trending feed that eats normal queries is worse
// than useless.
const PII_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.]{2,}/,                          // email
  /\b(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, // phone
  /\b\d{3}-\d{2}-\d{4}\b/,                               // US SSN
  /\b(?:\d[ -]?){13,16}\b/,                              // card number
  /\b\d{1,5}\s+[\w\s]{2,30}\s(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b\.?/i, // street address
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,                         // IPv4
];

// ── profanity + adult terms ───────────────────────────────────────────────
// A filter list, kept deliberately short: the common slurs and explicit terms
// that would actually embarrass the front page. Matching is word-boundary
// based, so "Scunthorpe", "classic", "assess" and "cocktail" survive.
//
// Known and accepted false positives: 'dick' and 'cock' are also a name and a
// bird, so "Dick Cheney interview" renders as "**** Cheney interview". On a
// public landing page, over-masking a surname is the cheaper mistake than
// under-masking the other reading, and telling the two apart needs a name
// model we're not going to ship for a trending pill.
const BLOCKED_WORDS = [
  // profanity
  'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'shit', 'shitty',
  'bullshit', 'bitch', 'bastard', 'asshole', 'dickhead', 'cunt', 'twat',
  'wanker', 'prick', 'slut', 'whore', 'douchebag', 'ass', 'arse',
  // slurs
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny',
  'kike', 'spic', 'chink', 'wetback', 'gook',
  // adult / explicit
  'porn', 'porno', 'pornhub', 'xxx', 'xvideos', 'xhamster', 'onlyfans',
  'nsfw', 'hentai', 'milf', 'blowjob', 'handjob', 'creampie', 'cumshot',
  'anal', 'deepthroat', 'gangbang', 'bukkake', 'dildo', 'fleshlight',
  'masturbate', 'masturbation', 'orgasm', 'nudes', 'nude', 'naked',
  'boobs', 'tits', 'titties', 'pussy', 'cock', 'dick', 'penis', 'vagina',
  'cum', 'jizz', 'escort', 'brothel', 'camgirl', 'sexcam', 'sextape',
];

const BLOCKED = new Set(BLOCKED_WORDS);

// Common substitutions used to slip past exactly this kind of list.
const LEET = { '@': 'a', '4': 'a', '8': 'b', '3': 'e', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };
const LEET_CHARS = /[@4831!|0$57+]/g;
const CENSOR_CHARS = /[*#._-]/;

// Consonant skeletons ("fuck" → "fck") of the blocked list. Only consulted
// when a token contains a censoring character, because skeletons alone are
// far too loose — "duck" and "dick" share one, and masking "duck" on the
// landing page would be its own kind of embarrassing.
const SKELETONS = new Set(BLOCKED_WORDS.map((w) => w.replace(/[aeiou]/g, '')).filter((s) => s.length >= 3));

function isBlockedWord(token) {
  const lower = token.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, '');
  if (BLOCKED.has(letters)) return true;

  // Leet substitution: sh1t, @ss, p0rn.
  const deLeet = lower.replace(LEET_CHARS, (c) => LEET[c] ?? c).replace(/[^a-z]/g, '');
  if (BLOCKED.has(deLeet)) return true;

  // Stretched letters: fuuuuck.
  const collapsed = deLeet.replace(/(.)\1+/g, '$1');
  if (collapsed.length >= 3 && BLOCKED.has(collapsed)) return true;

  // Self-censored: f*ck, s#it.
  if (CENSOR_CHARS.test(token)) {
    const skeleton = deLeet.replace(/[aeiou]/g, '');
    if (skeleton.length >= 3 && SKELETONS.has(skeleton)) return true;
  }
  return false;
}

const mask = (text) => '*'.repeat(text.length);

/**
 * @param {string} query a user-submitted search query
 * @returns {{ text: string, blocked: boolean, masked: boolean }}
 *   `text` is safe to render. `blocked` means don't render it at all.
 */
export function sanitizeTrendingQuery(query) {
  const raw = typeof query === 'string' ? query : '';
  if (!raw.trim()) return { text: '', blocked: true, masked: false };

  // Personal information: drop the whole entry, see the note up top.
  if (PII_PATTERNS.some((re) => re.test(raw))) {
    return { text: '', blocked: true, masked: false };
  }

  let masked = false;
  // Token boundaries include the symbols used for leet substitution, so
  // "f*ck" is examined as one token rather than "f" and "ck".
  const text = raw.replace(/[\p{L}\p{N}@$!*+|#._-]+/gu, (token) => {
    if (!isBlockedWord(token)) return token;
    masked = true;
    return mask(token);
  });

  // A pill that's mostly asterisks carries no information and just draws the
  // eye to what was censored — drop it instead.
  const letters = text.replace(/\s/g, '');
  const stars = (text.match(/\*/g) || []).length;
  const blocked = letters.length > 0 && stars / letters.length > 0.5;

  return { text, blocked, masked };
}

/**
 * Filter + mask a list of trending items in one pass.
 *
 * Each surviving item gets a `searchQuery`: the masked text with the censored
 * tokens removed entirely. Tapping a masked pill then searches the harmless
 * remainder ("car **** repair" → "car repair") instead of either running the
 * offensive query or searching a string of asterisks.
 *
 * @param {Array<{query: string}>} items
 */
export function sanitizeTrendingList(items) {
  return (items || []).reduce((acc, item) => {
    const { text, blocked } = sanitizeTrendingQuery(item?.query);
    if (blocked) return acc;
    const searchQuery = text.replace(/\*+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    acc.push({ ...item, query: text, searchQuery: searchQuery || text });
    return acc;
  }, []);
}
