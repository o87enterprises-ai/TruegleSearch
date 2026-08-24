/**
 * GroqKeyPool — the taper. Groq meters rate limits per ORGANIZATION, so these
 * lock in the behaviours that actually keep us under the free-tier ceiling:
 * spread across orgs, park a whole org on 429, and drop only the one key on 401.
 */
jest.mock('../config/env', () => ({ ai: { groq: { orgs: [] } } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { GroqKeyPool } = require('../services/GroqKeyPool');

/** 4 orgs × 3 keys, the real shape of the account. */
const fourOrgs = () => new GroqKeyPool([
  { label: 'org1', keys: ['a1', 'a2', 'a3'] },
  { label: 'org2', keys: ['b1', 'b2', 'b3'] },
  { label: 'org3', keys: ['c1', 'c2', 'c3'] },
  { label: 'org4', keys: ['d1', 'd2', 'd3'] },
]);

const drain = (pool, n, tried = new Set()) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const lease = pool.acquire(tried);
    out.push(lease);
  }
  return out;
};

describe('GroqKeyPool', () => {
  it('counts orgs and keys separately — 4 orgs is the quota, 12 keys is not', () => {
    const pool = fourOrgs();
    expect(pool.orgCount).toBe(4);
    expect(pool.size).toBe(12);
    expect(pool.stats()).toMatchObject({ orgs: 4, keys: 12, usableOrgs: 4 });
  });

  it('spreads sequential requests evenly across orgs, not just keys', () => {
    const pool = fourOrgs();
    const perOrg = [0, 0, 0, 0];
    drain(pool, 40).forEach(l => { perOrg[l.org] += 1; });
    expect(perOrg).toEqual([10, 10, 10, 10]);
  });

  it('rotates within an org too, so one key is not the only one exercised', () => {
    const pool = fourOrgs();
    const org0Keys = new Set(drain(pool, 12).filter(l => l.org === 0).map(l => l.key));
    expect(org0Keys).toEqual(new Set(['a1', 'a2', 'a3']));
  });

  it('starts each process on a random org so cold lambdas do not collide', () => {
    const starts = new Set();
    for (let i = 0; i < 60; i++) starts.add(fourOrgs().acquire().org);
    expect(starts.size).toBeGreaterThan(1);
  });

  it('parks the WHOLE org on a 429 — sibling keys share the exhausted bucket', () => {
    const pool = fourOrgs();
    pool.cool(0, '30');

    expect(drain(pool, 12).every(l => l.org !== 0)).toBe(true);
    expect(pool.stats()).toMatchObject({ usableOrgs: 3, coolingOrgs: 1 });

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    expect(drain(pool, 8).some(l => l.org === 0)).toBe(true);
    Date.now.mockRestore();
  });

  it('drops only the rejected key on a 401, leaving its org-mates in play', () => {
    const pool = fourOrgs();
    pool.disable(0, 0, 'HTTP 401');

    const org0 = drain(pool, 12).filter(l => l.org === 0);
    expect(org0.length).toBeGreaterThan(0);
    expect(org0.every(l => l.key !== 'a1')).toBe(true);
    expect(pool.stats()).toMatchObject({ orgs: 4, usableOrgs: 4, disabledKeys: 1 });
  });

  it('takes an org out of rotation once every one of its keys is disabled', () => {
    const pool = fourOrgs();
    [0, 1, 2].forEach(k => pool.disable(0, k, 'HTTP 401'));
    expect(drain(pool, 12).every(l => l.org !== 0)).toBe(true);
    expect(pool.stats()).toMatchObject({ usableOrgs: 3, disabledKeys: 3 });
    expect(pool.isAvailable()).toBe(true);
  });

  it('clamps a missing or absurd retry-after into a sane window', () => {
    const pool = fourOrgs();
    pool.cool(0, undefined);
    pool.cool(1, '999999');
    const now = Date.now();
    expect(pool.orgs[0].cooldownUntil - now).toBeGreaterThan(50_000);
    expect(pool.orgs[0].cooldownUntil - now).toBeLessThanOrEqual(60_000);
    expect(pool.orgs[1].cooldownUntil - now).toBeLessThanOrEqual(60 * 60_000);
  });

  it('never hands back an org already rate-limited on the same request', () => {
    const pool = fourOrgs();
    const tried = new Set();
    const seen = [];
    for (let i = 0; i < 6; i++) {
      const lease = pool.acquire(tried);
      if (!lease) break;
      tried.add(lease.org);
      seen.push(lease.org);
    }
    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });

  it('reports unavailable only when every key of every org is dead', () => {
    const pool = new GroqKeyPool([{ label: 'org1', keys: ['a1', 'a2'] }]);
    pool.disable(0, 0, 'HTTP 401');
    expect(pool.isAvailable()).toBe(true);
    pool.disable(0, 1, 'HTTP 401');
    expect(pool.isAvailable()).toBe(false);
    expect(pool.acquire()).toBeNull();
  });

  it('is a no-op pool when nothing is configured, and ignores empty orgs', () => {
    const pool = new GroqKeyPool([{ label: 'empty', keys: [] }]);
    expect(pool.orgCount).toBe(0);
    expect(pool.size).toBe(0);
    expect(pool.isAvailable()).toBe(false);
    expect(pool.acquire()).toBeNull();
    expect(new GroqKeyPool().acquire()).toBeNull();
  });
});
