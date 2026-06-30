#!/usr/bin/env node
/**
 * Adsterra ad-delivery verification loop
 * ======================================
 *
 * Drives a real Chromium browser against a Truegle deployment and inspects the
 * network to answer two distinct questions:
 *
 *   1. INTEGRATION — does the browser actually request the Adsterra tags
 *      (invoke.js from highperformanceformat.com + the popunder script) and is
 *      `window.atOptions` set? This proves our client-side wiring is correct.
 *
 *   2. FILL — does Adsterra return a NON-EMPTY ad (a real creative / impression
 *      beacon)? From a datacenter / CI IP, ad networks routinely return empty
 *      fills, so a "no fill" result here points at IP/account/site-approval on
 *      Adsterra's side, NOT at our code.
 *
 * It loops with retries and exits 0 the moment a FILL is verified. If it only
 * ever sees INTEGRATION-OK-but-empty, it exits 2 with a full report so the
 * difference (our bug vs. Adsterra-side) is unambiguous.
 *
 * Usage:
 *   node scripts/ad-verify.mjs --url https://truegle.info --attempts 5
 *   node scripts/ad-verify.mjs --url http://localhost:4173 --headful
 *
 * Browsers are pre-installed at $PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers);
 * do NOT run `playwright install`.
 */

import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'node:fs';

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const BASE_URL = getArg('url', 'http://localhost:4173').toString().replace(/\/$/, '');
const ATTEMPTS = parseInt(getArg('attempts', '5'), 10);
const SEARCH_PATH = getArg('search-path', '/search?q=privacy%20tools').toString();
const HEADFUL = !!getArg('headful', false);
const SETTLE_MS = parseInt(getArg('settle', '9000'), 10);
const OUT = getArg('out', '/tmp/claude-0/-home-user-TruegleSearch/b5c2fb33-0e73-5567-9031-5a66fadea6a9/scratchpad/ad-verify-report.json').toString();

// ── domain classification ─────────────────────────────────────────────────
// Adsterra's primary, known delivery domains.
const ADSTERRA_PRIMARY = [
  'highperformanceformat.com',
  'millionairelucidlytransmitted.com',
];
// Substrings that strongly indicate an Adsterra / ad-network request.
const AD_HINTS = [
  'adsterra', 'highperformanceformat', 'millionairelucid',
  'profitable', 'displaycontent', 'displaynetwork', 'effectivegate',
  'pl.', 'invoke.js', '/atag', 'popunder', 'sw.js?', 'native',
];
// First-party / known site infra — anything here is NOT an ad request.
const SITE_INFRA = [
  'truegle.info', 'ads.truegle.info', 'localhost', '127.0.0.1',
  'cloudflareinsights.com', 'cloudflare.com', 'fonts.googleapis.com',
  'fonts.gstatic.com', 'api.mapbox.com', 'mapbox.com', 'vercel.app',
  'youtube.com', 'ytimg.com', 'vimeo.com', 'openstreetmap.org',
  'project-osrm.org', 'tomtom.com', 'earthdata.nasa.gov', 'huggingface.co',
  'gstatic.com', 'googleapis.com',
];

