const { createRing, PROVIDERS } = require('../services/FreeSearchRing');
const { breakers } = require('../utils/breaker');
const budget = require('../services/PaidProviderBudget');

const KEYS = ['TAVILY_API_KEY', 'FIRECRAWL_API_KEY', 'LINKUP_API_KEY', 'EXA_API_KEY', 'SERPER_API_KEY', 'MARGINALIA_API_KEY'];
const clear = () => { KEYS.forEach((k) => delete process.env[k]); Object.keys(process.env).filter((k) => /^RING_/.test(k)).forEach((k) => delete process.env[k]); breakers.reset(); budget._reset(); };
beforeEach(clear);
afterAll(clear);

// A fake http: answers by URL. `plan` maps a host fragment to data or an error status.
const fake = (plan) => {
  const calls = [];
  const answer = async (url) => {
    calls.push(url);
    const hit = Object.entries(plan).find(([frag]) => url.includes(frag));
    if (!hit) throw Object.assign(new Error('no route'), { response: { status: 500 } });
    const [, v] = hit;
    if (typeof v === 'number') throw Object.assign(new Error(`HTTP ${v}`), { response: { status: v } });
    return { data: v };
  };
  return { http: { get: answer, post: answer }, calls };
};
const tavily = (n, tag = 't') => ({ results: Array.from({ length: n }, (_, i) => ({ title: `${tag} ${i}`, url: `https://${tag}${i}.example/`, content: 'c' })) });
const wiki = { pages: [{ key: 'Kakapo_bird', title: 'Kakapo bird', excerpt: 'a <span>parrot</span>' }] };
const margin = { results: [{ url: 'https://small.example/kakapo', title: 'Kakapo notes', description: 'hand written' }] };

describe('switching on', () => {
  it('uses only the key-free providers when no key is set', async () => {
    const { http, calls } = fake({ 'wikipedia.org': wiki, 'marginalia-search.com': margin });
    const r = await createRing({ http }).search('kakapo');
    expect(r.used.sort()).toEqual(['marginalia', 'wikipedia']);
    expect(calls.some((c) => /tavily|exa|serper|linkup|firecrawl/.test(c))).toBe(false);
    expect(r.results.map((x) => x.domain).sort()).toEqual(['en.wikipedia.org', 'small.example']);
  });
  it('a key turns its provider on', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const { http } = fake({ 'tavily.com': tavily(5), 'wikipedia.org': wiki, 'marginalia-search.com': margin });
    expect((await createRing({ http }).search('kakapo')).used).toContain('tavily');
  });
  it('RING_<NAME>_DAILY=0 turns it off even with a key', async () => {
    process.env.TAVILY_API_KEY = 'k'; process.env.RING_TAVILY_DAILY = '0';
    const { http, calls } = fake({ 'wikipedia.org': wiki, 'marginalia-search.com': margin });
    await createRing({ http }).search('kakapo');
    expect(calls.some((c) => c.includes('tavily'))).toBe(false);
  });
});

describe('result shape', () => {
  it('matches the shape SearXNG results have, stripped of markup', async () => {
    const { http } = fake({ 'wikipedia.org': wiki, 'marginalia-search.com': { results: [] } });
    const [x] = (await createRing({ http }).search('kakapo')).results;
    expect(x).toMatchObject({ category: 'web', source: 'wikipedia', engine: 'wikipedia', domain: 'en.wikipedia.org', verified: true });
    expect(x.url).toBe('https://en.wikipedia.org/wiki/Kakapo_bird');
    expect(x.snippet).toBe('a parrot');
    expect(x.sourceName).toBe('Wikipedia · via Truegle');
  });
  it('drops rows without a real http(s) url or a title', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const { http } = fake({ 'tavily.com': { results: [{ title: 'ok', url: 'https://a.example/' }, { title: 'js', url: 'javascript:alert(1)' }, { url: 'https://b.example/' }] }, 'wikipedia.org': { pages: [] }, 'marginalia-search.com': { results: [] } });
    expect((await createRing({ http }).search('x')).results.map((r) => r.url)).toEqual(['https://a.example/']);
  });
  it('reads Firecrawl v1 (array) and v2 ({web}) answers', async () => {
    process.env.FIRECRAWL_API_KEY = 'k';
    const v1 = fake({ 'firecrawl.dev': { data: [{ title: 'a', url: 'https://a.example/' }] }, 'wikipedia.org': { pages: [] }, 'marginalia-search.com': { results: [] } });
    const v2 = fake({ 'firecrawl.dev': { data: { web: [{ title: 'b', url: 'https://b.example/' }] } }, 'wikipedia.org': { pages: [] }, 'marginalia-search.com': { results: [] } });
    expect((await createRing({ http: v1.http }).search('q1')).results[0].url).toBe('https://a.example/');
    expect((await createRing({ http: v2.http }).search('q2')).results[0].url).toBe('https://b.example/');
  });
});

