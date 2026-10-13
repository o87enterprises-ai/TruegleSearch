/* A new visitor does not run out of "Up next".
 *
 * Owner, 2026-10-13: "a new user gets about 12 videos on a loop and that's way
 * too repetitive." The opening deck was 12 cards; tapping one started a feed of
 * the rest, and once that feed was spent manual Next did NOTHING (it stayed put
 * to protect a parked queue — even when no queue existed). Measured against the
 * live pool before the fix: 40 presses of Next → 12 distinct videos, then frozen.
 *
 * Pins, with a pool of 80 videos:
 *   1. a brand-new browser: the opening deck is bigger than 12, 40 presses of
 *      Next reach well over 12 distinct videos, and it never sits on one video
 *   2. a queue PARKED behind a spent feed is still left alone — that rule is the
 *      reason the stay-put branch exists, and the fix must not break it
 *
 * Run it:  npm run upnext:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5262;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();

const POOL = Array.from({ length: 80 }, (_, i) => {
  const id = `pool${String(i).padStart(7, '0')}`;
  return { mediaKey: `youtube:${id}`, kind: 'youtube', title: `Pool video ${i}`, pageUrl: `https://www.youtube.com/watch?v=${id}`, poster: '', channel: `Chan ${i}`, ups: 1, downs: 0, score: 0.3 - i / 1000 };
});
const SEARCH_IDS = [0, 1, 2, 3].map((i) => `row0000000${i}`);

// A fresh browser profile per scenario — the "seen" ledger is remembered in
// localStorage, so sharing one would hand the second scenario a used-up pool.
async function openFresh() {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  await ctx.route('**/api/**', (r) => {
    const url = new URL(r.request().url());
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.endsWith('/api/media/trending')) {
      const limit = Number(url.searchParams.get('limit')) || 20;
      const offset = Number(url.searchParams.get('offset')) || 0;
      const skip = new Set((url.searchParams.get('exclude') || '').split(',').filter(Boolean));
      return json({ success: true, results: POOL.filter((p) => !skip.has(p.mediaKey)).slice(offset, offset + limit) });
    }
    if (url.pathname.endsWith('/api/search')) {
      return json({ success: true, data: [], results: SEARCH_IDS.map((id, i) => ({ title: `Search row ${i}`, url: `https://www.youtube.com/watch?v=${id}`, image: '', snippet: 'd' })) });
    }
    return json({ success: true, results: [], data: [], videos: [] });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `http://localhost:${PORT}/tube`);
  return { ctx, page };
}

const errs = [];
const cur = (page) => page.evaluate(() => document.querySelector('iframe[src*="youtube"]')?.src?.match(/embed\/([\w-]+)/)?.[1] || null);
const press = async (page, n) => {
  const seen = [];
  for (let i = 0; i < n; i++) {
    seen.push(await cur(page));
    await page.locator('[aria-label="Next"]').first().dispatchEvent('click');
    await until(async () => (await cur(page)) !== seen[i], { what: `press ${i + 1}`, timeout: 2500 }).catch(() => {});
  }
  return seen.filter(Boolean);
};
const longestRun = (list) => {
  let run = 1; let worst = 1;
  for (let i = 1; i < list.length; i++) { run = list[i] === list[i - 1] ? run + 1 : 1; worst = Math.max(worst, run); }
  return worst;
};

// ── 1. a brand-new visitor, nothing queued ───────────────────────────────────
{
  const { ctx, page } = await openFresh();
  await until(async () => (await page.locator('[data-browse-actions]').count()) > 0, { what: 'the opening deck' });
  const deck = await page.locator('[data-browse-actions]').count();
  check(deck > 12, 'the opening deck is more than 12 cards', String(deck));
  await page.locator('[data-browse-action="play"]').first().dispatchEvent('click');
  await until(async () => !!(await cur(page)), { what: 'playback to start' });
  const seen = await press(page, 40);
  const distinct = new Set(seen).size;
  check(distinct >= 30, '40 presses of Next reach well over 12 distinct videos', `${distinct} distinct`);
  check(longestRun(seen) < 3, 'it never sits on one video for several presses', `longest run ${longestRun(seen)}`);
  await ctx.close();
}

// ── 2. a queue parked behind a spent feed is left alone ──────────────────────
{
  const { ctx, page } = await openFresh();
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('queue me'); await bar.press('Enter');
  const add = page.locator('[data-tube-grid] [aria-label^="Add "]');
  await until(async () => (await add.count()) >= 3, { what: 'the Tube grid' });
  // Idle player: the first Add plays it, the second is genuinely queued.
  await add.nth(0).dispatchEvent('click');
  await until(async () => !!(await cur(page)), { what: 'the first add to play' });
  await add.nth(1).dispatchEvent('click');
  // Now start a one-clip feed from the grid: the queue is parked behind it, and
  // the feed is spent at once.
  await page.locator('[data-tube-card]').nth(3).locator('button[aria-label^="Play "]').dispatchEvent('click');
  await until(async () => (await cur(page)) === SEARCH_IDS[3], { what: 'the feed clip to play' });
  const seen = await press(page, 8);
  check(seen.every((k) => k === SEARCH_IDS[3]), 'a spent feed with a queue parked behind it stays put', seen.join(' '));
  check(!seen.includes(SEARCH_IDS[1]), '…and does not tip into the parked queue');
  check(!seen.some((k) => k.startsWith('pool')), '…and does not wander off into discovery');
  await ctx.close();
}

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
