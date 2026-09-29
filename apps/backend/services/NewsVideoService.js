/**
 * YouTube coverage of today's news and markets — one implementation for the
 * two places that show it: the landing page's News and Markets cards
 * (GET /api/news/videos) and the Feed's News / Market Analysis lanes
 * (POST /api/social/feed, platforms 'newsvideo' and 'marketsvideo').
 *
 * A SEARCH, NOT A CHANNEL LIST: see NewsVideos.js for why. The shaping lives
 * there and is pure; this is the part that talks to the search index and
 * oEmbed, with a small cache in front so a busy landing page and a busy Feed
 * ask the index once between them.
 */
const OembedService = require('./OembedService');
const { shapeVideos, queryFor } = require('./NewsVideos');

let searchService = null;
function search() {
  // Lazy: SearchService pulls in a lot, and a cached answer never needs it.
  if (!searchService) {
    const SearchService = require('./SearchService');
    searchService = new SearchService();
  }
  return searchService;
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map(); // key -> { at, value }

/** Region name for local news ("Canada"), or '' for world. */
function regionName(country) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(country) || ''; } catch { return ''; }
}

/**
 * Videos for one kind/scope/country/topic/page, newest first.
 * @param {'news'|'markets'} kind
 * @param {{ scope?: 'local'|'world', country?: string, topic?: string, page?: number, limit?: number }} [opts]
 * @returns {Promise<{ items: object[], stale?: boolean }>} items carry channel bylines when known.
 */
async function youtubeVideos(kind, { scope = 'world', country = '', topic = '', page = 1, limit = 12 } = {}) {
  const key = `${kind}|${scope}|${scope === 'local' ? country : ''}|${topic}|${page}|${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  try {
    const base = queryFor(kind, scope, scope === 'local' ? regionName(country) : '');
    // A typed topic narrows it ("nvidia" + market analysis), it never replaces
    // the kind — a markets lane that answers with cooking videos is broken.
    const query = `${topic ? `${topic} ` : ''}${base} site:youtube.com`;
    const rows = await search().performSearch(
      query,
      { category: 'videos', dateRange: 'week', bias: 'all', sortBy: 'relevance', order: 'desc', safeSearch: 'safe', page, perPage: 30 },
      'blue-pill',
    );
    const items = shapeVideos(rows, { limit });
    // Who made each one. oEmbed is free, keyless and cached for hours; a miss
    // just leaves the byline off.
    try {
      const authors = await OembedService.lookupMany(items.map((v) => v.url));
      items.forEach((v) => { v.channel = authors[v.url]?.author || null; });
    } catch { /* bylines are decoration */ }
    const value = { items };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    // A stale list beats an empty card when the index is having a bad minute.
    if (hit) return { ...hit.value, stale: true };
    throw err;
  }
}

// ── the Feed lanes ─────────────────────────────────────────────────────────
// The platform NAMES are what the card and the provider list key their colour
// on (config/socialProviders.js), so they are spelled here exactly as there.
const LANES = {
  newsvideo: { kind: 'news', label: 'News Video' },
  marketsvideo: { kind: 'markets', label: 'Market Analysis' },
};

/**
 * One page of a video lane, in the shape every other lane returns.
 * `cursor` is the page number; a lane that comes back empty is finished.
 */
async function fetchVideoLane(id, query, limit = 20, cursor) {
  const lane = LANES[id];
  if (!lane) return { items: [], next: null };
  const page = Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
  const { items } = await youtubeVideos(lane.kind, { topic: query || '', page, limit });
  const posts = items.map((v) => ({
    id: v.url,
    platform: lane.label,
    title: v.title,
    url: v.url,
    permalink: v.url,
    snippet: null,
    author: v.channel || null,
    subreddit: null,
    date: v.at ? new Date(v.at).toISOString() : null,
    // NULL, not 0: a search result carries no vote count, and 0 would claim one
    // that was never measured.
    score: null,
    comments: null,
    thumbnail: v.thumbnail,
    flair: null,
  }));
  // Three pages is plenty of "today": beyond that the index is scraping the
  // bottom of the week.
  return { items: posts, next: posts.length && page < 3 ? page + 1 : null };
}

module.exports = { youtubeVideos, fetchVideoLane, LANES, __cache: cache };
