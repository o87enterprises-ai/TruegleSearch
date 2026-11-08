/**
 * What a query-less home feed searches for.
 *
 * 2026-11-08: the feed was seeded from the most-searched queries of the last
 * 48 hours. The search log stores no person, so it counts searches, not people,
 * and one person repeating a query took the whole home feed over — the live top
 * six were four variations of one private individual's name, and three scroll
 * pages in a row were posts about it. Search text now feeds the trending pills
 * and nothing else; the feed is seeded from today's headlines, topped up from a
 * static rotation.
 *
 * Pinned here:
 *   - the seeds NEVER read the search log, whatever it contains
 *   - headlines come first, then the rotation tops the list up to `limit`
 *   - no duplicates, never empty, never longer than asked
 *   - unreachable headlines fall back to the rotation, not to nothing
 */

// A search log full of one person's name. If any of it reaches a seed, or the
// log is even queried, the feed has regressed.
const SEARCH_LOG = [{ query: 'a private persons name' }, { query: 'the same name again' }];
const mockQuery = jest.fn(async () => ({ rows: SEARCH_LOG }));
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));

const mockHeadlines = jest.fn();
jest.mock('../services/NewsSources', () => ({ printHeadlines: (...a) => mockHeadlines(...a) }));

// A fresh module (and so a fresh 10-minute cache) per test.
const load = () => { let m; jest.isolateModules(() => { m = require('../services/feed/FeedSeeds'); }); return m; };

beforeEach(() => { mockQuery.mockClear(); mockHeadlines.mockReset(); });

describe('seedTopics', () => {
  test('never reads the search log, and none of its text becomes a seed', async () => {
    mockHeadlines.mockResolvedValue({ world: [{ title: 'Markets rally after the surprise rate decision today' }], local: [] });
    const { seedTopics } = load();
    const seeds = await seedTopics(6);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(seeds.join(' ').toLowerCase()).not.toMatch(/private person|same name/);
  });

  test('stays clear of the search log even when the headlines are down', async () => {
    mockHeadlines.mockRejectedValue(new Error('news is down'));
    const { seedTopics } = load();
    await seedTopics(6);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('headlines lead, the rotation tops the list up to the size asked for', async () => {
    mockHeadlines.mockResolvedValue({
      world: [{ title: 'Storm closes major roads across the region' }],
      local: [{ title: 'City council approves new transit plan' }],
    });
    const { seedTopics } = load();
    const seeds = await seedTopics(6);
    expect(seeds).toHaveLength(6);
    expect(seeds[0]).toBe('Storm closes major roads across');
    expect(seeds[1]).toBe('City council approves new transit');
    expect(new Set(seeds).size).toBe(6);
  });

  test('one lonely headline still gives a full, varied list', async () => {
    mockHeadlines.mockResolvedValue({ world: [{ title: 'Only one story today' }], local: [] });
    const { seedTopics } = load();
    const seeds = await seedTopics(5);
    expect(seeds).toHaveLength(5);
    expect(new Set(seeds).size).toBe(5);
  });

  test('unreachable headlines fall back to the rotation, never to nothing', async () => {
    mockHeadlines.mockRejectedValue(new Error('news is down'));
    const { seedTopics, STATIC_SEEDS } = load();
    const seeds = await seedTopics(6);
    expect(seeds).toHaveLength(6);
    seeds.forEach((s) => expect(STATIC_SEEDS).toContain(s));
  });

  test('never returns more than asked, and never repeats a topic', async () => {
    mockHeadlines.mockResolvedValue({
      world: Array.from({ length: 12 }, (_, i) => ({ title: `Headline number ${i} about something happening` })),
      local: [{ title: 'Headline number 0 about something happening' }],
    });
    const { seedTopics } = load();
    const seeds = await seedTopics(4);
    expect(seeds).toHaveLength(4);
    expect(new Set(seeds).size).toBe(4);
  });
});
