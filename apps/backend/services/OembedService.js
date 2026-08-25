const logger = require('../utils/logger');

/* ── Titles for links that only carry an id ─────────────────────────────────
 *
 * WHY THIS EXISTS. A shared Truegle queue is packed (utils/playerLinkPack) —
 * one host code plus a video id per track, which is what turns a 3,900
 * character link into 353. The saving comes almost entirely from dropping the
 * TITLES, and a title cannot be derived from an id. So the recipient of a
 * shared playlist sees "youtube.com/watch" twenty-five times until they play
 * each one. The link works; it just reads like a bug.
 *
 * WHY IT IS A SERVER ROUTE AND NOT A FETCH FROM THE PAGE. Two reasons, and
 * either alone would be enough:
 *
 *   1. PRIVACY. Asking YouTube "what is the title of this video" from the
 *      visitor's browser tells YouTube that visitor's IP is looking at that
 *      video, before they have played anything. Doing it from here means the
 *      provider sees Truegle's server and learns nothing about who asked —
 *      the same reasoning that keeps the link health check local.
 *   2. It would not work anyway. The site's CSP `connect-src` does not include
 *      youtube.com, and it should not have to be widened for this.
 *
 * WHAT IT IS NOT: a metadata API. It answers one question — the title, and the
 * uploader when the provider volunteers it — for URLs the player can already
 * host. It is not a way to fetch arbitrary URLs through our server, which is
 * what the allowlist below is for.
 */

// Providers with a KEYLESS oEmbed endpoint. Every one of these is free, needs
// no registration and no token. Anything not on this list is refused rather
// than guessed at — an open fetcher is an SSRF gadget, and this is a public
// route.
const PROVIDERS = [
  {
    name: 'youtube',
    match: (h) => h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be'
      || h === 'youtube-nocookie.com' || h.endsWith('.youtube-nocookie.com'),
    endpoint: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'vimeo',
    match: (h) => h === 'vimeo.com' || h.endsWith('.vimeo.com'),
    endpoint: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  },
  {
    name: 'soundcloud',
    match: (h) => h === 'soundcloud.com' || h.endsWith('.soundcloud.com'),
    endpoint: (url) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'dailymotion',
    match: (h) => h === 'dailymotion.com' || h.endsWith('.dailymotion.com') || h === 'dai.ly',
    endpoint: (url) => `https://www.dailymotion.com/services/oembed?format=json&url=${encodeURIComponent(url)}`,
  },
];

// A title is worth remembering for a long time — it effectively never changes,
// and a miss costs a round trip on somebody else's shared link.
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_ENTRIES = 500;
const FETCH_TIMEOUT_MS = 4000;

const cache = new Map(); // url -> { at, value }

// Returns undefined for "never looked up" and the stored value — which may
// legitimately be null — for "looked up already".
//
// These MUST be different answers. Conflating them (returning null for both)
// meant a cached MISS was indistinguishable from a cache miss, so a dead link
// in a shared queue was re-fetched on every single render. That is the case
// the cache exists for most: a hit resolves once and is done, but a 404 would
// otherwise ask forever.
function cacheGet(url) {
  const hit = cache.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) { cache.delete(url); return undefined; }
  return hit.value;
}

function cacheSet(url, value) {
  // Oldest-first eviction. Map preserves insertion order, so the first key is
  // the oldest — no timestamps to sort.
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(url, { at: Date.now(), value });
}

/** The provider for a URL, or null when it is not one we will fetch. */
function providerFor(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  // https only. A http:// URL here would be an unencrypted request made BY US,
  // on the user's behalf, which is worse than not answering.
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  return PROVIDERS.find((p) => p.match(host)) || null;
}

/**
 * Look up a title (and uploader, when offered) for one media URL.
 * @returns {Promise<{title: string, author: string|null, provider: string}|null>}
 *   null when the URL is not from an allowlisted provider, or the lookup failed.
 */
async function lookup(raw) {
  const url = String(raw || '').trim();
  if (!url || url.length > 500) return null;

  const provider = providerFor(url);
  if (!provider) return null;

  const cached = cacheGet(url);
  if (cached !== undefined) return cached;

  // A provider that is slow or down must not hold the request open. A missing
  // title is a cosmetic loss; a hung request is not.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(provider.endpoint(url), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });
    // 401/403/404 all mean "no title for you" — private, deleted, or
    // embedding-disabled. Cached as a miss so a dead link in a shared queue is
    // not re-asked on every render.
    if (!response.ok) { cacheSet(url, null); return null; }

    const data = await response.json();
    const title = typeof data?.title === 'string' ? data.title.trim().slice(0, 200) : '';
    if (!title) { cacheSet(url, null); return null; }

    const value = {
      title,
      author: typeof data?.author_name === 'string' ? data.author_name.trim().slice(0, 100) : null,
      provider: provider.name,
    };
    cacheSet(url, value);
    return value;
  } catch (error) {
    // Timeouts and network errors are NOT cached — the next attempt should be
    // allowed to succeed rather than being told "no" for six hours.
    if (error?.name !== 'AbortError') {
      logger.warn('oEmbed lookup failed', { provider: provider.name, error: error?.message });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up several at once, in parallel, tolerating individual failures.
 * @param {string[]} urls
 * @returns {Promise<Record<string, {title, author, provider}>>} keyed by url;
 *   URLs that resolved to nothing are simply absent.
 */
async function lookupMany(urls) {
  const list = [...new Set((urls || []).filter(Boolean))].slice(0, 25);
  const settled = await Promise.allSettled(list.map((u) => lookup(u)));
  const out = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) out[list[i]] = r.value;
  });
  return out;
}

module.exports = { lookup, lookupMany, providerFor, __cache: cache };
