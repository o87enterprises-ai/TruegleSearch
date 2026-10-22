/**
 * The creators feed must not be taken over by the partner who uploads most:
 * one video per channel per round, channel order shuffled by an hourly seed.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
const { spreadByChannel } = require('../routes/creators');

const vids = (author, n, day0 = 20) => Array.from({ length: n }, (_, i) => ({
  id: `${author}${i}`, author, date: `2026-10-${String(day0 - i).padStart(2, '0')}T00:00:00Z`,
}));

test('a prolific channel gets one slot per round, not the whole top of the feed', () => {
  const out = spreadByChannel([...vids('Busy', 10), ...vids('Quiet', 2, 10), ...vids('Mid', 3, 15)], 1);
  const firstRound = out.slice(0, 3).map((x) => x.author).sort();
  expect(firstRound).toEqual(['Busy', 'Mid', 'Quiet']);
  // Each channel's own videos stay newest-first.
  const busy = out.filter((x) => x.author === 'Busy').map((x) => x.id);
  expect(busy).toEqual(vids('Busy', 10).map((x) => x.id));
  expect(out).toHaveLength(15);
});

test('the same seed gives the same order (paging stays consistent); a new seed reshuffles', () => {
  const all = [...vids('A', 3), ...vids('B', 3), ...vids('C', 3), ...vids('D', 3)];
  const a = spreadByChannel(all, 7).map((x) => x.id);
  expect(spreadByChannel(all, 7).map((x) => x.id)).toEqual(a);
  const leads = new Set(Array.from({ length: 12 }, (_, s) => spreadByChannel(all, s)[0].author));
  expect(leads.size).toBeGreaterThan(1);
});
