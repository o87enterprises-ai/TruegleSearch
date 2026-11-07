/**
 * Instagram reels come from links shared on Bluesky (search engines barely
 * index individual posts — the live box returned only Instagram's /reels/
 * landing page). Top first, then latest, then the lane ends; Bluesky's own
 * cursor is never sent (it 403s keyless pagination).
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

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/social', require('../routes/social'));
  return a;
}

const post = (id, text = 'look', labels = []) => ({
  uri: `at://did:x/app.bsky.feed.post/${id}`,
  record: { text: `${text} https://instagram.com/reel/${id}`, createdAt: '2026-11-05T00:00:00Z' },
  labels: labels.map((val) => ({ val })),
});

beforeEach(() => axios.get.mockReset());

test('blank feed: real reels from Bluesky, top then latest, then the end', async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes('searchPosts')) {
      const latest = url.includes('sort=latest');
      expect(url).not.toContain('cursor=');
      return Promise.resolve({ data: { posts: latest ? [post('LATEST11111')] : [post('TOP11111111'), post('TOP11111111')] } });
    }
    return Promise.reject(new Error('unexpected'));
  });
  const one = await request(app()).post('/api/social/feed').send({ query: '', platforms: ['instagram'], limit: 10 });
  expect(one.body.results.map((r) => r.url)).toEqual(['https://www.instagram.com/reel/TOP11111111/']);
  expect(one.body.nextCursor.instagram).toBe('bsky:latest');

  const two = await request(app()).post('/api/social/feed')
    .send({ query: '', platforms: ['instagram'], limit: 10, cursor: one.body.nextCursor });
  expect(two.body.results.map((r) => r.url)).toEqual(['https://www.instagram.com/reel/LATEST11111/']);
  expect(two.body.nextCursor.instagram ?? null).toBeNull();
});

test('adult-labelled shares are kept out under Safe Search', async () => {
  axios.get.mockResolvedValue({ data: { posts: [post('SAFE1111111'), post('ADULT111111', 'x', ['porn'])] } });
  const r = await request(app()).post('/api/social/feed').send({ query: '', platforms: ['instagram'], limit: 10 });
  expect(r.body.results.map((x) => x.url)).toEqual(['https://www.instagram.com/reel/SAFE1111111/']);
});

test('Bluesky down on page 1 → falls back to search', async () => {
  axios.get.mockImplementation((url) => (url.startsWith('http://searx.test')
    ? Promise.resolve({ data: { results: [{ url: 'https://www.instagram.com/reel/SEARX111111/', title: 't' }] } })
    : Promise.reject(new Error('down'))));
  const r = await request(app()).post('/api/social/feed').send({ query: 'cats', platforms: ['instagram'], limit: 10 });
  expect(r.body.results.map((x) => x.url)).toEqual(['https://www.instagram.com/reel/SEARX111111/']);
});
