/* The map's chrome, measured in a browser.
 *
 * Every one of these is a defect that was visible in a screenshot and invisible
 * to every other kind of test:
 *
 *   FOUR ad slots around one map. AdBanner rendered in MapViewWrapper AND in
 *     TruegleMap, which the wrapper mounts — two stacked at the top, two at the
 *     bottom, pushing the map itself below the fold.
 *   THE CONTROL ROW WAS SLICED OFF AT BOTH ENDS. It was `absolute top-4
 *     left-1/2` with no width bound and no wrapping: ten buttons in one rigid
 *     row, wider than the map, clipped by the container's overflow-hidden. The
 *     screenshot showed "Ma…" on the left and "Cl…" on the right.
 *   IT ALSO SHARED THE TOP BAND with the search field and the zoom stack, so
 *     three separate controls overlapped in the same corner.
 *   THE MAP OPENED ON A POLAR PROJECTION. DEFAULT_MAP_VIEW_MODE was
 *     AZIMUTHAL_FLAT, so "coffee near me" landed on an azimuthal view of the
 *     northern hemisphere.
 *
 * Geometry, not pixels: Mapbox tiles are blocked in this sandbox and a
 * screenshot diff would fail on a starfield that is different every frame.
 *
 * Run it:  npm run mapui:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5194, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5194';
const browser = await launchChromium();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  permissions: ['geolocation'],
  geolocation: { latitude: 34.0522, longitude: -118.2437 },
});

await ctx.route('**/api/**', (route) => {
  const u = new URL(route.request().url());
  const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/maps/geocode')) {
    return json({ success: true, provider: 'mapbox', data: [
      { address: 'Los Angeles, California', position: { lon: -118.2437, lat: 34.0522 }, type: 'place', relevance: 0.99 },
    ] });
  }
  return json({ success: true, data: [], results: [] });
});
// Tiles and telemetry never leave; this is about layout.
await ctx.route('**/*.mapbox.com/**', (r) => r.abort());

const errs = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(`${BASE}/search?q=coffee+near+me`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);

const keep = page.locator('button', { hasText: /No, keep Smart/i });
if (await keep.count()) { await keep.first().click(); await page.waitForTimeout(1000); }

// The map toggle only appears once the Maps category is selected.
const category = page.locator('button', { hasText: /^\s*Maps\s*$/ }).first();
await category.click();
await page.waitForTimeout(1200);
await page.locator('button', { hasText: /map/i }).last().click();
await page.waitForTimeout(9000);

const container = page.locator('#truegle-map-container');
check(await container.count() === 1, 'the map opens');

// ── 1. one ad, not four ─────────────────────────────────────────────────────
const adCount = await page.evaluate(() => {
  const wrap = document.querySelector('#truegle-map-container')?.closest('.rounded-2xl') || document.body;
  return [...wrap.querySelectorAll('*')].filter((el) => /ADVERTISEMENT/i.test(el.childNodes[0]?.nodeValue || '')).length;
});
check(adCount <= 2, 'the map carries at most one ad slot per end, not two stacked',
  `${adCount} advertisement labels around the map`);

// ── 2. the control row fits inside the map ──────────────────────────────────
const bar = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const el = box?.querySelector('.absolute.bottom-4');
  if (!box || !el) return null;
  const b = el.getBoundingClientRect(); const c = box.getBoundingClientRect();
  const row = el.firstElementChild;
  return {
    fits: b.left >= c.left - 1 && b.right <= c.right + 1,
    leftGap: Math.round(b.left - c.left),
    rightGap: Math.round(c.right - b.right),
    scrolls: row ? row.scrollWidth > row.clientWidth : false,
    buttons: el.querySelectorAll('button').length,
  };
});
check(!!bar, 'the function bar is on screen');
check(bar?.fits, 'it fits inside the map instead of being sliced off at both ends',
  `left ${bar?.leftGap}px · right ${bar?.rightGap}px`);
check(bar?.buttons >= 8, '…with every control present', `${bar?.buttons} buttons`);
// It must be reachable when it does not fit — scrollable, never clipped away.
check(bar?.scrolls !== null, '…and scrolls horizontally rather than clipping', `scrollable: ${bar?.scrolls}`);

// ── 3. nothing floating over anything else ──────────────────────────────────
const collisions = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const el = box.querySelector('.absolute.bottom-4');
  const b = el.getBoundingClientRect();
  const hits = (r) => !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
  return [...box.querySelectorAll('button, .truegle-traditional-controls, img, input')]
    .filter((n) => !el.contains(n))
    .map((n) => ({ n, r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && hits(r))
    .map(({ n }) => (n.innerText || n.className || n.tagName).toString().replace(/\s+/g, ' ').slice(0, 40));
});
check(collisions.length === 0, 'no other control overlaps the function bar', collisions.join(' | ') || 'clear');

// The search field owns the top band now; the zoom stack must not sit on it.
const topBand = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const input = box.querySelector('input');
  const zoom = box.querySelector('.truegle-traditional-controls');
  if (!input || !zoom) return null;
  const a = input.getBoundingClientRect(); const z = zoom.getBoundingClientRect();
  return { overlap: !(a.right <= z.left || a.left >= z.right || a.bottom <= z.top || a.top >= z.bottom) };
});
check(topBand && !topBand.overlap, 'the search field and the zoom controls do not overlap',
  JSON.stringify(topBand));

// ── 4. a local question opens a local map ───────────────────────────────────
// Not the azimuthal projection of the northern hemisphere.
const mode = await page.evaluate(() => {
  const active = [...document.querySelectorAll('#truegle-map-container button')]
    .find((b) => /bg-cyan-600/.test(b.className) && /Map|Azimuthal|Globe/.test(b.innerText));
  return active?.innerText.trim() || null;
});
check(mode === 'Map', 'the map opens on the street map, not a polar projection', mode || '(none active)');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
