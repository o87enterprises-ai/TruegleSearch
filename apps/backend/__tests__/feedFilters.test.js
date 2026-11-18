const FeedFilters = require('../services/FeedFilters');

const NOW = Date.parse('2026-11-17T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const H = 36e5; const D = 864e5;
const post = (id, date, score) => ({ id, date, score });
const mk = () => {
  const a = post('a', ago(0.5 * H), 5);
  const b = post('b', ago(3 * D), 500);
  const c = post('c', ago(40 * D), null);
  const d = post('d', null, 50);
  const e = post('e', ago(2 * H), 0);
  return { results: [a, b, c, d, e], platforms: { reddit: [b, a], creators: [c, d, e] } };
};
const ids = (l) => l.map((x) => x.id).join('');

test('normalize: junk becomes the defaults; order only counts when sorting', () => {
  expect(FeedFilters.normalize(undefined)).toEqual({ sortBy: 'relevance', order: 'desc', dateRange: 'any' });
  expect(FeedFilters.normalize({ sortBy: 'views', order: 'asc', dateRange: 'decade' })).toEqual({ sortBy: 'relevance', order: 'desc', dateRange: 'any' });
  expect(FeedFilters.normalize({ sortBy: 'relevance', order: 'asc' }).order).toBe('desc');
  expect(FeedFilters.normalize({ sortBy: 'date', order: 'asc', dateRange: 'week' })).toEqual({ sortBy: 'date', order: 'asc', dateRange: 'week' });
});

test('default filters return the payload itself', () => {
  const p = mk();
  expect(FeedFilters.apply(p, undefined, NOW)).toBe(p);
});

test('date range keeps only posts inside it and drops undated ones, in every list', () => {
  const out = FeedFilters.apply(mk(), { dateRange: 'day' }, NOW);
  expect(ids(out.results)).toBe('ae');
  expect(ids(out.platforms.reddit)).toBe('a');
  expect(ids(out.platforms.creators)).toBe('e');
  expect(ids(FeedFilters.apply(mk(), { dateRange: 'hour' }, NOW).results)).toBe('a');
  expect(ids(FeedFilters.apply(mk(), { dateRange: 'week' }, NOW).results)).toBe('abe');
  expect(ids(FeedFilters.apply(mk(), { dateRange: 'year' }, NOW).results)).toBe('abce');
});

test('sort by date: newest first, oldest first, undated always last', () => {
  expect(ids(FeedFilters.apply(mk(), { sortBy: 'date' }, NOW).results)).toBe('aebcd');
  expect(ids(FeedFilters.apply(mk(), { sortBy: 'date', order: 'asc' }, NOW).results)).toBe('cbeaD'.toLowerCase());
});

test('sort by popularity: highest first, a missing score is last (not 0), 0 is a real score', () => {
  expect(ids(FeedFilters.apply(mk(), { sortBy: 'popularity' }, NOW).results)).toBe('bdaec');
  expect(ids(FeedFilters.apply(mk(), { sortBy: 'popularity', order: 'asc' }, NOW).results)).toBe('eadbc');
});

test('never mutates the (cached) payload', () => {
  const p = mk();
  const before = JSON.stringify(p);
  FeedFilters.apply(p, { sortBy: 'date', order: 'asc', dateRange: 'week' }, NOW);
  expect(JSON.stringify(p)).toBe(before);
});

test('creatorsParams maps to the Creators lane (exact, before paging)', () => {
  expect(FeedFilters.creatorsParams(undefined)).toEqual({ since: 'any', order: 'mix' });
  expect(FeedFilters.creatorsParams({ sortBy: 'date', order: 'asc', dateRange: 'month' })).toEqual({ since: 'month', order: 'oldest' });
  expect(FeedFilters.creatorsParams({ sortBy: 'date' })).toEqual({ since: 'any', order: 'newest' });
  expect(FeedFilters.creatorsParams({ sortBy: 'popularity', dateRange: 'hour' })).toEqual({ since: 'hour', order: 'mix' });
});
