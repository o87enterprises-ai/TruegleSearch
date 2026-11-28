/**
 * Free-tier web-search APIs: Serper, Tavily, Exa, Linkup, Firecrawl, Marginalia, Wikipedia.
 *
 * WHY THIS EXISTS. Render runs with NO paid/keyed web provider (Brave, Bing,
 * Google, SerpApi are deliberately unset), so SearXNG is the only web source.
 * When SearXNG's datacenter IP is CAPTCHA'd it can come back with a single tiny
 * engine (mwmbl) and the page is junk. These are extra, keyed, FREE-TIER
 * sources that top a thin page up.
 *
 * HOW IT SPENDS. Free quotas are small and monthly (Tavily 1,000/mo, Exa ~$10
 * credit/mo, Serper 2,500 one-time), so this is NOT a fan-out. `topUp` walks the
 * providers in order and stops as soon as the page has enough results. Every
 * provider also has:
 *   - a per-process DAILY cap (PaidProviderBudget) so a busy day cannot drain a
 *     month — override with FREE_SEARCH_DAILY_<NAME>, 0 turns it off;
 *   - a circuit breaker: a quota/auth answer parks the provider for hours;
 *   - a short result cache, so a repeated query costs nothing.
 *
 * KEYS. A provider with no key is silently absent — nothing breaks without them.
 *   SERPER_API_KEY, TAVILY_API_KEY, EXA_API_KEY, LINKUP_API_KEY, FIRECRAWL_API_KEY,
 *   MARGINALIA_API_KEY.  WIKIPEDIA needs no key (public REST search, last in the walk,
 *   FREE_SEARCH_DAILY_WIKIPEDIA=0 turns it off). Linkup and Firecrawl are no-card free tiers
 *   (Linkup ~EUR 5/month credit; Firecrawl 1,000 credits/month, a search costs 2 per 10 results).
 *   Safe search: Exa gets `moderation` and Serper `safe: active` unless safe search is off.
 * Marginalia's shared "public" key is rate-limited to uselessness (429), so it
 * is only used when a real key is configured. Marginalia keys are free but
 * NON-COMMERCIAL (CC-BY-NC-SA) — fine while Truegle has no revenue; revisit if
 * that ever changes.
 *
 * Output is the SAME shape formatBraveResults emits, so results flow through
 * the existing dedupe/rank/bias pipeline untouched.
 *
 * Request shapes are from each vendor's public docs and are covered by mocked
 * tests; they have NOT been exercised against live keys from this environment.
 */
const axios = require('axios');
const paidBudget = require('./PaidProviderBudget');
const { breakers } = require('../utils/breaker');
const { createTtlCache } = require('../utils/ttlCache');

const TIMEOUT_MS = 6000;
const HOUR = 3600 * 1000;
const cache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 300 });

const domainOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};
const clip = (t, n = 300) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

const row = (p, item) => ({
  title: clip(item.title, 200) || domainOf(item.url),
  url: item.url,
  snippet: clip(item.snippet),
  source: p.id,
  sourceName: p.label,
  date: item.date || null,
  image: null,
  favicon: null,
  domain: domainOf(item.url),
  category: 'web',
  verified: true,
});

// Daily call caps. Conservative on purpose: ~1/30 of a monthly quota per day.
const DEFAULT_DAILY = { serper: 80, tavily: 30, exa: 70, linkup: 100, firecrawl: 15, marginalia: 500, wikipedia: 500 };

