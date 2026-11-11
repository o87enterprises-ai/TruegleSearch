const axios = require('axios');
const config = require('../../config/env');
const { shared: serverGuard } = require('./ServerGuard');

// Public social posts, via our own SearXNG — no API key, no developer account.
//
// ── WHY THIS INSTEAD OF THE OFFICIAL APIS ───────────────────────────────────
//
// Every platform worth reading has closed or priced its read API: X wants $200
// a month, Instagram's Basic Display shut down, Facebook will not grant
// user_posts to non-partners, TikTok returns only the caller's own videos, and
// Reddit blocks keyless reads from datacenter IPs. Chasing credentials through
// six approval queues was the old plan, and it was blocked at every door.
//
// None of those platforms removed their PUBLIC WEB PAGES, though — the ones a
// signed-out visitor can read and a search engine indexes. SearXNG already
// queries those indexes, which is why this needs no key, no account and no
// approval: it reads what is already public, the same way a person following a
// link would.
//
// ── SEARCH RESULTS ARE NOT POST OBJECTS ─────────────────────────────────────
//
// What comes back is a title, a URL and an extract. There is no score and no
// comment count, so both are NULL rather than 0 — a zero renders as a real vote
// count of nothing, which is a different and false claim. The generic feed card
// already handles null for both.
//
// ── THE QUERY RULES, LEARNED THE HARD WAY ───────────────────────────────────
//
// These are not style preferences. Each one is a bug that shipped:
//
//   1. DOMAIN-ONLY `site:`. `site:reddit.com/r/news` is a PATH prefix, and only
//      Google honours it — every other engine returns nothing at all for it.
//   2. NO OR-GROUPS. The provider does not honour `(a OR b OR c)`. One query per
//      platform, never a combined one, however tempting the saved round trip.

const SEARX_TIMEOUT_MS = 8000;
// The engines that actually returned platform posts on the live instance
// (2026-11-07): main search's `site:tiktok.com viral` rows all came from
// "duckduckgo videos" and "bing videos" — the web engines answer thinly from
// this box (one engine per query in the logs). Video engines first, then the
// web ones. Overridable without a deploy; empty = skip to the categories.
const FEED_ENGINES = process.env.FEED_SEARX_ENGINES ?? 'duckduckgo videos,bing videos,duckduckgo,bing,mojeek';

// TWENTY MINUTES (was five; owner, 2026-11-10: "stricter caching for the
// individual feed servers"), through services/feed/ServerGuard.js, which also
// single-flights concurrent readers, serves the last good page for up to six
// hours when SearXNG fails, and leaves a network alone for 1-15 minutes after a
// rate-limit or timeout instead of asking it again on every request. An EMPTY
// page is believed for two minutes only, so a bad moment is not remembered.
//
// THIS IS LOAD PROTECTION, NOT AN OPTIMISATION. The SearXNG box is a 1 GB
// t3.micro. Six platforms switched on means six queries per feed page, per
// reader, on the same box that serves the main search. Without this cache a
// handful of people scrolling is a self-inflicted denial of service.
const SEARX_TTL_MS = 20 * 60 * 1000;

/** The domains behind each feed source id. Domain only — see rule 1. */
const PLATFORM_DOMAINS = {
  x: { domain: 'x.com', label: 'X' },
  instagram: { domain: 'instagram.com', label: 'Instagram' },
  facebook: { domain: 'facebook.com', label: 'Facebook' },
  tiktok: { domain: 'tiktok.com', label: 'TikTok' },
  rumble: { domain: 'rumble.com', label: 'Rumble' },
  truthsocial: { domain: 'truthsocial.com', label: 'Truth Social' },
  pinterest: { domain: 'pinterest.com', label: 'Pinterest' },
  // Reddit is here so fetchReddit can FALL BACK to it, and is deliberately
  // excluded from the fan-out list in routes/social.js — it already has its own
  // source, which tries the keyless JSON endpoints first. See the note there.
  reddit: { domain: 'reddit.com', label: 'Reddit' },
};

