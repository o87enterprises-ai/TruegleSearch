/**
 * Playable podcasts — YouTube full-episode search for the Feed's Podcasts
 * shelf (POST /api/social/feed, platform 'podcastvideo').
 *
 * Same plumbing as NewsVideoService (SearchService + oEmbed) but its own
 * shaping: podcasts are evergreen, so there is no "today" age cutoff, and
 * short clips are demoted behind real episodes when durations are known.
 * Plays through YouTube's official embed — the creator keeps the views.
 */
const OembedService = require('./OembedService');
const { youtubeId, cleanTitle, isLivestream } = require('./NewsVideos');
const roster = require('../config/creatorsRoster');

let searchService = null;
function search() {
  if (!searchService) {
    const SearchService = require('./SearchService');
    searchService = new SearchService();
  }
  return searchService;
}

const TTL_MS = 30 * 60 * 1000;
const cache = new Map();
const LONG_S = 15 * 60; // under this it is a clip, not an episode

const seconds = (d) => {
  if (typeof d === 'number') return Number.isFinite(d) ? d : null;
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(String(d || '').trim());
  return m ? (Number(m[1] || 0) * 3600) + (Number(m[2]) * 60) + Number(m[3]) : null;
};

/** Search rows → de-duplicated playable episodes, full-length first. Pure. */
function shapePodcasts(rows, limit = 20) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = youtubeId(r?.url);
    const title = cleanTitle(r?.title);
    if (!id || seen.has(id) || !title || isLivestream(title)) continue;
    seen.add(id);
    const at = r.date || r.publishedDate ? Date.parse(r.date || r.publishedDate) || null : null;
    out.push({
      id, title, at, duration: seconds(r.duration),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
  }
  // Stable partition: known-long episodes first, relevance order kept inside.
  const full = out.filter((v) => v.duration == null || v.duration >= LONG_S);
  const clips = out.filter((v) => v.duration != null && v.duration < LONG_S);
  return [...full, ...clips].slice(0, limit);
}

const ROSTER_PER_SHOW = 4; // episodes pulled per roster podcast
const ROSTER_MAX = 8;       // roster rows allowed to lead the first page

/**
 * Roster podcasts first, then the search rows, de-duplicated by URL. Pure.
 * Roster rows are taken one per show in turn so no single show owns the lead.
 */
function mergeRosterFirst(rosterLanes, searchRows, limit) {
  const lead = [];
  for (let round = 0; lead.length < ROSTER_MAX && rosterLanes.some((l) => l.length > round); round += 1) {
    for (const lane of rosterLanes) if (lane[round] && lead.length < ROSTER_MAX) lead.push(lane[round]);
  }
  const seen = new Set();
  const out = [];
  for (const row of [...lead, ...searchRows]) {
    if (!row || seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out.slice(0, limit);
}

/** The roster podcasts' own episodes (filtered by `query` when given), per show. */
async function rosterLanes(query) {
  // Lazy: routes/creators pulls in the DB layer, and a cached answer never needs it.
  const { fetchCreatorsFeed } = require('../routes/creators');
  const shows = roster.filter((c) => c.podcast);
  const settled = await Promise.allSettled(
    shows.map((c) => fetchCreatorsFeed(query || '', ROSTER_PER_SHOW, undefined, c.slug)),
  );
  return settled
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value.items.slice(0, ROSTER_PER_SHOW).map((it) => ({ ...it, platform: 'Podcasts' })));
}

/** One page of podcast episodes for `query` (empty = general podcast episodes). */
async function fetchPodcastLane(query, limit = 20, cursor) {
  const page = Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
  const topic = String(query || '').trim().slice(0, 120);
  const key = `${topic}|${page}|${limit}`;
  const hit = cache.get(key);
  let items;
  if (hit && Date.now() - hit.at < TTL_MS) {
    items = hit.items;
  } else {
    try {
      const rows = await search().performSearch(
        `${topic ? `${topic} ` : ''}podcast full episode site:youtube.com`,
        { category: 'videos', dateRange: 'any', bias: 'all', sortBy: 'relevance', order: 'desc', safeSearch: 'safe', page, perPage: 30 },
        'blue-pill',
      );
      items = shapePodcasts(rows, limit);
      try { // drop what oEmbed knows is private/deleted/unembeddable; fail open
        const authors = await OembedService.lookupMany(items.map((v) => v.url));
        if (Object.keys(authors).length > 0) items = items.filter((v) => authors[v.url]);
        items.forEach((v) => { v.channel = authors[v.url]?.author || null; });
      } catch { /* bylines are decoration */ }
      cache.set(key, { at: Date.now(), items });
    } catch (err) {
      if (hit) items = hit.items; else throw err;
    }
  }
  const posts = items.map((v) => ({
    id: v.url, platform: 'Podcasts', title: v.title, url: v.url, permalink: v.url,
    snippet: null, author: v.channel || null, subreddit: null,
    date: v.at ? new Date(v.at).toISOString() : null,
    score: null, comments: null, thumbnail: v.thumbnail, flair: null,
  }));
  // Page 1 only: the roster's own podcasts lead. A roster failure costs nothing.
  let merged = posts;
  if (page === 1) {
    try { merged = mergeRosterFirst(await rosterLanes(topic), posts, limit); } catch { /* generic results still stand */ }
  }
  return { items: merged, next: posts.length && page < 5 ? page + 1 : null };
}

module.exports = { fetchPodcastLane, shapePodcasts, mergeRosterFirst, __cache: cache };