const PROVIDERS = [
  {
    id: 'serper',
    label: 'Google (Serper)',
    key: () => process.env.SERPER_API_KEY,
    call: (q, f, key) => axios.post('https://google.serper.dev/search', {
      q, num: Math.min(f.perPage || 10, 20), page: f.page || 1,
      ...(f.language ? { hl: f.language } : {}), ...(f.country ? { gl: String(f.country).toLowerCase() } : {}),
      ...(f.safeSearch !== 'off' ? { safe: 'active' } : {}),
    }, { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }),
    parse: (d) => (d?.organic || []).map((r) => ({ title: r.title, url: r.link, snippet: r.snippet, date: r.date })),
  },
  {
    id: 'tavily',
    label: 'Tavily',
    key: () => process.env.TAVILY_API_KEY,
    call: (q, f, key) => axios.post('https://api.tavily.com/search', {
      query: q, max_results: Math.min(f.perPage || 10, 20), search_depth: 'basic', include_answer: false,
    }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }),
    parse: (d) => (d?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.content })),
  },
  {
    id: 'exa',
    label: 'Exa',
    key: () => process.env.EXA_API_KEY,
    call: (q, f, key) => axios.post('https://api.exa.ai/search', {
      query: q, numResults: Math.min(f.perPage || 10, 20), contents: { text: { maxCharacters: 300 } },
      moderation: f.safeSearch !== 'off',
    }, { headers: { 'x-api-key': key, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }),
    parse: (d) => (d?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.text, date: r.publishedDate })),
  },
  {
    id: 'linkup',
    label: 'Linkup',
    key: () => process.env.LINKUP_API_KEY,
    call: (q, f, key) => axios.post('https://api.linkup.so/v1/search', {
      q, depth: 'standard', outputType: 'searchResults',
    }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }),
    parse: (d) => (d?.results || []).map((r) => ({ title: r.name || r.title, url: r.url, snippet: r.content })),
  },
  {
    id: 'firecrawl',
    label: 'Firecrawl',
    key: () => process.env.FIRECRAWL_API_KEY,
    call: (q, f, key) => axios.post('https://api.firecrawl.dev/v2/search', {
      query: q, limit: Math.min(f.perPage || 10, 10),
    }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS }),
    // v1 answered with an array, v2 with { web: [...] }.
    parse: (d) => (Array.isArray(d?.data) ? d.data : (d?.data?.web || []))
      .map((r) => ({ title: r.title, url: r.url, snippet: r.description })),
  },
  {
    id: 'marginalia',
    label: 'Marginalia',
    key: () => process.env.MARGINALIA_API_KEY,
    call: (q, f, key) => axios.get('https://api2.marginalia-search.com/search', {
      params: { query: q, count: Math.min(f.perPage || 10, 20) },
      headers: { 'API-Key': key }, timeout: TIMEOUT_MS,
    }),
    parse: (d) => (d?.results || []).map((r) => ({ title: r.title, url: r.url, snippet: r.description })),
  },
  {
    // KEY-FREE, and last in the walk so the keyed engines (better general web) go first. REST search:
    // the older action API rate-limits shared server addresses hard (checked 2026-11-11). A 429 here is
    // transient, so it only pauses it for minutes.
    id: 'wikipedia',
    label: 'Wikipedia',
    key: () => (process.env.FREE_SEARCH_DAILY_WIKIPEDIA === '0' ? '' : 'keyless'),
    pause429: 10 * 60 * 1000,
    call: (q, f) => axios.get('https://en.wikipedia.org/w/rest.php/v1/search/page', {
      params: { q, limit: Math.min(f.perPage || 10, 10) },
      headers: { 'User-Agent': 'Truegle/1.0 (+https://truegle.info; search aggregator)' }, timeout: TIMEOUT_MS,
    }),
    parse: (d) => (d?.pages || []).map((r) => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(r.key || r.title).replace(/ /g, '_'))}`,
      snippet: [r.description, String(r.excerpt || '').replace(/<[^>]+>/g, '')].filter(Boolean).join(' — '),
    })),
  },
];

const dailyLimit = (id) => {
  const raw = process.env[`FREE_SEARCH_DAILY_${id.toUpperCase()}`];
  return raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_DAILY[id];
};

/** Which providers have a key right now (for logs / health). */
const configured = () => PROVIDERS.filter((p) => p.key()).map((p) => p.id);

/** Query one provider. Returns normalised rows; throws on failure (after tripping the breaker). */
async function searchOne(p, query, filters = {}) {
  const key = p.key();
  if (!key) throw new Error(`${p.id} not configured`);
  if (breakers.isOpen(p.id)) throw new Error(`${p.id} paused`);

  const ck = `${p.id}:${filters.page || 1}:${filters.perPage || 10}:${query}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  const budget = paidBudget.claim(`free-${p.id}`, dailyLimit(p.id));
  if (!budget.ok) throw new Error(`${p.id} daily cap: ${budget.reason}`);

  try {
    const res = await p.call(query, filters, key);
    const rows = p.parse(res.data).filter((r) => r && /^https?:\/\//i.test(r.url || '')).map((r) => row(p, r));
    breakers.ok(p.id);
    cache.set(ck, rows);
    return rows;
  } catch (err) {
    const status = err.response?.status;
    // 402/429/432/433 = out of quota or rate limited (Tavily uses 432/433 for plan limits).
    if (status === 429 && p.pause429) breakers.trip(p.id, p.pause429, 'rate limited (429)');
    else if ([402, 429, 432, 433].includes(status)) breakers.trip(p.id, 2 * HOUR, `quota (${status})`);
    else if (status === 401 || status === 403) breakers.trip(p.id, 6 * HOUR, `auth (${status})`);
    else breakers.trip(p.id, 30 * 1000, err.code || `error ${status || ''}`.trim());
    throw new Error(`${p.id} failed${status ? ` (${status})` : ''}`);
  }
}

/**
 * Walk configured providers in order until `needed` NEW rows are collected.
 * `have` is the set of URLs the page already holds, so duplicates do not count.
 * Never throws: a failing provider is skipped, and an empty array is a valid answer.
 */
async function topUp(query, filters, { needed = 10, have = new Set(), log = () => {} } = {}) {
  const out = [];
  const seen = new Set(have);
  for (const p of PROVIDERS) {
    if (out.length >= needed) break;
    if (!p.key()) continue;
    try {
      const rows = await searchOne(p, query, filters);
      const fresh = rows.filter((r) => !seen.has(r.url));
      fresh.forEach((r) => seen.add(r.url));
      out.push(...fresh);
      log(`🆓 ${p.id} added ${fresh.length}`);
    } catch (e) {
      log(`🆓 ${p.id} skipped — ${e.message}`);
    }
  }
  return out;
}

module.exports = { topUp, searchOne, configured, PROVIDERS, _cache: cache };