// What a POST looks like on each platform — the pages the Feed player can
// embed (see the frontend's utils/videoEmbed.js). A search for "NASA" on
// x.com returns x.com/NASA (a profile, which embeds as nothing) alongside
// x.com/NASA/status/… (a post, which plays). Posts are what a feed is for.
const POST_PATH = {
  x: /\/status\/\d+/,
  instagram: /^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+/,
  facebook: /\/(?:videos|posts|reel|reels)\/|\/watch\/?\?v=|permalink\.php|story\.php/,
  tiktok: /\/video\/\d+/,
  rumble: /^\/(?:embed\/)?v[a-z0-9]+/,
  truthsocial: /^\/@[^/]+\/(?:posts\/)?\d+/,
  pinterest: /^\/pin\/\d+/,
  reddit: /\/comments\//,
};

function isPost(url, platform) {
  const re = POST_PATH[platform];
  if (!re) return true;
  try {
    const u = new URL(url);
    return re.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

function isSiteRoot(url) {
  try { return new URL(url).pathname.replace(/\/+$/, '') === ''; } catch { return true; }
}

const isConfigured = () => Boolean(config.searxng && config.searxng.url);

/**
 * Ask SearXNG once.
 *
 * Deliberately a direct call rather than going through SearchService: that is a
 * class whose constructor wires up every paid provider the app has, and a feed
 * source should not drag all of it in to send one GET. The parameter shape is
 * copied from performSearXNGCategorySearch so the two stay recognisably the
 * same request.
 */
async function askSearx(query, category, page, engines) {
  const params = { q: query, format: 'json', pageno: page };
  if (engines) params.engines = engines; else params.categories = category;
  const res = await axios.get(`${config.searxng.url}/search`, {
    params,
    headers: {
      // The instance sits behind ngrok in some deployments and serves an
      // interstitial page instead of JSON without this.
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'TruegleSearch/1.0',
    },
    timeout: SEARX_TIMEOUT_MS,
  });
  return Array.isArray(res.data && res.data.results) ? res.data.results : [];
}

/** Is this result actually from the platform we asked about? */
function onDomain(url, domain) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const want = domain.toLowerCase();
    return host === want || host.endsWith(`.${want}`);
  } catch {
    return false;
  }
}

function normalise(rows, platformLabel, domain) {
  return rows
    // An engine can return something from elsewhere when its site: handling is
    // soft. A result that is not on the platform's own domain is not a post
    // from that platform, and labelling it as one would be a lie on screen.
    .filter((r) => r && r.url && onDomain(r.url, domain))
    .map((r) => ({
      // The URL is the identity: it is what `platform:id` dedupe and the
      // client's seen-ledger hang off, and it is stable across engines that
      // happen to return the same page.
      id: r.url,
      platform: platformLabel,
      title: r.title || r.url,
      url: r.url,
      permalink: r.url,
      snippet: r.content || null,
      // Search results carry no author. The engine that found it is not the
      // author, and inferring one from the URL would be fiction.
      author: null,
      subreddit: null,
      date: r.publishedDate || null,
      // NULL, not 0 — see the header note.
      score: null,
      comments: null,
      thumbnail: r.thumbnail || r.img_src || null,
      flair: null,
    }));
}

/**
 * One platform, one page.
 *
 * @param {object} opts
 * @param {string} opts.platform  a key of PLATFORM_DOMAINS
 * @param {string} opts.topic     what to search for — a seed, or the user's query
 * @param {number} opts.limit     how many rows the caller wants
 * @param {number} [opts.cursor]  SearXNG page number; 1 when absent
 * @returns {Promise<{items: object[], next: number|null}>}
 */
