/* The Tube player on an iPhone.
 *
 * Owner, 2026-10-14: "none of the full screen buttons and a lot of the other
 * buttons are getting hung and not actually firing … this doesn't happen on
 * Android just iPhone". Two separate causes, both iOS-only:
 *
 *   1. iPhone Safari has NO element full screen — requestFullscreen exists on
 *      iPad only. The button called `el.requestFullscreen?.()`, which on an
 *      iPhone is undefined, so the press did nothing. The player now falls
 *      back to a fixed box covering the screen.
 *   2. iOS spends a tap on :hover first, and if a hover handler or hover style
 *      REVEALS something, Safari treats the tap as that hover and never sends
 *      the click. The volume button opened its slider on mouseenter; Tube
 *      cards faded a play badge in on group-hover. Both now need a real hover.
 *
 * Playwright's WebKit is not installed here, so this runs Chromium with the
 * iPhone's missing API removed. (2) cannot be reproduced in Chromium, which
 * has no hover-tap rule — what is pinned is that a tap no longer goes through
 * hover at all.
 *
 * Run it:  npm run iphone:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5293;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const W = 390; const H = 844;
const ctx = await testContext(browser, {
  viewport: { width: W, height: H },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript(`
  delete Element.prototype.requestFullscreen;
  delete Element.prototype.webkitRequestFullscreen;
  delete Document.prototype.exitFullscreen;
  delete Document.prototype.webkitExitFullscreen;
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  localStorage.setItem('truegle_swipe_hint_seen', '1');
  localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
await ctx.route('**/api/**', (r) => {
  let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
  const q = String(b.query || '').trim();
  const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (new URL(r.request().url()).pathname === '/api/search' && q && b.filters?.category === 'videos') {
    return json({ success: true, results: Array.from({ length: 6 }, (_, i) => ({ title: `${q} video ${i}`, url: `https://www.youtube.com/watch?v=iphone${String(i).padStart(5, '0')}`, duration: `3:0${i}` })) });
  }
  return json({ success: true, data: [], results: [] });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await openApp(page, `${BASE}/tube`);

check(await page.evaluate('typeof document.body.requestFullscreen') === 'undefined',
  'the page sees what an iPhone has: no requestFullscreen');

const bar = page.locator('[aria-label="Search input"]:visible').first();
await until(() => bar.count(), { what: 'the Tube bar' });
await bar.click(); await bar.fill('warm up'); await bar.press('Enter');
const playNow = page.locator('[aria-label="Play warm up video 0 now"]').first();
await until(() => playNow.count(), { what: 'results' });
await playNow.dispatchEvent('click');
await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'something playing' });
await page.waitForTimeout(800);

// ── full screen ───────────────────────────────────────────────────────────
const enter = page.locator('[aria-label="Full screen"]:visible').first();
await until(() => enter.count(), { what: 'the Full screen button' });
const inlineBox = await page.locator('[data-player-root]').first().boundingBox();
await enter.tap();
await until(() => page.locator('[data-pseudo-fullscreen]').count(), { what: 'full screen', timeout: 3000 }).catch(() => {});
check(await page.locator('[data-pseudo-fullscreen]').count() === 1, 'a tap on Full screen goes full screen on an iPhone');

const fsBox = await page.locator('[data-pseudo-fullscreen]').first().boundingBox().catch(() => null);
check(!!fsBox && Math.round(fsBox.x) === 0 && Math.round(fsBox.y) === 0 && Math.round(fsBox.width) === W && Math.round(fsBox.height) === H,
  '…covering the whole screen', fsBox ? `${Math.round(fsBox.x)},${Math.round(fsBox.y)} ${Math.round(fsBox.width)}×${Math.round(fsBox.height)}` : 'none');
const covered = await page.evaluate(`(() => { const f = document.querySelector('[data-pseudo-fullscreen]'); if (!f) return 'none';
  return [[4, 4], [${W / 2}, ${H / 2}], [${W - 4}, ${H - 4}], [4, ${H - 4}]].map(([x, y]) => { const t = document.elementFromPoint(x, y);
    return t && f.contains(t) ? 'ok' : (t ? t.tagName + '.' + String(t.className).slice(0, 30) : 'none'); }).join(' | '); })()`);
check(/^ok \| ok \| ok \| ok$/.test(covered), '…with nothing from the page drawn over it, corner to corner', covered);
check(await page.evaluate('getComputedStyle(document.documentElement).overflow') === 'hidden',
  '…and the page behind it cannot scroll');
check(await page.locator('[data-swipe-sheet]').count() === 1, '…and the full-screen gestures are live (swipe sheet up)');

// A tap on the picture only brings up the controls — pausing takes a
// deliberate tap on a Play/Pause button, same as on Android.
const sheet = await page.locator('[data-swipe-sheet]').first().boundingBox().catch(() => null);
if (sheet) await page.touchscreen.tap(sheet.x + sheet.width * 0.2, sheet.y + sheet.height * 0.7);
await page.waitForTimeout(500);
check(await page.locator('[data-player-root] button[aria-label="Play"]:visible').count() === 0, 'a stray tap on the picture in full screen does NOT pause it');
const hudPause = page.locator('[data-player-hud-transport] button[aria-label="Pause"]').first();
if (await hudPause.count()) await hudPause.tap();
const playBtn = page.locator('[data-player-root] button[aria-label="Play"]:visible').first();
await until(() => playBtn.count(), { what: 'the tap to pause', timeout: 2000 }).catch(() => {});
check(await playBtn.count() > 0, 'a tap on the centre Pause button pauses it');
if (await playBtn.count()) await playBtn.tap();
await until(async () => (await page.locator('[data-player-root] button[aria-label="Play"]:visible').count()) === 0, { what: 'resume', timeout: 2000 }).catch(() => {});
check(await page.locator('[data-player-root] button[aria-label="Pause"]:visible').count() > 0, '…and a tap on Play resumes it');

// The add-to-list sheet in the iPhone's full screen (a fixed box at z-index
// 2147483000): it used to sit under that box and could not be reached.
const addBtn = page.locator('[data-pseudo-fullscreen] [aria-label="Add to a list"]:visible').first();
if (await addBtn.count()) {
  await addBtn.tap();
  await until(() => page.locator('[data-add-to-list]').count(), { what: 'the add-to-list sheet', timeout: 3000 }).catch(() => {});
  const onTop = await page.evaluate(() => {
    const d = document.querySelector('[data-add-to-list]');
    if (!d) return 'no sheet';
    const r = d.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const box = document.querySelector('[data-pseudo-fullscreen]');
    return !!hit && d.contains(hit) && !!box && box.contains(d);
  });
  check(onTop === true, 'on an iPhone the add-to-list sheet opens in full screen, on top of the player', String(onTop));
  const done = page.locator('[data-add-to-list] button', { hasText: 'Done' });
  if (await done.count()) await done.tap();
} else {
  check(false, 'the add-to-list button is in iPhone full screen to test');
}

const leave = page.locator('[aria-label="Leave full screen"]:visible').first();
check(await leave.count() === 1, 'the button now offers the way out');
if (await leave.count()) await leave.tap();
await until(async () => (await page.locator('[data-pseudo-fullscreen]').count()) === 0, { what: 'leaving full screen', timeout: 3000 }).catch(() => {});
check(await page.locator('[data-pseudo-fullscreen]').count() === 0, 'a tap on Leave full screen leaves it');
const backBox = await page.locator('[data-player-root]').first().boundingBox().catch(() => null);
check(!!backBox && !!inlineBox && Math.abs(backBox.height - inlineBox.height) < 4,
  '…back to the inline player it was', backBox && inlineBox ? `${Math.round(backBox.height)}px vs ${Math.round(inlineBox.height)}px` : '');
check(await page.evaluate('getComputedStyle(document.documentElement).overflow') !== 'hidden', '…and the page scrolls again');

// ── full screen from the footer dock, whose frame is translateX(-50%) ──────
// A transformed ancestor captures a fixed box; index.css stands it down.
const pop = page.locator('[aria-label="Pop out the player"]:visible').first();
if (await pop.count()) await pop.tap();
const toFooter = page.locator('[aria-label="Dock the player at the bottom of the page"]:visible').first();
await until(() => toFooter.count(), { what: 'the footer-dock button', timeout: 3000 }).catch(() => {});
if (await toFooter.count()) await toFooter.tap();
await page.waitForTimeout(400);
const frameTransform = await page.evaluate("getComputedStyle(document.querySelector('[data-mini]')).transform");
const fsInFooter = page.locator('[data-mini] [aria-label="Full screen"]:visible').first();
if (await fsInFooter.count()) await fsInFooter.tap();
await until(() => page.locator('[data-pseudo-fullscreen]').count(), { what: 'full screen from the footer', timeout: 3000 }).catch(() => {});
const footerBox = await page.locator('[data-pseudo-fullscreen]').first().boundingBox().catch(() => null);
check(frameTransform !== 'none' && !!footerBox && Math.round(footerBox.x) === 0 && Math.round(footerBox.width) === W && Math.round(footerBox.height) === H,
  'from the footer dock (a transformed frame) full screen still covers the whole screen',
  `frame transform before: ${frameTransform}; box: ${footerBox ? `${Math.round(footerBox.x)},${Math.round(footerBox.y)} ${Math.round(footerBox.width)}×${Math.round(footerBox.height)}` : 'none'}`);
const leave2 = page.locator('[aria-label="Leave full screen"]:visible').first();
if (await leave2.count()) await leave2.tap();
await until(async () => (await page.locator('[data-pseudo-fullscreen]').count()) === 0, { what: 'leaving', timeout: 3000 }).catch(() => {});
check(await page.evaluate("getComputedStyle(document.querySelector('[data-mini]')).transform") === frameTransform,
  '…and the frame gets its own transform back on the way out');

// ── volume: the clip autoplays muted on an iPhone, and the speaker SAYS so ──
// It used to show the stored level, so the first tap "muted" a silent video
// and the second restored a level that was then never sent — no sound at all.
const unmute = page.locator('[data-player-root] button[aria-label="Unmute"]:visible').first();
check(await unmute.count() === 1, 'a fresh clip on an iPhone shows the speaker as MUTED');
if (await unmute.count()) {
  await unmute.tap();
  await page.waitForTimeout(200);
  const loud = await page.locator('[data-player-root] button[aria-label^="Volume,"]:visible').count();
  const slider = await page.locator('[data-player-root] input[aria-label="Volume"]:visible').count();
  check(loud === 1 && slider === 1, 'one tap on it turns the sound ON (and opens the slider)', `loud=${loud} slider=${slider}`);
}

// ── hover styles need a hover ─────────────────────────────────────────────
check(await page.evaluate("matchMedia('(hover: hover)').matches") === false, 'the emulated phone reports no hover');
const gated = await page.evaluate(`(() => {
  let inMedia = 0, bare = 0;
  const walk = (rules, media) => { for (const r of rules) {
    if (r.cssRules && r.conditionText !== undefined) walk(r.cssRules, r.conditionText);
    else if (r.selectorText && /group-hover\\\\:opacity-100/.test(r.selectorText)) { if (/hover:\\s*hover/.test(media || '')) inMedia++; else bare++; }
  } };
  for (const s of document.styleSheets) { try { walk(s.cssRules, ''); } catch { /* cross-origin */ } }
  return { inMedia, bare };
})()`);
check(gated.inMedia > 0 && gated.bare === 0, 'group-hover reveals only apply where a real hover exists', JSON.stringify(gated));

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

await ctx.close();
await browser.close();
await server.close();
console.log(ok.concat(bad).join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
