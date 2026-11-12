// The top-posts cache: which requests it covers, and how serve() behaves.
const mockRows = new Map();
let mockDbDown = false;
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, params) => {
    if (mockDbDown) throw new Error('db down');
    const s = sql.trim();
    if (/^CREATE TABLE/i.test(s)) return {};
    if (/^SELECT/i.test(s)) {
      const r = mockRows.get(params[0]);
      return { rows: r ? [{ epoch: r.epoch, partial: r.partial, built_at: new Date(r.builtAt).toISOString(), payload: r.payload }] : [] };
    }
    if (/^INSERT INTO feed_cache/i.test(s)) {
      mockRows.set(params[0], { epoch: params[1], partial: params[2], builtAt: params[3], payload: JSON.parse(params[4]) });
      return {};
    }
    return {};
  }),
}));

const TopFeedCache = require('../services/TopFeedCache');
const { TOP_NETWORKS, PREWARM_REQUEST } = require('../config/topFeed');

const MORNING = Date.parse('2026-11-09T14:30:00Z');       // 6:30 AM PST, epoch 2026-11-09
const NEXT_5_59 = Date.parse('2026-11-10T13:59:00Z');     // 5:59 AM next day: same epoch
const NEXT_6_00 = Date.parse('2026-11-10T14:00:00Z');     // 6:00 AM next day: new epoch

const posts = (n, tag = 'a') => Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, title: `Post ${tag}${i}` }));
const payload = (n = 12, errors = {}, tag = 'a') => ({ query: '', results: posts(n, tag), platforms: {}, nextCursor: {}, errors });
const req = (over = {}) => ({ platforms: TOP_NETWORKS, query: '', cursor: {}, limit: 20, adult: false, ...over });

beforeEach(() => {
  TopFeedCache.__memory.clear(); TopFeedCache.__inflight.clear(); TopFeedCache.__resetTable();
  mockRows.clear(); mockDbDown = false;
});

describe('keyFor: only "top posts" requests are cacheable', () => {
  test('the landing and /feed Home request is', () => {
    expect(TopFeedCache.keyFor(req())).toMatch(/^[0-9a-f]{40}$/);
    expect(TopFeedCache.keyFor(PREWARM_REQUEST)).toBe(TopFeedCache.keyFor(req()));
  });
  test('platform order and duplicates do not matter; a different set is a different key', () => {
    const a = TopFeedCache.keyFor(req({ platforms: ['x', 'reddit'] }));
    expect(TopFeedCache.keyFor(req({ platforms: ['reddit', 'x', 'x'] }))).toBe(a);
    expect(TopFeedCache.keyFor(req({ platforms: ['reddit'] }))).not.toBe(a);
  });
  test('a fixed fallback seed is cacheable (its own key); a typed search never is', () => {
    expect(TopFeedCache.keyFor(req({ query: 'viral' }))).not.toBeNull();
    expect(TopFeedCache.keyFor(req({ query: 'viral' }))).not.toBe(TopFeedCache.keyFor(req()));
    expect(TopFeedCache.keyFor(req({ query: 'raspberry pi' }))).toBeNull();
    expect(TopFeedCache.keyFor(req({ query: '  ' }))).toBe(TopFeedCache.keyFor(req()));
  });
  test('only the social networks: news, markets, creators, podcasts, github and "all" are never cached', () => {
    for (const p of ['news', 'newsvideo', 'marketsvideo', 'creators', 'podcastvideo', 'github', 'hackernews', 'community']) {
      expect(TopFeedCache.keyFor(req({ platforms: ['reddit', p] }))).toBeNull();
    }
    expect(TopFeedCache.keyFor(req({ platforms: ['all'] }))).toBeNull();
    expect(TopFeedCache.keyFor(req({ platforms: [] }))).toBeNull();
    expect(TopFeedCache.keyFor(req({ platforms: undefined }))).toBeNull();
  });
  test('pages (cursor), page size and adult-content setting each get their own entry', () => {
    const base = TopFeedCache.keyFor(req());
    expect(TopFeedCache.keyFor(req({ cursor: { reddit: 't3_abc' } }))).not.toBe(base);
    expect(TopFeedCache.keyFor(req({ limit: 30 }))).not.toBe(base);
    expect(TopFeedCache.keyFor(req({ adult: true }))).not.toBe(base);
    expect(TopFeedCache.keyFor(req({ cursor: { a: 1, b: 2 } }))).toBe(TopFeedCache.keyFor(req({ cursor: { b: 2, a: 1 } })));
    expect(TopFeedCache.keyFor(req({ cursor: { x: 'y'.repeat(3000) } }))).toBeNull();
  });
});

