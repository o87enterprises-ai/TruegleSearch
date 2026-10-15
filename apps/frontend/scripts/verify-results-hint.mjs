/* After a search on Tube the player's list stays RETRACTED and a strip under the
 * controls points at the results grid below (owner, 2026-10-15: "make the
 * default state of the playlist drop down retracted so the user is inclined to
 * view the results below the player, and add some form of arrow or indicator").
 *
 *   npm run resultshint:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5242;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const DAY = 86400000;
const SHOTS = process.env.SHOTS_DIR || '';


for (const phone of [true, false]) {
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').replace(/#shorts/, '').trim();
    const id = (i) => `${(q.replace(/\W/g, '') + 'xxxxxx').slice(0, 6)}0000${i}`;
    const rows = q ? [0, 1, 2, 3, 4, 5].map((i) => ({
      title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=${id(i)}`,
      image: `https://i.ytimg.com/vi/${id(i)}/hqdefault.jpg`,
      snippet: `Description of ${q} result ${i}`, date: new Date(Date.now() - (i + 1) * DAY).toISOString(),
    })) : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [] }) });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = phone ? '[phone]' : '[desktop]';
  const hint = page.locator('[data-player-results-hint]');
  const list = page.locator('[data-player-results]');
  const cards = page.locator('[data-tube-card]');

  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('duck sauce'); await bar.press('Enter');
  await until(async () => (await cards.count()) >= 6, { what: 'the Tube grid' });
  // Start something playing, so this is the "after a search, while playing" case.
  await cards.first().locator('button').first().click();
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'playback', timeout: 8000 }).catch(() => {});
  await page.evaluate('window.scrollTo(0, 0)');

  // A second search, with the player busy.
  await bar.click(); await bar.fill('duck sauce two'); await bar.press('Enter');
  // The strip is there from the first search on, so wait for THIS query's text.
  await until(async () => (await hint.innerText().catch(() => '')).includes('duck sauce two'), { timeout: 8000, what: 'the results hint for the new query' }).catch(() => {});
  check(await list.count() === 0, `${tag} a search leaves the player's list retracted`);
  check(await hint.count() === 1, `${tag} a strip under the controls points at the results`);
  check((await hint.innerText()).includes('duck sauce two'), `${tag} …and names the query`, (await hint.innerText()).trim());
  check(await hint.locator('svg').count() >= 1, `${tag} …with an arrow`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/hint-${phone ? 'phone' : 'desktop'}.png` });

  // Pressing it takes you to the grid, and it stands down once you can see it.
  await hint.click();
  await until(async () => (await hint.getAttribute('data-seen')) === 'yes', { timeout: 5000, what: 'the hint to quieten' }).catch(() => {});
  const gridTop = await page.evaluate("document.querySelector('[data-tube-grid]').getBoundingClientRect().top");
  check(gridTop < (phone ? 844 : 800) - 96, `${tag} pressing it scrolls the results into view`, `grid top ${Math.round(gridTop)}px`);
  check((await hint.getAttribute('data-seen')) === 'yes', `${tag} …and the hint quietens (stops bouncing) once they are showing`);

  // Back up top, it returns; the list is still one press away.
  await page.evaluate('window.scrollTo(0, 0)');
  await until(async () => (await hint.getAttribute('data-seen')) === null, { timeout: 5000, what: 'the hint to return' }).catch(() => {});
  check(await hint.count() === 1 && (await hint.getAttribute('data-seen')) === null, `${tag} scrolling back up makes it loud again`);
  await page.locator('button[aria-label="Queue and results"]:visible').first().click();
  await until(() => list.count(), { timeout: 5000, what: 'the list' }).catch(() => {});
  check(await list.count() >= 1, `${tag} the list button still opens the list`);
  check(await hint.count() === 0, `${tag} …and the hint steps aside while it is open`);

  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
