// GET /api/cron/refresh-top-feed: acts only in the 6 AM Pacific hour, once a day,
// and is authenticated when CRON_SECRET is set.
const mockRows = new Map();
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, params) => {
    const s = sql.trim();
    if (/^SELECT/i.test(s)) { const r = mockRows.get(params[0]); return { rows: r ? [{ epoch: r.epoch, partial: r.partial, built_at: new Date(r.builtAt).toISOString(), payload: r.payload }] : [] }; }
    if (/^INSERT INTO feed_cache/i.test(s)) { mockRows.set(params[0], { epoch: params[1], partial: params[2], builtAt: params[3], payload: JSON.parse(params[4]) }); }
    return {};
  }),
}));
const mockBuild = jest.fn();
jest.mock('../routes/social', () => ({ buildFeedPayload: (...a) => mockBuild(...a) }));

const express = require('express');
const request = require('supertest');
const TopFeedCache = require('../services/TopFeedCache');
const { PREWARM_REQUEST, TOP_NETWORKS, pillRequest } = require('../config/topFeed');

const app = () => { const a = express(); a.use('/api/cron', require('../routes/cron')); return a; };
const good = (n = 12) => ({ query: '', results: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })), platforms: {}, nextCursor: {}, errors: {} });

const SIX_AM_WINTER = Date.parse('2026-11-09T14:10:00Z');   // 6:10 AM PST
const FIVE_AM_WINTER = Date.parse('2026-11-09T13:10:00Z');  // 5:10 AM PST (the other cron firing)
const SIX_AM_SUMMER = Date.parse('2026-07-15T13:10:00Z');   // 6:10 AM PDT
let nowSpy;
const setNow = (ms) => { nowSpy.mockReturnValue(ms); };

beforeEach(() => {
  TopFeedCache.__memory.clear(); TopFeedCache.__inflight.clear(); TopFeedCache.__resetTable();
  mockRows.clear(); mockBuild.mockReset(); mockBuild.mockResolvedValue(good());
  delete process.env.CRON_SECRET;
  nowSpy = jest.spyOn(Date, 'now');
});
afterEach(() => { nowSpy.mockRestore(); });

describe('timing', () => {
  test('outside the 6 AM Pacific hour it does nothing', async () => {
    setNow(FIVE_AM_WINTER);
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.body).toMatchObject({ status: 'skipped' });
    expect(mockBuild).not.toHaveBeenCalled();
  });

  test('in the 6 AM hour it builds the landing request first and stores it', async () => {
    setNow(SIX_AM_WINTER);
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.body).toMatchObject({ status: 'refreshed', epoch: '2026-11-09', results: 12 });
    expect(mockBuild).toHaveBeenNthCalledWith(1, {
      q: PREWARM_REQUEST.query, requestedPlatforms: PREWARM_REQUEST.platforms,
      cur: PREWARM_REQUEST.cursor, limit: PREWARM_REQUEST.limit, allowAdult: PREWARM_REQUEST.adult,
    });
    // A visitor asking the same thing is then served from the cache.
    const hit = await TopFeedCache.serve(TopFeedCache.keyFor({ platforms: PREWARM_REQUEST.platforms, query: '', cursor: {}, limit: 20, adult: false }), async () => good(1), { now: SIX_AM_WINTER + 1000 });
    expect(hit.cache).toBe('hit');
  });

  test('then each network\'s own pill is pre-built, so picking one is a cache hit (owner, 2026-11-10)', async () => {
    setNow(SIX_AM_WINTER);
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(Object.keys(r.body.pills)).toEqual(TOP_NETWORKS);
    expect(Object.values(r.body.pills).every((v) => v === 'refreshed')).toBe(true);
    expect(mockBuild).toHaveBeenCalledTimes(1 + TOP_NETWORKS.length);
    // Exactly the request the Feed sends for a pill: one network, empty query, 20, Safe Search on.
    expect(mockBuild).toHaveBeenCalledWith({ q: '', requestedPlatforms: ['tiktok'], cur: {}, limit: 20, allowAdult: false });
    for (const network of TOP_NETWORKS) {
      const key = TopFeedCache.keyFor({ platforms: [network], query: '', cursor: {}, limit: 20, adult: false });
      const hit = await TopFeedCache.serve(key, async () => good(1), { now: SIX_AM_WINTER + 1000 });
      expect(hit.cache).toBe('hit');
    }
  });

  test('one pill failing or coming back thin costs only that pill, never the landing entry', async () => {
    setNow(SIX_AM_WINTER);
    mockBuild.mockImplementation(async ({ requestedPlatforms }) => {
      if (requestedPlatforms.length === 1 && requestedPlatforms[0] === 'x') throw new Error('x exploded');
      if (requestedPlatforms.length === 1 && requestedPlatforms[0] === 'rumble') return good(2);
      return good();
    });
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'refreshed' });
    expect(r.body.pills).toMatchObject({ x: 'failed', rumble: 'thin', tiktok: 'refreshed' });
    expect(JSON.stringify(r.body)).not.toMatch(/exploded/);
  });

  test('works in summer time too', async () => {
    setNow(SIX_AM_SUMMER);
    expect((await request(app()).get('/api/cron/refresh-top-feed')).body).toMatchObject({ status: 'refreshed', epoch: '2026-07-15' });
  });

  test('calling it again the same morning (the second cron entry, a retry, anyone) does no more work', async () => {
    setNow(SIX_AM_WINTER);
    await request(app()).get('/api/cron/refresh-top-feed');
    const again = await request(app()).get('/api/cron/refresh-top-feed');
    expect(again.body).toMatchObject({ status: 'fresh' });
    expect(Object.values(again.body.pills).every((v) => v === 'fresh')).toBe(true);
    expect(mockBuild).toHaveBeenCalledTimes(1 + TOP_NETWORKS.length); // all from the first call
  });

  test('a thin build is reported and stores nothing; a failing build is a 502, not a crash', async () => {
    setNow(SIX_AM_WINTER);
    mockBuild.mockResolvedValueOnce(good(2));
    expect((await request(app()).get('/api/cron/refresh-top-feed')).body).toMatchObject({ status: 'thin' });
    const landingKey = TopFeedCache.keyFor(PREWARM_REQUEST);
    expect(mockRows.has(landingKey)).toBe(false); // the thin landing page is stored nowhere
    mockBuild.mockRejectedValueOnce(new Error('upstream exploded'));
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toMatch(/exploded/); // no internals leaked
  });
});

describe('auth', () => {
  test('with CRON_SECRET set: no header or a wrong one is refused, the right one works', async () => {
    process.env.CRON_SECRET = 's3cret-value';
    setNow(SIX_AM_WINTER);
    expect((await request(app()).get('/api/cron/refresh-top-feed')).status).toBe(401);
    expect((await request(app()).get('/api/cron/refresh-top-feed').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect(mockBuild).not.toHaveBeenCalled();
    const ok = await request(app()).get('/api/cron/refresh-top-feed').set('Authorization', 'Bearer s3cret-value');
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('refreshed');
  });

  test('force (rebuild now, any hour) needs the secret; without one configured it is refused', async () => {
    setNow(FIVE_AM_WINTER);
    expect((await request(app()).get('/api/cron/refresh-top-feed?force=1')).status).toBe(403);
    process.env.CRON_SECRET = 'k';
    expect((await request(app()).get('/api/cron/refresh-top-feed?force=1')).status).toBe(401);
    const ok = await request(app()).get('/api/cron/refresh-top-feed?force=1').set('Authorization', 'Bearer k');
    expect(ok.body.status).toBe('refreshed');
  });
});