describe('serve', () => {
  test('an uncacheable request goes straight to the build and is stored nowhere', async () => {
    const build = jest.fn(async () => payload());
    const r = await TopFeedCache.serve(null, build);
    expect(r.cache).toBe('bypass');
    expect(build).toHaveBeenCalledTimes(1);
    expect(mockRows.size).toBe(0);
  });

  test('first request builds and stores; the second is a hit and does not build', async () => {
    const key = TopFeedCache.keyFor(req());
    const build = jest.fn(async () => payload());
    const a = await TopFeedCache.serve(key, build, { platforms: TOP_NETWORKS, now: MORNING });
    const b = await TopFeedCache.serve(key, build, { platforms: TOP_NETWORKS, now: MORNING + 1000 });
    expect([a.cache, b.cache]).toEqual(['miss', 'hit']);
    expect(build).toHaveBeenCalledTimes(1);
    expect(b.payload.results).toHaveLength(12);
  });

  test('the cache is SHARED: a fresh instance (empty memory) is served from the database', async () => {
    const key = TopFeedCache.keyFor(req());
    await TopFeedCache.serve(key, async () => payload(), { now: MORNING });
    TopFeedCache.__memory.clear(); // a cold start somewhere else
    const build = jest.fn(async () => payload(12, {}, 'z'));
    const r = await TopFeedCache.serve(key, build, { now: MORNING + 5000 });
    expect(r.cache).toBe('hit');
    expect(build).not.toHaveBeenCalled();
  });

  test('it lasts until 6 AM Pacific, then rebuilds exactly once at 6 AM', async () => {
    const key = TopFeedCache.keyFor(req());
    const build = jest.fn(async () => payload());
    await TopFeedCache.serve(key, build, { now: MORNING });
    expect((await TopFeedCache.serve(key, build, { now: NEXT_5_59 })).cache).toBe('hit');
    expect(build).toHaveBeenCalledTimes(1);
    expect((await TopFeedCache.serve(key, build, { now: NEXT_6_00 })).cache).toBe('miss');
    expect(build).toHaveBeenCalledTimes(2);
    expect((await TopFeedCache.serve(key, build, { now: NEXT_6_00 + 60000 })).cache).toBe('hit');
    expect(build).toHaveBeenCalledTimes(2);
  });

  test('a thin result is never stored (so a blip is not frozen in)', async () => {
    const key = TopFeedCache.keyFor(req());
    const build = jest.fn(async () => payload(3));
    const a = await TopFeedCache.serve(key, build, { now: MORNING });
    const b = await TopFeedCache.serve(key, build, { now: MORNING + 1000 });
    expect([a.cache, b.cache]).toEqual(['thin', 'thin']);
    expect(build).toHaveBeenCalledTimes(2);
    expect(mockRows.size).toBe(0);
  });

  test('yesterday\'s posts beat an empty feed: thin or failing live build serves the older copy', async () => {
    const key = TopFeedCache.keyFor(req());
    await TopFeedCache.serve(key, async () => payload(12, {}, 'old'), { now: MORNING });
    const thin = await TopFeedCache.serve(key, async () => payload(2), { now: NEXT_6_00 });
    expect(thin.cache).toBe('stale');
    expect(thin.payload.results[0].id).toBe('old0');
    const failed = await TopFeedCache.serve(key, async () => { throw new Error('upstream down'); }, { now: NEXT_6_00 });
    expect(failed.cache).toBe('stale');
  });

  test('a failing build with nothing cached still fails (nothing to hide behind)', async () => {
    const key = TopFeedCache.keyFor(req());
    await expect(TopFeedCache.serve(key, async () => { throw new Error('boom'); }, { now: MORNING })).rejects.toThrow('boom');
  });

  test('a result where a requested network failed is kept, but only for two hours', async () => {
    const key = TopFeedCache.keyFor(req());
    const build = jest.fn(async () => payload(12, { reddit: 'HTTP 429' }));
    await TopFeedCache.serve(key, build, { platforms: TOP_NETWORKS, now: MORNING });
    expect((await TopFeedCache.serve(key, build, { platforms: TOP_NETWORKS, now: MORNING + 60 * 60 * 1000 })).cache).toBe('hit');
    expect((await TopFeedCache.serve(key, build, { platforms: TOP_NETWORKS, now: MORNING + 2.5 * 60 * 60 * 1000 })).cache).toBe('miss');
    expect(build).toHaveBeenCalledTimes(2);
  });

  test('simultaneous requests share ONE live build', async () => {
    const key = TopFeedCache.keyFor(req());
    let release; const gate = new Promise((r) => { release = r; });
    const build = jest.fn(async () => { await gate; return payload(); });
    const all = [1, 2, 3, 4].map(() => TopFeedCache.serve(key, build, { now: MORNING }));
    release();
    const out = await Promise.all(all);
    expect(build).toHaveBeenCalledTimes(1);
    expect(out.every((r) => r.payload.results.length === 12)).toBe(true);
  });

  test('a database that is down costs a miss, never an error', async () => {
    mockDbDown = true;
    const key = TopFeedCache.keyFor(req());
    const build = jest.fn(async () => payload());
    const a = await TopFeedCache.serve(key, build, { now: MORNING });
    const b = await TopFeedCache.serve(key, build, { now: MORNING + 1000 }); // still served from this instance's memory
    expect([a.cache, b.cache]).toEqual(['miss', 'hit']);
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('refreshTop (the 6 AM job)', () => {
  test('builds the main landing entry once; a second call the same day is a no-op', async () => {
    const build = jest.fn(async () => payload());
    expect(await TopFeedCache.refreshTop(build, { now: MORNING })).toMatchObject({ status: 'refreshed', results: 12 });
    expect(await TopFeedCache.refreshTop(build, { now: MORNING + 1000 })).toMatchObject({ status: 'fresh' });
    expect(build).toHaveBeenCalledTimes(1);
    // ...and a visitor's identical request is now a hit.
    const r = await TopFeedCache.serve(TopFeedCache.keyFor(req()), async () => payload(12, {}, 'z'), { now: MORNING + 2000 });
    expect(r.cache).toBe('hit');
  });
  test('force rebuilds even when fresh; a thin build stores nothing', async () => {
    const build = jest.fn(async () => payload());
    await TopFeedCache.refreshTop(build, { now: MORNING });
    await TopFeedCache.refreshTop(build, { now: MORNING + 1000, force: true });
    expect(build).toHaveBeenCalledTimes(2);
    TopFeedCache.__memory.clear(); mockRows.clear();
    expect(await TopFeedCache.refreshTop(async () => payload(2), { now: MORNING })).toMatchObject({ status: 'thin' });
    expect(mockRows.size).toBe(0);
  });
});

describe('partial = a TRANSIENT failure only', () => {
  const key = () => TopFeedCache.keyFor(req());
  test.each([
    ['Request failed with status code 422', false], // permanent: endpoint wants a login (Mastodon, 2026-11-09)
    ['Request failed with status code 403', false],
    ['Request failed with status code 404', false],
    ['Request failed with status code 429', true],  // rate limit: will recover
    ['Request failed with status code 503', true],
    ['timeout of 8000ms exceeded', true],
    ['unavailable', true],
  ])('%s -> partial=%s', (err, partial) => {
    expect(TopFeedCache.isPartial(payload(12, { reddit: err }), TOP_NETWORKS)).toBe(partial);
  });
  test('a permanently refused network no longer cuts the day\'s cache to two hours', async () => {
    const build = jest.fn(async () => payload(12, { mastodon: 'Request failed with status code 422' }));
    await TopFeedCache.serve(key(), build, { platforms: TOP_NETWORKS, now: MORNING });
    expect((await TopFeedCache.serve(key(), build, { platforms: TOP_NETWORKS, now: MORNING + 6 * 60 * 60 * 1000 })).cache).toBe('hit');
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('refreshOne (the 6 AM job, one request at a time)', () => {
  const { pillRequest } = require('../config/topFeed');
  const good = (n = 12) => ({ results: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })), errors: {} });

  test('builds a network pill once; a second call the same day is a no-op', async () => {
    const build = jest.fn(async () => good());
    expect(await TopFeedCache.refreshOne(pillRequest('tiktok'), build)).toMatchObject({ status: 'refreshed' });
    expect(await TopFeedCache.refreshOne(pillRequest('tiktok'), build)).toMatchObject({ status: 'fresh' });
    expect(build).toHaveBeenCalledTimes(1);
  });

  test('a request that is never cacheable (a typed search) is refused without building', async () => {
    const build = jest.fn(async () => good());
    expect(await TopFeedCache.refreshOne({ platforms: ['tiktok'], query: 'my private search', cursor: {}, limit: 20, adult: false }, build)).toEqual({ status: 'uncacheable' });
    expect(build).not.toHaveBeenCalled();
  });
});
