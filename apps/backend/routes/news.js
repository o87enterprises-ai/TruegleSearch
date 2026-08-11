/*
 * The landing page's news feed — local + global headlines, video coverage, and
 * a live markets summary.
 *
 * EVERY SOURCE IS FREE AND KEYLESS. That is a hard requirement, not a
 * preference (docs/AD-POLICY.md's sibling: the $0 budget), so:
 *
 *   print    → Google News RSS. Country-scoped editions are a URL parameter,
 *              which is what makes "local" work without asking anyone where
 *              they are.
 *   video    → OUR OWN search (SearXNG), category `videos`, seeded with the
 *              day's top headline. Deliberately not a hardcoded list of news
 *              channels: picking which outlets count as "the news" is exactly
 *              the editorial thumb on the scale Truegle exists to avoid, and
 *              this way the video row is whatever the index actually has.
 *   markets  → CoinGecko for crypto (keyless, generous free tier) and Yahoo
 *              Finance's chart endpoint for indices and commodities.
 *
 * ⚠️ YAHOO IS AN UNOFFICIAL ENDPOINT. It has been stable for years and needs no
 * key, but nobody promises it will stay that way. It is isolated behind its own
 * adapter and its own settled promise so the day it changes, the markets row
 * degrades to crypto-only instead of taking the feed down. Run
 * `npm run news:test` (apps/backend) to check all three upstreams for real.
 *
 * WHERE THE USER IS: the country comes from the edge/CDN header the request
 * already carries (GeoAdService.countryFromHeaders — Cloudflare and Vercel both
 * set it for free). No geolocation prompt, no IP lookup service, no third
 * party, and nothing is stored against anybody. The client may also pass
 * ?country= to override it, which is what the feed's own region picker sends.
 */
const express = require('express');
const router = express.Router();
const GeoAdService = require('../services/GeoAdService');
const logger = require('../utils/logger');

// ── cache ───────────────────────────────────────────────────────────────────
// One process-local Map, same as routes/creators.js. Serverless gives every
// instance its own, which is fine: the TTLs exist to stay well inside the free
// tiers' rate limits, and a cold instance making one extra call is not the
// thing that would breach them.
const cache = new Map(); // key -> { at, value }

const TTL = {
  print: 5 * 60 * 1000,        // headlines move, but not every second
  video: 15 * 60 * 1000,       // our own SearXNG — be kind to the box
  markets: 60 * 1000,          // "live" without hammering a free tier
};

async function cached(key, ttl, produce) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return { ...hit.value, cached: true };
  const value = await produce();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Serve whatever is in the cache regardless of age. The "better than nothing
 *  when an upstream is down" path — a stale headline beats an empty panel. */
function stale(key) {
  const hit = cache.get(key);
  return hit ? { ...hit.value, stale: true } : null;
}

const timeout = (ms) => AbortSignal.timeout(ms);

// ── country + language ──────────────────────────────────────────────────────
const COUNTRY = /^[A-Z]{2}$/;

// Google News wants an edition as language + country. Only the languages that
// differ from plain English are worth listing; everything else reads the
// English edition of its own country, which is still correctly LOCAL news.
const LANG_BY_COUNTRY = {
  DE: 'de', AT: 'de', CH: 'de', ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es',
  FR: 'fr', BE: 'fr', NL: 'nl', PT: 'pt-PT', BR: 'pt-BR', IT: 'it', PL: 'pl',
  JP: 'ja', KR: 'ko', CN: 'zh-CN', TW: 'zh-TW', RU: 'ru', TR: 'tr', SE: 'sv',
  NO: 'no', DK: 'da', FI: 'fi', GR: 'el', IL: 'he', SA: 'ar', AE: 'ar', EG: 'ar',
  IN: 'en-IN', GB: 'en-GB', AU: 'en-AU', CA: 'en-CA', NZ: 'en-NZ', IE: 'en-IE',
  ZA: 'en-ZA', NG: 'en-NG', PH: 'en-PH', SG: 'en-SG',
};

function editionFor(country) {
  const cc = COUNTRY.test(country || '') ? country : 'US';
  const hl = LANG_BY_COUNTRY[cc] || 'en-US';
  return { cc, hl, ceid: `${cc}:${hl.split('-')[0]}` };
}

// ── print: Google News RSS ──────────────────────────────────────────────────
//
// The feed is XML with no CORS headers, so it has to be proxied and parsed
// here. Regex rather than an XML dependency: the shape is three fields deep and
// adding a parser to the bundle for that would be the expensive way to do it.
const ITEM = /<item>([\s\S]*?)<\/item>/g;
const FIELD = (name, xml) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1].trim() : '';
};

