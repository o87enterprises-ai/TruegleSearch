jest.mock('axios');

// Request/response shapes follow each vendor's public docs. They are asserted
// against mocks here — NOT exercised with live keys from CI.
describe('freeSearchApis', () => {
  let fsa; let breakers; let budget; let axios;
  const KEYS = ['SERPER_API_KEY', 'TAVILY_API_KEY', 'EXA_API_KEY', 'MARGINALIA_API_KEY'];

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    axios = require('axios');   // the SAME instance the module under test gets after resetModules
    KEYS.forEach((k) => delete process.env[k]);
    delete process.env.FREE_SEARCH_DAILY_SERPER;
    fsa = require('../services/freeSearchApis');
    ({ breakers } = require('../utils/breaker'));
    budget = require('../services/PaidProviderBudget');
    breakers.reset();
    if (budget._reset) budget._reset();
  });

  it('is a no-op with no keys (nothing breaks without them)', async () => {
    expect(fsa.configured()).toEqual([]);
    expect(await fsa.topUp('anything', {}, { needed: 10 })).toEqual([]);
    expect(axios.post).not.toHaveBeenCalled();
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
});
