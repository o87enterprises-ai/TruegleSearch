/**
 * The Feed's Sort By / Order / Date filter (owner, 2026-11-17) — the same three
 * controls as the mainstream search "Filters" bar, applied across EVERY platform
 * and category in the feed.
 *
 *   sortBy:    'relevance' (default: the feed's own mix) | 'date' | 'popularity'
 *   order:     'desc' | 'asc'   (newest / highest first, or the reverse)
 *   dateRange: 'any' | 'hour' | 'day' | 'week' | 'month' | 'year'
 *
 * POPULARITY is a post's `score`: likes, upvotes, points or stars, where the
 * platform shares one. The feed has NO view counts, so there is no "Views" sort;
 * a post with no score sorts last either way (never as if it had 0).
 *
 * Applied per request, AFTER the cache (like ContentLang.filterByLang), to each
 * list in a payload. Every lane is fetched and paged on its own cursor, so this
 * orders and trims the posts of one response, not the whole internet; only the
 * Creators lane (an in-memory list) is filtered before paging, via
 * creatorsParams(). A post with no usable date is dropped when a range is on:
 * it cannot be shown to fall inside it. Never mutates its input.
 */
const RANGE_MS = { hour: 36e5, day: 864e5, week: 7 * 864e5, month: 30 * 864e5, year: 365 * 864e5 };
const SORTS = ['relevance', 'date', 'popularity'];

function normalize(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const sortBy = SORTS.includes(f.sortBy) ? f.sortBy : 'relevance';
  const dateRange = RANGE_MS[f.dateRange] ? f.dateRange : 'any';
  const order = sortBy !== 'relevance' && f.order === 'asc' ? 'asc' : 'desc';
  return { sortBy, order, dateRange };
}

const isActive = (f) => f.sortBy !== 'relevance' || f.dateRange !== 'any';

const dateOf = (it) => { const t = Date.parse(it?.date); return Number.isNaN(t) ? null : t; };
const scoreOf = (it) => (typeof it?.score === 'number' && Number.isFinite(it.score) ? it.score : null);

function applyList(list, f, now) {
  if (!Array.isArray(list)) return list;
  let out = list;
  if (f.dateRange !== 'any') {
    const cutoff = now - RANGE_MS[f.dateRange];
    out = out.filter((it) => { const t = dateOf(it); return t !== null && t >= cutoff; });
  }
  if (f.sortBy !== 'relevance') {
    const key = f.sortBy === 'date' ? dateOf : scoreOf;
    const dir = f.order === 'asc' ? 1 : -1;
    out = out.map((it, i) => ({ it, i, k: key(it) }))
      .sort((a, b) => ((a.k === null) - (b.k === null)) || (a.k === null ? 0 : dir * (a.k - b.k)) || a.i - b.i)
      .map((x) => x.it);
  }
  return out;
}

/** A new payload, filtered and sorted. The default filters return it untouched. */
function apply(payload, filters, now = Date.now()) {
  const f = normalize(filters);
  if (!payload || !isActive(f)) return payload;
  const platforms = {};
  for (const [k, v] of Object.entries(payload.platforms || {})) platforms[k] = applyList(v, f, now);
  return { ...payload, results: applyList(payload.results, f, now), platforms };
}

/** What the Creators lane (fetchCreatorsFeed) can do exactly, before paging. */
function creatorsParams(filters) {
  const f = normalize(filters);
  return {
    since: f.dateRange,
    order: f.sortBy === 'date' ? (f.order === 'asc' ? 'oldest' : 'newest') : 'mix',
  };
}

module.exports = { normalize, apply, creatorsParams, isActive, RANGE_MS };