async function fetchPublicSocial({ platform, topic, limit = 20, cursor } = {}) {
  const meta = PLATFORM_DOMAINS[platform];
  if (!meta) throw new Error(`Unknown public-social platform: ${platform}`);
  if (!isConfigured()) {
    // The honest reason, so the feed's `errors` field can say WHY this panel is
    // empty rather than the useless "unavailable".
    throw new Error('SEARXNG_URL is not set — public social sources need the metasearch instance');
  }
  // No topic means nothing to search for. An empty result is the truthful
  // answer; querying `site:x.com` alone returns the platform's front page and
  // not posts.
  if (!topic) return { items: [], next: null };

  const page = Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
  const query = `site:${meta.domain} ${topic}`;
  const key = `${meta.domain} ${topic} ${page}`;

  // The guard is single-flight: several readers hitting the same page at once
  // produce ONE upstream request, which on a 1 GB box is the difference between
  // a cache and a stampede.
  const rows = await serverGuard.run(platform, key, async () => {
    // 'social media' first: where the instance has platform-specific engines
    // enabled, they answer better than the general index. The web category is
    // the fallback and does most of the real work, because public Instagram and
    // Facebook post pages live in the general web index rather than in any
    // social engine.
    //
    // WHAT COUNTS AS AN ANSWER IS WHAT IS ON THE PLATFORM. This used to fall
    // back only when the social category came back EMPTY. Its engines
    // (Mastodon, Reddit, …) ignore `site:` and answer with their own posts, so
    // it was never empty — and every one of those rows was then dropped as
    // off-domain. Result: X, Facebook, Instagram and TikTok returned nothing
    // for every query, silently, while `site:x.com NASA` in the general
    // category returned 54 real x.com posts.
    // NAMED ENGINES FIRST (2026-11-07). On the live instance the category
    // queries below came back EMPTY — no error — while main search, which
    // names its engines (data/modeEngines.js), found real posts for the exact
    // same `site:` query (`site:tiktok.com viral`: 10 TikTok videos vs 0).
    // So ask the way main search does, and keep the category path as the
    // fallback for instances where that is what works.
    try {
      const named = (await askSearx(query, null, page, FEED_ENGINES))
        .filter((row) => row?.url && onDomain(row.url, meta.domain));
      if (named.length) return named;
    } catch {
      // fall through to the category queries
    }
    let social = [];
    try {
      social = (await askSearx(query, 'social media', page)).filter((row) => row?.url && onDomain(row.url, meta.domain));
    } catch {
      // A thin or unavailable social category is not a failure — it is the
      // reason the general fallback below exists.
    }
    // One upstream request when the social engines have real posts from the
    // platform; the general index only when they have none. Not "fewer than
    // a page": that doubles the load on the 1 GB box for every feed page.
    if (social.some((row) => isPost(row.url, platform))) return social;
    // The videos category — where the live instance's working engines are.
    let videos = [];
    try {
      videos = (await askSearx(query, 'videos', page)).filter((row) => row?.url && onDomain(row.url, meta.domain));
    } catch { /* fall through to general */ }
    if (videos.some((row) => isPost(row.url, platform))) return videos;
    const general = await askSearx(query, 'general', page);
    const seen = new Set(social.map((row) => row.url));
    return [...social, ...general.filter((row) => row?.url && !seen.has(row.url))];
  }, { ttlMs: SEARX_TTL_MS, isEmpty: (r) => !r.length });

  const onPlatform = normalise(rows, meta.label, meta.domain);
  // Posts only, when there are any: a profile or hashtag page has no embed and
  // shows in the feed as a dead card. With no posts at all (a person with a
  // private account), their public page is still better than nothing.
  const posts = onPlatform.filter((item) => isPost(item.url, platform));
  // A site's bare homepage is never "better than nothing": it showed up as a
  // post titled "Reddit - The heart of the internet" (2026-10-01).
  const pages = onPlatform.filter((item) => !isSiteRoot(item.url));
  const items = (posts.length ? posts : pages).slice(0, limit);
  return {
    items,
    // A page that came back empty is the end. SearXNG will happily serve page
    // 40 of nothing, and a cursor that never goes null is an infinite scroll
    // that loads forever and shows nothing.
    next: items.length ? page + 1 : null,
  };
}

module.exports = { fetchPublicSocial, PLATFORM_DOMAINS, isConfigured, isPost, isSiteRoot };
