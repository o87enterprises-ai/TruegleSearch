/**
 * FREE SEARCH RING — every free search tier we can get, spread so no one runs dry.
 *
 * WHY (owner, 2026-11-11): the paid-looking providers are out of quota — one week of
 * logs showed ~28,000 Brave 429s, ~29,000 Google CSE 403s, ~29,000 YouTube failures
 * (see utils/breaker.js) — and SearXNG alone still falls short on niche queries,
 * because the engines behind it rate-limit it. Budget is $0 (docs/AD-POLICY.md, the
 * financial skill), so the answer is MORE free sources, used carefully, not a paid one.
 *
 * HOW. Each provider below switches itself on when its key is in the environment
 * (no key, no call — nothing is configured here that is not in .env). A request:
 *
 *   1. the KEY-FREE public APIs run alongside (Marginalia, Wikipedia) — cheap, and
 *      Marginalia is built for exactly the niche small-site queries that fall through;
 *   2. the KEYED providers are tried in a ROTATING order (so load is spread and no one
 *      free tier is drained first), one after another, until one returns enough.
 *      A provider that is out of daily budget, cooling down (breaker), or that fails is
 *      skipped and the next one takes the request.
 *
 * QUOTA. Every provider has a DAILY CALL BUDGET (services/PaidProviderBudget.js — the
 * same brake the SerpApi fallback uses) set below its free allowance divided by 30, and
 * a breaker that opens on a quota answer (429/402/432/433 until the next UTC midnight,
 * 401/403 for hours: a bad key). Both are process-local, so on serverless this is a
 * brake, not an accountant. Override with RING_<NAME>_DAILY; 0 turns a provider off.
 *
 * PRIVACY. Server to server: the vendor gets the query text and our server's address —
 * never a visitor's IP, account or cookie. Nothing is stored; the cache is in memory
 * only and short. (Same footing as the Brave/Google calls it stands in for.)
 *
 * NOT INCLUDED, ON PURPOSE: the anonymous "keyless" vendor endpoints (Firecrawl keyless,
 * Parallel's anonymous MCP, Exa/Keenable free rings). Their terms for a production
 * backend are unclear and their per-IP caps would be shared with other Vercel tenants
 * (owner's call, 2026-11-11).
 *
 * Pure of the rest of the app but for three small utilities, so
 * __tests__/freeSearchRing.test.js runs it with a fake `http`.
 */
const axios = require('axios');
const { breakers } = require('../utils/breaker');
const budget = require('./PaidProviderBudget');
const upstream = require('../utils/upstreamStats');
const { createTtlCache } = require('../utils/ttlCache');

const UA = 'Truegle/1.0 (+https://truegle.info; search aggregator)';
const TIMEOUT_MS = 4500;
const MIN_USEFUL = 3;           // a keyed provider returning fewer than this hands on to the next
const MAX_KEYED_ATTEMPTS = 3;
const CACHE_MS = 30 * 60 * 1000;

const clean = (s, n = 400) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const env = (k) => (process.env[k] || '').trim();
const dailyOf = (name, dflt) => {
  const v = process.env[`RING_${name.toUpperCase()}_DAILY`];
  return v === undefined || v === '' ? dflt : Number(v);
};

