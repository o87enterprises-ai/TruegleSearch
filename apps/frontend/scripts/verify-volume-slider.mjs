/* The volume slider must stay open while you reach for it (owner, 2026-10-15:
 * "the volume bar opens but when you move your finger or mouse to adjust it,
 * the bar retracts before you can make an adjustment").
 *
 * Mouse: hover the button, travel to the slider, and drag it — it must survive
 * the trip and the drag. Touch: tap the button, then tap the slider — it must
 * still be there and the level must change.
 *
 *   npm run volumeslider:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5207;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const ID = 'volAAAAAAA1';

async function open(opts) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#000"></body></html>' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}/tube?u=${encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`)}`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the share gate' });
  await page.locator('[data-share-gate]').click();
  await page.evaluate('if (document.fullscreenElement) document.exitFullscreen()').catch(() => {});
  const btn = page.locator('[data-mini] button[aria-label^="Volume"], [data-mini] button[aria-label="Unmute"]').first();
  await until(() => btn.count(), { what: 'the volume button' });
  const slider = page.locator('[data-mini] input[type="range"][aria-label="Volume"]');
  return { ctx, page, errs, btn, slider };
}

// ── mouse ───────────────────────────────────────────────────────────────────
{
  const { ctx, page, errs, btn, slider } = await open({ viewport: { width: 1280, height: 800 } });
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await until(() => slider.count(), { timeout: 3000, what: 'the slider to open on hover' }).catch(() => {});
  check(await slider.count() === 1, 'hovering the volume button opens the slider');

  // Travel to the slider the slow way a hand does, in small steps.
  const s = await slider.boundingBox();
  const tx = s.x + s.width * 0.3; const ty = s.y + s.height / 2;
  const sx = b.x + b.width / 2; const sy = b.y + b.height / 2;
  for (let i = 1; i <= 20; i += 1) await page.mouse.move(sx + ((tx - sx) * i) / 20, sy + ((ty - sy) * i) / 20);
  check(await slider.count() === 1, 'the slider is still open after moving the mouse onto it');

  const before = await slider.inputValue().catch(() => '');
  await page.mouse.down();
  await page.mouse.move(s.x + s.width * 0.8, ty, { steps: 8 });
  // Drag well outside the popup, as a real drag does — it must not retract.
  await page.mouse.move(s.x + s.width * 0.8, ty - 60, { steps: 5 });
  check(await slider.count() === 1, 'the slider stays open while dragging, even off its edge');
  await page.mouse.up();
  const after = await slider.inputValue().catch(() => '');
  check(before !== after, 'dragging changes the volume', `${before} → ${after}`);

  // A click on the button while it is hovered open must not close it.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.up();
  check(await slider.count() === 1, 'clicking the hovered button (mute) does not snap the slider shut');

  await page.mouse.move(5, 5, { steps: 4 });
  await until(async () => !(await slider.count()), { timeout: 3000, what: 'the slider to close' }).catch(() => {});
  check(await slider.count() === 0, 'moving away closes it again');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── touch ───────────────────────────────────────────────────────────────────
{
  const { ctx, page, errs, btn, slider } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const b = await btn.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await until(() => slider.count(), { timeout: 3000, what: 'the slider to open on tap' }).catch(() => {});
  check(await slider.count() === 1, 'tapping the volume button opens the slider');
  await page.waitForTimeout(1500);
  check(await slider.count() === 1, '…and it stays open (nothing retracts it)');
  const s = await slider.boundingBox();
  const before = await slider.inputValue().catch(() => '');
  await page.touchscreen.tap(s.x + s.width * 0.25, s.y + s.height / 2);
  check(await slider.count() === 1, 'tapping the slider does not close it');
  const after = await slider.inputValue().catch(() => '');
  check(before !== after, 'tapping the slider changes the volume', `${before} → ${after}`);
  await page.touchscreen.tap(20, 300);
  await until(async () => !(await slider.count()), { timeout: 3000, what: 'the slider to close' }).catch(() => {});
  check(await slider.count() === 0, 'tapping elsewhere closes it');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

await browser.close();
await server.close();
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
