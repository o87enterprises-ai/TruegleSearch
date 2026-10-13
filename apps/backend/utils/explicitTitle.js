// Explicit titles, music, and rows that are not videos at all — shared by the
// platform pool (MediaService.trending) and the player's search.
//
// WHAT THIS IS FOR. Two places hand strangers video suggestions under Safe
// Search: the cold-start pool and the player's search box. Owner, 2026-10-13:
// "hide explicit titles" for the first, and for the second "when safe search is
// on it won't pull results that have cussing in it, so searching for songs
// becomes cumbersome … allow all music to be played unless the song link is
// explicitly 18+ gated."
//
// WHAT THIS IS NOT. It is not a ban, and it is NOT a profanity filter. Swearing
// is on no list here: a song full of it is music, and music passes. What is
// hidden is sexual material. Nothing is removed from the index or from anyone's
// ability to play it; a visitor who is signed in and has turned Safe Search off
// gets everything (same rule as the social feed: off AND signed in).
//
// TWO TIERS, because the same word means different things in a song title:
//   HARD — porn, hentai, NSFW, explicit acts. Hidden no matter what.
//   SOFT — words that are also real song/album titles ("Naked", "Nude",
//          "Lingerie", "Strippers"). Hidden UNLESS the row looks like music.
//
// BIASED TOWARD HIDING WITHIN THAT. A false positive costs one video that is not
// volunteered to a stranger — it can still be searched for. A false negative
// puts something explicit in front of a child. Every bounded term is
// word-bounded so "Essex", "Sussex", "analysis" and "Scunthorpe" are not caught.

const HARD_TERMS = [
  // outright adult material
  'porn(?:o|hub|ography|star|stars)?', 'xxx+', 'nsfw', 'hentai', 'rule\\s*34', '18\\+',
  'erotic(?:a)?', 'adult\\s+(?:video|videos|film|films|content|only)',
  'sexually\\s+explicit', 'sex\\s+(?:tape|video|videos|scene|scenes|toy|toys|cam|chat|story|stories|party|slave)',
  // acts
  'fellatio', 'cunnilingus', 'blow\\s*jobs?', 'hand\\s*jobs?', 'cum\\s*shots?', 'creampie',
  'gang\\s*bang', 'orgy', 'orgies', 'threesomes?', 'anal',
  'cum', 'cumming', 'jack\\s*off', 'nut\\s*bust(?:er|ers|ing)?',
  // bodies
  'penis(?:es)?', 'vagina', 'genitals?', 'busty',
  // toys, services
  'dildos?', 'vibrators?', 'milf', 'bbw', 'bdsm',
  'only\\s*fans', 'cam\\s*girls?',
  // seen in the live pool
  'erome', 'ss?bbw', 'pawg', 'sissy', 'futanari', 'regla\\s*34', 'sex\\s+(?:robot|robots|doll|dolls)',
];
// Words that are ALSO real song titles. Hidden unless the row looks like music.
const SOFT_TERMS = [
  'naked', 'nudes?', 'lingerie', 'topless', 'fetish', 'bondage',
  'strippers?', 'strip\\s*(?:tease|club|clubs)',
];
// Stems unmistakable even GLUED into a longer token — uploaders name files
// "animopron_720p" and hashtag "#nsfw" — so these match anywhere, not just at
// word edges. Only stems with no innocent word containing them: 'porn' is in
// "pornography" but not in "unicorn"; bare 'anal' or 'pron' (apron) are NOT here.
const HARD_STEMS = ['porn', 'pr0n', 'p0rn', 'animopron', 'hentai', 'nsfw', 'fellat', 'cunnilingus',
  'blowjob', 'cumshot', 'creampie', 'gangbang', 'dildo', 'bdsm', 'jackoff'];

const HARD = new RegExp(`${HARD_STEMS.join('|')}|\\b(?:${HARD_TERMS.join('|')})\\b`, 'i');
const SOFT = new RegExp(`\\b(?:${SOFT_TERMS.join('|')})\\b`, 'i');

