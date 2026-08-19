/**
 * The visitor's safe-search choice has to reach the provider that answers.
 *
 * REPORTED: "it seems to be gating all 18+ sites with safe search turned off,
 * which is against our policies." It was, and the reason is narrow and
 * embarrassing: SearXNG is the PRIMARY provider, and neither of the two
 * functions that query it sent a `safesearch` parameter at all.
 *
 * Every other provider was wired up — Brave, Google, Bing, SerpAPI and
 * Unsplash all map the setting — so the plumbing looked complete from every
 * angle except the one that mattered. SearXNG simply applied whatever default
 * sat in its own settings.yml, on every search, for everyone.
 *
 * For a product whose stated hallmark is uncensored search, an explicit "off"
 * being silently ignored is a correctness bug, not a preference.
 */
process.env.JWT_SECRET ||= 'test-only-secret';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
process.env.GOOGLE_API_KEY ||= 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID ||= 'test-only';

const SearchService = require('../services/SearchService');

describe('safe search reaches SearXNG', () => {
  const svc = new SearchService();

  it('off means OFF — SearXNG 0, no filtering', () => {
    expect(svc.searxngSafeSearch({ safeSearch: 'off' })).toBe(0);
  });

  it('blur is moderate', () => {
    expect(svc.searxngSafeSearch({ safeSearch: 'blur' })).toBe(1);
  });

  it('safe is strict', () => {
    expect(svc.searxngSafeSearch({ safeSearch: 'safe' })).toBe(2);
  });

  it('anything unrecognised fails CLOSED, not open', () => {
    // A typo, a missing field or a hand-rolled request must not accidentally
    // switch filtering off for somebody who never asked.
    for (const v of [undefined, null, '', 'yes', 'OFF', 0, {}]) {
      expect(svc.searxngSafeSearch({ safeSearch: v })).toBe(2);
    }
    expect(svc.searxngSafeSearch({})).toBe(2);
  });

  it('actually puts the parameter on the request', async () => {
    // The mapping being right is worthless if the value never leaves. This is
    // the assertion that would have caught the original bug: the old params
    // object was { q, format, pageno } and nothing here would have failed.
    const axios = require('axios');
    const seen = [];
    const spy = jest.spyOn(axios, 'get').mockImplementation((url, cfg) => {
      seen.push(cfg?.params);
      return Promise.resolve({ data: { results: [] } });
    });
    svc.searxngUrl = 'http://searxng.test';

    await svc.performSearXNGSearch('anything', { safeSearch: 'off' });
    await svc.performSearXNGCategorySearch('anything', 'images', { safeSearch: 'off' });

    expect(seen).toHaveLength(2);
    for (const params of seen) {
      expect(params).toHaveProperty('safesearch');
      expect(params.safesearch).toBe(0);
    }
    spy.mockRestore();
  });
});