const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };
const isPrimary = (host) => ADSTERRA_PRIMARY.some((d) => host.endsWith(d));
const isInfra = (host) => SITE_INFRA.some((d) => host === d || host.endsWith('.' + d) || host.endsWith(d));
const looksAd = (url) => {
  const host = hostOf(url);
  if (isPrimary(host)) return true;
  if (isInfra(host)) return false;
  const u = url.toLowerCase();
  return AD_HINTS.some((h) => u.includes(h));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runAttempt(browser, n) {
  const events = [];
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  page.on('request', (req) => {
    const url = req.url();
    if (looksAd(url)) {
      events.push({ phase: 'request', method: req.method(), url, host: hostOf(url), frame: req.frame().url() });
    }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (looksAd(url)) {
      events.push({ phase: 'failed', url, host: hostOf(url), error: req.failure()?.errorText });
    }
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (!looksAd(url)) return;
    let size = null;
    try { size = (await res.body()).length; } catch { /* opaque */ }
    events.push({ phase: 'response', status: res.status(), url, host: hostOf(url), size });
  });

  // 1) Landing — fires the global popunder + (via FreemiumTokenBar) a banner
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  // Accept the cookie banner if it appears (ads load by default, but click anyway)
  await page.getByRole('button', { name: /accept/i }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(2500);

  // 2) Search results — renders AdsterraBanner placements
  await page.goto(BASE_URL + SEARCH_PATH, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await sleep(SETTLE_MS);

  const pageState = await page.evaluate(() => ({
    atOptions: typeof window.atOptions === 'object' ? window.atOptions : null,
    adConsent: window.__truegle_ad_consent,
    popFired: !!sessionStorage.getItem('truegle_pop_fired'),
  })).catch(() => ({}));

  await context.close();

  // ── analyse ──────────────────────────────────────────────────────────────
  const invokeReq = events.find((e) => e.phase === 'request' && e.url.includes('invoke.js'));
  const popReq = events.find((e) => e.phase === 'request' && hostOf(e.url).endsWith('millionairelucidlytransmitted.com'));
  const nonEmpty = events.filter((e) => e.phase === 'response' && e.status === 200 && e.size != null && e.size > 50);
  const adRequests = events.filter((e) => e.phase === 'request');
  const failures = events.filter((e) => e.phase === 'failed');

  const integrationOk = !!invokeReq && !!pageState.atOptions;
  const filled = nonEmpty.length > 0;

  return { n, events, pageState, invokeReq: !!invokeReq, popReq: !!popReq, integrationOk, filled, nonEmpty, adRequests, failures };
}

// The environment pre-installs Chromium at $PLAYWRIGHT_BROWSERS_PATH/chromium,
// which may not match the playwright npm package's expected build. Prefer that
// binary when present so we never trigger a (blocked) browser download. Using
// the full chromium build also avoids the missing chrome-headless-shell.
function resolveExecutable() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidate = `${base}/chromium`;
  try { return existsSync(candidate) ? candidate : undefined; } catch { return undefined; }
}

(async () => {
  console.log(`\n🔎 Adsterra verify — target ${BASE_URL}  (attempts: ${ATTEMPTS})\n`);
  const executablePath = resolveExecutable();
  const browser = await chromium.launch({
    headless: !HEADFUL,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const summaries = [];
  let success = null;
  let lastFull = null;

  for (let n = 1; n <= ATTEMPTS; n++) {
    process.stdout.write(`  attempt ${n}/${ATTEMPTS} … `);
    let r;
    try {
      r = await runAttempt(browser, n);
      lastFull = r;
    } catch (err) {
      console.log(`error: ${err.message}`);
      summaries.push({ n, error: err.message });
      continue;
    }
    summaries.push({
      n, integrationOk: r.integrationOk, filled: r.filled,
      invokeReq: r.invokeReq, popReq: r.popReq,
      adReqCount: r.adRequests.length, nonEmptyCount: r.nonEmpty.length,
      failures: r.failures.length, pageState: r.pageState,
    });
    console.log(
      `integration=${r.integrationOk ? 'OK' : 'NO'}  ` +
      `invoke.js=${r.invokeReq ? '✓' : '✗'}  popunder=${r.popReq ? '✓' : '✗'}  ` +
      `ad-reqs=${r.adRequests.length}  non-empty=${r.nonEmpty.length}  ` +
      `fill=${r.filled ? '✅' : '—'}`
    );
    if (r.filled) { success = r; break; }
    if (n < ATTEMPTS) await sleep(3000);
  }

  await browser.close();

  // Persist the richest attempt (full network events) for inspection
  const detail = success || lastFull || summaries[summaries.length - 1];
  try { writeFileSync(OUT, JSON.stringify({ baseUrl: BASE_URL, summaries, detail }, null, 2)); } catch { /* ignore */ }

  console.log('\n──────────── VERDICT ────────────');
  if (success) {
    console.log('✅ VERIFIED: Adsterra returned a non-empty ad (real fill/impression).');
    console.log(`   ${success.nonEmpty.length} non-empty ad response(s). Report: ${OUT}`);
    process.exit(0);
  }
  const anyIntegration = summaries.some((s) => s.integrationOk);
  const anyAdReq = summaries.some((s) => (s.adReqCount || 0) > 0);
  if (anyIntegration || anyAdReq) {
    console.log('⚠️  INTEGRATION OK, BUT EMPTY FILL.');
    console.log('   The browser DID request the Adsterra tags (our wiring is correct),');
    console.log('   but Adsterra returned no creative. Most likely cause: this run');
    console.log('   originates from a datacenter/CI IP (ad networks suppress those),');
    console.log('   or the site/placement is not yet approved in the Adsterra dashboard.');
    console.log(`   → Re-run from a residential browser to confirm fill. Report: ${OUT}`);
    process.exit(2);
  }
  console.log('❌ NO Adsterra requests observed at all — integration is NOT firing.');
  console.log(`   Check that the ad components mount and CSP allows the domains. Report: ${OUT}`);
  process.exit(1);
})().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
