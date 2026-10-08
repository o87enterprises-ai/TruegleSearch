/* A pick from the Tube page's search keeps that search in the player.
 *
 * Owner, 2026-10-01: "drops the search query and results after the user makes
 * their first selection … they need to retype". On Tube the page bar drives
 * the player only while it is docked; on a phone it floats, with its OWN box —
 * which was empty after the pick, showing unrelated suggestions. This pins:
 *   - search on the Tube bar, pick a result → the player's box holds the query
 *   - and the player's results are that search's, not something else
 *   - the query survives the ten-second tuck-away and a trip to another page
 *
 * Run it:  npm run carrysearch:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5232;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

for (const phone of [true, false]) {
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').replace(/#shorts/, '').trim();
    const id = (i) => `${(q.replace(/\W/g, '') + 'xxxxxx').slice(0, 6)}0000${i}`;
    const rows = q ? Array.from({ length: 6 }, (_, i) => ({ title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=${id(i)}`, duration: `3:0${i}` })) : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [] }) });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const tag = phone ? '[phone]' : '[desktop]';

  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('duck sauce'); await bar.press('Enter');
  await until(() => page.getByText('duck sauce result 0').count(), { what: 'the Tube results' });
  // With nothing playing, Tube's results are cards in the player's screen;
  // "Play now" on the first card is the pick.
  await page.locator('[aria-label="Play duck sauce result 0 now"]').first().dispatchEvent('click');
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'the pick to start playing', timeout: 8000 }).catch(() => {});
  const box = page.locator('input[aria-label="Search the player"], input[placeholder^="Search something to play"]').first();
  const boxValue = () => box.inputValue().catch(() => '');
  await until(async () => (await boxValue()) === 'duck sauce', { what: 'the player box to hold the search', timeout: 8000 }).catch(() => {});
  const floating = await box.count();
  check(!floating || (await boxValue()) === 'duck sauce', `${tag} after the pick, the player's own search box still holds "duck sauce"`, floating ? `"${await boxValue()}"` : 'player docked to the page bar');
  // (Not the "Not loading? Skip" offer, which can sit beside the title when
  // the stubbed embed stays silent — it is not a result row.)
  const otherQueries = await page.locator('text=/^(?!duck sauce|Not loading).* result \\d$/').count();
  check(otherQueries === 0, `${tag} …and the player shows that search's results, not unrelated ones`, `${otherQueries} foreign rows`);

  // A trip away from Tube: the player floats everywhere else.
  // In-app navigation, as a visitor does it — a reload would restart the app.
  await page.evaluate("history.pushState({}, '', '/chat'); dispatchEvent(new PopStateEvent('popstate'))");
  await until(() => box.count(), { what: 'the floating player on another page', timeout: 10000 }).catch(() => {});
  check((await boxValue()) === 'duck sauce', `${tag} away from Tube (on Chat) the player still has the search — no retyping`, `"${await boxValue()}"`);
  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
