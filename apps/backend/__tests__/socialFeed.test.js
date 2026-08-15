/**
 * The social feed's PAGING.
 *
 * All three upstreams (Reddit, HN Algolia, GitHub) have always supported
 * paging and none of it was used: Reddit's `after` cursor was fetched on every
 * response and thrown away, HN's `page` and GitHub's `page` were never sent.
 * Without them the feed is one page of twenty and then silence.
 *
 * axios is stubbed rather than called. Two reasons, and the second is the
 * honest one: these are third-party endpoints with rate limits that a test
 * suite should not be spending, and this sandbox cannot reach them at all — a
 * live run reports `unavailable` for all three. So what is verified here is
 * exactly what this repo controls: which URL is built, which cursor goes out,
 * and which comes back. Whether Reddit's JSON still looks like this is not
 * something a test can promise.
 */
jest.mock('axios');
const axios = require('axios');

// The route module reads config at require time, which needs the required env
// vars present before the import.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';

const express = require('express');
const request = require('supertest');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/social', require('../routes/social'));
  return a;
}

/** Reply to whichever upstream is being asked, recording the URLs. */
function stub({ redditAfter = null, hnPage = 0, hnPages = 5, ghItems = 20 } = {}) {
  const seen = [];
  axios.get.mockImplementation((url, opts) => {
    seen.push({ url, headers: opts?.headers || {} });
    if (url.includes('reddit.com')) {
      return Promise.resolve({
        data: { data: { after: redditAfter, children: [{ data: { id: 'r1', title: 'A reddit post', permalink: '/r/x/comments/r1/', created_utc: 1700000000 } }] } },
      });
    }
    if (url.includes('hn.algolia.com')) {
      return Promise.resolve({ data: { hits: [{ objectID: 7, title: 'An HN story', created_at: '2026-01-01T00:00:00Z' }], page: hnPage, nbPages: hnPages } });
    }
    if (url.includes('api.github.com')) {
      // Honour the page size actually asked for. GitHub signals "no more" by
      // returning a SHORT page, so a stub that always returns twenty rows
      // regardless of per_page reports "no more" on every request, and the
      // paging assertion then fails for a reason with nothing to do with the
      // code under test.
      const want = Number(new URL(url).searchParams.get('per_page')) || 20;
      const n = Math.min(ghItems, want);
      return Promise.resolve({ data: { items: Array.from({ length: n }, (_, i) => ({ id: i, full_name: `o/r${i}`, owner: { login: 'o' } })) } });
    }
    return Promise.reject(new Error(`unexpected upstream: ${url}`));
  });
  return seen;
}

afterEach(() => jest.resetAllMocks());

describe('POST /api/social/feed — paging', () => {
  test('an empty query is the HOME feed and goes to the popular listings', async () => {
    const seen = stub();
    const res = await request(app()).post('/api/social/feed').send({ limit: 5 });

    expect(res.status).toBe(200);
    const urls = seen.map((s) => s.url);
    // Reddit's /search.json needs a q; /hot.json is the keyless popular
    // listing, which is the only thing an unauthenticated "home feed" can
    // honestly be until a token can ask for the real one.
    expect(urls.some((u) => u.includes('/hot.json'))).toBe(true);
    expect(urls.some((u) => u.includes('search.json'))).toBe(false);
    expect(urls.some((u) => u.includes('tags=front_page'))).toBe(true);
    // GitHub search REQUIRES a q, so the home feed asks a real question
    // rather than sending an empty one.
    expect(urls.some((u) => u.includes('api.github.com') && u.includes('stars'))).toBe(true);
  });

  test('a query searches instead, on every platform', async () => {
    const seen = stub();
    await request(app()).post('/api/social/feed').send({ query: 'raspberry pi', limit: 5 });
    const urls = seen.map((s) => s.url);
    expect(urls.some((u) => u.includes('search.json') && u.includes('raspberry'))).toBe(true);
    expect(urls.some((u) => u.includes('hn.algolia.com') && u.includes('tags=story'))).toBe(true);
  });

  test('the cursor it hands back is the cursor it sends next time', async () => {
    stub({ redditAfter: 't3_abc', hnPage: 0, hnPages: 5 });
    const first = await request(app()).post('/api/social/feed').send({ limit: 5 });
    expect(first.body.nextCursor).toEqual({ reddit: 't3_abc', hackernews: 1, github: 2 });

    const seen = stub({ redditAfter: 't3_def', hnPage: 1, hnPages: 5 });
    await request(app()).post('/api/social/feed').send({ limit: 5, cursor: first.body.nextCursor });
    const urls = seen.map((s) => s.url);
    expect(urls.some((u) => u.includes('after=t3_abc'))).toBe(true);
    expect(urls.some((u) => u.includes('page=1'))).toBe(true);
    expect(urls.some((u) => u.includes('api.github.com') && u.includes('page=2'))).toBe(true);
  });

  test('a platform that has run out reports null, so the client stops asking', async () => {
    // HN on its last page, GitHub returning a short page.
    stub({ redditAfter: null, hnPage: 4, hnPages: 5, ghItems: 3 });
    const res = await request(app()).post('/api/social/feed').send({ limit: 5 });
    expect(res.body.nextCursor).toEqual({ reddit: null, hackernews: null, github: null });
  });

  test('only the requested platforms are contacted', async () => {
    const seen = stub();
    await request(app()).post('/api/social/feed').send({ query: 'x', platforms: ['reddit'] });
    expect(seen.every((s) => s.url.includes('reddit.com'))).toBe(true);
    expect(seen.length).toBe(1);
  });

  test('Reddit is asked with the user agent that stops it 429ing', async () => {
    // Not cosmetic: a default UA gets rate-limited almost immediately, and it
    // is the only reason any of this works unauthenticated.
    const seen = stub();
    await request(app()).post('/api/social/feed').send({ query: 'x', platforms: ['reddit'] });
    expect(seen[0].headers['User-Agent']).toMatch(/TruegleSearch/);
  });

  test('one dead platform costs one panel, not the request', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('reddit.com')) return Promise.reject(new Error('reddit is down'));
      if (url.includes('hn.algolia.com')) return Promise.resolve({ data: { hits: [{ objectID: 1, title: 'Still here', created_at: '2026-01-01T00:00:00Z' }], page: 0, nbPages: 2 } });
      return Promise.resolve({ data: { items: [] } });
    });
    const res = await request(app()).post('/api/social/feed').send({ query: 'x' });
    expect(res.status).toBe(200);
    expect(res.body.errors.reddit).toBe('unavailable');
    expect(res.body.platforms.hackernews).toHaveLength(1);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  test('a non-string query is still rejected', async () => {
    stub();
    const res = await request(app()).post('/api/social/feed').send({ query: { evil: true } });
    expect(res.status).toBe(400);
  });

  test('limit is clamped — a caller cannot ask an upstream for ten thousand', async () => {
    const seen = stub();
    await request(app()).post('/api/social/feed').send({ query: 'x', limit: 10000, platforms: ['reddit'] });
    expect(seen[0].url).toMatch(/limit=50\b/);
  });
});
