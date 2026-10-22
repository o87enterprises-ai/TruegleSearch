const { createTtlCache } = require('../../utils/ttlCache');

// What a query-less feed searches for.
//
// ── THE PROBLEM ─────────────────────────────────────────────────────────────
//
// SearXNG is a SEARCH engine. The public-social sources are `site:<domain>
// <topic>` queries, and the home feed — the one you land on having typed
// nothing — has no topic. Every other design decision in the feed follows from
// the timeline being seeded with something.
//
// ── THREE SOURCES, IN ORDER, EACH COVERING THE ONE BEFORE ───────────────────
//
//   1. What people here are actually searching for (`search_queries`, the same
//      table behind the landing page's trending pills). The best seed there is:
//      it is real, current, free, and already collected.
//   2. Today's headlines, when trending is thin. A brand-new install has no
//      query history at all, and a feed that is empty until strangers have used
//      it for a week is a feed nobody will use for a week.
//   3. A small static rotation, when both are empty or unreachable. Dull, but a
//      dull feed beats a blank one — the same reasoning as serving repeats
//      rather than nothing when the seen-ledger has suppressed everything.
//
// Nothing here is per-person. These are the SAME seeds for every visitor, which
// is what keeps a personalised-looking feed from needing a profile to build it.

// Long: seeds change the character of the whole feed, and re-deriving them on
// every page of an infinite scroll would put the trending query and the news
// fetch on the hot path for no benefit.
const cache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 8 });

// Deliberately broad and evergreen. These are the last resort, so they must
// return SOMETHING on every platform rather than being sharp and current.
const STATIC_SEEDS = [
  'news', 'technology', 'science', 'music', 'sports',
  'film', 'photography', 'food', 'travel', 'art',
];

/** Trending searches from our own visitors. Never throws — returns []. */
async function fromTrending(limit) {
  try {
    const { query } = require('../../db/connection');
    // Same table the landing page's trending pills read. Recent and popular,
    // and nothing about who searched — the table stores query, mode and
    // timestamp, never a person.
    const { rows } = await query(
      `SELECT query FROM search_queries
        WHERE created_at > NOW() - INTERVAL '48 hours'
          AND length(query) BETWEEN 3 AND 60
        GROUP BY query
        ORDER BY COUNT(*) DESC
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => r.query).filter(Boolean);
  } catch {
    // No database, no table yet, or a cold serverless start. A feed must not
    // depend on analytics being up.
    return [];
  }
}

/** Today's headlines, as topics. Never throws — returns []. */
async function fromHeadlines(limit) {
  try {
    const { printHeadlines } = require('../NewsSources');
    const { local, world } = await printHeadlines();
    return [...(world || []), ...(local || [])]
      .map((h) => h && h.title)
      .filter(Boolean)
      // A whole headline is a terrible search term — too specific, and it
      // returns the same article back. The first few words are the subject.
      .map((t) => t.split(/\s+/).slice(0, 5).join(' '))
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * The topics a query-less feed should search for.
 *
 * @param {number} [limit] how many to return
 * @returns {Promise<string[]>} never empty
 */
async function seedTopics(limit = 6) {
  return cache.wrap(`seeds:${limit}`, async () => {
    const trending = await fromTrending(limit);
    // "Thin" rather than "empty": one lonely search from yesterday is not a
    // feed's worth of topics, and topping up beats a timeline about one thing.
    if (trending.length >= limit) return trending;

    const headlines = await fromHeadlines(limit - trending.length);
    const merged = [...new Set([...trending, ...headlines])];
    if (merged.length) return merged;

    // Rotated by the hour so the last-resort feed is not identical all day.
    const offset = new Date().getHours() % STATIC_SEEDS.length;
    return [...STATIC_SEEDS.slice(offset), ...STATIC_SEEDS.slice(0, offset)].slice(0, limit);
  });
}

// ── TOP POSTS, PER PLATFORM ─────────────────────────────────────────────────
// Trending searches and headline words are good seeds for Mastodon or News,
// and nearly useless for the login-walled video platforms: `site:tiktok.com
// <five words of a headline>` rarely matches a public post page, so narrowing
// the feed to TikTok, Instagram or Facebook came back EMPTY. These are the
// kinds of words those platforms' popular public posts are actually indexed
// under. Used when the shared seed finds nothing, and walked page by page so a
// long scroll keeps broadening instead of repeating.
const TOP_POST_SEEDS = {
  tiktok: ['viral', 'trending', 'funny', 'fyp', 'dance', 'recipe', 'comedy', 'pets', 'life hack', 'music'],
  instagram: ['reel', 'viral reel', 'photography', 'travel', 'food', 'fashion', 'art', 'fitness', 'nature', 'music'],
  facebook: ['viral video', 'reels', 'funny video', 'watch', 'music video', 'cooking', 'news video', 'sports highlights'],
  x: ['breaking', 'viral', 'video', 'news', 'sports', 'tech'],
  pinterest: ['ideas', 'recipe', 'home decor', 'art', 'outfit', 'diy'],
  rumble: ['video', 'news', 'podcast', 'sports', 'comedy'],
  truthsocial: ['news', 'video', 'breaking'],
};

/** The top-posts seed for a platform on a page, or null if it has none. */
function topSeedFor(platform, page) {
  const list = TOP_POST_SEEDS[platform];
  if (!list) return null;
  return list[(Math.max(1, page) - 1) % list.length];
}

/**
 * Pick one seed for a given page, walking the list rather than repeating.
 * Page 1 gets the first topic, page 2 the second, and it wraps.
 */
function seedForPage(topics, page) {
  if (!topics || !topics.length) return null;
  return topics[(Math.max(1, page) - 1) % topics.length];
}

module.exports = { seedTopics, seedForPage, topSeedFor, TOP_POST_SEEDS, STATIC_SEEDS };
