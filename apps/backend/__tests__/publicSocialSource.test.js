/**
 * The SearXNG-backed public social sources.
 *
 * WHY THESE ASSERTIONS AND NOT OTHERS: two of them are bugs that have already
 * shipped in this repo and are recorded as such in agent memory —
 *
 *   - `site:reddit.com/r/news` is a PATH prefix. Only Google honours it; every
 *     other engine returns nothing at all, so a path-scoped site: filter is a
 *     silently empty source.
 *   - The provider does not honour `(a OR b OR c)`. A combined query looks like
 *     one saved round trip and returns nothing.
 *
 * Both are invisible in production: the feed just goes quiet for that platform
 * and reports no error, because an empty result set is a legitimate answer.
 * They are only catchable by asserting on the OUTBOUND request, which is what
 * most of this file does.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-key';
process.env.SEARXNG_URL = 'http://searx.test';

jest.mock('axios');
const axios = require('axios');

const modulePath = '../services/feed/PublicSocialSource';

/** Fresh module each test so the internal TTL cache never leaks between them. */
function load() {
  let mod;
  jest.isolateModules(() => { mod = require(modulePath); });
  return mod;
}

const results = (...urls) => ({
  data: { results: urls.map((u, i) => ({ url: u, title: `Post ${i}`, content: 'body' })) },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PublicSocialSource — the outbound query', () => {
  test('is domain-only site:, never a path prefix', async () => {
    axios.get.mockResolvedValue(results('https://reddit.com/r/x/comments/1'));
    const { fetchPublicSocial } = load();
    await fetchPublicSocial({ platform: 'reddit', topic: 'privacy', limit: 5 });

    const q = axios.get.mock.calls[0][1].params.q;
    expect(q).toBe('site:reddit.com privacy');
    // The bug: anything after the domain in the site: term.
    expect(q).not.toMatch(/site:[^\s]+\//);
  });

  test('never uses an OR-group', async () => {
    axios.get.mockResolvedValue(results('https://x.com/a/status/1'));
    const { fetchPublicSocial } = load();
    await fetchPublicSocial({ platform: 'x', topic: 'election', limit: 5 });

    const q = axios.get.mock.calls[0][1].params.q;
    expect(q).not.toMatch(/\bOR\b/);
    expect(q).not.toMatch(/[()]/);
  });

  test('asks the social category first, then falls back to the general index', async () => {
    // Public Instagram and Facebook post pages live in the general web index
    // rather than in any social engine, so the fallback is where most of the
    // real work happens — not an error path.
    axios.get
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce(results('https://instagram.com/p/abc'));
    const { fetchPublicSocial } = load();
    const r = await fetchPublicSocial({ platform: 'instagram', topic: 'street art', limit: 5 });

    expect(axios.get.mock.calls[0][1].params.categories).toBe('social media');
    expect(axios.get.mock.calls[1][1].params.categories).toBe('general');
    expect(r.items).toHaveLength(1);
  });
});

describe('PublicSocialSource — what it returns', () => {
  test('drops results that are not on the platform, keeps subdomains', async () => {
    // An engine with soft site: handling returns other hosts. Labelling one of
    // those as a post from this platform would be a lie on screen.
    axios.get.mockResolvedValue(results(
      'https://x.com/a/status/1',
      'https://evil.example.com/spoof',
      'https://mobile.x.com/b/status/2',
      // A lookalike domain that merely ENDS with the string, which a naive
      // endsWith check would wave through.
      'https://notx.com/c',
    ));
    const { fetchPublicSocial } = load();
    const r = await fetchPublicSocial({ platform: 'x', topic: 'news', limit: 10 });

    const hosts = r.items.map((i) => new URL(i.url).hostname);
    expect(hosts).toEqual(['x.com', 'mobile.x.com']);
  });

  test('reports no score and no comment count, as null rather than zero', async () => {
    // A search result has neither. Zero is a real number of votes and would
    // render as one — a different and false claim.
    axios.get.mockResolvedValue(results('https://x.com/a/status/1'));
    const { fetchPublicSocial } = load();
    const r = await fetchPublicSocial({ platform: 'x', topic: 'news', limit: 5 });

    expect(r.items[0].score).toBeNull();
    expect(r.items[0].comments).toBeNull();
    expect(r.items[0].platform).toBe('X');
  });

  test('an empty page ends the cursor instead of paging forever', async () => {
    // SearXNG will happily serve page 40 of nothing, and a cursor that never
    // goes null is an infinite scroll that loads forever and shows nothing.
    axios.get.mockResolvedValue({ data: { results: [] } });
    const { fetchPublicSocial } = load();
    const r = await fetchPublicSocial({ platform: 'x', topic: 'news', limit: 5 });

    expect(r.items).toHaveLength(0);
    expect(r.next).toBeNull();
  });
});

describe('PublicSocialSource — load protection', () => {
  test('a repeat page is served from cache, not re-fetched', async () => {
    axios.get.mockResolvedValue(results('https://x.com/a/status/1'));
    const { fetchPublicSocial } = load();
    await fetchPublicSocial({ platform: 'x', topic: 'news', limit: 5 });
    const after = axios.get.mock.calls.length;
    await fetchPublicSocial({ platform: 'x', topic: 'news', limit: 5 });

    expect(axios.get.mock.calls.length).toBe(after);
  });

  test('concurrent readers of the same page make ONE upstream request', async () => {
    // The SearXNG box is a 1 GB t3.micro serving the main search too. Six
    // platforms per feed page per reader is the difference between a cache and
    // a self-inflicted denial of service.
    axios.get.mockImplementation(() => new Promise((res) => {
      setTimeout(() => res(results('https://x.com/a/status/1')), 10);
    }));
    const { fetchPublicSocial } = load();
    await Promise.all(Array.from({ length: 8 }, () => fetchPublicSocial({
      platform: 'x', topic: 'news', limit: 5,
    })));

    expect(axios.get.mock.calls.length).toBe(1);
  });
});

describe('PublicSocialSource — the social category answering off-platform', () => {
  beforeEach(() => axios.get.mockReset());

  test('falls back to the general index when social rows are all from other sites', async () => {
    // Reported: X / Facebook / Instagram empty for every query. The social
    // engines ignore site: and answer with Mastodon posts, which used to stop
    // the fallback — then every row was dropped as off-domain.
    axios.get
      .mockResolvedValueOnce(results('https://mastodon.social/@a/1', 'https://reddit.com/r/x/comments/1'))
      .mockResolvedValueOnce(results('https://x.com/NASA', 'https://x.com/NASA/status/123'));
    const { fetchPublicSocial } = load();
    const out = await fetchPublicSocial({ platform: 'x', topic: 'offsite-case', limit: 5 });
    expect(axios.get.mock.calls[1][1].params.categories).toBe('general');
    expect(out.items.map((i) => i.url)).toEqual(['https://x.com/NASA/status/123']);
  });

  test('posts win over profile pages; a profile is kept only when there are no posts', async () => {
    axios.get.mockResolvedValue(results('https://www.facebook.com/daniel.oden'));
    const { fetchPublicSocial } = load();
    const out = await fetchPublicSocial({ platform: 'facebook', topic: 'profile-only', limit: 5 });
    expect(out.items.map((i) => i.url)).toEqual(['https://www.facebook.com/daniel.oden']);
  });

  test('isPost knows each platform\'s post shape', () => {
    const { isPost } = load();
    expect(isPost('https://x.com/NASA/status/1', 'x')).toBe(true);
    expect(isPost('https://x.com/NASA', 'x')).toBe(false);
    expect(isPost('https://www.instagram.com/p/Cabc123/', 'instagram')).toBe(true);
    expect(isPost('https://www.instagram.com/nasa/', 'instagram')).toBe(false);
    expect(isPost('https://www.facebook.com/NASA/videos/12345', 'facebook')).toBe(true);
    expect(isPost('https://www.tiktok.com/@nasa/video/7', 'tiktok')).toBe(true);
    expect(isPost('https://www.tiktok.com/@nasa', 'tiktok')).toBe(false);
  });
});

describe('PublicSocialSource — refusing honestly', () => {
  test('says WHY when the metasearch instance is not configured', async () => {
    jest.isolateModules(() => {
      const saved = process.env.SEARXNG_URL;
      delete process.env.SEARXNG_URL;
      jest.resetModules();
      const { fetchPublicSocial } = require(modulePath);
      expect(fetchPublicSocial({ platform: 'x', topic: 'news', limit: 5 }))
        .rejects.toThrow(/SEARXNG_URL/);
      process.env.SEARXNG_URL = saved;
    });
  });

  test('an unknown platform is an error, not a silent empty page', async () => {
    const { fetchPublicSocial } = load();
    await expect(fetchPublicSocial({ platform: 'myspace', topic: 'news', limit: 5 }))
      .rejects.toThrow(/Unknown public-social platform/);
  });

  test('no topic returns nothing rather than the platform front page', async () => {
    // `site:x.com` alone returns x.com's front page, which is not a post.
    const { fetchPublicSocial } = load();
    const r = await fetchPublicSocial({ platform: 'x', topic: '', limit: 5 });
    expect(r).toEqual({ items: [], next: null });
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('isSiteRoot — a homepage is never a feed post', () => {
  const { isSiteRoot } = require('../services/feed/PublicSocialSource');
  it('flags a bare homepage, with or without the slash', () => {
    expect(isSiteRoot('https://www.reddit.com/')).toBe(true);
    expect(isSiteRoot('https://www.reddit.com')).toBe(true);
  });
  it('keeps real pages', () => {
    expect(isSiteRoot('https://www.reddit.com/r/videos/comments/abc/x/')).toBe(false);
    expect(isSiteRoot('https://www.reddit.com/r/videos/')).toBe(false);
  });
  it('treats junk as not a post', () => expect(isSiteRoot('not a url')).toBe(true));
});
