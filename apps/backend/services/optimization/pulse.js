/**
 * GEO Pulse — read-only status of the citation engine: what it has published,
 * how much backlog remains, and which free-tier providers are healthy / how
 * much quota they've used today. Surfaced via `node run.js pulse` and the
 * read-only GET /api/optimization/pulse route.
 *
 * (Whether AI bots have actually CRAWLED the pages lives in Cloudflare KV
 * BOT_TRACKING via functions/_middleware.js — reading that back is a documented
 * follow-up; this pulse reports the engine's own publishing health.)
 */

const config = require('./config');
const universe = require('./keywordUniverse');
const quota = require('./quotaTracker');
const citationLog = require('./citationLog');
const { readPublishedPosts } = require('./topicSource');
const FallbackRouter = require('./fallbackRouter');

async function pulse() {
  const published = readPublishedPosts();
  const publishedSlugs = new Set(published.map((p) => p.slug));
  const remaining = universe.filter((t) => !publishedSlugs.has(t.slug)).length;

  const usageToday = {};
  for (const p of config.PROVIDERS) usageToday[p.name] = await quota.usedToday(p.name);

  let available = [];
  try {
    available = new FallbackRouter().available();
  } catch {
    /* env not loaded */
  }

  const [recent, total] = await Promise.all([citationLog.recent(10), citationLog.total()]);

  return {
    generatedAt: new Date().toISOString(),
    blog: { totalPosts: published.length },
    engine: { autoPublished: total, recent },
    backlog: { universeSize: universe.length, remaining },
    providers: { available, usageToday, dailySoftCap: config.QUOTA.DAILY_SOFT_CAP },
  };
}

module.exports = { pulse };
