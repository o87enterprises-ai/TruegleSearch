/* Four things the owner reported broken, all desktop-shaped:
 *
 *   - "Open in app" (the search result preview) had no full screen, so a
 *     small inline frame was the only way to read it.
 *   - The desktop scroll (mouse wheel / trackpad) did nothing in Tube's and
 *     Reels' full-screen views — only a touch swipe moved to the next clip.
 *   - Reels full screen had NO click target to change videos at all: only
 *     the swipe gesture, undiscoverable on a desktop.
 *   - A platform's OWN on-screen content (a YouTube end-card, a link inside
 *     an embed) was unreachable: Truegle's own transparent layer covered the
 *     whole picture so every press went to US, never through to the embed.
 *
 * Owner, 2026-10-10. Run it:  npm run playerinteract:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5301;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const DESKTOP = { viewport: { width: 1366, height: 820 } }; // no touch — a mouse, not a finger

// Same fallback the rest of the suite uses for a button that might be
// mid-transition when the click lands (verify-player-suite.mjs's `press`).
const clickSafely = async (locator) => {
  await locator.click({ timeout: 2000 }).catch(() => locator.dispatchEvent('click').catch(() => {}));
};

// ResultCard is defined INSIDE UniversalSearch's own render — a fresh
// component identity on every parent re-render, which occasionally remounts
// it (and its local viewerFullscreen state) mid-click. Not this feature's
// bug to fix, but a real press should not have to land in that one instant:
// try, give React a beat to settle, try again.
const clickUntil = async (locatorFn, isDone, label) => {
  for (let i = 0; i < 4; i += 1) {
    await clickSafely(locatorFn());
    if (await until(isDone, { what: label, timeout: 4000 }).then(() => true, () => false)) return;
  }
  throw new Error(`gave up on: ${label}`);
};

// YouTube's real postMessage protocol, trimmed: silent until "listening",
// then onReady + a steady infoDelivery. Enough to make embed.canCommand true
// without needing the player to actually obey commands for these checks.
const stub = (id) => `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      setInterval(function () { send({ event: 'infoDelivery', info: { playerState: 1, currentTime: 1, duration: 200 } }); }, 500);
    }
  });
</script></body></html>`;

const A = 'clipAAAAAA1'; const B = 'clipBBBBBB2'; const C = 'clipCCCCCC3';
const SHARE = `/tube?${[A, B, C].map((id) => `u=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`).join('&')}`;

async function tubeContext() {
  const ctx = await testContext(browser, DESKTOP);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop();
    return r.fulfill({ status: 200, contentType: 'text/html', body: stub(id) });
  });
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  return ctx;
}
const nowPlaying = (page) => page.locator('iframe[src*="youtube-nocookie"]').first().getAttribute('src')
  .then((s) => (/embed\/([\w-]{11})/.exec(s || '') || [])[1] || '').catch(() => '');

// ── A. "Open in app" full screen, minimize, Escape ──────────────────────────
{
  const ctx = await testContext(browser, DESKTOP);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  // Registered AFTER the generic fallback above: Playwright tries the LAST
  // matching route first, so this specific one wins for /api/search.
  await ctx.route('**/api/search', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    success: true, results: [{ title: 'An article worth reading', url: 'https://example.org/open-in-app-test', snippet: 'words', domain: 'example.org', category: 'web' }],
  }) }));
  await ctx.route('**/example.org/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>the article</body></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/search?q=${encodeURIComponent('an article worth reading')}`);
  const openBtn = page.getByText('Open in app', { exact: true }).first();
  await until(() => openBtn.count(), { what: 'the Open in app button', timeout: 10000 });
  await clickSafely(openBtn);
  await until(() => page.locator('iframe[src*="example.org"]').count(), { what: 'the inline preview' });
  check(await page.locator('[data-viewer-fullscreen-open]').count() === 0, 'opens inline first, not full screen');

  await clickSafely(page.locator('[data-viewer-fullscreen]').first());
  await until(() => page.locator('[data-viewer-fullscreen-open]').count(), { what: 'full screen to open' });
  check(await page.locator('[data-viewer-fullscreen-open]').count() === 1, 'a Full screen press opens it full screen');
  const box = await page.locator('[data-viewer-fullscreen-open]').boundingBox();
  const vp = page.viewportSize();
  check(box && box.width >= vp.width - 2 && box.height >= vp.height - 2, '…covering the whole viewport', box ? `${box.width}x${box.height}` : 'none');
  check(await page.locator('[data-viewer-fullscreen-open] iframe[src*="example.org"]').count() === 1, '…the SAME preview, not a reload');

  // Escape minimizes (back to inline), it does not close the viewer outright.
  await page.keyboard.press('Escape');
  await until(() => page.locator('[data-viewer-fullscreen-open]').count().then((n) => n === 0), { what: 'Escape to minimize' });
  check(await page.locator('[data-viewer-fullscreen-open]').count() === 0, 'Escape leaves full screen');
  check(await page.locator('iframe[src*="example.org"]').count() === 1, '…back to the inline preview, still open (not closed)');

  // Minimize button does the same from inside full screen.
  await clickUntil(
    () => page.locator('[data-viewer-fullscreen]').first(),
    () => page.locator('[data-viewer-fullscreen-open]').count(),
    'full screen again',
  );
  await clickSafely(page.locator('[data-viewer-fullscreen-open] [data-viewer-fullscreen]'));
  await until(() => page.locator('[data-viewer-fullscreen-open]').count().then((n) => n === 0), { what: 'Minimize to work' });
  check(await page.locator('[data-viewer-fullscreen-open]').count() === 0, 'the Minimize button leaves full screen the same way');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── B. Tube full screen: the desktop scroll wheel changes the clip ──────────
{
  const ctx = await tubeContext();
  const page = await ctx.newPage();
  await openApp(page, `${BASE}${SHARE}`);
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the play door' });
  await page.locator('[data-share-gate]').click();
  await until(async () => (await nowPlaying(page)) === A, { what: 'the first clip', timeout: 8000 });
  if (!(await page.evaluate('!!document.fullscreenElement'))) {
    await page.locator('button[aria-label="Full screen"]').click().catch(() => {});
  }
  await page.waitForTimeout(500);
  await until(() => page.locator('[data-swipe-sheet]').count(), { what: 'the swipe sheet (full screen)', timeout: 5000 }).catch(() => {});
  const inFullscreen = await page.evaluate('!!document.fullscreenElement');
  check(inFullscreen, 'entered full screen for this check', 'headless Chromium may refuse it');
  if (inFullscreen) {
    const sheetCount = await page.locator('[data-swipe-sheet]').count();
    const band = sheetCount ? await page.locator('[data-swipe-sheet]').boundingBox() : null;
    if (process.env.DEBUG) console.log('DEBUG sheetCount', sheetCount, 'band', band);
    if (band) {
      await page.mouse.move(band.x + band.width / 2, band.y + band.height / 2);
      const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.outerHTML?.slice(0, 160), [band.x + band.width / 2, band.y + band.height / 2]);
      if (process.env.DEBUG) console.log('DEBUG elementAtBandCentre', onTop);
    }
    await page.mouse.wheel(0, 200); // down = forward, same as swiping up
    await until(async () => (await nowPlaying(page)) === B, { what: 'the wheel to advance the clip', timeout: 4000 }).catch(() => {});
    check(await nowPlaying(page) === B, 'scrolling the mouse wheel in full screen moves to the next clip', await nowPlaying(page));
    await page.waitForTimeout(600); // past useWheelNav's own cooldown — a second flick, not the same one
    await page.mouse.wheel(0, -200); // up = back
    await until(async () => (await nowPlaying(page)) === A, { what: 'the wheel to go back', timeout: 4000 }).catch(() => {});
    check(await nowPlaying(page) === A, '…and scrolling back up returns to the previous one', await nowPlaying(page));
  }
  await ctx.close();
}

