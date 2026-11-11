/**
 * The individual feed servers behind POST /api/social/feed, through the real
 * route and the real ServerGuard (owner, 2026-11-10: "stricter caching for the
 * individual feed servers"). Only the network is stubbed.
 *
 * Hacker News stands in for any server here: it is not one of the top-posts
 * networks, so TopFeedCache never sees it and any reuse is the guard's alone.
 */
jest.mock('axios');
const axios = require('axios');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
jest.mock('../db/connection', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
const express = require('express');
const request = require('supertest');
const { shared: guard } = require('../services/feed/ServerGuard');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/social', require('../routes/social')); return a; };
const hit = (i) => ({ objectID: `h${i}`, title: `HN story ${i}`, url: `https://example.com/${i}`, created_at: '2026-11-10T00:00:00Z', points: 5, num_comments: 2 });
const hnCalls = () => axios.get.mock.calls.filter(([u]) => String(u).includes('hn.algolia.com')).length;
const http = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
const ask = (body = {}) => request(app()).post('/api/social/feed').send({ platforms: ['hackernews'], limit: 20, cursor: {}, ...body });

beforeEach(() => {
  guard.reset();
  axios.get.mockReset();
  axios.get.mockImplementation((url) => (String(url).includes('hn.algolia.com')
    ? Promise.resolve({ data: { hits: [hit(1), hit(2)], nbPages: 1, page: 0 } })
    : Promise.reject(new Error(`unexpected ${url}`))));
});

test('a repeated request, even a typed search, makes no second upstream call', async () => {
  const a = await ask({ query: 'rust' });
  const b = await ask({ query: 'rust' });
  expect(hnCalls()).toBe(1);
  expect(b.body.platforms.hackernews.map((p) => p.id)).toEqual(a.body.platforms.hackernews.map((p) => p.id));
  await ask({ query: 'zig' });          // a different search is a different key
  expect(hnCalls()).toBe(2);
});

test('different pages are different keys', async () => {
  await ask({ cursor: { hackernews: 0 } });
  await ask({ cursor: { hackernews: 1 } });
  expect(hnCalls()).toBe(2);
});

test('a server that answers 429 is left alone: later requests never reach it', async () => {
  axios.get.mockImplementation(() => Promise.reject(http(429)));
  const a = await ask();
  expect(a.status).toBe(200);                       // one dead server costs one panel
  expect(a.body.errors.hackernews).toMatch(/429/);
  expect(hnCalls()).toBe(1);

  const b = await ask({ query: 'anything else' }); // ANY key, same server
  expect(b.body.errors.hackernews).toMatch(/cooling down/);
  expect(hnCalls()).toBe(1);                        // not asked again
});

test('the last good page covers a failing server, with no error shown', async () => {
  const good = await ask();
  expect(good.body.platforms.hackernews).toHaveLength(2);

  // let the fresh answer age out by asking under a clock 20 minutes on
  const realNow = Date.now;
  Date.now = () => realNow() + 20 * 60 * 1000;
  try {
    axios.get.mockImplementation(() => Promise.reject(http(503)));
    const again = await ask();
    expect(again.body.errors.hackernews).toBeNull();
    expect(again.body.platforms.hackernews.map((p) => p.id)).toEqual(['h1', 'h2']);
  } finally { Date.now = realNow; }
});

test('a permanent refusal (403) is not retried for the same request, and is not a cool-down', async () => {
  axios.get.mockImplementation(() => Promise.reject(http(403)));
  await ask();
  await ask();
  expect(hnCalls()).toBe(1);                         // same key: remembered for five minutes
  await ask({ query: 'other' });                     // another key still tries
  expect(hnCalls()).toBe(2);
  expect(guard.status().hackernews?.cooling).toBeFalsy();
});

test('one server cooling down does not touch another', async () => {
  axios.get.mockImplementation((url) => (String(url).includes('hn.algolia.com')
    ? Promise.reject(http(429))
    : Promise.reject(new Error(`unexpected ${url}`))));
  await ask();
  expect(guard.status().hackernews.cooling).toBe(true);
  expect(guard.status().github?.cooling).toBeFalsy();
});
