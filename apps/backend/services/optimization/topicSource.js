/**
 * Topic source — decides what to write next.
 *
 * Privacy-by-design: we NEVER publish a raw user query. Instead, the anonymous
 * demand signal (search_queries: query+mode+timestamp, no identity) is used
 * only to RANK the vetted, evergreen keyword universe. A sensitive-looking
 * query is filtered out before it can even influence the ranking, and the
 * published topic always comes from the hand-curated universe — so "seeded by
 * user activity" never leaks an individual's search.
 *
 * Degrades gracefully: no DB / empty table → falls back to the backlog order.
 */

const fs = require('fs');
const config = require('./config');
const universe = require('./keywordUniverse');
const { isSensitiveQuery } = require('./qualityGate');
const log = require('./log');

let query = null;
try {
  ({ query } = require('../../db/connection'));
} catch {
  /* no DB → backlog mode */
}

const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'why', 'does', 'your', 'you', 'are', 'can', 'with', 'without', 'from', 'that', 'this', 'get', 'not', 'search', 'engine']);

function keywords(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

/** Slugs + titles already published (blogPosts.jsx is the source of truth). */
function readPublishedPosts() {
  let src = '';
  try {
    src = fs.readFileSync(config.PATHS.blogPosts, 'utf8');
  } catch {
    return [];
  }
  const slugs = [...src.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  const titles = [...src.matchAll(/title:\s*'((?:\\.|[^'\\])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
  return slugs.map((slug, i) => ({ slug, title: titles[i] || slug }));
}

async function fetchTrending() {
  if (!query) return [];
  const { TRENDING } = config;
  try {
    const { rows } = await query(
      `SELECT query, COUNT(*)::int AS count
         FROM search_queries
        WHERE created_at > NOW() - ($1 || ' days')::interval
          AND LENGTH(query) BETWEEN $2 AND $3
        GROUP BY query
       HAVING COUNT(*) >= $4
        ORDER BY count DESC
        LIMIT $5`,
      [TRENDING.LOOKBACK_DAYS, TRENDING.MIN_LEN, TRENDING.MAX_LEN, TRENDING.MIN_COUNT, TRENDING.LIMIT]
    );
    return rows
      .filter((r) => !isSensitiveQuery(r.query))
      .map((r) => ({ query: r.query, count: r.count, kw: new Set(keywords(r.query)) }));
  } catch {
    return []; // table may not exist on a fresh deploy
  }
}

/**
 * @returns {Promise<{topic:object, publishedPosts:Array, source:string,
 *   demand:number, matched:string[]}>|null} null when the whole backlog is done.
 */
async function selectTopic() {
  const publishedPosts = readPublishedPosts();
  const done = new Set(publishedPosts.map((p) => p.slug));
  const remaining = universe.filter((t) => !done.has(t.slug));

  if (remaining.length === 0) {
    log.warn('every universe topic is published — add keywords to keywordUniverse.js');
    return null;
  }

  const trending = await fetchTrending();
  log.info(`published=${publishedPosts.length} remaining=${remaining.length} trending=${trending.length}`);

  // Rank remaining topics by anonymous demand overlap.
  let best = null;
  for (const topic of remaining) {
    const tkw = keywords(`${topic.question} ${topic.intent}`);
    let demand = 0;
    const matched = [];
    for (const row of trending) {
      if (tkw.some((w) => row.kw.has(w))) {
        demand += row.count;
        matched.push(row.query);
      }
    }
    if (!best || demand > best.demand) best = { topic, demand, matched };
  }

  if (best && best.demand > 0) {
    log.ok(`topic "${best.topic.slug}" (demand ${best.demand} from ${best.matched.length} queries)`);
    return { ...best, publishedPosts, source: 'trending' };
  }

  // No demand signal → next backlog item in curated order.
  const topic = remaining[0];
  log.info(`no trending match — backlog pick "${topic.slug}"`);
  return { topic, demand: 0, matched: [], publishedPosts, source: 'backlog' };
}

module.exports = { selectTopic, readPublishedPosts };