// Google wraps titles in CDATA and HTML-escapes the rest.
const decode = (s) => String(s || '')
  .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&')
  .trim();

// Google renders a title as "Headline - The Publisher" and ALSO ships the
// publisher in its own <source> element. Use the element: it is authoritative,
// and splitting on the dash is guesswork — headlines contain dashes of their
// own ("Trump - Biden debate recap - CNN"), and a sentence like "Report: X says
// Y - and then Z happened" loses its tail to any length-based heuristic.
//
// The dash split survives only as the fallback for a feed that omits <source>,
// and there it is held to what a publisher name actually looks like: short, and
// leaving a real headline behind.
const MIN_HEADLINE = 10;
const MAX_SOURCE = 30;

function splitSource(title, declared) {
  if (declared) {
    // Strip the exact suffix Google appended, and nothing else.
    const suffix = ` - ${declared}`;
    return {
      title: title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title,
      source: declared,
    };
  }
  const at = title.lastIndexOf(' - ');
  const source = at === -1 ? '' : title.slice(at + 3).trim();
  // Four words is "The Wall Street Journal" and "The Times of India"; it is not
  // "and then Z happened at length".
  const looksLikePublisher = source.length >= 2
    && source.length <= MAX_SOURCE
    && source.split(/\s+/).length <= 4
    && !/[.?!,;:]/.test(source);
  if (at >= MIN_HEADLINE && looksLikePublisher) {
    return { title: title.slice(0, at).trim(), source };
  }
  return { title, source: '' };
}

function parseRss(xml, limit) {
  const out = [];
  let m;
  ITEM.lastIndex = 0;
  while ((m = ITEM.exec(xml)) && out.length < limit) {
    const block = m[1];
    const rawTitle = decode(FIELD('title', block));
    if (!rawTitle) continue;
    const { title, source } = splitSource(rawTitle, decode(FIELD('source', block)));
    out.push({
      title,
      source,
      url: decode(FIELD('link', block)),
      at: Date.parse(decode(FIELD('pubDate', block))) || null,
    });
  }
  return out;
}

async function googleNews(url, limit = 12) {
  const r = await fetch(url, {
    signal: timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleNews/1.0)' },
  });
  if (!r.ok) throw new Error(`google news ${r.status}`);
  return parseRss(await r.text(), limit);
}

async function printHeadlines(country) {
  const { cc, hl, ceid } = editionFor(country);
  const qs = `hl=${encodeURIComponent(hl)}&gl=${cc}&ceid=${encodeURIComponent(ceid)}`;
  // Local and world are two different editions of the same feed, fetched
  // together so the panel can show both without a second round trip.
  const [local, world] = await Promise.allSettled([
    googleNews(`https://news.google.com/rss?${qs}`, 10),
    googleNews(`https://news.google.com/rss/headlines/section/topic/WORLD?${qs}`, 10),
  ]);
  return {
    country: cc,
    local: local.status === 'fulfilled' ? local.value : [],
    world: world.status === 'fulfilled' ? world.value : [],
  };
}

// ── video: our own index ────────────────────────────────────────────────────
async function videoCoverage(seed) {
  // Required lazily: the search service pulls in a lot, and the markets-only
  // refresh path has no business paying for it.
  const PrivateSearchService = require('../services/PrivateSearchService');
  const query = (seed || 'world news today').slice(0, 120);
  const data = await PrivateSearchService.search(query, { category: 'videos', perPage: 12 });
  const rows = data?.results || data || [];
  const items = (Array.isArray(rows) ? rows : []).slice(0, 12).map((r) => ({
    title: r.title || '',
    url: r.url || r.pageUrl || '',
    source: r.engine || r.source || '',
    thumbnail: r.thumbnail || r.img_src || r.image || '',
    at: r.publishedDate ? Date.parse(r.publishedDate) || null : null,
  })).filter((v) => v.title && v.url);
  // Wrapped rather than returned bare: cached() stores objects so it can stamp
  // `cached`/`stale` onto what it hands back, and spreading an array turns it
  // into a keyed object with a length property — a silent, ugly failure.
  return { items };
}

// ── markets ─────────────────────────────────────────────────────────────────
//
// Every instrument comes back in ONE shape so the UI has a single row
// component and a single sparkline:
//   { id, label, kind, price, change, changePct, currency, spark: number[] }
// `spark` is already downsampled — sending 400 raw points to a 90px chart is
// bandwidth nobody sees.
function downsample(values, target = 40) {
  const clean = (values || []).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (clean.length <= target) return clean;
  const step = clean.length / target;
  return Array.from({ length: target }, (_, i) => clean[Math.floor(i * step)]);
}

const pct = (from, to) => (from ? ((to - from) / from) * 100 : 0);

