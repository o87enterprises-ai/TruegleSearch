/* Chat's "In app" preview has a full screen and a way back.
 *
 * Owner, 2026-10-17: "in chat, Open in app — can you add a full screen and
 * minimize / escape flow?" The search results' preview has had one since
 * 2026-10-10; chat's Sources opened a bare frame with none of it.
 *
 *   - In app opens a preview with a header bar: Open link, Full screen, ✕
 *   - Full screen covers the whole viewport; the page behind cannot scroll
 *   - Escape minimizes: back to the small frame, still open
 *   - Minimize does the same by button (a phone has no Escape key)
 *   - ✕ closes the preview, including from full screen, and "In app" is back
 *   - every control is on screen on a phone, too
 *
 * Run it:  npm run chatpreview:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5321;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const SOURCE = 'https://example.org/thc-explained';

async function run(label, opts) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  await ctx.route('**/api/search', (r) => r.fulfill({ json: { success: true, results: [
    { title: 'THC explained: effects and uses', url: SOURCE, snippet: 'What THC is and what it does', domain: 'example.org', category: 'web' },
  ] } }));
  await ctx.route('**/api/ai/chat', (r) => r.fulfill({ json: { success: true, response: 'THC is the main psychoactive compound in cannabis.' } }));
  await ctx.route('**/example.org/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="font:20px sans-serif">the article</body></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/chat`);

  const box = page.locator('textarea').first();
  await until(() => box.count(), { what: 'the chat box' });
  await box.fill('what is thc');
  await box.press('Enter');
  const inApp = page.getByRole('button', { name: 'In app', exact: true });
  await until(() => inApp.count(), { what: 'the In app button on the answer\'s source', timeout: 15000 });
  await inApp.first().dispatchEvent('click');

  const inline = page.locator('[data-viewer-inline]');
  const overlay = page.locator('[data-viewer-fullscreen-open]');
  await until(() => inline.count(), { what: 'the inline preview' });
  check(await page.locator('[data-viewer-fullscreen]').count() === 1 && await page.locator('[data-viewer-close]').count() === 1,
    `${label}: the preview has a Full screen and a ✕ in its header`);
  check(await page.locator(`iframe[src="${SOURCE}"]`).count() === 1, `${label}: it shows the page`);

  // Full screen
  await page.locator('[data-viewer-fullscreen]').dispatchEvent('click');
  await until(() => overlay.count(), { what: 'full screen to open' });
  const vp = page.viewportSize();
  const b = await overlay.boundingBox();
  check(b && b.width >= vp.width - 2 && b.height >= vp.height - 2, `${label}: Full screen covers the whole viewport`, b ? `${Math.round(b.width)}x${Math.round(b.height)}` : 'none');
  check(await page.evaluate('document.body.style.overflow') === 'hidden', `${label}: the page behind cannot scroll`);
  for (const [sel, name] of [['[data-viewer-fullscreen-open] [data-viewer-fullscreen]', 'Minimize'], ['[data-viewer-fullscreen-open] [data-viewer-close]', '✕']]) {
    const r = await page.locator(sel).boundingBox();
    check(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= vp.width && r.y + r.height <= vp.height, `${label}: ${name} is on screen in full screen`);
    // On screen is not enough: the page's own fixed clock chip and menu button
    // used to float OVER the bar and hide these. The clock is pointer-events:
    // none, so elementFromPoint ignores it — the test has to look for anything
    // fixed, visible and stacked ABOVE the overlay that overlaps the button.
    // An expression string: this file is linted as node, but it runs in the page.
    const coveredBy = await page.evaluate(`((x, y, w, h) => {
      const overlay = document.querySelector('[data-viewer-fullscreen-open]');
      const z = (el) => parseInt(getComputedStyle(el).zIndex, 10) || 0;
      const oz = z(overlay);
      return [...document.querySelectorAll('body *')]
        .filter((el) => !overlay.contains(el) && el !== overlay && getComputedStyle(el).position === 'fixed' && z(el) > oz)
        .filter((el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0; })
        .filter((el) => { const q = el.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.left < x + w && q.right > x && q.top < y + h && q.bottom > y; })
        .map((el) => el.tagName.toLowerCase() + ' (z ' + z(el) + ')');
    })(${r.x}, ${r.y}, ${r.width}, ${r.height})`);
    const topmost = coveredBy.length === 0;    check(topmost, `${label}: ${name} is not covered by anything above the overlay`, coveredBy.join(', ') || 'nothing above it');
  }
  check(await page.locator(`[data-viewer-fullscreen-open] iframe[src="${SOURCE}"]`).count() === 1, `${label}: …showing the same page`);

  // Escape minimizes (desktop keyboards)
  if (!opts.isMobile) {
    await page.keyboard.press('Escape');
    await until(() => overlay.count().then((n) => n === 0), { what: 'Escape to minimize' });
    check(await inline.count() === 1 && await page.locator(`iframe[src="${SOURCE}"]`).count() === 1, `${label}: Escape minimizes — the preview is still open`);
    check(await page.evaluate('document.body.style.overflow') !== 'hidden', `${label}: …and the page scrolls again`);
    await page.locator('[data-viewer-fullscreen]').dispatchEvent('click');
    await until(() => overlay.count(), { what: 'full screen again' });
  }

  // Minimize by button
  await page.locator('[data-viewer-fullscreen-open] [data-viewer-fullscreen]').dispatchEvent('click');
  await until(() => overlay.count().then((n) => n === 0), { what: 'Minimize to work' });
  check(await inline.count() === 1, `${label}: the Minimize button returns to the small frame`);

  // ✕ from full screen closes everything
  await page.locator('[data-viewer-fullscreen]').dispatchEvent('click');
  await until(() => overlay.count(), { what: 'full screen a third time' });
  await page.locator('[data-viewer-fullscreen-open] [data-viewer-close]').dispatchEvent('click');
  await until(() => overlay.count().then((n) => n === 0), { what: '✕ to close' });
  check(await inline.count() === 0 && await page.locator(`iframe[src="${SOURCE}"]`).count() === 0, `${label}: ✕ closes the preview, even from full screen`);
  check(await page.evaluate('document.body.style.overflow') !== 'hidden', `${label}: …leaving the page scrollable`);
  check(await inApp.count() >= 1, `${label}: the source offers In app again`);
  check(errs.length === 0, `${label}: nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

await run('desktop', { viewport: { width: 1366, height: 820 } });
await run('phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
