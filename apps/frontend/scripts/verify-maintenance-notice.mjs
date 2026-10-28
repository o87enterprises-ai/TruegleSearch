/* The landing-page notice says Truegle is LIVE, not down.
 *
 * Owner, 2026-10-28: visitors read "Site under maintenance" as "the site is
 * down" and left. The title now says it is live during updates, the button says
 * "Continue to Truegle", the known issues are listed, and it must fit a phone.
 *
 * Run it:  npm run maintenance:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5317;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

for (const [name, opts] of [['phone', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1280, height: 800 } }]]) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/`);
  const dialog = page.locator('[data-maintenance-notice] [role="dialog"]');
  await until(() => dialog.count(), { what: 'the notice' });
  check((await dialog.locator('h2').innerText()).trim() === 'Truegle is live during updates', `${name}: the title says Truegle is live during updates`);
  const button = dialog.locator('button');
  check((await button.innerText()).trim() === 'Continue to Truegle', `${name}: the button says "Continue to Truegle"`);
  check(await dialog.locator('[data-maintenance-issues] li').count() === 2, `${name}: both known issues are listed`);
  const text = await dialog.innerText();
  check(/some features may be slow, missing or not\s+working/.test(text) && /search itself should still work/.test(text), `${name}: the original message is still there`);
  const box = await dialog.boundingBox();
  const vh = opts.viewport.height;
  check(box && box.y >= 0 && box.y + box.height <= vh + 1, `${name}: the whole card fits on screen`, `${Math.round(box?.y)}+${Math.round(box?.height)} of ${vh}`);
  if (name === 'phone') await page.screenshot({ path: process.argv[2] || '/tmp/maintenance-phone.png' });
  await button.click();
  await until(async () => (await page.locator('[data-maintenance-notice]').count()) === 0, { what: 'the notice to close' });
  check(await page.locator('[data-maintenance-notice]').count() === 0, `${name}: the button closes it`);
  check(errs.length === 0, `${name}: nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
