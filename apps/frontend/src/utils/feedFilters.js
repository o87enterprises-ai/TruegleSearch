// The Feed's Sort By / Order / Date filter state — the same three controls as the
// mainstream search "Filters" bar. The server applies it (backend/services/FeedFilters.js);
// this just keeps the state valid, so junk never reaches the request.
//
//   sortBy:    'relevance' (the feed's own mix) | 'date' | 'popularity'
//   order:     'desc' | 'asc'
//   dateRange: 'any' | 'hour' | 'day' | 'week' | 'month' | 'year'
// Popularity is likes / votes / points where a platform shares them; the feed has no view counts.
export const DEFAULT_FEED_FILTERS = Object.freeze({ sortBy: 'relevance', order: 'desc', dateRange: 'any' });

const SORTS = ['relevance', 'date', 'popularity'];
const RANGES = ['any', 'hour', 'day', 'week', 'month', 'year'];

export function normalizeFilters(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const sortBy = SORTS.includes(f.sortBy) ? f.sortBy : 'relevance';
  return {
    sortBy,
    // Order only means something once there is something to order by.
    order: sortBy !== 'relevance' && f.order === 'asc' ? 'asc' : 'desc',
    dateRange: RANGES.includes(f.dateRange) ? f.dateRange : 'any',
  };
}

export const filtersActive = (f) => f.sortBy !== 'relevance' || f.dateRange !== 'any';
// Part of WHICH feed this is: a change reloads it.
export const filtersKey = (f) => `${f.sortBy}.${f.order}.${f.dateRange}`;