describe('rotation and failover', () => {
  beforeEach(() => { process.env.TAVILY_API_KEY = 'k'; process.env.EXA_API_KEY = 'k'; });
  const plan = { 'tavily.com': tavily(5, 't'), 'exa.ai': { results: Array.from({ length: 5 }, (_, i) => ({ title: `e${i}`, url: `https://e${i}.example/` })) }, 'wikipedia.org': { pages: [] }, 'marginalia-search.com': { results: [] } };
  it('rotates which keyed provider goes first so none is drained first', async () => {
    const { http } = fake(plan);
    const ring = createRing({ http });
    const a = (await ring.search('one')).used.find((u) => ['tavily', 'exa'].includes(u));
    const b = (await ring.search('two')).used.find((u) => ['tavily', 'exa'].includes(u));
    expect(a).not.toBe(b);
  });
  it('a provider that answers 429 hands the request to the next and is left alone after', async () => {
    const { http, calls } = fake({ ...plan, 'tavily.com': 429 });
    const ring = createRing({ http });
    const r = await ring.search('one');
    expect(r.used).toContain('exa');
    expect(r.skipped.tavily).toMatch(/failed/);
    expect(breakers.isOpen('ring:tavily')).toBe(true);
    const before = calls.filter((c) => c.includes('tavily')).length;
    await ring.search('two'); await ring.search('three');
    expect(calls.filter((c) => c.includes('tavily')).length).toBe(before);   // not asked again while cooling down
  });
  it('a rejected key (403) also stays off for hours', async () => {
    delete process.env.TAVILY_API_KEY;               // Exa is the only keyed provider, so it is asked first
    const { http } = fake({ ...plan, 'exa.ai': 403 });
    await createRing({ http }).search('one');
    expect(breakers.status()['ring:exa'].reopensInMs).toBeGreaterThan(60 * 60 * 1000);
  });
  it('stops at the daily budget', async () => {
    process.env.RING_TAVILY_DAILY = '1'; process.env.RING_EXA_DAILY = '1';
    const { http } = fake(plan);
    const ring = createRing({ http });
    await ring.search('a'); await ring.search('b');
    const third = await ring.search('c');
    expect(third.used.filter((u) => ['tavily', 'exa'].includes(u))).toEqual([]);
    expect(third.skipped.tavily).toMatch(/budget/);
  });
  it('a thin keyed answer is topped up from the next provider', async () => {
    const { http } = fake({ ...plan, 'tavily.com': tavily(1, 't'), 'exa.ai': tavily(1, 'e') });
    const r = await createRing({ http }).search('niche');
    expect(r.used).toEqual(expect.arrayContaining(['tavily', 'exa']));
  });
});

describe('shared-key limits', () => {
  it('a 429 on the shared Marginalia key pauses it for minutes, not a day', async () => {
    const { http } = fake({ 'wikipedia.org': wiki, 'marginalia-search.com': 429 });
    await createRing({ http }).search('x');
    const left = breakers.status()['ring:marginalia'].reopensInMs;
    expect(left).toBeLessThanOrEqual(2 * 60 * 1000);
    expect(left).toBeGreaterThan(0);
  });
  it('sends Marginalia its key as a header, defaulting to the shared public key', async () => {
    let sent;
    const http = { get: async (u, o) => { if (u.includes('marginalia')) sent = o.headers['API-Key']; return { data: {} }; }, post: async () => ({ data: {} }) };
    await createRing({ http }).search('x');
    expect(sent).toBe('public');
  });
});

describe('cache and safety', () => {
  it('answers a repeat from memory without spending quota', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const { http, calls } = fake({ 'tavily.com': tavily(5), 'wikipedia.org': wiki, 'marginalia-search.com': margin });
    const ring = createRing({ http });
    await ring.search('same'); const n = calls.length;
    const again = await ring.search('same');
    expect(calls.length).toBe(n);
    expect(again.cached).toBe(true);
  });
  it('de-duplicates the same page returned by two providers', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const { http } = fake({ 'tavily.com': { results: [{ title: 'K', url: 'https://en.wikipedia.org/wiki/Kakapo_bird/' }] }, 'wikipedia.org': wiki, 'marginalia-search.com': { results: [] } });
    expect((await createRing({ http }).search('kakapo')).results).toHaveLength(1);
  });
  it('asks for moderation / safe results unless safe search is off', async () => {
    process.env.EXA_API_KEY = 'k'; process.env.SERPER_API_KEY = 'k';
    const seen = [];
    const http = { get: async () => ({ data: {} }), post: async (u, body) => { seen.push([u, body]); return { data: {} }; } };
    await createRing({ http }).search('a', { safeSearch: 'strict' });
    await createRing({ http }).search('b', { safeSearch: 'off' });
    const exa = seen.filter(([u]) => u.includes('exa.ai')).map(([, b]) => b.moderation);
    expect(exa).toEqual(expect.arrayContaining([true, false]));
    const serper = seen.filter(([u]) => u.includes('serper')).map(([, b]) => b.safe);
    expect(serper).toContain('active');
  });
  it('never throws: every provider failing returns an empty, explained result', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const { http } = fake({});
    const r = await createRing({ http }).search('x');
    expect(r.results).toEqual([]);
    expect(Object.keys(r.skipped).length).toBeGreaterThan(0);
  });
  it('lists what is on and what each has spent', async () => {
    process.env.TAVILY_API_KEY = 'k';
    const s = createRing({ http: fake({}).http }).status();
    expect(s.find((p) => p.id === 'tavily')).toMatchObject({ on: true, keyed: true });
    expect(s.find((p) => p.id === 'exa').on).toBe(false);
    expect(s.find((p) => p.id === 'wikipedia').on).toBe(true);
    expect(PROVIDERS.map((p) => p.id)).toHaveLength(7);
  });
});
