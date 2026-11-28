jest.mock('axios');

// Request/response shapes follow each vendor's public docs. They are asserted
// against mocks here — NOT exercised with live keys from CI.
describe('freeSearchApis', () => {
  let fsa; let breakers; let budget; let axios;
  const KEYS = ['SERPER_API_KEY', 'TAVILY_API_KEY', 'EXA_API_KEY', 'LINKUP_API_KEY', 'FIRECRAWL_API_KEY', 'MARGINALIA_API_KEY'];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    axios = require('axios');   // the SAME instance the module under test gets after resetModules
    axios.get.mockResolvedValue({ data: {} });   // Wikipedia (key-free) is always in the walk
    KEYS.forEach((k) => delete process.env[k]);
    delete process.env.FREE_SEARCH_DAILY_SERPER;
    delete process.env.FREE_SEARCH_DAILY_WIKIPEDIA;
    fsa = require('../services/freeSearchApis');
    ({ breakers } = require('../utils/breaker'));
    budget = require('../services/PaidProviderBudget');
    breakers.reset();
    if (budget._reset) budget._reset();
  });

  it('with no keys only the key-free Wikipedia is configured, and no keyed API is called', async () => {
    expect(fsa.configured()).toEqual(['wikipedia']);
    expect(await fsa.topUp('anything', {}, { needed: 10 })).toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('FREE_SEARCH_DAILY_WIKIPEDIA=0 makes it a true no-op without keys', async () => {
    process.env.FREE_SEARCH_DAILY_WIKIPEDIA = '0';
    jest.resetModules();
    const again = require('../services/freeSearchApis');
    expect(again.configured()).toEqual([]);
    expect(await again.topUp('anything', {}, { needed: 10 })).toEqual([]);
  });

  it('normalises Serper, Tavily and Exa into the shared result shape', async () => {
    process.env.SERPER_API_KEY = 's'; process.env.TAVILY_API_KEY = 't'; process.env.EXA_API_KEY = 'e';
    axios.post.mockImplementation(async (url) => {
      if (url.includes('serper')) return { data: { organic: [{ title: 'S', link: 'https://a.com/1', snippet: 'sn' }] } };
      if (url.includes('tavily')) return { data: { results: [{ title: 'T', url: 'https://b.com/1', content: 'c' }] } };
      return { data: { results: [{ title: 'E', url: 'https://c.com/1', text: 'x', publishedDate: '2026-01-01' }] } };
    });
    const rows = await fsa.topUp('q', {}, { needed: 10 });
    expect(rows.map((r) => r.source)).toEqual(['serper', 'tavily', 'exa']);
    expect(rows[0]).toMatchObject({ title: 'S', url: 'https://a.com/1', category: 'web', domain: 'a.com', verified: true });
    const [, body, cfg] = axios.post.mock.calls[0];
    expect(body.q).toBe('q');
    expect(cfg.headers['X-API-KEY']).toBe('s');
    expect(axios.post.mock.calls[1][2].headers.Authorization).toBe('Bearer t');
  });

  it('stops walking providers once the page is full, so free quota is not wasted', async () => {
    process.env.SERPER_API_KEY = 's'; process.env.TAVILY_API_KEY = 't';
    axios.post.mockResolvedValue({ data: { organic: [1, 2, 3].map((n) => ({ title: `r${n}`, link: `https://a.com/${n}`, snippet: '' })) } });
    const rows = await fsa.topUp('q', {}, { needed: 3 });
    expect(rows).toHaveLength(3);
    expect(axios.post).toHaveBeenCalledTimes(1);   // Tavily never called
  });

  it('does not count URLs the page already has', async () => {
    process.env.SERPER_API_KEY = 's';
    axios.post.mockResolvedValue({ data: { organic: [{ title: 'dup', link: 'https://a.com/1', snippet: '' }] } });
    const rows = await fsa.topUp('q', {}, { needed: 5, have: new Set(['https://a.com/1']) });
    expect(rows).toEqual([]);
  });

  it('parks a provider after a quota answer and falls through to the next', async () => {
    process.env.SERPER_API_KEY = 's'; process.env.TAVILY_API_KEY = 't';
    axios.post.mockImplementation(async (url) => {
      if (url.includes('serper')) { const e = new Error('quota'); e.response = { status: 429 }; throw e; }
      return { data: { results: [{ title: 'T', url: 'https://b.com/1', content: '' }] } };
    });
    const first = await fsa.topUp('q1', {}, { needed: 5 });
    expect(first.map((r) => r.source)).toEqual(['tavily']);
    expect(breakers.isOpen('serper')).toBe(true);
    axios.post.mockClear();
    await fsa.topUp('q2', {}, { needed: 5 });
    expect(axios.post.mock.calls.every(([u]) => !u.includes('serper'))).toBe(true);   // not called while parked
  });

  it('respects the per-provider daily cap', async () => {
    process.env.SERPER_API_KEY = 's';
    process.env.FREE_SEARCH_DAILY_SERPER = '1';
    axios.post.mockResolvedValue({ data: { organic: [{ title: 'x', link: 'https://a.com/x', snippet: '' }] } });
    await fsa.topUp('one', {}, { needed: 5 });
    axios.post.mockClear();
    expect(await fsa.topUp('two', {}, { needed: 5 })).toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('serves a repeated query from cache without spending quota', async () => {
    process.env.SERPER_API_KEY = 's';
    axios.post.mockResolvedValue({ data: { organic: [{ title: 'x', link: 'https://a.com/x', snippet: '' }] } });
    await fsa.topUp('same', {}, { needed: 5 });
    await fsa.topUp('same', {}, { needed: 5 });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('drops non-http(s) URLs', async () => {
    process.env.SERPER_API_KEY = 's';
    axios.post.mockResolvedValue({ data: { organic: [{ title: 'bad', link: 'javascript:alert(1)', snippet: '' }, { title: 'ok', link: 'https://a.com/ok', snippet: '' }] } });
    const rows = await fsa.topUp('q', {}, { needed: 5 });
    expect(rows.map((r) => r.title)).toEqual(['ok']);
  });

  describe('Linkup, Firecrawl and Wikipedia', () => {
    const wikiPage = { pages: [{ key: 'Kakapo_bird', title: 'Kakapo bird', excerpt: 'a <span>parrot</span>', description: 'NZ parrot' }] };

    it('walks the keyed providers first and Wikipedia last', () => {
      expect(fsa.PROVIDERS.map((p) => p.id)).toEqual(['serper', 'tavily', 'exa', 'linkup', 'firecrawl', 'marginalia', 'wikipedia']);
    });

    it('normalises Linkup and Firecrawl (v1 array and v2 {web}) answers', async () => {
      process.env.LINKUP_API_KEY = 'l'; process.env.FIRECRAWL_API_KEY = 'f';
      let v2 = false;
      axios.post.mockImplementation(async (url) => {
        if (url.includes('linkup')) return { data: { results: [{ type: 'text', name: 'L', url: 'https://l.com/1', content: 'lc' }] } };
        return { data: { data: v2 ? { web: [{ title: 'F2', url: 'https://f.com/2', description: 'd' }] } : [{ title: 'F1', url: 'https://f.com/1', description: 'd' }] } };
      });
      const rows = await fsa.topUp('q1', {}, { needed: 10 });
      expect(rows.map((r) => `${r.source}:${r.title}`)).toEqual(['linkup:L', 'firecrawl:F1']);
      v2 = true;
      const rows2 = await fsa.topUp('q2', {}, { needed: 10 });
      expect(rows2.map((r) => r.title)).toContain('F2');
      const linkup = axios.post.mock.calls.find(([u]) => u.includes('linkup'));
      expect(linkup[1]).toMatchObject({ q: 'q1', outputType: 'searchResults' });
      expect(linkup[2].headers.Authorization).toBe('Bearer l');
    });

    it('reads Wikipedia REST results with no key, stripping the markup', async () => {
      axios.get.mockResolvedValue({ data: wikiPage });
      const [r] = await fsa.topUp('kakapo', {}, { needed: 10 });
      expect(r).toMatchObject({ source: 'wikipedia', domain: 'en.wikipedia.org', url: 'https://en.wikipedia.org/wiki/Kakapo_bird', category: 'web' });
      expect(r.snippet).toBe('NZ parrot — a parrot');
      expect(axios.get.mock.calls[0][0]).toContain('rest.php/v1/search/page');
    });

    it('a Wikipedia 429 only pauses it for minutes, not hours', async () => {
      axios.get.mockRejectedValue(Object.assign(new Error('429'), { response: { status: 429 } }));
      await fsa.topUp('x', {}, { needed: 10 });
      const left = breakers.status().wikipedia.reopensInMs;
      expect(left).toBeLessThanOrEqual(10 * 60 * 1000);
      expect(left).toBeGreaterThan(0);
    });

    it('asks Exa for moderation and Serper for safe results unless safe search is off', async () => {
      process.env.SERPER_API_KEY = 's'; process.env.EXA_API_KEY = 'e';
      axios.post.mockResolvedValue({ data: {} });
      await fsa.topUp('a', { safeSearch: 'strict' }, { needed: 10 });
      await fsa.topUp('b', { safeSearch: 'off' }, { needed: 10 });
      const bodyFor = (id, q) => axios.post.mock.calls.find(([u, b]) => u.includes(id) && (b.q === q || b.query === q))[1];
      expect(bodyFor('exa', 'a').moderation).toBe(true);
      expect(bodyFor('exa', 'b').moderation).toBe(false);
      expect(bodyFor('serper', 'a').safe).toBe('active');
      expect(bodyFor('serper', 'b').safe).toBeUndefined();
    });
  });
});
