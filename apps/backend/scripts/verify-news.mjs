/* The news feed's three upstreams, checked for real.
 *
 * WHY THIS EXISTS: routes/news.js talks to Google News RSS, CoinGecko and
 * Yahoo Finance. None of them is under our control and one of them (Yahoo) is
 * an unofficial endpoint with no compatibility promise. The parsing in that
 * file is therefore the whole risk surface — and it was written in an
 * environment whose network policy blocks all three hosts, so the response
 * SHAPES could not be confirmed there.
 *
 * This hits each upstream, runs the real adapter over the real response, and
 * says exactly which field is missing when something has moved. Run it from
 * anywhere with normal outbound network:
 *
 *   cd apps/backend && npm run news:test
 *   # or, with no npm and no node_modules at all:
 *   node apps/backend/scripts/verify-news.mjs
 *
 * Exit 0 = all three adapters produce usable data.
 * Exit 1 = an upstream ANSWERED but in a shape the adapter can't use. The
 *          report names the field, so the fix is a one-liner not an
 *          investigation.
 * Exit 2 = nothing was reachable, so nothing was asserted. A network result,
 *          never a verdict on the code — the distinction matters, because
 *          "0 headlines" looks the same either way from inside the adapter.
 *
 * A failure here does NOT mean the site is down: every source in routes/news.js
 * is behind its own settled promise, so a broken upstream costs one panel.
 */
import { createRequire } from 'node:module';

// services/NewsSources.js requires NOTHING - no express, no winston-backed
// logger, no search service. That is what lets this run on a machine where
// `npm install` cannot finish, which is exactly when you most want to know
// whether the upstreams still answer in the shape the adapters expect.
const require = createRequire(import.meta.url);
const adapters = require('../services/NewsSources.js');

const ok = []; const bad = []; const warn = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v) => typeof v === 'string' && v.length > 0;

// REACHABILITY FIRST. The adapters settle their own failures into empty arrays
// on purpose — that is what keeps one dead upstream from taking the feed down.
// The cost is that "0 headlines" looks identical to "Google changed the feed",
// and those need completely different fixes. So probe each host up front and
// say which world we are in before running a single shape assertion.
const HOSTS = [
  ['Google News', 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'],
  ['CoinGecko', 'https://api.coingecko.com/api/v3/ping'],
  ['Yahoo Finance', 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d'],
];

const reachable = new Map();
console.log('→ checking reachability…');
for (const [name, url] of HOSTS) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleNews/1.0)' },
    });
    reachable.set(name, r.ok);
    console.log(`   ${r.ok ? '✓' : '✗'} ${name} — HTTP ${r.status}`);
  } catch (err) {
    reachable.set(name, false);
    console.log(`   ✗ ${name} — ${err.message}`);
  }
}

const offline = [...reachable.entries()].filter(([, up]) => !up).map(([n]) => n);
if (offline.length === HOSTS.length) {
  console.log(`\nNone of the upstreams is reachable from here (${offline.join(', ')}).`);
  console.log('That is a NETWORK result, not a shape result — this environment, a firewall,');
  console.log('or an outage. Re-run somewhere with normal outbound access before concluding');
  console.log('anything about the adapters. Nothing was asserted.');
  process.exit(2);
}
if (offline.length) {
  warn.push(`WARN unreachable from here, skipped: ${offline.join(', ')}`);
}
console.log('');

