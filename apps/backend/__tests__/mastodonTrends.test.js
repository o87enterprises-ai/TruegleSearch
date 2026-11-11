// Mastodon in the feed: the keyless TRENDING endpoint (the public timeline now
// needs a login: 422), paged by offset, with each post's own language label.
jest.mock('axios');
const axios = require('axios');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
jest.mock('../db/connection', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
const express = require('express');
const request = require('supertest');
const app = () => { const a = express(); a.use(express.json()); a.use('/api/social', require('../routes/social')); return a; };
const toot = (i, language) => ({ id: `t${i}`, content: `<p>Toot number ${i}</p>`, url: `https://mastodon.social/@a/t${i}`, language, account: { acct: 'a' }, created_at: '2026-11-09T00:00:00Z', favourites_count: 3, replies_count: 1 });

beforeEach(() => {
  axios.get.mockReset();
  axios.get.mockImplementation((url) => {
    if (String(url).includes('/api/v1/trends/statuses')) {
      const off = Number(new URL(url).searchParams.get('offset'));
      return Promise.resolve({ data: off === 0 ? [toot(1, 'en'), toot(2, 'de')] : [toot(3, 'en')] });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
});

test('asks the trending endpoint, never the login-only public timeline', async () => {
  const r = await request(app()).post('/api/social/feed').send({ platforms: ['mastodon'], limit: 20, cursor: {} });
  const urls = axios.get.mock.calls.map(([u]) => String(u));
  expect(urls.some((u) => u.includes('/api/v1/trends/statuses'))).toBe(true);
  expect(urls.some((u) => u.includes('/timelines/public'))).toBe(false);
  expect(r.body.platforms.mastodon.map((t) => t.id)).toEqual(['t1', 't2']);
  expect(r.body.platforms.mastodon.map((t) => t.lang)).toEqual(['en', 'de']); // the network's own label
  expect(r.body.errors.mastodon).toBeNull();
  expect(r.body.nextCursor.mastodon).toBe('2');
});

test('pages by offset: the cursor it hands back is where the next page starts', async () => {
  const r = await request(app()).post('/api/social/feed').send({ platforms: ['mastodon'], limit: 20, cursor: { mastodon: '2' } });
  const last = String(axios.get.mock.calls.at(-1)[0]);
  expect(new URL(last).searchParams.get('offset')).toBe('2');
  expect(r.body.platforms.mastodon.map((t) => t.id)).toEqual(['t3']);
  expect(r.body.nextCursor.mastodon).toBe('3');
});
