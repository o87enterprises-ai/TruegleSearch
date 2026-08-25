// Explicit .js extensions: this module is reachable from the Cloudflare Pages
// middleware, which is bundled outside Vite's resolver.
import { getPlayable } from './videoEmbed.js';
import { buildPlayerLink, titleFromUrl } from './playerLink.js';

/* ── "The user pasted a link" ───────────────────────────────────────────────
 *
 * THE BUG THIS EXISTS TO FIX. Pasting a YouTube playlist URL into the search
 * bar ran it as a TEXT SEARCH. The backend did what it was asked and matched
 * on the words in the string, so a link to an album came back as a page of
 * results about HTTP vs HTTPS — the query had been read as prose because
 * nothing on the way in ever asked whether it was a URL.
 *
 * A pasted link is not a search. It is one of exactly two intents:
 *
 *   playable → open it. The player is the answer; a list of pages ABOUT the
 *              link is not, and never was.
 *   anything → show it as ONE link, with the AI summary above it saying what
 *   else       it is. Still not a list: the user already knows which page
 *              they want, they just arrived holding the URL instead of a
 *              query.
 *
 * WHAT IS DELIBERATELY NOT A URL HERE. Bare hostnames stay searches. "node.js",
 * "example.com" and "3.14" all look like hosts to a loose regex, and turning
 * a real search into a link card is a worse failure than missing a link — the
 * user can always paste a fuller URL, but they cannot un-hijack a query. So a
 * scheme-less string only counts if it has a path or a query on it.
 */

// Tracking params that ride along on a shared link and identify the SHARER.
// Stripped before anything is stored, embedded or handed onward — on a product
// that sets zero cookies, silently forwarding someone's YouTube share token
// would be the one place we passed an identifier along.
const TRACKING_PARAMS = [
  'si', 'feature', 'pp',                                  // YouTube share sheet
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'igshid', 'mc_eid', 'ref_src', 'ref_url',
];

/** Drop share-tracking parameters. Returns the URL unchanged if it won't parse. */
export function stripTracking(raw) {
  try {
    const u = new URL(raw);
    let touched = false;
    for (const p of TRACKING_PARAMS) {
      if (u.searchParams.has(p)) { u.searchParams.delete(p); touched = true; }
    }
    if (!touched) return raw;
    // Re-serialise without a trailing '?' when that emptied the query string.
    const qs = u.searchParams.toString();
    return `${u.origin}${u.pathname}${qs ? `?${qs}` : ''}${u.hash}`;
  } catch {
    return raw;
  }
}

/**
 * Is this whole query string a single URL? Returns the normalized absolute URL,
 * or null. Whitespace anywhere means prose, not a link — a URL with a space in
 * it is not a URL, and "check out youtube.com/watch" is a sentence.
 */
export function asUrl(text) {
  const raw = String(text || '').trim();
  if (!raw || /\s/.test(raw)) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return u.hostname ? stripTracking(u.toString()) : null;
    } catch { return null; }
  }

  // Refuse every other scheme explicitly. javascript:, data: and file: must
  // never reach a place that might render or navigate to them.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;

  // Scheme-less. Needs a host AND a path/query — see the header note on why a
  // bare hostname stays a search.
  const m = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)([/?#].*)$/i.exec(raw);
  if (!m) return null;
  // A last TLD-ish sanity check: letters only, at least two of them.
  const tld = m[1].split('.').pop();
  if (!/^[a-z]{2,}$/i.test(tld)) return null;
  try {
    const u = new URL(`https://${raw}`);
    return stripTracking(u.toString());
  } catch { return null; }
}

/**
 * Classify a submitted query.
 *
 * @returns {null | {
 *   kind: 'playable' | 'link',
 *   url: string,          // normalized, tracking stripped
 *   host: string,         // display host, no leading www.
 *   title: string,        // best-effort label
 *   playerLink: string|null,  // /tube link, present only when kind==='playable'
 *   media: object|null,       // getPlayable() output when playable
 * }}
 *   null when the query is ordinary prose and should be searched normally.
 */
export function classifyQuery(text, origin) {
  const url = asUrl(text);
  if (!url) return null;

  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep '' */ }

  const media = getPlayable(url);
  return {
    kind: media ? 'playable' : 'link',
    url,
    host,
    title: titleFromUrl(url),
    // buildPlayerLink re-checks playability itself and returns null if the
    // link isn't hostable, so this stays null for kind==='link' without a
    // second branch here.
    playerLink: buildPlayerLink({ url, title: titleFromUrl(url) }, origin),
    media,
  };
}

/**
 * A short, plain description of what a link IS, for the chat surface and the
 * single-link card. Deliberately factual: what host, what kind of thing, what
 * Truegle will do with it. No claims about the CONTENT — we have not fetched
 * it, and guessing is how a summary ends up confidently wrong.
 */
export function describeLink(info) {
  if (!info) return '';
  const { host, media, kind } = info;
  if (kind !== 'playable') {
    return `A link to ${host}. Truegle can't play this one in the app, so it opens on ${host} itself.`;
  }
  const what = {
    youtube: 'a YouTube video',
    vimeo: 'a Vimeo video',
    dailymotion: 'a Dailymotion video',
    rumble: 'a Rumble video',
    odysee: 'an Odysee video',
    tiktok: 'a TikTok',
    reddit: 'a Reddit post',
    soundcloud: 'a SoundCloud track',
    audio: 'an audio file',
    video: 'a video file',
  }[media?.kind] || 'media';
  // A playlist link is a LIST, not "a video that also has a list" — saying
  // "a YouTube video (a playlist)" was the wrong noun with a correction
  // stapled on. The bare /playlist form is unambiguous; /watch?v=…&list=… is
  // genuinely one video inside a list, and reads as such.
  const isList = /[?&]list=/.test(info.url);
  const isBareList = /\/playlist(\?|$)/.test(info.url);
  const noun = isBareList ? `a playlist on ${host}` : `${what} on ${host}`;
  const tail = isList && !isBareList ? ', from a playlist — the rest queues up behind it' : '';
  const first = `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  return `${first}${tail}. It plays inside Truegle — no cookies, no account.`;
}