// ── C. Click-through: a press reaches the embed's own on-screen content ────
{
  const ctx = await tubeContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}${SHARE}`);
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the play door' });
  await page.locator('[data-share-gate]').click();
  await until(async () => (await nowPlaying(page)) === A, { what: 'the first clip', timeout: 8000 });
  await page.evaluate('if (document.fullscreenElement) document.exitFullscreen()').catch(() => {});
  await page.waitForTimeout(400);

  const frame = page.locator('iframe[src*="youtube-nocookie"]').first();
  const fbox = await frame.boundingBox();
  const centre = [fbox.x + fbox.width / 2, fbox.y + fbox.height / 2];

  // Move the mouse to reveal the overlay rail (desktop's way, per useOverlayReveal).
  await page.mouse.move(...centre);
  await page.mouse.move(centre[0] + 2, centre[1] + 2);
  await until(() => page.locator('[data-clickthrough-toggle]').count(), { what: 'the overlay to reveal the toggle', timeout: 4000 });
  const before = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, centre);
  check(before !== 'IFRAME', 'before: our own layer covers the picture, not the embed', before);

  await page.locator('[data-clickthrough-toggle]').click();
  await until(() => page.locator('[data-clickthrough-exit]').count(), { what: 'the exit pill' });
  check(await page.locator('[data-clickthrough-exit]').count() === 1, 'turning it on shows an always-visible way back');
  const during = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, centre);
  check(during === 'IFRAME', 'on: a press in the middle of the picture now reaches the embed itself', during);

  await page.locator('[data-clickthrough-exit]').click();
  await until(() => page.locator('[data-clickthrough-exit]').count().then((n) => n === 0), { what: 'the pill to close it' });
  const after = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, centre);
  check(after !== 'IFRAME', 'the exit pill restores Truegle\'s own layer', after);

  // It never carries over to the next clip — a choice about THIS one.
  await page.mouse.move(...centre); await page.mouse.move(centre[0] + 2, centre[1] + 2);
  await until(() => page.locator('[data-clickthrough-toggle]').count(), { what: 'overlay again' });
  await page.locator('[data-clickthrough-toggle]').click();
  await until(() => page.locator('[data-clickthrough-exit]').count(), { what: 'on again' });
  await page.locator('button[aria-label="Next"]').click().catch(() => page.keyboard.press('Shift+N'));
  await until(async () => (await nowPlaying(page)) === B, { what: 'the next clip', timeout: 4000 }).catch(() => {});
  check(await page.locator('[data-clickthrough-exit]').count() === 0, 'a new clip resets it — never left on by accident', await nowPlaying(page));
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── D. Reels (desktop): buttons AND the wheel change the video ─────────────
{
  const id = (seed, n) => `${seed.replace(/[^a-z]/gi, '').slice(0, 6).padEnd(6, 'x')}${String(n).padStart(5, '0')}`;
  const webRows = (q) => {
    const seed = (q || 'blank').replace(/#shorts/, '').trim() || 'blank';
    return Array.from({ length: 6 }, (_, i) => ({
      title: `${seed} short ${i} #shorts`, url: `https://www.youtube.com/watch?v=${id(seed, i)}`, duration: '0:4' + i,
    }));
  };
  const ctx = await testContext(browser, DESKTOP);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  for (const host of ['**/*youtube*.com/**', '**/*tiktok.com/**', '**/*ytimg.com/**']) {
    await ctx.route(host, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  }
  await ctx.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* GET */ }
    if (u.pathname === '/api/search') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: /#shorts/.test(body.query) ? webRows(body.query) : [] }) });
    if (u.pathname === '/api/media/titles') {
      const titles = {}; for (const url of body.urls || []) titles[url] = { title: 't', width: 113, height: 200 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ titles }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  await page.locator('button', { hasText: /Reels/i }).first().click().catch(async () => {
    await page.goto(`${BASE}/shorts`, { waitUntil: 'domcontentloaded' });
  });
  await until(() => page.locator('[data-reels-surface]').count(), { what: 'Reels to open', timeout: 8000 });
  const cells = page.locator('[data-reels-surface="grid"] [data-reel-root] button');
  await until(() => cells.count().then((n) => n > 1), { what: 'the grid to fill', timeout: 8000 });

  const openNth = async (n) => {
    const t = await cells.nth(n).innerText();
    await cells.nth(n).click();
    await until(() => page.locator('[data-reels-surface="player"]').count(), { what: 'the player to open' });
    return t;
  };
  const current = () => page.locator('[data-reel-title]').innerText();

  const first = await openNth(0);
  check(await page.locator('[data-reels-next]').count() === 1 && await page.locator('[data-reels-prev]').count() === 1,
    'playing full screen offers Next/Prev buttons — a click target, not only a gesture');
  check(await page.locator('[data-reels-prev]').isDisabled(), 'Prev is disabled on the first one (nothing before it)');

  await clickSafely(page.locator('[data-reels-next]'));
  await until(async () => (await current()) !== first, { what: 'Next to change the video', timeout: 4000 });
  check((await current()) !== first, 'clicking Next changes the video', `first="${first}" now="${await current()}"`);
  check(!(await page.locator('[data-reels-prev]').isDisabled()), '…and Prev is enabled now there is one before it');

  const second = await current();
  await clickSafely(page.locator('[data-reels-prev]'));
  await until(async () => (await current()) === first, { what: 'Prev to go back', timeout: 4000 }).catch(() => {});
  check((await current()) === first, 'clicking Prev returns to the one before it', `expected="${first}" now="${await current()}"`);

  // The scroll wheel, over the picture itself.
  const pbox = await page.locator('[data-reels-surface="player"] [data-reel-root]').boundingBox();
  await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await page.mouse.wheel(0, 200);
  await until(async () => (await current()) === second, { what: 'the wheel to advance the reel', timeout: 4000 }).catch(() => {});
  check((await current()) === second, 'scrolling the wheel over a reel changes it too, the same as Next', await current());
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
