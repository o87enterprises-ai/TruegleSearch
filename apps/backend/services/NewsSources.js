/*
 * The news feed's upstreams: fetch and parse, and nothing else.
 *
 * ZERO REQUIRES, ON PURPOSE. Not a style preference — this module is what
 * scripts/verify-news.mjs runs against, and that script has to work on a
 * machine where `npm install` cannot complete. (It routinely can't: the repo
 * has native dependencies that need a compiler, which a phone running Termux
 * does not have.) The moment this file requires express or the winston-backed
 * logger, checking whether Google News still answers in the shape we expect
 * needs a full working backend install — which is exactly backwards, since the
 * check matters most when you are somewhere awkward.
 *
 * So: only Node's built-in fetch. Anything needing express, the logger, the
 * search service or the cache lives in routes/news.js.
 *
 * ⚠️ YAHOO IS AN UNOFFICIAL ENDPOINT. Stable for years, needs no key, but
 * nobody promises it stays. Each source is its own function returning its own
 * promise so the route can settle them independently and lose one panel rather
 * than the feed.
 */

const timeout = (ms) => AbortSignal.timeout(ms);
const UA = 'Mozilla/5.0 (compatible; TruegleNews/1.0)';

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
// adding a parser for that would be the expensive way to do it — and would
// break the zero-requires rule above.
const ITEM = /<item>([\s\S]*?)<\/item>/g;
const FIELD = (name, xml) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? m[1].trim() : '';
};

// Google wraps titles in CDATA and HTML-escapes the rest. `&amp;` is decoded
// LAST so a double-escaped entity resolves one level, not two.
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
// and there it is held to what a publisher name actually looks like: short,
// unpunctuated, and leaving a real headline behind.
const MIN_HEADLINE = 10;
const MAX_SOURCE = 30;

function splitSource(title, declared) {
  if (declared) {
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
  const r = await fetch(url, { signal: timeout(8000), headers: { 'User-Agent': UA } });
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

// ── markets ─────────────────────────────────────────────────────────────────
//
// Every instrument comes back in ONE shape so the UI has a single row
// component and a single sparkline:
//   { id, label, kind, price, changePct, currency, spark: number[] }
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

// A chart window, reduced to the two things the feed needs.
async function yahooChart(symbol, range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?range=${range}&interval=${interval}`;
  const r = await fetch(url, {
    signal: timeout(8000),
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`yahoo ${symbol} ${r.status}`);
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo ${symbol} empty`);
  return {
    meta: result.meta || {},
    closes: (result.indicators?.quote?.[0]?.close || []).filter((v) => typeof v === 'number'),
  };
}

// Below this many intraday points the line is a stub rather than a chart, and
// under 2 the UI draws nothing at all.
const THIN_SPARK = 8;

async function yahooQuote({ symbol, label, kind }) {
  // Today, at fifteen-minute resolution — the right window while a market is
  // open, and where the day's own price and previous close come from.
  const day = await yahooChart(symbol, '1d', '15m');
  const meta = day.meta;

  // OUT OF HOURS THAT WINDOW IS NEARLY EMPTY. Verified against the live
  // endpoint on a partly-closed session: crypto came back with 40 points,
  // the S&P with 27 and gold with 8 — and a fully closed market can return one
  // point or none, which the sparkline renders as a blank box. So when today
  // is too thin to draw, widen to the last five days and chart that instead.
  //
  // Only the SPARKLINE widens. Price and change stay on the day's meta, or the
  // percentage would silently become "since five days ago" — a wrong number is
  // worse than a short line.
  let spark = day.closes;
  if (spark.length < THIN_SPARK) {
    try {
      const week = await yahooChart(symbol, '5d', '1h');
      if (week.closes.length > spark.length) spark = week.closes;
    } catch { /* keep the thin series — still better than nothing */ }
  }

  const price = meta.regularMarketPrice ?? day.closes[day.closes.length - 1] ?? spark[spark.length - 1] ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? day.closes[0] ?? null;
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
    spark: downsample(spark),
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

module.exports = {
  printHeadlines, markets, cryptoRow, yahooQuote, yahooChart,
  parseRss, splitSource, decode, downsample, editionFor, COUNTRY, THIN_SPARK,
};
