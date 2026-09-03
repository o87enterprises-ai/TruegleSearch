/* One gate, and no meter anywhere else.
 *
 * WHAT IT WAS. A "⚡ 10/10 · N searches today · Upgrade" strip pinned across the
 * bottom of every page, claiming a daily limit that was never enforced —
 * consumeFreemiumSearch() had no call sites — while the genuinely expensive
 * surface, OSINT, was free and unlimited. The meter cost a strip of screen the
 * player and the map both need, and told every visitor a lie.
 *
 * WHAT IT IS. The meter is deleted. OSINT — six third-party lookup APIs on
 * free-tier quotas plus an AI call, per run — gets one free investigation for a
 * signed-out visitor, then asks for a (free) account.
 *
 * THE TWO BUGS THIS TEST EXISTS FOR, neither visible to a build:
 *
 *   1. The gate blocks the FIRST run. Off-by-one in the counter and the wall
 *      appears before anyone has had anything, which is worse than no gate.
 *   2. The gate charges twice for one investigation. Adding a tool and
 *      re-running the SAME subject is the same investigation; if that spends a
 *      second credit, the "one free investigation" is really half of one.
 *
 * So the run is driven for real, twice, and the lookups are counted.
 *
 * Run it:  npm run osintgate:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const server = await createServer({ server: { port: 5203, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5203';
const browser = await launchChromium();

// Count what a run actually costs us, so "one investigation" can be measured in
// third-party calls rather than taken on trust.
let lookups = 0;
let aiCalls = 0;

async function freshContext() {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.includes('/api/osint/')) {
      lookups += 1;
      if (u.pathname.includes('username-platforms')) {
        return json({ platforms: [{ name: 'GitHub', url: 'https://github.com/x', exists: true, checkable: true }] });
      }
      return json({ ok: true });
    }
    if (u.pathname.includes('/api/ai/')) { aiCalls += 1; return json({ success: true, data: { response: 'Brief.' } }); }
    return json({ success: true, data: [], results: [] });
  });
  for (const p of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/tile.openstreetmap.org/**']) {
    await ctx.route(p, (r) => r.abort());
  }
  return ctx;
}

const dismissModals = async (page) => {
  for (let i = 0; i < 12; i++) {
    if (!(await page.locator('div.z-\\[9999\\]').count())) { await page.waitForTimeout(250); continue; }
    await page.locator('div.z-\\[9999\\] button').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    if (!(await page.locator('div.z-\\[9999\\]').count())) break;
  }
};

const openOcean = async (ctx, query) => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/search?mode=ocean&q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await dismissModals(page);
  const t = Date.now();
  while (Date.now() - t < 30000) {
    if (await page.locator('form:has(input[placeholder*="username, name, email"])').count()) break;
    await page.waitForTimeout(300);
  }
  return page;
};

// ── The meter is gone, everywhere ───────────────────────────────────────────
{
  const ctx = await freshContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/search?q=coffee`, { waitUntil: 'domcontentloaded' });
  await dismissModals(page);
  await page.waitForTimeout(1500);
  const meter = await page.evaluate(() => {
    const txt = document.body.innerText;
    return {
      // The meter's own copy, in any of the three places it used to appear.
      claimsDailyLimit: /\d+\s*\/\s*10\b/.test(txt) || /searches today/i.test(txt)
        || /10 searches\/day/i.test(txt) || /10 free searches/i.test(txt),
    };
  });
  ok('no page claims a daily search limit that is not enforced', !meter.claimsDailyLimit);
  await ctx.close();
}

// ── The signed-out visitor's ONE investigation ──────────────────────────────
{
  const ctx = await freshContext();
  const page = await openOcean(ctx, 'ada.lovelace');
  ok('the OSINT panel is on the ocean page',
    (await page.locator('form:has(input[placeholder*="username, name, email"])').count()) === 1);

  const quota = page.locator('[data-osint-quota]');
  ok('a signed-out visitor is told the limit before hitting it',
    (await quota.count()) > 0 && /1 free investigation/i.test(await quota.first().innerText().catch(() => '')),
    (await quota.first().innerText().catch(() => '(none)')).trim());

  const runBtn = page.locator('form button[type="submit"]');
  const gate = page.locator('[data-osint-gate]');

  // FIRST run — must go through. A gate that blocks run #1 is worse than none.
  lookups = 0;
  await runBtn.click({ force: true });
  await page.waitForTimeout(2500);
  ok('the first investigation runs', lookups > 0 && (await gate.count()) === 0,
    `${lookups} lookups, ${await gate.count()} gates`);

  // SAME subject again — one investigation, not two. Adding a tool mid-way is
  // not a new investigation, and charging for it halves the promised one.
  const before = lookups;
  await runBtn.click({ force: true });
  await page.waitForTimeout(2500);
  ok('re-running the same subject is still the same investigation',
    (await gate.count()) === 0 && lookups > before,
    `${lookups - before} more lookups, ${await gate.count()} gates`);

  // A DIFFERENT subject — that is a second investigation, and it is gated.
  const spent = lookups;
  await page.locator('form input[type="text"]').fill('grace.hopper');
  await runBtn.click({ force: true });
  await page.waitForTimeout(2000);
  ok('a second subject is gated', (await gate.count()) === 1, `${await gate.count()} gates`);
  ok('…and no third-party lookup was spent on it', lookups === spent,
    `${lookups - spent} extra lookups`);

  const gateText = (await gate.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  ok('the wall offers a free account, not a purchase',
    /free account/i.test(gateText) && !/\$|subscribe|upgrade to premium/i.test(gateText),
    gateText.slice(0, 80));

  // The counter has to survive a reload — a gate reset by F5 is not a gate.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await dismissModals(page);
  await page.waitForTimeout(2000);
  const quotaAfter = (await page.locator('[data-osint-quota]').first().innerText().catch(() => '')).trim();
  ok('the spent investigation survives a reload', /used/i.test(quotaAfter), quotaAfter || '(none)');

  await ctx.close();
}

// ── A fresh visitor is not punished for someone else's run ──────────────────
{
  const ctx = await freshContext();           // new context = new localStorage
  const page = await openOcean(ctx, 'ada.lovelace');
  const quota = (await page.locator('[data-osint-quota]').first().innerText().catch(() => '')).trim();
  ok('a new visitor starts with their own free investigation',
    /1 free investigation/i.test(quota), quota || '(none)');
  await ctx.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
await server.close();
process.exit(failed === 0 ? 0 : 1);
