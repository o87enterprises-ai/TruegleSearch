/**
 * Channel (profile) lookup for the Feed — "find @Crisco Art on TikTok" and
 * "paste a facebook.com/share link".
 *
 * WHY THIS EXISTS (owner, 2026-11-21): the feed searches POSTS. A query for a
 * creator's name returned every video that merely mentioned the words, and the
 * creator's own page was thrown away as a "dead card" (PublicSocialSource keeps
 * profiles only when a platform has no posts at all). A person looking for a
 * channel wants the channel first.
 *
 * Two keyless, no-account routes, both verified live before they were written:
 *   1. TikTok oEmbed (`tiktok.com/oembed?url=…/@handle`) answers 200 with the
 *      account's display name for a real handle and 400 for one that does not
 *      exist. Handles are GUESSED from the name, so a hit only counts when the
 *      account's DISPLAY NAME matches what was typed — `@criscoart` exists but
 *      belongs to someone else (user28445693846), `@crisco_art` is "Crisco_Art".
 *   2. A Facebook share link (`facebook.com/share/<id>`) 302s to the real page;
 *      the page serves og:title / og:description / og:image to a link-preview
 *      user agent, which is all a result card needs.
 *
 * Nothing here logs in, scrapes behind a wall, or stores anything: results are
 * cached in memory for an hour, like the SearXNG lanes.
 */
const axios = require('axios');

const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 6000;
const MAX_HOPS = 4;
const PREVIEW_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uagent.php)';
const FB_HOSTS = ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'];

const cache = new Map(); // key -> { at, value }
const remember = async (key, make) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await make();
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
};

const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
const isFacebookHost = (h) => FB_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
const squash = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

const decodeEntities = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const metaTag = (html, prop) => {
  const m = new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i').exec(html)
    || new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i').exec(html);
  return m ? decodeEntities(m[1]) : '';
};

function channelItem({ platform, title, url, snippet, thumbnail }) {
  return {
    id: url, platform, title, url, permalink: url, snippet: snippet || null,
    author: null, subreddit: null, date: null, score: null, comments: null,
    thumbnail: thumbnail || null, flair: null,
    // The client can key a "Channel" badge off this; nothing else depends on it.
    channel: true,
  };
}

/* ── Facebook links ─────────────────────────────────────────────────────── */

/** Is the query a single http(s) URL on a Facebook-owned host? */
function facebookUrlOf(q) {
  const s = String(q || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return null;
  return isFacebookHost(hostOf(s)) ? s : null;
}

/** Follow a share link's redirects by hand, refusing to leave Facebook's hosts. */
async function followFacebook(startUrl) {
  let url = startUrl;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await axios.get(url, {
      maxRedirects: 0,
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': PREVIEW_UA, Accept: 'text/html' },
      validateStatus: (s) => s >= 200 && s < 400,
      responseType: 'text',
      maxContentLength: 2 * 1024 * 1024,
    });
    const next = res.headers && res.headers.location;
    if (res.status >= 300 && next) {
      const abs = new URL(next, url).toString();
      if (!isFacebookHost(hostOf(abs))) return { url, html: '' }; // never follow off-site
      url = abs;
      continue;
    }
    return { url, html: typeof res.data === 'string' ? res.data : '' };
  }
  return { url, html: '' };
}

/** The canonical page address, without the share/tracking parameters. */
function cleanFacebookUrl(url) {
  try {
    const u = new URL(url);
    const keep = u.pathname.replace(/\/+$/, '') === '/profile.php' ? ['id'] : [];
    const kept = new URLSearchParams();
    keep.forEach((k) => { if (u.searchParams.has(k)) kept.set(k, u.searchParams.get(k)); });
    const qs = kept.toString();
    return `https://www.facebook.com${u.pathname.replace(/\/+$/, '')}${qs ? `?${qs}` : ''}`;
  } catch { return url; }
}

async function lookupFacebook(q) {
  const start = facebookUrlOf(q);
  if (!start) return [];
  return remember(`fb:${start}`, async () => {
    try {
      const { url, html } = await followFacebook(start);
      const clean = cleanFacebookUrl(metaTag(html, 'og:url') || url);
      // A page that served no preview (login wall) still resolved; say so plainly
      // rather than inventing a name from the URL.
      const title = metaTag(html, 'og:title') || clean.replace(/^https?:\/\/(www\.)?facebook\.com\//, '');
      return [channelItem({
        platform: 'Facebook', title, url: clean,
        snippet: metaTag(html, 'og:description') || null,
        thumbnail: metaTag(html, 'og:image') || null,
      })];
    } catch { return []; }
  });
}

/* ── TikTok channels by name ────────────────────────────────────────────── */

/** `Crisco Art` -> crisco_art, criscoart, crisco.art … (most likely first). */
function handleGuesses(q) {
  const words = String(q || '').trim().replace(/^@/, '').split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return [];
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z0-9_.]/g, '')).filter(Boolean);
  if (!lower.length) return [];
  const out = new Set();
  if (lower.length === 1) out.add(lower[0]);
  else {
    out.add(lower.join('_'));
    out.add(lower.join(''));
    out.add(lower.join('.'));
  }
  return [...out].filter((h) => h.length >= 2 && h.length <= 24);
}

async function tiktokOembed(handle) {
  try {
    const res = await axios.get('https://www.tiktok.com/oembed', {
      params: { url: `https://www.tiktok.com/@${handle}` },
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleSearch/1.0)' },
    });
    const d = res.data || {};
    return d.author_name ? { handle, name: String(d.author_name) } : null;
  } catch { return null; }
}

async function lookupTikTok(q) {
  const typed = squash(q);
  if (typed.length < 3) return [];
  return remember(`tt:${typed}`, async () => {
    const found = await Promise.all(handleGuesses(q).map((h) => tiktokOembed(h)));
    return found
      .filter(Boolean)
      // The display name has to be the thing that was asked for. An account that
      // merely has the handle (the guess) is not the channel.
      .filter((c) => squash(c.name) === typed)
      .map((c) => channelItem({
        platform: 'TikTok', title: c.name, url: `https://www.tiktok.com/@${c.handle}`,
        snippet: `TikTok channel · @${c.handle}`,
      }));
  });
}

/**
 * Everything the feed can say about "this is a channel / profile link".
 * Never throws: a lookup that fails is an empty lane, like any other source.
 */
async function lookupChannels(q, { tiktok = true, facebook = true } = {}) {
  const s = String(q || '').trim();
  if (!s || s.length > 200) return { items: [], next: null };
  if (facebookUrlOf(s)) return { items: facebook ? await lookupFacebook(s) : [], next: null };
  // Any other URL is a link, not a name to guess handles from.
  if (/^https?:\/\//i.test(s)) return { items: [], next: null };
  return { items: tiktok ? await lookupTikTok(s) : [], next: null };
}

module.exports = { lookupChannels, handleGuesses, facebookUrlOf, cleanFacebookUrl, followFacebook };
