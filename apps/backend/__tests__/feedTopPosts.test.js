/**
 * Narrowing the Feed to TikTok / Instagram / Facebook used to come back EMPTY
 * on the home feed: the shared seeds (trending searches, headline words) almost
 * never match a public post page on those sites. When the shared seed finds
 * nothing, the platform's own top-posts words are tried instead.
 */
jest.mock('axios');
const axios = require('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
process.env.SEARXNG_URL = 'http://searx.test';

const express = require('express');
const request = require('supertest');
const { topSeedFor } = require('../services/feed/FeedSeeds');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/social', require('../routes/social'));
  return a;
}

beforeEach(() => {
  axios.get.mockReset();
  axios.get.mockImplementation((url, opts) => {
    const q = opts?.params?.q || '';
    if (url.startsWith('http://searx.test')) {
      // Only the platform's own top-posts word finds anything.
      if (q === `site:tiktok.com ${topSeedFor('tiktok', 1)}`) {
        return Promise.resolve({ data: { results: [{ url: 'https://www.tiktok.com/@a/video/123', title: 'A viral clip' }] } });
      }
      return Promise.resolve({ data: { results: [] } });
    }
    return Promise.reject(new Error('offline'));
  });
});

test('home feed narrowed to TikTok is filled from top posts', async () => {
  const res = await request(app()).post('/api/social/feed').send({ platforms: ['tiktok'] });
  expect(res.status).toBe(200);
  expect(res.body.platforms.tiktok.map((p) => p.url)).toEqual(['https://www.tiktok.com/@a/video/123']);
  expect(res.body.nextCursor.tiktok).toBe(2);
});

test('a typed query is searched as typed, never swapped for top posts', async () => {
  const res = await request(app()).post('/api/social/feed').send({ platforms: ['tiktok'], query: 'nasa' });
  expect(res.body.platforms.tiktok).toEqual([]);
  const asked = axios.get.mock.calls.map(([, o]) => o?.params?.q).filter(Boolean);
  expect(asked.every((q) => q === 'site:tiktok.com nasa')).toBe(true);
});
