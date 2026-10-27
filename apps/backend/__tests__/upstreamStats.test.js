const u = require('../utils/upstreamStats');

beforeEach(() => u._reset());

test('outcomeOf prefers the real HTTP status over message text', () => {
  expect(u.outcomeOf(u.withStatus(new Error('invalid or quota exceeded'), 403))).toBe('403');
  expect(u.outcomeOf({ response: { status: 429 } })).toBe('429');
  expect(u.outcomeOf(new Error('timeout of 5000ms exceeded'))).toBe('timeout');
  expect(u.outcomeOf(new Error('Brave API key not configured'))).toBeNull();
  expect(u.outcomeOf(new Error('boom'))).toBe('error');
});

test('track counts ok and failures, and rethrows', async () => {
  await u.track('brave', async () => 1)();
  await expect(u.track('brave', async () => { throw u.withStatus(new Error('x'), 429); })()).rejects.toThrow('x');
  expect(u.snapshot().counts[new Date().toISOString().slice(0, 10)].brave).toEqual({ ok: 1, '429': 1 });
});

test('degraded lists only providers that failed in this request', async () => {
  await new Promise((resolve) => {
    setImmediate(async () => {
      u.beginRequest();
      await u.track('youtube', async () => 1)();
      await u.track('brave', async () => { throw new Error('x'); })().catch(() => {});
      u.record('tomtom', 'skipped');
      expect(u.degraded()).toEqual(['brave', 'tomtom']);
      resolve();
    });
  });
});

test('flush sends deltas once and restores them on failure', async () => {
  const sent = [];
  u._setFlush(async (rows) => { sent.push(...rows); });
  u.record('newsapi', 'ok');
  await u.flush();
  expect(sent).toEqual([expect.objectContaining({ provider: 'newsapi', outcome: 'ok', count: 1 })]);
  u._setFlush(async () => { throw new Error('db down'); });
  u.record('newsapi', 'ok');
  expect(await u.flush()).toBe(false);
  const again = [];
  u._setFlush(async (rows) => { again.push(...rows); });
  await u.flush();
  expect(again.length).toBeGreaterThan(0);
});

test('unknown providers and outcomes are ignored', () => {
  u.record('nope', 'ok'); u.record('brave', 'weird');
  expect(u.snapshot().counts).toEqual({});
});