/** One normalised web result, in the same shape SearchService.formatSearXNGResults makes. */
function row(provider, label, { title, url, snippet, date }) {
  if (!url || !/^https?:\/\//i.test(url) || !title) return null;
  return {
    title: clean(title, 200),
    url,
    snippet: clean(snippet),
    source: provider,
    sourceName: `${label} · via Truegle`,
    engine: provider,
    engines: [provider],
    date: date || null,
    image: null,
    favicon: null,
    domain: domainOf(url),
    category: 'web',
    verified: true,
  };
}

/**
 * The providers. `daily` is the default call budget per UTC day — each is the free
 * allowance (checked 2026-11-11 against the vendors' own roundups, which differ; verify on
 * the pricing page when you sign up) spread over 30 days and rounded DOWN.
 */
const PROVIDERS = [
  {
    id: 'tavily', label: 'Tavily', keyed: true, keyEnv: 'TAVILY_API_KEY', daily: 30, // 1,000 credits/mo, no card
    async call(http, q, { perPage }) {
      const r = await http.post('https://api.tavily.com/search',
        { query: q, max_results: Math.min(perPage, 20), search_depth: 'basic' },
        { headers: { Authorization: `Bearer ${env('TAVILY_API_KEY')}` }, timeout: TIMEOUT_MS });
      return (r.data?.results || []).map((x) => row('tavily', 'Tavily', { title: x.title, url: x.url, snippet: x.content, date: x.published_date }));
    },
  },
  {
    id: 'firecrawl', label: 'Firecrawl', keyed: true, keyEnv: 'FIRECRAWL_API_KEY', daily: 15, // 1,000 credits/mo, search = 2 per 10
    async call(http, q, { perPage }) {
      const r = await http.post('https://api.firecrawl.dev/v2/search',
        { query: q, limit: Math.min(perPage, 10) },
        { headers: { Authorization: `Bearer ${env('FIRECRAWL_API_KEY')}` }, timeout: TIMEOUT_MS });
      const d = r.data?.data;
      const list = Array.isArray(d) ? d : (d?.web || []);          // v1 gave an array, v2 gives { web: [...] }
      return list.map((x) => row('firecrawl', 'Firecrawl', { title: x.title, url: x.url, snippet: x.description }));
    },
  },
  {
    id: 'linkup', label: 'Linkup', keyed: true, keyEnv: 'LINKUP_API_KEY', daily: 100, // ~EUR 5/mo credit, no card
    async call(http, q) {
      const r = await http.post('https://api.linkup.so/v1/search',
        { q, depth: 'standard', outputType: 'searchResults' },
        { headers: { Authorization: `Bearer ${env('LINKUP_API_KEY')}` }, timeout: TIMEOUT_MS });
      return (r.data?.results || []).map((x) => row('linkup', 'Linkup', { title: x.name || x.title, url: x.url, snippet: x.content }));
    },
  },
  {
    id: 'exa', label: 'Exa', keyed: true, keyEnv: 'EXA_API_KEY', daily: 25, // monthly credit, no card; page text costs extra, so a short one
    async call(http, q, { perPage, safe }) {
      const r = await http.post('https://api.exa.ai/search',
        { query: q, numResults: Math.min(perPage, 10), moderation: safe, contents: { text: { maxCharacters: 280 } } },
        { headers: { 'x-api-key': env('EXA_API_KEY') }, timeout: TIMEOUT_MS });
      return (r.data?.results || []).map((x) => row('exa', 'Exa', { title: x.title, url: x.url, snippet: x.text || x.summary, date: x.publishedDate }));
    },
  },
  {
    id: 'serper', label: 'Serper', keyed: true, keyEnv: 'SERPER_API_KEY', daily: 40, // 2,500 free queries, ONE-TIME: ~60 days at this rate
    async call(http, q, { perPage, safe }) {
      const r = await http.post('https://google.serper.dev/search',
        { q, num: Math.min(perPage, 20), ...(safe ? { safe: 'active' } : {}) },
        { headers: { 'X-API-KEY': env('SERPER_API_KEY') }, timeout: TIMEOUT_MS });
      return (r.data?.organic || []).map((x) => row('serper', 'Serper', { title: x.title, url: x.link, snippet: x.snippet, date: x.date }));
    },
  },
  {
    // KEY-FREE, best effort. Marginalia moved (2026-11): the old api.marginalia.nu host no longer
    // answers; the key is now a header. The shared "public" key is rate limited PER MINUTE for
    // everybody ("QPM Limit Exceeded"), so a 429 here only pauses it briefly; a free personal key
    // (MARGINALIA_API_KEY, emailed on request) gives it a quota of its own. Built for small,
    // independent sites — the niche queries other engines miss.
    id: 'marginalia', label: 'Marginalia', keyed: false, daily: 300, coolOn429Ms: 2 * 60 * 1000,
    async call(http, q, { perPage }) {
      const r = await http.get('https://api2.marginalia-search.com/search', {
        params: { query: q, count: Math.min(perPage, 20) },
        headers: { 'API-Key': env('MARGINALIA_API_KEY') || 'public', 'User-Agent': UA },
        timeout: TIMEOUT_MS,
      });
      return (r.data?.results || []).map((x) => row('marginalia', 'Marginalia', { title: x.title, url: x.url, snippet: x.description }));
    },
  },
  {
    // KEY-FREE, and generous. Uses the REST search (the older action API rate-limits shared
    // server addresses hard; verified 2026-11-11). Encyclopedic: lifts the entity pages niche queries name.
    id: 'wikipedia', label: 'Wikipedia', keyed: false, daily: 500, coolOn429Ms: 10 * 60 * 1000,
    async call(http, q, { perPage }) {
      const r = await http.get('https://en.wikipedia.org/w/rest.php/v1/search/page', {
        params: { q, limit: Math.min(perPage, 10) },
        headers: { 'User-Agent': UA }, timeout: TIMEOUT_MS,
      });
      return (r.data?.pages || []).map((x) => row('wikipedia', 'Wikipedia', {
        title: x.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(x.key || x.title).replace(/ /g, '_'))}`,
        snippet: [x.description, x.excerpt].filter(Boolean).join(' — '),
      }));
    },
  },
];

/** What the vendor's answer means for the breaker: ms to stay away, or 0 for "just a failure". */
function coolOffFor(err, p) {
  const s = err?.response?.status;
  if (s === 429 && p?.coolOn429Ms) return p.coolOn429Ms;      // a shared key's per-minute limit: a short pause
  if (s === 429 || s === 402 || s === 432 || s === 433) {
    // Quota: stay off until the next UTC midnight (cap 24 h, floor 15 min); a bare per-second limit is shorter.
    const msToMidnight = 24 * 3600 * 1000 - (Date.now() % (24 * 3600 * 1000));
    return Math.min(24 * 3600 * 1000, Math.max(15 * 60 * 1000, msToMidnight));
  }
  if (s === 401 || s === 403) return 6 * 3600 * 1000;     // a rejected key will not fix itself in minutes
  return 0;
}
const outcomeFor = (err) => {
  const s = err?.response?.status;
  if (s === 429 || s === 402 || s === 432 || s === 433) return '429';
  if (s === 401 || s === 403) return '403';
  if (/timeout|ECONNABORTED|ETIMEDOUT/i.test(`${err?.code} ${err?.message}`)) return 'timeout';
  return 'error';
};

function createRing({ http = axios, providers = PROVIDERS, now = () => Date.now() } = {}) {
  let turn = 0;                                  // the rotation: each search starts one provider further on
  const cache = createTtlCache({ ttlMs: CACHE_MS, max: 200, now });

  const configured = (p) => !p.keyed || !!env(p.keyEnv);
  const enabled = () => providers.filter((p) => configured(p) && dailyOf(p.id, p.daily) > 0);

  /** Ask one provider. Returns [] on any failure; counts, budgets and breaks as it goes. */
  async function ask(p, q, opts) {
    if (breakers.isOpen(`ring:${p.id}`)) { upstream.record(p.id, 'skipped'); return { rows: [], skipped: 'cooling down' }; }
    const verdict = budget.check(p.id, dailyOf(p.id, p.daily));
    if (!verdict.ok) return { rows: [], skipped: verdict.reason };
    budget.spend(p.id);                           // on the way OUT: a failed call still counts as spent
    try {
      const rows = (await p.call(http, q, opts)).filter(Boolean);
      breakers.ok(`ring:${p.id}`);
      upstream.record(p.id, 'ok');
      return { rows };
    } catch (err) {
      upstream.record(p.id, outcomeFor(err));
      const ms = coolOffFor(err, p);
      if (ms) breakers.trip(`ring:${p.id}`, ms, `HTTP ${err?.response?.status}`);
      return { rows: [], failed: err?.response?.status || err?.code || err?.message };
    }
  }

  /**
   * @param {string} query
   * @param {{ perPage?: number, safeSearch?: string }} [filters]
   * @returns {Promise<{ results: object[], used: string[], skipped: object }>}
   */
  async function search(query, filters = {}) {
    const q = String(query || '').trim();
    if (!q) return { results: [], used: [], skipped: {} };
    const opts = { perPage: filters.perPage || 10, safe: filters.safeSearch !== 'off' };
    const key = `${q.toLowerCase()}|${opts.perPage}|${opts.safe}`;
    const hit = cache.get(key);
    if (hit !== undefined) return { ...hit, cached: true };

    const live = enabled();
    const free = live.filter((p) => !p.keyed);
    const keyed = live.filter((p) => p.keyed);
    const start = keyed.length ? (turn++ % keyed.length) : 0;
    const order = keyed.map((_, i) => keyed[(start + i) % keyed.length]);

    const used = []; const skipped = {};
    const chain = (async () => {                  // keyed providers, one at a time, until one gives enough
      const got = [];
      let attempts = 0;
      for (const p of order) {
        if (attempts >= MAX_KEYED_ATTEMPTS) break;
        const r = await ask(p, q, opts);
        if (r.skipped) { skipped[p.id] = r.skipped; continue; }
        attempts += 1;
        if (r.failed) { skipped[p.id] = `failed (${r.failed})`; continue; }
        used.push(p.id);
        got.push(...r.rows);
        if (r.rows.length >= MIN_USEFUL) break;
      }
      return got;
    })();
    const side = free.map(async (p) => {
      const r = await ask(p, q, opts);
      if (r.skipped) skipped[p.id] = r.skipped; else if (r.failed) skipped[p.id] = `failed (${r.failed})`; else used.push(p.id);
      return r.rows;
    });

    const lists = await Promise.all([chain, ...side]);
    const seen = new Set();
    const results = lists.flat().filter((r) => {
      const k = r.url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const out = { results, used, skipped };
    cache.set(key, out);
    return out;
  }

  /** For /health and the log: what is switched on and what each has left today. */
  function status() {
    const spent = budget.report();
    return providers.map((p) => ({
      id: p.id,
      on: configured(p) && dailyOf(p.id, p.daily) > 0,
      keyed: p.keyed,
      dailyBudget: dailyOf(p.id, p.daily),
      usedToday: spent[p.id] || 0,
      coolingDown: breakers.isOpen(`ring:${p.id}`),
    }));
  }

  return { search, status, enabled: () => enabled().length > 0 };
}

const ring = createRing();

module.exports = { createRing, ring, PROVIDERS };
