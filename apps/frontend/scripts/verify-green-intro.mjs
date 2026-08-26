/* The Green Mode explainer: once, on green, and never in the way.
 *
 * WHAT IT WAS. A full-screen dialog fired after the first successful search on
 * ANY AI mode, asking "Disable Smart Features? Yes, go Green / No, keep Smart
 * features". Three things wrong with that:
 *
 *   - It interrupted a search nobody had asked a question about, to offer
 *     turning off a feature the user had not yet seen work.
 *   - It was an opaque z-9999 backdrop over the results that swallowed EVERY
 *     click until answered. Two separate browser tests written for other
 *     features hit it and timed out before anyone noticed it was doing this to
 *     real users too.
 *   - By the time it appeared, the choice it offered had nothing to do with
 *     what the user was doing.
 *
 * WHAT IT IS NOW. An explainer shown when green mode is actually entered,
 * exactly once ever, dismissed by clicking anywhere outside it.
 *
 * The assertions below pin BOTH halves. A test that only checked "the modal
 * appears on green" would pass just as happily if it also still appeared on
 * every other search — which is the actual complaint.
 *
 * Run it:  npm run greenintro:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5199';
const browser = await launchChromium();

const RESULTS = {
  success: true,
  results: [
    { title: 'Sourdough starter guide', url: 'https://example.org/sourdough', snippet: 'How to begin.', domain: 'example.org' },
    { title: 'Feeding schedules', url: 'https://example.org/feeding', snippet: 'Twice a day.', domain: 'example.org' },
  ],
};

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    if (u.includes('/api/search')) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESULTS) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], results: [] }) });
  });
  for (const p of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/overpass-api.de/**', '**/server.arcgisonline.com/**']) {
    await ctx.route(p, (r) => r.abort());
  }
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

/** Is a full-screen blocking overlay up? */
const overlayCount = (page) => page.locator('div.z-\\[9999\\]').count();

const settle = async (page, ms = 4000) => page.waitForTimeout(ms);

// ── 1. An ordinary search is not interrupted ───────────────────────────────
// This is the reported complaint, and the half a naive test would miss.
{
  const { ctx, page } = await open('/search?q=sourdough');
  await settle(page, 6000);
  ok('a plain search shows no modal at all', (await overlayCount(page)) === 0,
    `${await overlayCount(page)} overlays`);

  // And the page is genuinely usable — the old backdrop intercepted clicks
  // even where it looked like nothing was there.
  const cat = page.locator('button', { hasText: /^\s*Maps\s*$/ });
  const clickable = await cat.count()
    ? await cat.first().click({ timeout: 4000 }).then(() => true).catch(() => false)
    : null;
  ok('…and nothing invisible is swallowing clicks',
    clickable !== false, clickable === null ? '(no category row to test)' : 'clicked');
  await ctx.close();
}

// ── 2. Entering green explains itself, once ────────────────────────────────
{
  const { ctx, page } = await open('/search?q=sourdough&mode=green');
  await settle(page);
  ok('choosing green shows the explainer', (await overlayCount(page)) === 1,
    `${await overlayCount(page)} overlays`);

  const text = (await page.locator('div.z-\\[9999\\]').innerText()).replace(/\s+/g, ' ');
  ok('…and it explains rather than asks', /Green Mode/i.test(text) && !/Yes, go Green/i.test(text),
    text.slice(0, 90));

  // "user clicks out" — dismissal by clicking the backdrop, not just a button.
  await page.mouse.click(20, 20);
  await page.waitForTimeout(900);
  ok('clicking outside dismisses it', (await overlayCount(page)) === 0,
    `${await overlayCount(page)} overlays`);

  // Same browser profile, so localStorage carries — this is the "never again".
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}/search?q=rye&mode=green`, { waitUntil: 'domcontentloaded' });
  await settle(page2);
  ok('a second visit to green never shows it again',
    (await overlayCount(page2)) === 0, `${await overlayCount(page2)} overlays`);
  await ctx.close();
}

// ── 3. Clicking the card does not close it ────────────────────────────────
// The card lives inside the backdrop, so without stopPropagation a click on
// the text being read would dismiss the thing being read.
{
  const { ctx, page } = await open('/search?q=sourdough&mode=green');
  await settle(page);
  if ((await overlayCount(page)) === 1) {
    await page.locator('div.z-\\[9999\\] h3').click();
    await page.waitForTimeout(700);
    ok('clicking the dialog itself keeps it open', (await overlayCount(page)) === 1);
  } else {
    ok('clicking the dialog itself keeps it open', false, 'explainer never appeared');
  }
  await ctx.close();
}

// ── 4. /green is a destination, not a decision ────────────────────────────
// Someone who bookmarked the dedicated route did not just choose anything, so
// there is nothing to explain and a modal is only an obstacle.
{
  const { ctx, page } = await open('/green?q=sourdough');
  await settle(page);
  ok('the dedicated /green route shows no modal', (await overlayCount(page)) === 0,
    `${await overlayCount(page)} overlays`);
  await ctx.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
await server.close();
process.exit(failed === 0 ? 0 : 1);
