/* A camera pin shows what the camera sees.
 *
 * WHAT IT WAS. Traffic cameras dropped onto the map as the same anonymous
 * teardrop as every other marker. Finding out whether one pointed at your
 * route meant tapping it, reading a panel, and closing it again — for each of
 * them, with the previous one closing as you opened the next.
 *
 * WHAT IT IS. A camera glyph you can pick out at a glance, a live frame on
 * hover, and the full picture on click.
 *
 * THE BUG THIS TEST EXISTS FOR, because it is invisible to a build and to any
 * assertion that only asks "did the preview render":
 *
 *   The preview is absolutely positioned. Its anchor is the pin, and only
 *   `position: relative` on the pin makes that true. Without it the preview
 *   escapes to the nearest positioned ancestor — the map container — so EVERY
 *   camera's frame stacks in the same corner, nowhere near the pin that owns
 *   it. The existing .truegle-marker rule carries a comment warning about
 *   exactly this, which is how it was caught before shipping.
 *
 * So the geometry is measured, not just the existence of an element.
 *
 * Run it:  npm run campins:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const server = await createServer({ server: { port: 5202, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5202';
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });

const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Two cameras in the shape the backend really sends. One still, one HLS —
// CameraView branches on which, and a pin must handle both.
const CAMERAS = [
  {
    id: 'cam-still-1',
    name: 'I-5 at Cottage Grove',
    location: { lat: 43.7976, lng: -123.0592 },
    urls: { image: 'https://cams.example.org/cam/still-1.jpg', video: null },
    road: 'I-5', state: 'OR', status: 'active',
    metadata: { city: 'Cottage Grove', region: 'OR' },
  },
  {
    id: 'cam-video-1',
    name: 'I-5 at Eugene',
    location: { lat: 44.0521, lng: -123.0868 },
    urls: { image: null, video: 'https://cams.example.org/cam/live-1.m3u8' },
    road: 'I-5', state: 'OR', status: 'active',
    metadata: { city: 'Eugene', region: 'OR' },
  },
];

await ctx.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/api/maps/traffic-cameras')) return json({ success: true, data: CAMERAS });
  if (u.pathname.includes('/cameras/multi-state')) return json({ success: true, data: [] });
  return json({ success: true, data: [], results: [] });
});
for (const p of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**', '**/server.arcgisonline.com/**']) {
  await ctx.route(p, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TILE }));
}
// The camera frame: a solid green so a painted preview is unmistakable.
let frameRequests = 0;
await ctx.route('**/cams.example.org/**', (r) => {
  frameRequests += 1;
  return r.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#22c55e"/></svg>',
  });
});
for (const p of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/overpass-api.de/**', '**/router.project-osrm.org/**']) {
  await ctx.route(p, (r) => r.abort());
}

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/search?q=coffee+near+me`, { waitUntil: 'domcontentloaded' });
const until = async (fn, ms = 30000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (await fn()) return true; await page.waitForTimeout(300); }
  return false;
};

await until(() => page.locator('button', { hasText: /^\s*Maps\s*$/ }).count().then((n) => n > 0));
// The first-search modal is portalled and animates in; it swallows every click
// until dismissed.
for (let i = 0; i < 15; i++) {
  if (!(await page.locator('div.z-\\[9999\\]').count())) { await page.waitForTimeout(300); continue; }
  await page.locator('div.z-\\[9999\\] button').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  if (!(await page.locator('div.z-\\[9999\\]').count())) break;
}
await page.locator('button', { hasText: /^\s*Maps\s*$/ }).first().click();
await page.waitForTimeout(1200);
const mapToggle = page.locator('button', { hasText: /map/i });
if (await mapToggle.count()) await mapToggle.last().click();
ok('the map opens', await until(() => page.locator('#truegle-map-container').count().then((n) => n === 1)));

// ── The anchoring rule ─────────────────────────────────────────────────────
// Asserted from the stylesheet as well as from geometry: the rule is the thing
// that has to survive a future edit to this file.
const positionRule = await page.evaluate(() => {
  const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
  return rules.find((r) => r.selectorText === '.truegle-camera-marker')?.style.position || '(rule missing)';
});
ok('a camera pin is a positioned ancestor, so its preview anchors to it',
  positionRule === 'relative', positionRule);

// ── Drive the real path: search a camera, select it, get a pin ────────────
// SPECIFIC, not "any button mentioning camera": the search bar has its own
// "Open camera" image-upload button, and a loose selector grabs that instead
// and clicks something entirely unrelated.
const camBtn = page.locator('button[title="Search Cameras"]');
if (await camBtn.count()) {
  await camBtn.first().click({ force: true });
  await page.waitForTimeout(1200);
  const search = page.locator('input[placeholder*="search" i], input[type="text"]').last();
  if (await search.count()) {
    await search.fill('I-5');
    await page.waitForTimeout(2500);
  }
  // The result rows are motion.div, NOT buttons — a button-only selector
  // finds the list but never the rows in it, which reads as "the search
  // returned nothing" when the search worked perfectly.
  const row = page.locator('div').filter({ hasText: /^I-5 at Cottage Grove/ });
  if (await row.count()) {
    await row.first().click({ force: true });
    await page.waitForTimeout(1500);
  }
}

const pins = page.locator('.truegle-camera-marker');
const pinCount = await pins.count();
ok('selecting a camera puts a CAMERA pin on the map, not a generic teardrop',
  pinCount > 0, `${pinCount} camera pins`);

if (pinCount > 0) {
  const pin = pins.first();

  // ── Hover shows the frame, anchored to THIS pin ─────────────────────────
  await pin.hover();
  await page.waitForTimeout(1500);

  const geom = await page.evaluate(() => {
    const p = document.querySelector('.truegle-camera-marker');
    const preview = p?.querySelector('div[class*="absolute"]');
    if (!p || !preview) return null;
    const a = p.getBoundingClientRect();
    const b = preview.getBoundingClientRect();
    return {
      pin: { x: a.left + a.width / 2, y: a.top },
      preview: { x: b.left + b.width / 2, y: b.bottom, w: b.width },
      dx: Math.abs((b.left + b.width / 2) - (a.left + a.width / 2)),
      dy: Math.abs(b.bottom - a.top),
    };
  });

  ok('hovering a pin shows a live frame', !!geom, geom ? `${Math.round(geom.preview.w)}px wide` : 'no preview');
  if (geom) {
    // THE ASSERTION THAT CATCHES THE ESCAPED-PREVIEW BUG. A preview anchored
    // to the map container instead of the pin lands hundreds of pixels away;
    // one anchored to the pin sits directly above it.
    ok('…positioned over the pin it belongs to, not adrift in the map',
      geom.dx < 40 && geom.dy < 60, `dx=${Math.round(geom.dx)} dy=${Math.round(geom.dy)}`);
  }
  ok('…and the frame itself was actually fetched', frameRequests > 0, `${frameRequests} requests`);

  // ── Click opens it full size ────────────────────────────────────────────
  await pin.click({ force: true });
  await page.waitForTimeout(1200);
  const dialog = page.locator('[role="dialog"][aria-label*="I-5" i], [role="dialog"]');
  const dialogOpen = await dialog.count();
  ok('clicking a pin opens the camera full size', dialogOpen > 0, `${dialogOpen} dialogs`);

  if (dialogOpen > 0) {
    // Escape must close it — a modal over a map with no keyboard exit is a trap.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    ok('Escape closes it', (await page.locator('[role="dialog"]').count()) === 0);
  }
} else {
  ok('hovering a pin shows a live frame', false, 'no pin to hover');
  ok('…positioned over the pin it belongs to, not adrift in the map', false, 'no pin');
  ok('clicking a pin opens the camera full size', false, 'no pin');
}

ok('nothing threw', errs.length === 0, errs.slice(0, 2).join(' | ') || 'clean');

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
await server.close();
process.exit(failed === 0 ? 0 : 1);
