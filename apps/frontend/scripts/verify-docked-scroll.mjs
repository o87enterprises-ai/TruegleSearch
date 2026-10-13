/* The docked Tube player scrolls WITH the page — no trailing, no resizing.
 *
 * Owner, 2026-10-13: "search bar docked tube player seems really glitchy when
 * scrolling the entire page." The docked frame was position:fixed and chased
 * the page's slot from a scroll listener, so it always trailed by a frame, and
 * its size caps were computed from the slot's live on-screen position, so the
 * player's own size changed as you scrolled. Measured before the fix (phone):
 * after a 100px scroll the slot was at top 224 and the player still at 324;
 * --truegle-player-cap climbed 401 → 901 across the same scroll.
 *
 * Pins, on a phone and on a desktop, with media playing:
 *   - read IMMEDIATELY after each scroll (before any handler could run), the
 *     player sits exactly on its slot
 *   - the player's height and its size cap do not change with scroll position
 *   - scrolling does not re-render the player (no work done per scroll tick)
 *
 * Run it:  npm run dockedscroll:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5271;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();

for (const phone of [true, false]) {
  const tag = phone ? '[phone]' : '[desktop]';
  const ctx = await testContext(browser, phone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));localStorage.setItem('truegle_swipe_hint_seen','1');");
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').trim();
    const rows = q ? Array.from({ length: 20 }, (_, i) => ({
      title: `${q} r${i}`, url: `https://www.youtube.com/watch?v=scrl00000${String(i).padStart(2, '0')}`,
      image: '', snippet: 'a description '.repeat(6),
    })) : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: rows, data: [], videos: [] }) });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `http://localhost:${PORT}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('scroll test'); await bar.press('Enter');
  await until(async () => (await page.locator('[data-tube-card]').count()) >= 6, { what: 'the grid' });
  await page.locator('[data-tube-card] button[aria-label^="Play "]').first().dispatchEvent('click');
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'playback' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await until(async () => (await page.evaluate(() => !!document.querySelector('[data-mini]'))), { what: 'the docked frame' });

  const snap = () => page.evaluate(() => {
    const slot = document.querySelector('[data-player-slot]')?.getBoundingClientRect();
    const fr = document.querySelector('[data-mini]')?.getBoundingClientRect();
    return {
      y: Math.round(window.scrollY), slotTop: slot ? slot.top : NaN, frameTop: fr ? fr.top : NaN, frameH: fr ? Math.round(fr.height) : NaN,
      cap: getComputedStyle(document.documentElement).getPropertyValue('--truegle-player-cap'),
    };
  });
  await page.waitForTimeout(400);                       // let the first layout settle
  const base = await snap();
  let worstGap = 0; let heights = new Set([base.frameH]); let caps = new Set([base.cap]); let moved = 0;

  // Count React renders of the player during pure scrolling via a MutationObserver
  // on the frame's attributes (its inline style is rewritten on every re-position).
  await page.evaluate(() => {
    window.__styleWrites = 0;
    new MutationObserver((m) => { window.__styleWrites += m.length; })
      .observe(document.querySelector('[data-mini]'), { attributes: true, attributeFilter: ['style'] });
  });

  for (const y of [120, 260, 400, 560, 700, 400, 120, 0]) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    const s = await snap();                             // immediately, no waiting
    if (s.y !== base.y) moved += 1;
    worstGap = Math.max(worstGap, Math.abs(s.frameTop - s.slotTop));
    heights.add(s.frameH); caps.add(s.cap);
  }
  await page.waitForTimeout(500);
  const writes = await page.evaluate(() => window.__styleWrites);

  check(moved >= 5, `${tag} the page really scrolled`, `${moved} of 8 steps moved`);
  check(worstGap <= 1, `${tag} read right after a scroll, the player sits on its slot`, `worst gap ${worstGap.toFixed(1)}px`);
  check(heights.size === 1, `${tag} the player's height does not change as you scroll`, [...heights].join(','));
  check(caps.size === 1, `${tag} its size cap does not change as you scroll`, [...caps].join(','));
  check(writes === 0, `${tag} scrolling does no work on the player`, `${writes} style rewrites`);
  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
