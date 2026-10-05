/**
 * Search results carry no proxy links.
 *
 * Until 2026-10-05 every result carried a `proxyUrl` built from
 * SEARXNG_RESULT_PROXY_URL — in production `http://44.236.219.63:3001/?mortyurl=…`:
 * plain HTTP, the server's bare IP in every response, and a port that did not
 * answer. Nothing in the app used it. The Morty "Anonymous View" was retired
 * (docs/ANONYMOUS-VIEW.md); protected browsing is planned in
 * docs/TRUEGLE-BROWSER-BLUEPRINT.md. This pins it gone even if the old env
 * vars are still set somewhere.
 */
process.env.JWT_SECRET ||= 'test-only-secret';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
process.env.GOOGLE_API_KEY ||= 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID ||= 'test-only';
process.env.SEARXNG_RESULT_PROXY_URL = 'http://44.236.219.63:3001/';
process.env.SEARXNG_RESULT_PROXY_KEY = 'dGVzdA==';

const SearchService = require('../services/SearchService');

describe('no dead proxy links on results', () => {
  const svc = new SearchService();
  const data = { results: [{ url: 'https://example.com/a', title: 'A', content: 'x', engine: 'brave' }] };

  test('web results', () => {
    const [r] = svc.formatSearXNGResults(data);
    expect(r.url).toBe('https://example.com/a');
    expect(r).not.toHaveProperty('proxyUrl');
    expect(JSON.stringify(r)).not.toMatch(/mortyurl|44\.236\.219\.63/);
  });

  test('category results', () => {
    const [r] = svc.formatSearXNGCategoryResults(data, 'news');
    expect(r).not.toHaveProperty('proxyUrl');
    expect(JSON.stringify(r)).not.toMatch(/mortyurl|44\.236\.219\.63/);
  });
});