/** 'hard' | 'soft' | null — which tier of explicit this text reads as. */
const explicitTier = (text) => {
  if (typeof text !== 'string' || !text) return null;
  if (HARD.test(text)) return 'hard';
  if (SOFT.test(text)) return 'soft';
  return null;
};

/** Does this text (a title, a channel name) read as explicit at all, music or not? */
const isExplicitTitle = (text) => explicitTier(text) !== null;

// Hosts whose whole business is adult material — a result from one is explicit
// whatever it is called.
const ADULT_HOSTS = /(?:^|[./])(?:pornhub|xvideos|xnxx|xhamster|redtube|youporn|spankbang|eporner|brazzers|onlyfans|chaturbate|stripchat|livejasmin|rule34|e621|nhentai|hanime|erome)\./i;

// ── what counts as MUSIC ─────────────────────────────────────────────────────
// A heuristic, and an honest one: it only has to be right often enough to let a
// song called "Naked" through, because the HARD tier never depends on it.
//   · a " - Topic" channel is YouTube's auto-generated artist channel — the most
//     reliable music signal there is;
//   · VEVO and the music hosts;
//   · the words uploaders put on a song.
const MUSIC_CHANNEL = /(?:\s-\s*topic\s*$|vevo\b)/i;
const MUSIC_TITLE = /\b(?:official\s+(?:music\s+)?(?:video|audio|visuali[sz]er|lyric\s+video)|music\s+video|lyrics?|lyric\s+video|audio|remix|acoustic|feat\.?|ft\.|live\s+(?:at|on|in|session|performance)|album|single|ep)\b/i;
const MUSIC_KINDS = new Set(['soundcloud', 'audio']);
const MUSIC_HOSTS = /(?:soundcloud|bandcamp|audiomack|spotify|deezer|mixcloud)\./i;

/** Does this row look like a song? */
const looksLikeMusic = ({ title = '', channel = '', kind = '', url = '' } = {}) =>
  MUSIC_CHANNEL.test(channel || '') || MUSIC_TITLE.test(title || '')
  || MUSIC_KINDS.has(kind) || MUSIC_HOSTS.test(url || '');

/**
 * Should this row be kept away from a visitor who has Safe Search on?
 *   HARD terms, or an adult site → always.
 *   SOFT terms → unless it looks like music.
 * Swearing is not consulted at all.
 */
const isExplicitRow = ({ title = '', channel = '', kind = '', url = '' } = {}) => {
  if (ADULT_HOSTS.test(url || '')) return true;
  const tiers = [explicitTier(title), explicitTier(channel)];
  if (tiers.includes('hard')) return true;
  if (tiers.includes('soft')) return !looksLikeMusic({ title, channel, kind, url });
  return false;
};

// A playlist or a "series" embed is a list of videos, not a video.
const NOT_A_VIDEO = /(?:youtube\.com\/playlist\b|[?&/]videoseries\b)/i;

/**
 * Rows that are not a single watchable video. Hidden for EVERYONE — unlike
 * explicit titles this is not a content call, it is a row that cannot play as
 * one video.
 *
 * DELIBERATELY NARROW. A first version also hid any row whose title was just a
 * link ("youtube.com/watch"), reasoning that it reads as broken. Checked against
 * the live pool, that rule hid Gangnam Style, Despacito and Never Gonna Give You
 * Up — real, playable, popular videos whose title lookup merely failed. A bad
 * TITLE is a display problem; it is not a reason to withhold the video.
 */
const isJunkRow = ({ mediaKey = '', pageUrl = '' } = {}) =>
  /^youtube:videoseries$/i.test(mediaKey) || NOT_A_VIDEO.test(pageUrl || '');

module.exports = { isExplicitTitle, explicitTier, isExplicitRow, looksLikeMusic, isJunkRow };
