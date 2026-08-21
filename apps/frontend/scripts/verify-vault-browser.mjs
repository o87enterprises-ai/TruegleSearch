/* The encyclopedia, end to end, in a browser.
 *
 * verify-encyclopedia.mjs proves the book parses and that the saved file is
 * whole and self-contained. None of that answers the questions a reader has:
 *
 *   Is it actually hidden before you find it?
 *   Does winning the game open it?
 *   Does the SAVE button hand you a real file?
 *   Is any of it downloaded by somebody who just mistyped a URL?
 *
 * The last one is the one that would rot silently: a stray top-level import
 * anywhere would pull forty kilobytes of survival manual into the bundle every
 * visitor loads, and nothing about the page would look different.
 *
 * Run it:  npm run vault:browser
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';
import { readFileSync } from 'node:fs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5183, strictPort: true }, logLevel: 'error' });
await server.listen();
const base = 'http://localhost:5183';

const browser = await launchChromium();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true,
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

// Watch what the browser actually fetches. The encyclopedia must not appear
// until somebody opens it.
const fetched = [];
page.on('request', (r) => fetched.push(r.url()));

// ── 1. hidden until found ──────────────────────────────────────────────────
await page.goto(`${base}/asdf`, { waitUntil: 'domcontentloaded' });
// waitForSelector already proves the 404 is up. The 1.2s that followed was
// insurance against the rest of it still rendering; the assertions below read
// specific text, so wait for the element they depend on instead.
await page.waitForSelector('text=Page Not Found', { timeout: 25000 });
await page.waitForSelector('button[aria-label*="Press to play"]', { timeout: 25000 })
  .catch(() => { /* the numerals may be absent; that is asserted below */ });

check(await page.locator("text=THE SURVIVOR'S ENCYCLOPEDIA").count() === 0,
  'on a fresh browser the encyclopedia is not on the page at all');
check(!fetched.some((u) => /encyclopedia|survival-encyclopedia/i.test(u)),
  'and none of it is downloaded — a mistyped URL costs the reader nothing',
  fetched.filter((u) => /encyclopedia/i.test(u)).join(', ') || 'nothing fetched');

// ── 2. arriving in TRAIL opens it ──────────────────────────────────────────
await page.click('button[aria-label*="Trail"]');
await page.waitForSelector('canvas', { timeout: 25000 });
await page.waitForTimeout(5500);              // past the hint timer that used to remount
await page.keyboard.press('Enter');           // off the title
await page.waitForTimeout(400);

// Force the ending rather than playing 500 miles. The run object is the real
// one the loop is stepping, so everything downstream of "you arrived" — the
// unlock, the drawn button, the V key — is exercised for real.
await page.evaluate(() => {
  const r = document.querySelector('canvas').__trailRun;
  r.phase = 'over';
  r.ending = 'arrive';
  r.dist = 500;
});
await page.waitForTimeout(600);

check(await page.evaluate(() => localStorage.getItem('truegle_vault_v1')) === '1',
  'arriving at the settlement unlocks the encyclopedia for good');

await page.keyboard.press('v');
await page.waitForTimeout(1500);
const opened = await page.locator('h1', { hasText: "The Survivor's Encyclopedia" }).count();
check(opened === 1, 'and V opens it straight from the arrival screen', `${opened} found`);

// ── 3. it is a usable reference ────────────────────────────────────────────
const entryCount = await page.locator('article').count();
check(entryCount > 50, 'the whole book is on the page', `${entryCount} entries`);

await page.fill('input[type="search"]', 'water filter');
await page.waitForTimeout(400);
const hits = await page.locator('article h3').allTextContents();
check(hits.length > 0 && hits.length < 20 && /Water Filter/.test(hits[0]),
  'searching narrows to the thing you asked for', `${hits.length} hits, first "${hits[0] || 'none'}"`);
check(await page.locator('text=Bucket Bio-Sand Filter').count() > 0,
  'and the build instructions come with it');

// ── 4. the file it hands you ───────────────────────────────────────────────
await page.fill('input[type="search"]', '');
await page.waitForTimeout(200);
const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.click('text=HTML'),
]);
const saved = readFileSync(await dl.path(), 'utf8');
check(dl.suggestedFilename() === 'survivors-encyclopedia.html',
  'saving hands over a named file', dl.suggestedFilename());
check(saved.length > 30000, 'containing the whole book', `${(saved.length / 1024).toFixed(1)} KB`);
check(!/https?:\/\//i.test(saved) && !/<script/i.test(saved),
  'that reaches for nothing and runs nothing');
check(/Figure-4 Deadfall/.test(saved) && /Bloomery Furnace/.test(saved) && /Sourdough/.test(saved),
  'from A to Z');

// ── 5. it stays found ──────────────────────────────────────────────────────
await page.goto(`${base}/asdf`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Page Not Found', { timeout: 25000 });
await page.waitForTimeout(800);
const link = page.locator("button", { hasText: "THE SURVIVOR'S ENCYCLOPEDIA" });
check(await link.count() === 1, 'once found, it is on the 404 page from then on — no game required');
await link.click();
await page.waitForTimeout(1200);
check(await page.locator('input[type="search"]').count() === 1,
  'and one tap reopens it');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
