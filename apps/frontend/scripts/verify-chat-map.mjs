/* "Coffee near me", asked in Chat.
 *
 * WHY THIS EXISTS. A local question has an answer that is a PLACE, and prose
 * cannot be a place. Asked in Chat, "coffee near me" got a description of
 * coffee — the model has no position, no radius and no map — while the exact
 * same words on /search opened a map with the cafes on it. The surface you
 * typed into decided whether you got an answer.
 *
 * WHAT IS BEING GUARDED. Almost none of this is new code, and that is the
 * point: detection is useLocationDetection, the nearby lookup is
 * MapViewWrapper's, the window is the map's own pop-out frame. These checks
 * exist to make sure it STAYS borrowed — the moment Chat grows its own copy of
 * "near me", the two surfaces start answering differently, which is exactly
 * how this tree ended up with five dead forks of the search page.
 *
 * Run it:  npm run chatmap:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5201, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5201';
const browser = await launchChromium();

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function ask(query) {
  const calls = [];
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    permissions: ['geolocation'],
    geolocation: { latitude: 34.0522, longitude: -118.2437 },
  });
  await ctx.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    let body = null;
    try { body = route.request().postData() ? JSON.parse(route.request().postData()) : null; } catch { /* not JSON */ }
    calls.push({ path: u.pathname, body });
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname.includes('/maps/reverse-geocode')) {
      return json({ success: true, data: [{ address: '742 Evergreen Terrace, Los Angeles', position: { lon: -118.2437, lat: 34.0522 } }] });
    }
    if (u.pathname.includes('/maps/places')) {
      return json({ success: true, data: [{ name: 'Blue Bottle Coffee', address: '300 S Broadway', position: { lon: -118.244, lat: 34.051 } }] });
    }
    if (u.pathname.includes('/maps/geocode')) {
      return json({ success: true, data: [{ address: 'Los Angeles, CA', position: { lon: -118.2437, lat: 34.0522 }, relevance: 0.99 }] });
    }
    return json({ success: true, data: [], results: [], response: 'Here are some options.', content: 'Here are some options.' });
  });
  for (const p of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**', '**/server.arcgisonline.com/**']) {
    await ctx.route(p, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  }
  await ctx.route('**/*.mapbox.com/**', (r) => r.abort());

  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => {
    if (!/node_modules\/\.vite\/deps\/maplibre-gl/.test(e.stack || '')) errs.push(e.message);
  });
  await page.goto(`${BASE}/chat?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(11000);
  return { page, ctx, calls, errs };
}

// ── 1. a local question gets a map ──────────────────────────────────────────
const local = await ask('coffee near me');
const frame = await local.page.evaluate(() => {
  const f = document.querySelector('[data-map-popout]');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  const bar = f.querySelector('#truegle-map-container .absolute.bottom-4');
  const b = bar?.getBoundingClientRect();
  return {
    // Portalled, or a transformed ancestor in the chat thread would clip it.
    inBody: f.parentElement === document.body,
    fixed: getComputedStyle(f).position,
    canvas: !!f.querySelector('#truegle-map-container canvas'),
    onScreen: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    // The bar must not eat the window it is chrome for.
    barShare: b ? Math.round((b.height / r.height) * 100) : null,
    barRows: b ? Math.round(b.height / 44) : null,
    title: f.querySelector('span')?.innerText || '',
  };
});
check(!!frame, 'a location question in Chat opens a map');
check(frame?.inBody && frame?.fixed === 'fixed',
  '…as a floating window portalled to the body, not wedged into the thread',
  `${frame?.fixed} · body child: ${frame?.inBody}`);
check(frame?.canvas, '…with the map actually drawn in it');
check(frame?.onScreen, '…entirely on screen');
check(frame?.title === 'coffee near me', '…titled with the question that opened it', frame?.title);
check(frame?.barShare !== null && frame.barShare <= 20,
  '…and the function bar does not eat the window it is chrome for',
  `${frame?.barShare}% of the frame, ~${frame?.barRows} row(s)`);

// The chip is what stops a window arriving unexplained.
const chip = await local.page.evaluate(() => {
  const m = document.body.innerText.match(/Looking for [^\n]*/);
  return m ? m[0].trim() : null;
});
check(/coffee/i.test(chip || ''), 'the thread says why a map appeared', chip || '(no chip)');

// ── 2. it asks for the SUBJECT, through the same ladder as /search ──────────
// Not a hardcoded category sweep, and not the whole query as a place name.
const asked = local.calls
  .filter((c) => /\/maps\/(places|local-businesses)/.test(c.path))
  .map((c) => c.body?.options?.query ?? c.body?.query ?? '(none)');
check(asked.length > 0, 'Chat looks for nearby places on its own', `${asked.length} lookups`);
check(asked.some((q) => /^coffee$/i.test(q)),
  '…for COFFEE, the same subject /search would extract', asked.join(' · '));
check(!local.calls.some((c) => c.path.includes('/maps/geocode') && /^\s*me\s*$/i.test(c.body?.query || '')),
  '"near me" is never geocoded as a place called "me"');

// ── 3. closing means closed ─────────────────────────────────────────────────
// A map that springs back after being dismissed is what people call fighting
// the page. It may only return when a NEW question is asked.
await local.page.locator('[data-map-popout] button[aria-label="Close the map"]').first().click();
await local.page.waitForTimeout(1500);
check(await local.page.locator('[data-map-popout]').count() === 0, 'closing it closes it');
const wayBack = await local.page.evaluate(() => /Show the map for/.test(document.body.innerText));
check(wayBack, '…leaving one quiet line to get it back');
await local.page.locator('button', { hasText: /Show the map for/ }).first().click();
await local.page.waitForTimeout(1500);
check(await local.page.locator('[data-map-popout]').count() === 1, '…which reopens it');
check(local.errs.length === 0, 'nothing threw on the local question', local.errs.slice(0, 2).join(' | ') || 'clean');
await local.ctx.close();

// ── 4. an ordinary question gets no map ─────────────────────────────────────
// The cost of a false positive here is a window over somebody's conversation,
// so a question that is not local must not open one.
const plain = await ask('what is the capital of France');
check(await plain.page.locator('[data-map-popout]').count() === 0,
  'an ordinary question opens no map');
check(!plain.calls.some((c) => /\/maps\/(places|local-businesses)/.test(c.path)),
  '…and asks for no nearby places',
  plain.calls.filter((c) => c.path.includes('/maps/')).map((c) => c.path).join(' · ') || 'none');
check(plain.errs.length === 0, 'nothing threw on the ordinary question', plain.errs.slice(0, 2).join(' | ') || 'clean');
await plain.ctx.close();

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