const CRYPTO = ['bitcoin', 'ethereum', 'solana'];

async function cryptoRow() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets'
    + `?vs_currency=usd&ids=${CRYPTO.join(',')}&sparkline=true&price_change_percentage=24h`;
  const r = await fetch(url, { signal: timeout(8000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : []).map((c) => ({
    id: c.id,
    label: (c.symbol || '').toUpperCase(),
    name: c.name,
    kind: 'crypto',
    price: c.current_price,
    changePct: c.price_change_percentage_24h ?? 0,
    currency: 'USD',
    spark: downsample(c.sparkline_in_7d?.price),
  }));
}

// Indices and commodities. Yahoo's chart endpoint carries the last close and a
// day of intraday points in one response, which is exactly a sparkline.
const YAHOO = [
  { symbol: '^GSPC', label: 'S&P 500', kind: 'stock' },
  { symbol: '^IXIC', label: 'Nasdaq', kind: 'stock' },
  { symbol: '^DJI', label: 'Dow', kind: 'stock' },
  { symbol: 'GC=F', label: 'Gold', kind: 'commodity' },
  { symbol: 'CL=F', label: 'Crude oil', kind: 'commodity' },
  { symbol: 'SI=F', label: 'Silver', kind: 'commodity' },
];

async function yahooQuote({ symbol, label, kind }) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m`;
  const r = await fetch(url, {
    signal: timeout(8000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleNews/1.0)', Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo ${symbol} empty`);
  const meta = result.meta || {};
  const closes = (result.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === 'number');
  const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? closes[0] ?? null;
  if (price == null) throw new Error(`yahoo ${symbol} no price`);
  return {
    id: symbol,
    label,
    name: meta.shortName || label,
    kind,
    price,
    change: prev == null ? 0 : price - prev,
    changePct: prev == null ? 0 : pct(prev, price),
    currency: meta.currency || 'USD',
    spark: downsample(closes),
  };
}

async function markets() {
  const [crypto, ...quotes] = await Promise.allSettled([
    cryptoRow(),
    ...YAHOO.map((y) => yahooQuote(y)),
  ]);
  const equities = quotes.filter((q) => q.status === 'fulfilled').map((q) => q.value);
  return {
    crypto: crypto.status === 'fulfilled' ? crypto.value : [],
    stocks: equities.filter((q) => q.kind === 'stock'),
    commodities: equities.filter((q) => q.kind === 'commodity'),
    at: Date.now(),
  };
}

// ── routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/news/feed?country=US
 *
 * The landing page's first paint. Every category is settled independently, so
 * a dead upstream costs one panel and not the feed.
 */
router.get('/feed', async (req, res) => {
  const country = COUNTRY.test(String(req.query.country || '').toUpperCase())
    ? String(req.query.country).toUpperCase()
    : (await GeoAdService.detectCountry(req).catch(() => null)) || 'US';

  const printKey = `print:${country}`;
  const [printed, market] = await Promise.allSettled([
    cached(printKey, TTL.print, () => printHeadlines(country)),
    cached('markets', TTL.markets, markets),
  ]);

  const print = printed.status === 'fulfilled'
    ? printed.value
    : stale(printKey) || { country, local: [], world: [] };

  // Video is seeded by the day's top headline, so it has to wait for print —
  // and it must never be the reason the feed is slow, hence its own cache key
  // and a shorter leash than the panels above it.
  const seed = print.local?.[0]?.title || print.world?.[0]?.title || '';
  const videoKey = `video:${country}`;
  let video = [];
  try {
    video = (await cached(videoKey, TTL.video, () => videoCoverage(seed))).items;
  } catch (err) {
    logger.warn('News video lookup failed:', { error: err.message });
    video = stale(videoKey)?.items || [];
  }

  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    country,
    print,
    video,
    markets: market.status === 'fulfilled' ? market.value : stale('markets') || { crypto: [], stocks: [], commodities: [] },
  });
});

/**
 * GET /api/news/markets
 *
 * Just the numbers. The markets panel refreshes on its own cadence and has no
 * use for a headline it already has — and when the panel is minimised the
 * client stops calling this entirely.
 */
router.get('/markets', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.json(await cached('markets', TTL.markets, markets));
  } catch (err) {
    logger.warn('Markets fetch failed:', { error: err.message });
    const last = stale('markets');
    if (last) return res.json(last);
    return res.status(502).json({ error: 'markets_unavailable', crypto: [], stocks: [], commodities: [] });
  }
});

module.exports = router;
// Exported for scripts/verify-news.mjs, which checks the adapters against the
// real upstreams — the shapes here are the whole risk surface of this file.
module.exports.__adapters = { printHeadlines, markets, parseRss, downsample, editionFor };
