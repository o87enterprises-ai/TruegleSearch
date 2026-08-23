/**
 * GroqKeyPool — the taper. These lock in the two behaviours that matter for
 * staying under the free-tier limits: even spread across keys, and honouring
 * Groq's retry-after instead of hammering a key that just 429'd.
 */
jest.mock('../config/env', () => ({ ai: { groq: { keys: [] } } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { GroqKeyPool } = require('../services/GroqKeyPool');

const drain = (pool, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const lease = pool.acquire();
    out.push(lease ? lease.index : null);
  }
  return out;
};

describe('GroqKeyPool', () => {
  it('spreads sequential requests evenly instead of draining key 0', () => {
    const pool = new GroqKeyPool(['a', 'b', 'c', 'd']);
    const counts = [0, 0, 0, 0];
    drain(pool, 40).forEach(i => { counts[i] += 1; });
    expect(counts).toEqual([10, 10, 10, 10]);
  });

  it('starts each process on a random key so cold lambdas do not collide', () => {
    const starts = new Set();
    for (let i = 0; i < 60; i++) {
      starts.add(new GroqKeyPool(['a', 'b', 'c', 'd']).acquire().index);
    }
    expect(starts.size).toBeGreaterThan(1);
  });

  it('skips a rate-limited key until its retry-after elapses', () => {
    const pool = new GroqKeyPool(['a', 'b']);
    const first = pool.acquire();
    pool.cool(first.index, '30');

    expect(drain(pool, 4).every(i => i !== first.index)).toBe(true);
    expect(pool.stats()).toMatchObject({ total: 2, usable: 1, cooling: 1, disabled: 0 });

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    expect(drain(pool, 4)).toContain(first.index);
    Date.now.mockRestore();
  });

  it('clamps a missing or absurd retry-after into a sane window', () => {
    const pool = new GroqKeyPool(['a', 'b']);
    pool.cool(0, undefined);
    pool.cool(1, '999999');
    const now = Date.now();
    expect(pool.cooldownUntil[0] - now).toBeGreaterThan(50_000);
    expect(pool.cooldownUntil[0] - now).toBeLessThanOrEqual(60_000);
    expect(pool.cooldownUntil[1] - now).toBeLessThanOrEqual(60 * 60_000);
  });

  it('drops a rejected key permanently and reports the pool as unavailable when all are dead', () => {
    const pool = new GroqKeyPool(['a', 'b']);
    pool.disable(0, 'HTTP 401');
    expect(drain(pool, 4).every(i => i === 1)).toBe(true);
    expect(pool.isAvailable()).toBe(true);

    pool.disable(1, 'HTTP 401');
    expect(pool.isAvailable()).toBe(false);
    expect(pool.acquire()).toBeNull();
  });

  it('never hands back a key already tried on the same request', () => {
    const pool = new GroqKeyPool(['a', 'b', 'c']);
    const tried = new Set();
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const lease = pool.acquire(tried);
      if (!lease) break;
      tried.add(lease.index);
      seen.push(lease.index);
    }
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });

  it('is a no-op pool when no keys are configured', () => {
    const pool = new GroqKeyPool([]);
    expect(pool.size).toBe(0);
    expect(pool.isAvailable()).toBe(false);
    expect(pool.acquire()).toBeNull();
  });
});
