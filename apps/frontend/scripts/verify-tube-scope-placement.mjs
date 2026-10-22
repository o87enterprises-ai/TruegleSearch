/* Tube's categories (All, Shorts, Track…) sit ABOVE the search bar, and the
 * full-screen search bar offers them as one compact dropdown.
 * Run it:  node scripts/verify-tube-scope-placement.mjs
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, d = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${d ? ` — ${d}` : ''}`);
const PORT = 5296;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();
const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(`localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now())); localStorage.setItem('truegle_swipe_hint_seen_v2', '1');`);
await ctx.route('**/api/**', (r) => {
  let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
  const q = String(b.query || 'x');
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: Array.from({ length: 4 }, (_, i) => ({ title: `${q} clip ${i}`, url: `https://www.youtube.com/watch?v=scope${String(i).padStart(6, '0')}` })) }) });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await openApp(page, `http://localhost:${PORT}/tube`);
const bar = page.locator('[aria-label="Search input"]:visible').first();
await until(() => bar.count(), { what: 'the Tube bar' });

const chips = page.locator('[data-tube-scope-bar]');
check(await chips.count() === 1, 'exactly one category row on Tube', `${await chips.count()}`);
const chipBox = await chips.first().boundingBox();
const barBox = await bar.boundingBox();
check(!!chipBox && !!barBox && chipBox.y + chipBox.height <= barBox.y + 2, 'the categories sit above the search bar', `chips bottom ${Math.round(chipBox?.y + chipBox?.height)} / bar top ${Math.round(barBox?.y)}`);
await page.screenshot({ path: process.env.SHOT || '/tmp/tube-scope.png' });

// Play something, go full screen, open the drop-down bar.
await bar.click(); await bar.fill('cats'); await bar.press('Enter');
const playNow = page.locator('[aria-label="Play cats clip 0 now"]').first();
await until(() => playNow.count(), { what: 'results' });
await playNow.dispatchEvent('click');
await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'playing' });
await page.locator('[aria-label="Full screen"]:visible').first().click();
await page.waitForTimeout(600);
await page.locator('[aria-label="Show the search bar"]').first().click();
const sel = page.locator('[data-fs-scope]');
await until(() => sel.count(), { what: 'the full-screen category dropdown', timeout: 3000 }).catch(() => {});
check(await sel.count() === 1, 'the full-screen search bar has a category dropdown');
const opts = await sel.locator('option').allInnerTexts();
check(opts.join(',') === 'All,Shorts,Channel,Track,Artist,Title,Topic', '…listing the same categories', opts.join(','));
await sel.selectOption('shorts');
check(await sel.inputValue() === 'shorts', '…and picking one sticks', await sel.inputValue());
check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
await ctx.close(); await browser.close(); await server.close();
console.log(ok.concat(bad).join('\n')); console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
