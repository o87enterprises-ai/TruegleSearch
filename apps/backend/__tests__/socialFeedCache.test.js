/**
 * POST /api/social/feed through the top-posts cache: the real route and the real
 * cache; only the network (axios) and the database are stubbed.
 */
const mockRows = new Map();
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, params) => {
    const s = sql.trim();
    if (/^SELECT/i.test(s)) { const r = mockRows.get(params[0]); return { rows: r ? [{ epoch: r.epoch, partial: r.partial, built_at: new Date(r.builtAt).toISOString(), payload: r.payload }] : [] }; }
    if (/^INSERT INTO feed_cache/i.test(s)) mockRows.set(params[0], { epoch: params[1], partial: params[2], builtAt: params[3], payload: JSON.parse(params[4]) });
    return {};
  }),
}));
jest.mock('axios');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';

const express = require('express');
const request = require('supertest');
const TopFeedCache = require('../services/TopFeedCache');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/social', require('../routes/social')); return a; };

// A Reddit that answers with a healthy page of posts.
const redditPage = (n = 12) => ({
  data: { data: { after: 't3_next', children: Array.from({ length: n }, (_, i) => ({ data: { id: `r${i}`, title: `Reddit post ${i}`, permalink: `/r/x/comments/r${i}/`, created_utc: 1700000000 + i } })) } },
});
const redditCalls = () => axios.get.mock.calls.filter(([u]) => String(u).includes('reddit.com')).length;

beforeEach(() => {
  TopFeedCache.__memory.clear(); TopFeedCache.__inflight.clear(); TopFeedCache.__resetTable(); mockRows.clear();
  axios.get.mockReset();
  axios.get.mockImplementation((url) => (String(url).includes('reddit.com') ? Promise.resolve(redditPage()) : Promise.reject(new Error(`unexpected upstream: ${url}`))));
});

const top = { platforms: ['reddit'], limit: 20 };

test('the first request scrapes; the identical second one is a cache hit with no upstream calls', async () => {
  const a = await request(app()).post('/api/social/feed').send(top);
  expect(a.status).toBe(200);
  expect(a.headers['x-truegle-cache']).toBe('miss');
  expect(a.body.results.length).toBeGreaterThanOrEqual(8);
  const callsAfterFirst = redditCalls();
  expect(callsAfterFirst).toBeGreaterThan(0);

  const b = await request(app()).post('/api/social/feed').send(top);
  expect(b.headers['x-truegle-cache']).toBe('hit');
  expect(redditCalls()).toBe(callsAfterFirst); // nothing new was fetched
  expect(b.body.results.map((r) => r.id)).toEqual(a.body.results.map((r) => r.id));
  expect(b.body.nextCursor).toEqual(a.body.nextCursor);
});

test('a hit survives a cold start: the database serves it to a fresh instance', async () => {
  await request(app()).post('/api/social/feed').send(top);
  const calls = redditCalls();
  TopFeedCache.__memory.clear();
  const r = await request(app()).post('/api/social/feed').send(top);
  expect(r.headers['x-truegle-cache']).toBe('hit');
  expect(redditCalls()).toBe(calls);
});

test('the next page (its cursor) is cached separately from the first', async () => {
  const first = await request(app()).post('/api/social/feed').send(top);
  const page2 = { ...top, cursor: first.body.nextCursor };
  const a = await request(app()).post('/api/social/feed').send(page2);
  expect(a.headers['x-truegle-cache']).toBe('miss');
  const b = await request(app()).post('/api/social/feed').send(page2);
  expect(b.headers['x-truegle-cache']).toBe('hit');
});

test('things that must stay live are never cached: a typed search, non-social lanes, other sources', async () => {
  const typed = await request(app()).post('/api/social/feed').send({ ...top, query: 'raspberry pi' });
  expect(typed.headers['x-truegle-cache']).toBe('bypass');
  const mixed = await request(app()).post('/api/social/feed').send({ platforms: ['reddit', 'github'], limit: 20 });
  expect(mixed.headers['x-truegle-cache']).toBe('bypass');
  const creators = await request(app()).post('/api/social/feed').send({ platforms: ['creators'], limit: 20 });
  expect(creators.headers['x-truegle-cache']).toBe('bypass');
  expect(mockRows.size).toBe(0);
});

test('a thin answer is served as-is and is not cached', async () => {
  axios.get.mockImplementation((url) => (String(url).includes('reddit.com') ? Promise.resolve(redditPage(2)) : Promise.reject(new Error('x'))));
  const a = await request(app()).post('/api/social/feed').send(top);
  expect(a.headers['x-truegle-cache']).toBe('thin');
  expect(mockRows.size).toBe(0);
});
