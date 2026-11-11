/**
 * ServerGuard: the strict cache in front of every individual feed server
 * (owner, 2026-11-10). Fake clock throughout, so every timing rule is exact.
 */
const { createServerGuard, isTransient, BASE_COOLDOWN_MS, MAX_COOLDOWN_MS, NEGATIVE_TTL_MS } = require('../services/feed/ServerGuard');

const MIN = 60 * 1000;
const http = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });

let clock; let guard;
beforeEach(() => { clock = 1_000_000; guard = createServerGuard({ now: () => clock }); });
const run = (server, key, produce, opts = {}) => guard.run(server, key, produce, { ttlMs: 10 * MIN, ...opts });

describe('fresh answers', () => {
  test('are served without another upstream call until they expire', async () => {
    const produce = jest.fn().mockResolvedValue({ items: [1] });
    await run('mastodon', 'a', produce);
    clock += 9 * MIN;
    expect(await run('mastodon', 'a', produce)).toEqual({ items: [1] });
    expect(produce).toHaveBeenCalledTimes(1);
    clock += 2 * MIN;
    await run('mastodon', 'a', produce);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  test('are kept per server and per key', async () => {
    const produce = jest.fn().mockResolvedValue('x');
    await run('mastodon', 'a', produce);
    await run('mastodon', 'b', produce);
    await run('lemmy', 'a', produce);
    expect(produce).toHaveBeenCalledTimes(3);
  });

  test('an EMPTY page is only believed for two minutes, not the full lifetime', async () => {
    const produce = jest.fn().mockResolvedValue({ items: [] });
    const opts = { isEmpty: (v) => !v.items.length };
    await run('tiktok', 'a', produce, opts);
    clock += 1 * MIN;
    await run('tiktok', 'a', produce, opts);
    expect(produce).toHaveBeenCalledTimes(1);
    clock += 2 * MIN;
    await run('tiktok', 'a', produce, opts);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  test('concurrent readers share ONE upstream call', async () => {
    let release;
    const produce = jest.fn(() => new Promise((r) => { release = () => r('v'); }));
    const all = Promise.all([run('x', 'a', produce), run('x', 'a', produce), run('x', 'a', produce)]);
    release();
    expect(await all).toEqual(['v', 'v', 'v']);
    expect(produce).toHaveBeenCalledTimes(1);
  });
});

describe('a server that fails TRANSIENTLY (429, 5xx, timeout) is left alone', () => {
  test('after a 429 no further call leaves the process for a minute, for ANY key', async () => {
    const produce = jest.fn().mockRejectedValue(http(429));
    await expect(run('bluesky', 'a', produce)).rejects.toThrow(/429/);
    expect(produce).toHaveBeenCalledTimes(1);

    await expect(run('bluesky', 'a', produce)).rejects.toThrow(/cooling down/);
    await expect(run('bluesky', 'b', produce)).rejects.toThrow(/cooling down/);
    expect(produce).toHaveBeenCalledTimes(1);

    clock += BASE_COOLDOWN_MS + 1;
    produce.mockResolvedValueOnce('back');
    expect(await run('bluesky', 'a', produce)).toBe('back');
  });

  test('other servers are not affected', async () => {
    await expect(run('bluesky', 'a', jest.fn().mockRejectedValue(http(503)))).rejects.toThrow();
    const ok = jest.fn().mockResolvedValue('fine');
    expect(await run('lemmy', 'a', ok)).toBe('fine');
  });

  test('the cool-down doubles with each consecutive failure and stops at 15 minutes', async () => {
    const produce = jest.fn().mockRejectedValue(http(500));
    const waits = [];
    for (let i = 0; i < 7; i += 1) {
      await expect(run('lemmy', 'a', produce)).rejects.toThrow();
      waits.push(guard.status().lemmy.retryInMs);
      clock += guard.status().lemmy.retryInMs + 1;
    }
    expect(waits).toEqual([1 * MIN, 2 * MIN, 4 * MIN, 8 * MIN, MAX_COOLDOWN_MS, MAX_COOLDOWN_MS, MAX_COOLDOWN_MS]);
  });

  test('readers sharing one failed call count as ONE failure', async () => {
    let fail;
    const produce = jest.fn(() => new Promise((_, rej) => { fail = () => rej(http(429)); }));
    const all = Promise.allSettled([run('x', 'a', produce), run('x', 'a', produce), run('x', 'a', produce)]);
    fail();
    await all;
    expect(guard.status().x.failures).toBe(1);
  });

  test('a success closes the circuit and resets the count', async () => {
    await expect(run('x', 'a', jest.fn().mockRejectedValue(http(429)))).rejects.toThrow();
    clock += BASE_COOLDOWN_MS + 1;
    await run('x', 'a', jest.fn().mockResolvedValue('ok'));
    expect(guard.status().x).toMatchObject({ failures: 0, cooling: false });
  });

  test('timeouts and refused connections count as transient too', () => {
    expect(isTransient(Object.assign(new Error('x'), { code: 'ECONNABORTED' }))).toBe(true);
    expect(isTransient(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isTransient(new Error('timeout of 6000ms exceeded'))).toBe(true);
    expect(isTransient(http(429))).toBe(true);
    expect(isTransient(http(502))).toBe(true);
  });
});

describe('a PERMANENT failure (403, 404, 422, a config error) only quiets that one key', () => {
  test('the same key is not retried for five minutes; other keys and the server carry on', async () => {
    const bad = jest.fn().mockRejectedValue(http(403));
    await expect(run('reddit', 'a', bad)).rejects.toThrow(/403/);
    await expect(run('reddit', 'a', bad)).rejects.toThrow(/403/);
    expect(bad).toHaveBeenCalledTimes(1);

    const other = jest.fn().mockResolvedValue('fine');
    expect(await run('reddit', 'b', other)).toBe('fine');
    expect(guard.status().reddit?.cooling).toBeFalsy();

    clock += NEGATIVE_TTL_MS + 1;
    await expect(run('reddit', 'a', bad)).rejects.toThrow(/403/);
    expect(bad).toHaveBeenCalledTimes(2);
  });

  test('a config error is permanent, not a reason to leave the server alone', () => {
    expect(isTransient(new Error('SEARXNG_URL is not set'))).toBe(false);
    expect(isTransient(http(422))).toBe(false);
    expect(isTransient(http(404))).toBe(false);
  });
});

describe('the last good answer beats an error', () => {
  test('a failing server serves what it last said, up to six hours old', async () => {
    await run('mastodon', 'a', jest.fn().mockResolvedValue('yesterday-ish'));
    clock += 30 * MIN;
    const failing = jest.fn().mockRejectedValue(http(429));
    expect(await run('mastodon', 'a', failing)).toBe('yesterday-ish');
    // ...and while cooling, too, with no call at all
    expect(await run('mastodon', 'a', failing)).toBe('yesterday-ish');
    expect(failing).toHaveBeenCalledTimes(1);
  });

  test('past six hours the error is shown instead, so a day-old feed is never cached as today\'s', async () => {
    await run('mastodon', 'a', jest.fn().mockResolvedValue('old'));
    clock += 6 * 60 * MIN + 1;
    await expect(run('mastodon', 'a', jest.fn().mockRejectedValue(http(429)))).rejects.toThrow(/429/);
  });

  test('a permanent failure also falls back to the last good answer', async () => {
    await run('reddit', 'a', jest.fn().mockResolvedValue('good'));
    clock += 11 * MIN;
    expect(await run('reddit', 'a', jest.fn().mockRejectedValue(http(403)))).toBe('good');
  });
});

describe('housekeeping', () => {
  test('memory is capped', async () => {
    for (let i = 0; i < 900; i += 1) await run('x', `k${i}`, jest.fn().mockResolvedValue(i));
    expect(guard.size).toBeLessThanOrEqual(800);
  });

  test('ttlMs is required', async () => {
    await expect(guard.run('x', 'a', jest.fn(), {})).rejects.toThrow(/ttlMs/);
  });
});
