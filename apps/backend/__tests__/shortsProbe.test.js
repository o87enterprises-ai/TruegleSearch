const { annotateShorts, matchesKind, __known } = require('../services/ShortsProbe');

const vid = (id) => ({ videoId: id, title: id });
const fakeFetch = (table) => jest.fn(async (url) => {
  const id = decodeURIComponent(url.split('/shorts/')[1]);
  const v = table[id];
  if (v === 'throw') throw new Error('network');
  return { status: v };
});

beforeEach(() => __known.clear());

describe('annotateShorts', () => {
  it('200 = Short, redirect = not a Short; anything else is left unknown', async () => {
    const f = fakeFetch({ s1: 200, v1: 303, v2: 302, x1: 404, x2: 429, x3: 'throw' });
    const out = await annotateShorts(['s1', 'v1', 'v2', 'x1', 'x2', 'x3'].map(vid), { fetchImpl: f });
    const by = Object.fromEntries(out.map((v) => [v.videoId, v.short]));
    expect(by).toEqual({ s1: true, v1: false, v2: false, x1: undefined, x2: undefined, x3: undefined });
  });

  it('caches answers for good, never caches a guess, and does not re-ask known ids', async () => {
    const f = fakeFetch({ s1: 200, v1: 303, x1: 429 });
    await annotateShorts([vid('s1'), vid('v1'), vid('x1')], { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(3);
    await annotateShorts([vid('s1'), vid('v1'), vid('x1')], { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(4); // only the unknown one is asked again
  });

  it('dedupes ids and tolerates junk input', async () => {
    const f = fakeFetch({ a: 200 });
    await annotateShorts([vid('a'), vid('a'), null, {}], { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect(await annotateShorts(null, { fetchImpl: f })).toEqual([]);
  });

  it('gives up on a batch that runs past its budget instead of stalling', async () => {
    const slow = jest.fn(() => new Promise((r) => { setTimeout(() => r({ status: 200 }), 60); }));
    const ids = Array.from({ length: 40 }, (_, i) => vid(`id${i}`));
    const t0 = Date.now();
    await annotateShorts(ids, { fetchImpl: slow, budgetMs: 100 });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(slow.mock.calls.length).toBeLessThan(40);
  });
});

describe('matchesKind', () => {
  it('filters Shorts / videos / all; unknown counts as a video', () => {
    const s = { short: true }; const v = { short: false }; const u = {};
    expect([s, v, u].map((x) => matchesKind(x, 'short'))).toEqual([true, false, false]);
    expect([s, v, u].map((x) => matchesKind(x, 'video'))).toEqual([false, true, true]);
    expect([s, v, u].map((x) => matchesKind(x, 'all'))).toEqual([true, true, true]);
    expect(matchesKind(s, 'nonsense')).toBe(true);
  });
});
