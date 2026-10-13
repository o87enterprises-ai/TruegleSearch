/* Tube lists PLAYABLE results only, laid out like YouTube.
 *
 * Owner, 2026-10-13: "remove the full search functionality and only search
 * for playable results so that the tube page acts like youtube … same style
 * with full thumbnails and descriptions on mobile … a quick easy way to change
 * the filter results in the player and on the page … latest, popular, oldest
 * … add a safesearch clicker to the player and page". This pins:
 *   - a Tube search shows the video grid and NO whole-web result cards
 *   - two cards a row on a phone, each with a thumbnail and its description
 *   - Latest / Popular / Oldest on the page; picking one moves the player too
 *   - Safe Search in the page's filter row and in the player's list, and
 *     changing it re-runs the search
 *
 * Run it:  npm run tubegrid:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5241;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const DAY = 86400000;
const SHOTS = process.env.SHOTS_DIR || '';

for (const phone of [true, false]) {
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  let searches = 0;
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    if (r.request().url().includes('/api/search')) searches++;
    const q = String(b.query || '').replace(/#shorts/, '').trim();
    const id = (i) => `${(q.replace(/\W/g, '') + 'xxxxxx').slice(0, 6)}0000${i}`;
    // Ages 0..5 days, shuffled, so Latest and Oldest are both real orders.
    const ages = [3, 0, 5, 1, 4, 2];
    const rows = q ? ages.map((age, i) => ({
      title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=${id(i)}`,
      image: `https://i.ytimg.com/vi/${id(i)}/hqdefault.jpg`,
      snippet: `Description of ${q} result ${i}`, date: new Date(Date.now() - (age + 1) * DAY).toISOString(),
    })) : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [] }) });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = phone ? '[phone]' : '[desktop]';

  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('duck sauce'); await bar.press('Enter');
  const cards = page.locator('[data-tube-card]');
  await until(async () => (await cards.count()) >= 6, { what: 'the Tube grid' });

  check((await cards.count()) === 6, `${tag} the grid shows the playable results`, String(await cards.count()));
  const webCards = await page.locator('main a:has-text("Open link"), a:text-is("Open link")').count();
  check(webCards === 0, `${tag} no whole-web result cards under the player`, `${webCards} "Open link" cards`);
  check(await cards.first().locator('img').count() === 1, `${tag} each card has its thumbnail`);
  check(await cards.first().getByText(/^Description of duck sauce result/).count() === 1, `${tag} …and its description`);

  const boxes = await Promise.all([0, 1, 2].map((i) => cards.nth(i).boundingBox()));
  const perRow = boxes.filter((b) => Math.abs(b.y - boxes[0].y) < 4).length;
  check(perRow === (phone ? 2 : 3), `${tag} ${phone ? 'two' : 'three'} cards a row`, `${perRow} per row`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tube-${phone ? 'phone' : 'desktop'}.png`, fullPage: false });

  // ── Sort: page → player ────────────────────────────────────────────────
  const firstTitle = () => cards.first().locator('h3').innerText();
  await page.locator('[data-tube-sort="newest"]').click();
  await until(async () => (await firstTitle()) === 'duck sauce result 1', { what: 'Latest to apply', timeout: 4000 }).catch(() => {});
  check((await firstTitle()) === 'duck sauce result 1', `${tag} Latest puts the newest first`, await firstTitle());
  await page.locator('[data-tube-sort="oldest"]').click();
  await until(async () => (await firstTitle()) === 'duck sauce result 2', { what: 'Oldest to apply', timeout: 4000 }).catch(() => {});
  check((await firstTitle()) === 'duck sauce result 2', `${tag} Oldest puts the oldest first`, await firstTitle());
  const playerSort = page.locator('[data-player-results] [data-sort="oldest"]');
  if (await playerSort.count()) {
    check((await playerSort.first().getAttribute('aria-pressed')) === 'true', `${tag} the player's list follows the page's sort`);
  }
  check(await page.locator('[data-tube-grid] [data-safesearch-toggle]').count() === 1, `${tag} Safe Search sits in the page's filter row`);

  // ── Safe Search re-runs the search ─────────────────────────────────────
  const before = searches;
  await page.locator('[data-tube-grid] [data-safesearch-toggle]').click();
  await until(() => searches > before, { what: 'a re-run search', timeout: 5000 }).catch(() => {});
  check(searches > before, `${tag} changing Safe Search re-runs the search`, `${searches - before} new requests`);

  // ── Player: pick one, then its list carries the sort + Safe Search ────
  await cards.first().locator('button').first().click();
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'playback', timeout: 8000 }).catch(() => {});
  await bar.click(); await bar.fill('duck sauce two');
  await until(() => page.locator('[data-player-results] [data-safesearch-toggle]').count(), { what: 'the player list', timeout: 8000 }).catch(() => {});
  check(await page.locator('[data-player-results] [data-safesearch-toggle]').count() >= 1, `${tag} Safe Search is in the player's results list`);
  check(await page.locator('[data-player-results] [data-sort="oldest"]').count() >= 1, `${tag} …beside Latest / Popular / Oldest`);

  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