// ── 1. Google News RSS, via the real print adapter ──────────────────────────
console.log('→ Google News RSS (print headlines)…');
try {
  if (!reachable.get('Google News')) throw new Error('skipped — unreachable from here');
  const print = await adapters.printHeadlines('US');
  check(print.country === 'US', 'print: country echoed back');
  check(print.local.length > 0, 'print: LOCAL edition returned headlines', `${print.local.length} items`);
  check(print.world.length > 0, 'print: WORLD edition returned headlines', `${print.world.length} items`);

  const h = print.local[0] || print.world[0];
  if (h) {
    check(str(h.title), 'print: headline has a title', JSON.stringify(h.title || '').slice(0, 60));
    check(str(h.url), 'print: headline has a link', String(h.url).slice(0, 60));
    check(num(h.at), 'print: headline has a parseable date', String(h.at));
    // Not fatal — the dash fallback covers a feed without <source> — but if it
    // stops appearing, the UI loses the publisher line.
    const withSource = [...print.local, ...print.world].filter((x) => str(x.source)).length;
    if (withSource === 0) warn.push('WARN print: no headline carried a source/publisher');
    // The suffix must be stripped; if this fires, splitSource has drifted.
    const glued = [...print.local, ...print.world]
      .filter((x) => x.source && x.title.endsWith(` - ${x.source}`));
    check(glued.length === 0, 'print: publisher suffix stripped from titles',
      glued.length ? `${glued.length} still glued, e.g. ${glued[0].title.slice(0, 60)}` : '');
  }

  // A non-English edition proves the country scoping is real and not just the
  // US feed with a different querystring.
  const de = await adapters.printHeadlines('DE');
  check(de.local.length > 0, 'print: a non-US edition also returns headlines', `DE ${de.local.length} items`);
  const overlap = new Set(print.local.map((x) => x.url));
  const shared = de.local.filter((x) => overlap.has(x.url)).length;
  check(shared < de.local.length, 'print: DE edition differs from US', `${shared} shared of ${de.local.length}`);
} catch (err) {
  check(false, 'print: Google News RSS reachable', err.message);
}

// ── 2 + 3. CoinGecko and Yahoo, via the real markets adapter ────────────────
console.log('→ CoinGecko + Yahoo Finance (markets)…');
try {
  if (!reachable.get('CoinGecko') && !reachable.get('Yahoo Finance')) throw new Error('skipped — both unreachable from here');
  const m = await adapters.markets();

  check(m.crypto.length > 0, 'markets: CoinGecko returned coins', `${m.crypto.length}`);
  check(m.stocks.length > 0, 'markets: Yahoo returned indices', `${m.stocks.length}`);
  check(m.commodities.length > 0, 'markets: Yahoo returned commodities', `${m.commodities.length}`);

  for (const [label, rows] of [['crypto', m.crypto], ['stock', m.stocks], ['commodity', m.commodities]]) {
    const q = rows[0];
    if (!q) continue;
    check(str(q.label), `markets: ${label} row has a label`, q.label);
    check(num(q.price), `markets: ${label} row has a price`, String(q.price));
    check(num(q.changePct), `markets: ${label} row has a change %`, String(q.changePct));
    // The sparkline is the "summarized live chart" — a row without one renders
    // an empty box, which is the failure this catches.
    check(Array.isArray(q.spark) && q.spark.length >= 2,
      `markets: ${label} row has a sparkline`, `${q.spark?.length ?? 0} points`);
    check((q.spark || []).every(num), `markets: ${label} sparkline is all numbers`);
  }

  // Downsampling has to actually cap the payload.
  const sparks = [...m.crypto, ...m.stocks, ...m.commodities].map((q) => q.spark?.length || 0);
  const longest = Math.max(0, ...sparks);
  check(sparks.length > 0 && longest > 1 && longest <= 40,
    'markets: sparklines are downsampled', `longest ${longest} across ${sparks.length} rows`);
} catch (err) {
  check(false, 'markets: upstreams reachable', err.message);
}

// ── report ──────────────────────────────────────────────────────────────────
ok.forEach((l) => console.log(l));
warn.forEach((l) => console.log(l));
if (bad.length) {
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log(`\n${bad.length} failed, ${ok.length} passed`);
  console.log('\nA failure names the upstream and the field. routes/news.js keeps each');
  console.log('source behind its own settled promise, so the live feed degrades to the');
  console.log('panels that still work rather than going down.');
  process.exit(1);
}
console.log(`\nall ${ok.length} passed — every news upstream is answering in the expected shape`);
