const SearchService = require('../services/SearchService');

/**
 * "Blue page = Google parity" is a standing project rule (see the tech skill).
 * These lock in the part of it that broke in production on 2026-08-24: a
 * Dailymotion clip and a YouTube upload ranked above the BBC and the New York
 * Times on a news query, because video results are merged into the same list as
 * web results on the "All" tab and were ranked by relevance with no notion of
 * source type.
 *
 * The failure is quiet — search still works, the results are still relevant,
 * they are just in an order no mainstream engine would produce.
 */
describe('Google-parity ranking (blue and green)', () => {
  const svc = new SearchService();

  const fixture = () =>
    svc.categorizeByBias(
      [
        { title: 'Trump Dismisses USS Abraham Lincoln Conditions', url: 'https://dailymotion.com/video/xaymaj2', snippet: 'video', category: 'videos', date: '2026-08-18' },
        { title: 'USS Abraham Lincoln conditions', url: 'https://youtube.com/watch', snippet: 'Rep. Mike Levin discusses conditions', category: 'videos', date: '2026-08-19' },
        { title: 'Concern grows over conditions on USS Abraham Lincoln', url: 'https://bbc.com/news/articles/cyvl2d5j52lo', snippet: 'Military news outlets reported that some sailors', category: 'web', date: '2026-08-13' },
        { title: 'Concerns grow over conditions on USS Abraham Lincoln', url: 'https://nytimes.com/2026/08/13/us/uss-abraham-lincoln', snippet: 'Concerns Grow Over Conditions on Navy Carrier', category: 'web', date: '2026-08-13' },
      ].map((r) => ({ ...r, domain: svc.extractDomain(r.url) })),
    );

  const QUERY = 'uss abraham lincoln conditions';
  const firstIndexOf = (list, cat) => list.findIndex((r) => r.category === cat);

  test('platform video outranks news WITHOUT parity — the reported bug', () => {
    const ranked = svc.rankResults(QUERY, fixture(), {});
    expect(firstIndexOf(ranked, 'videos')).toBeLessThan(firstIndexOf(ranked, 'web'));
  });

  test('news outranks platform video WITH parity', () => {
    const ranked = svc.rankResults(QUERY, fixture(), { googleParity: true });
    expect(firstIndexOf(ranked, 'web')).toBeLessThan(firstIndexOf(ranked, 'videos'));
  });

  test('parity demotes, it does not remove', () => {
    // Weighting, not filtering: every result still comes back. Dropping sources
    // would be censorship, which the project forbids outright.
    const before = svc.rankResults(QUERY, fixture(), {});
    const after = svc.rankResults(QUERY, fixture(), { googleParity: true });
    expect(after).toHaveLength(before.length);
    expect(new Set(after.map((r) => r.url))).toEqual(new Set(before.map((r) => r.url)));
  });

  test('order WITHIN a group is unchanged', () => {
    // A uniform multiplier must not reshuffle results of the same type — only
    // move the groups relative to one another.
    const webOnly = (list) => list.filter((r) => r.category === 'web').map((r) => r.domain);
    expect(webOnly(svc.rankResults(QUERY, fixture(), { googleParity: true })))
      .toEqual(webOnly(svc.rankResults(QUERY, fixture(), {})));
  });

  test('a markedly more relevant video still beats a marginal news item', () => {
    // Parity is a thumb on the scale, not a ceiling. If it pinned every video
    // below every article it would be a filter wearing a ranking costume.
    const mixed = svc.categorizeByBias([
      { title: 'uss abraham lincoln conditions explained in full', url: 'https://youtube.com/watch', snippet: 'uss abraham lincoln conditions conditions uss abraham lincoln', category: 'videos', date: '2026-08-19' },
      { title: 'Local weather roundup', url: 'https://bbc.com/news/weather', snippet: 'unrelated', category: 'web', date: '2026-08-13' },
    ].map((r) => ({ ...r, domain: svc.extractDomain(r.url) })));
    const ranked = svc.rankResults(QUERY, mixed, { googleParity: true });
    expect(ranked[0].category).toBe('videos');
  });

  test('parityWeight only discounts platform-ish sources', () => {
    expect(svc.parityWeight({ category: 'web', bias: 'center' })).toBe(1);
    expect(svc.parityWeight({ category: 'web', bias: 'unknown' })).toBe(1);
    expect(svc.parityWeight({ category: 'videos', bias: 'unknown' })).toBeLessThan(1);
    expect(svc.parityWeight({ category: 'social', bias: 'unknown' })).toBeLessThan(1);
    expect(svc.parityWeight({ category: 'web', bias: 'platform' })).toBeLessThan(1);
  });

  test('red-pill does NOT get parity weighting', () => {
    // Red-pill exists to surface exactly the non-institutional sources parity
    // de-emphasises. Applying it there would defeat the mode.
    const ranked = svc.rankResults(QUERY, fixture(), { boostAlternative: true });
    expect(firstIndexOf(ranked, 'videos')).toBeLessThan(firstIndexOf(ranked, 'web'));
  });
});
