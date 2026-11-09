// GET /api/cron/refresh-top-feed: acts only in the 9 AM Pacific hour, once a day,
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
const { PREWARM_REQUEST } = require('../config/topFeed');

const app = () => { const a = express(); a.use('/api/cron', require('../routes/cron')); return a; };
const good = (n = 12) => ({ query: '', results: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })), platforms: {}, nextCursor: {}, errors: {} });

const NINE_AM_WINTER = Date.parse('2026-11-09T17:10:00Z');   // 9:10 AM PST
const EIGHT_AM_WINTER = Date.parse('2026-11-09T16:10:00Z');  // 8:10 AM PST (the other cron firing)
const NINE_AM_SUMMER = Date.parse('2026-07-15T16:10:00Z');   // 9:10 AM PDT
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
  test('outside the 9 AM Pacific hour it does nothing', async () => {
    setNow(EIGHT_AM_WINTER);
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.body).toMatchObject({ status: 'skipped' });
    expect(mockBuild).not.toHaveBeenCalled();
  });

  test('in the 9 AM hour it builds exactly the landing request and stores it', async () => {
    setNow(NINE_AM_WINTER);
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.body).toMatchObject({ status: 'refreshed', epoch: '2026-11-09', results: 12 });
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockBuild).toHaveBeenCalledWith({
      q: PREWARM_REQUEST.query, requestedPlatforms: PREWARM_REQUEST.platforms,
      cur: PREWARM_REQUEST.cursor, limit: PREWARM_REQUEST.limit, allowAdult: PREWARM_REQUEST.adult,
    });
    // A visitor asking the same thing is then served from the cache.
    const hit = await TopFeedCache.serve(TopFeedCache.keyFor({ platforms: PREWARM_REQUEST.platforms, query: '', cursor: {}, limit: 20, adult: false }), async () => good(1), { now: NINE_AM_WINTER + 1000 });
    expect(hit.cache).toBe('hit');
  });

  test('works in summer time too', async () => {
    setNow(NINE_AM_SUMMER);
    expect((await request(app()).get('/api/cron/refresh-top-feed')).body).toMatchObject({ status: 'refreshed', epoch: '2026-07-15' });
  });

  test('calling it again the same morning (the second cron entry, a retry, anyone) does no more work', async () => {
    setNow(NINE_AM_WINTER);
    await request(app()).get('/api/cron/refresh-top-feed');
    const again = await request(app()).get('/api/cron/refresh-top-feed');
    expect(again.body).toMatchObject({ status: 'fresh' });
    expect(mockBuild).toHaveBeenCalledTimes(1);
  });

  test('a thin build is reported and stores nothing; a failing build is a 502, not a crash', async () => {
    setNow(NINE_AM_WINTER);
    mockBuild.mockResolvedValueOnce(good(2));
    expect((await request(app()).get('/api/cron/refresh-top-feed')).body).toMatchObject({ status: 'thin' });
    expect(mockRows.size).toBe(0);
    mockBuild.mockRejectedValueOnce(new Error('upstream exploded'));
    const r = await request(app()).get('/api/cron/refresh-top-feed');
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toMatch(/exploded/); // no internals leaked
  });
});

describe('auth', () => {
  test('with CRON_SECRET set: no header or a wrong one is refused, the right one works', async () => {
    process.env.CRON_SECRET = 's3cret-value';
    setNow(NINE_AM_WINTER);
    expect((await request(app()).get('/api/cron/refresh-top-feed')).status).toBe(401);
    expect((await request(app()).get('/api/cron/refresh-top-feed').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect(mockBuild).not.toHaveBeenCalled();
    const ok = await request(app()).get('/api/cron/refresh-top-feed').set('Authorization', 'Bearer s3cret-value');
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('refreshed');
  });

  test('force (rebuild now, any hour) needs the secret; without one configured it is refused', async () => {
    setNow(EIGHT_AM_WINTER);
    expect((await request(app()).get('/api/cron/refresh-top-feed?force=1')).status).toBe(403);
    process.env.CRON_SECRET = 'k';
    expect((await request(app()).get('/api/cron/refresh-top-feed?force=1')).status).toBe(401);
    const ok = await request(app()).get('/api/cron/refresh-top-feed?force=1').set('Authorization', 'Bearer k');
    expect(ok.body.status).toBe('refreshed');
  });
});
