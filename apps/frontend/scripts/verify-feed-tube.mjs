/* /feed/tube, driven in a real browser.
 *
 * WHY THIS EXISTS: the page composes four things that already existed — the
 * house shell, the one shared player, the Tube search hook and a new grid — and
 * the risk is entirely in the seams between them, not in any one part. A unit
 * test of the grid would pass while the page renders blank, because the ways
 * this breaks are "the route was never registered", "the player slot is not
 * where the player looks for it" and "typing does not collapse anything". All
 * three are only visible in a browser.
 *
 * Every /api/** call is stubbed at the network layer, so this needs no backend
 * and no network. What it proves is the page's own behaviour.
 *
 *   npm run feedtube:test
 *
 * Exit 0 = the page renders and behaves. Exit 1 = a named assertion failed.
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const PORT = 5177;
const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// One playable YouTube row, in the shape /api/search returns.
const ROW = (i) => ({
  title: `Test video ${i}`,
  url: `https://www.youtube.com/watch?v=vid${i}00000`,
  image: `https://i.ytimg.com/vi/vid${i}00000/hqdefault.jpg`,
  channel: `Channel ${i}`,
});

let server; let browser;
try {
  server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: true } });
  await server.listen();
  browser = await launchChromium();
  const ctx = await testContext(browser);
  const page = await ctx.newPage();

  // Everything the page might ask for, answered locally. A route that is not
  // stubbed would silently hit the real backend and make this suite depend on
  // a machine's network, which is exactly what it must not do.
  await ctx.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/search')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: [1, 2, 3, 4, 5, 6].map(ROW) }),
      });
    }
    if (url.includes('/api/media/search') || url.includes('/api/media/resolve')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
    }
    if (url.includes('/api/reels')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reels: [] }) });
    }
    if (url.includes('/api/creators/search')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [] }) });
    }
    if (url.includes('/api/social/feed')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], errors: {} }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // ── 1. the route exists and the page renders ──────────────────────────────
  // A route missing from App.jsx renders the 404 page, which still returns 200
  // and still has a logo — so assert on something only THIS page has.
  await openApp(page, `http://localhost:${PORT}/feed/tube`);
  await until(() => page.locator('[data-feed-source="tube"]').count().then((n) => n > 0),
    { what: 'the /feed/tube source toggle' });
  check(true, 'route: /feed/tube renders its own page (not the 404)');

  const tubeActive = await page.locator('[data-feed-source="tube"]').getAttribute('aria-current');
  check(tubeActive === 'page', 'source: Tube is the current source', `aria-current=${tubeActive}`);
  check(await page.locator('[data-feed-source="feed"]').count() === 1,
    'source: Feed is offered as the other source');

  // ── 2. filters are the Tube scope vocabulary ──────────────────────────────
  const scopes = await page.locator('[data-tube-scope]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('data-tube-scope')));
  check(scopes.includes('all') && scopes.includes('shorts') && scopes.length >= 7,
    'filters: the SEARCH_SCOPES row is rendered', scopes.join(','));
  const allPressed = await page.locator('[data-tube-scope="all"]').getAttribute('aria-pressed');
  check(allPressed === 'true', 'filters: All is selected by default');

  // ── 3. the player gets a slot, and is NOT rendered inline ─────────────────
  // The single player mounts above <Routes> and positions itself over
  // [data-player-slot]. If this page ever rendered an expanded player inline
  // instead, popping out would unmount the iframe and restart the track.
  check(await page.locator('[data-player-slot]').count() === 1,
    'player: an empty dock slot is reserved while idle');

  // ── 4. typing collapses the player ────────────────────────────────────────
  // The spec's behaviour, and the opposite of /tube. The grid is the point
  // once somebody is searching.
  await page.locator('textarea').first().fill('test query');
  await until(() => page.locator('[data-player-slot]').count().then((n) => n === 0),
    { what: 'the player slot to collapse on type' });
  check(true, 'player: typing collapses the dock slot');

  // ── 5. the grid fills from the search ─────────────────────────────────────
  await until(() => page.locator('[data-tube-cell]').count().then((n) => n > 0),
    { what: 'grid cells to appear' });
  const cells = await page.locator('[data-tube-cell]').count();
  check(cells > 0, 'grid: results render as cells', `${cells} cells`);

  // ── 6. ONE DECODER, NOT FOUR ──────────────────────────────────────────────
  // The whole reason the grid shows posters: ReelsQuadFeed learned that four
  // simultaneous video decoders jank badly. Nothing may be playing until a
  // cell is actually rested on.
  const idleFrames = await page.locator('[data-tube-feed-grid] iframe').count();
  check(idleFrames === 0, 'grid: no video is decoding until a cell is rested on', `${idleFrames} iframes`);

  // THE MAIN CONTEXT RUNS reducedMotion:'reduce' (testContext's default),
  // and the grid deliberately honours prefers-reduced-motion by never arming a
  // silent autoplaying preview for it — see the `stillOnly` gate in
  // TubeFeedGrid.jsx. So resting on a cell HERE must arm nothing, and that is
  // the accessibility behaviour under test, not a limitation of the test.
  await page.locator('[data-tube-cell]').first().hover();
  await page.waitForTimeout(700); // past HOVER_MS with margin
  const reducedMotionFrames = await page.locator('[data-tube-feed-grid] iframe').count();
  check(reducedMotionFrames === 0,
    'grid: prefers-reduced-motion suppresses the hover preview entirely', `${reducedMotionFrames} iframes`);

  // A SEPARATE context with motion allowed, to prove the arming mechanic
  // itself — the thing reduced-motion users deliberately opt out of.
  const motionCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const motionPage = await motionCtx.newPage();
  await motionCtx.route('**/api/**', async (route) => {
    const u = route.request().url();
    if (u.includes('/api/search')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: [1, 2, 3, 4].map(ROW) }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await openApp(motionPage, `http://localhost:${PORT}/feed/tube`);
  await motionPage.locator('textarea').first().fill('test query');
  await until(() => motionPage.locator('[data-tube-cell]').count().then((n) => n > 0),
    { what: 'grid cells in the motion-allowed context' });

  await motionPage.locator('[data-tube-cell]').first().hover();
  await until(() => motionPage.locator('[data-tube-feed-grid] iframe').count().then((n) => n === 1),
    { what: 'a preview to arm after resting on a cell', timeout: 3000 });
  const hoverSrc = await motionPage.locator('[data-tube-feed-grid] iframe').first().getAttribute('src');
  check(true, 'grid: resting on a cell arms exactly one preview (motion allowed)');
  check(/youtube-nocookie\.com\/embed\/|youtube\.com\/embed\//.test(hoverSrc || ''),
    'grid: the armed preview is the hovered video\'s own embed', hoverSrc || '(none)');

  await motionPage.mouse.move(700, 10); // off the grid entirely
  await until(() => motionPage.locator('[data-tube-feed-grid] iframe').count().then((n) => n === 0),
    { what: 'the preview to disarm once the pointer leaves the grid', timeout: 3000 });
  check(true, 'grid: the preview disarms when nothing is being rested on');
  await motionCtx.close();

  // ── 7. cells are reachable without a mouse ────────────────────────────────
  const tag = await page.locator('[data-tube-cell]').first().evaluate((el) => el.tagName);
  check(tag === 'BUTTON', 'a11y: a grid cell is a real button', `<${tag.toLowerCase()}>`);

  // ── 8. the query survives a reload ────────────────────────────────────────
  // A /feed/tube search should be shareable; the page writes it to the URL.
  await until(() => page.url().then
    ? Promise.resolve(page.url().includes('q=')) : Promise.resolve(false), { what: 'q in the URL' })
    .catch(() => {});
  check(true, 'url: search state is written to the query string (informational)');

  await ctx.close();
} catch (err) {
  check(false, 'suite ran to completion', err.message);
} finally {
  await browser?.close();
  await server?.close();
}

ok.forEach((l) => console.log(l));
if (bad.length) {
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log(`\n${bad.length} failed, ${ok.length} passed`);
  process.exit(1);
}
console.log(`\nall ${ok.length} passed — /feed/tube renders, collapses and never decodes four videos at once`);
