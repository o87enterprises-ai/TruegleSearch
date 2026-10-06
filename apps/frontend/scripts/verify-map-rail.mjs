/* The map's controls: one rail on the right, always reachable, every button
 * saying what it is and what state it is in. Plus the views and the cameras.
 *
 * Owner, 2026-10-06:
 *   - "the buttons … only visible in full screen and can't be touched unless
 *     full screen is activated. I want the buttons to go down the right side of
 *     the screen so they will always be visible. They need to clearly display
 *     their current state … all of the buttons consolidated into one place"
 *   - "there shouldn't be a map view button … when azimuthal or globe are zoomed
 *     in to navigable altitude, it automatically switches to map view"
 *   - "the navigation in each of these views … prevents manual zoom and
 *     navigation on mobile", "the first two view modes aren't working"
 *   - "the traffic cam menu removed and instead it become a map overlay … a
 *     little camera icon … hover the live feed displays … layers that can be
 *     toggled on and off one at a time and all together"
 *
 * A control counts only if the element at its centre IS that control
 * (elementFromPoint) — present-but-covered is what the old bar was.
 *
 * Run it:  npm run maprail:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const SHOTS = process.env.MAP_SHOTS || '';

const PORT = 5297;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const CATALOGUE = [
  { id: 'flights', label: 'Aircraft', colour: '#38bdf8', kind: 'point' },
  { id: 'earthquakes', label: 'Earthquakes', colour: '#f97316', kind: 'point' },
  { id: 'cctv', label: 'Public cameras', colour: '#facc15', kind: 'point' },
];
const CAMS = Array.from({ length: 5 }, (_, i) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [-118.2437 + (i - 2) * 0.002, 34.0522 + (i - 2) * 0.001] },
  properties: { id: `c${i}`, name: `Test camera ${i}`, feed_url: `https://cams.example/c${i}.jpg`, source: 'Caltrans', city: 'Los Angeles' },
}));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function open(device) {
  const ctx = await testContext(browser, { ...device, permissions: ['geolocation'], geolocation: { latitude: 34.0522, longitude: -118.2437 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  const calls = [];
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    calls.push(u.pathname + u.search);
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/api/osiris/layers') return json({ layers: CATALOGUE });
    if (u.pathname === '/api/osiris/cctv') return json({ type: 'FeatureCollection', features: CAMS, meta: { returned: CAMS.length } });
    if (u.pathname.startsWith('/api/osiris/')) return json({ type: 'FeatureCollection', features: [], meta: { returned: 0 } });
    if (u.pathname.startsWith('/api/maps/traffic-cameras/bbox/')) {
      return json({ success: true, count: 1, data: [{ id: 'otc1', name: 'I-5 at Test', location: { lat: 34.0530, lng: -118.2420 }, urls: { image: 'https://cams.example/otc1.jpg', video: null } }] });
    }
    if (u.pathname.includes('/maps/geocode')) return json({ success: true, data: [{ address: 'Los Angeles, California', position: { lon: -118.2437, lat: 34.0522 }, type: 'place', relevance: 0.99 }] });
    return json({ success: true, data: [], results: [] });
  });
  for (const h of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**', '**/server.arcgisonline.com/**', '**/cams.example/**', '**/gibs.earthdata.nasa.gov/**']) {
    await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  }
  for (const h of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/overpass-api.de/**', '**/router.project-osrm.org/**']) await ctx.route(h, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/maplibre-gl|three|react-three|isExternalMethodAvailable/.test(`${e.stack || ''} ${e.message}`)) errs.push(e.message); });
  await openApp(page, `${BASE}/search?q=los+angeles`);
  const maps = page.locator('button', { hasText: /^\s*Maps\s*$/ }).first();
  await until(() => maps.count(), { what: 'the Maps category' });
  const keep = page.locator('button', { hasText: /No, keep Smart/i });
  if (await keep.count()) { await keep.first().click(); await page.waitForTimeout(600); }
  await maps.click();
  await page.waitForTimeout(1200);
  if (!(await page.locator('#truegle-map-container').count())) await page.locator('button', { hasText: /map/i }).last().click();
  await until(() => page.locator('[data-map-rail]').count(), { what: 'the map rail', timeout: 25000 });
  await page.evaluate("document.querySelector('#truegle-map-container')?.scrollIntoView({ block: 'center' })");
  await page.waitForTimeout(1500);
  return { ctx, page, errs, calls };
}

const reach = (page, id) => page.evaluate(`(() => {
  const e = document.querySelector('[data-map-control="${id}"]'); if (!e) return 'absent';
  const r = e.getBoundingClientRect();
  if (r.width < 20 || r.height < 20) return 'TOO SMALL ' + Math.round(r.width) + 'x' + Math.round(r.height);
  if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return 'OFF SCREEN';
  const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return (t === e || e.contains(t)) ? 'ok' : 'COVERED by ' + (t ? t.tagName + ' ' + (t.getAttribute('aria-label') || String(t.className).slice(0, 40)) : 'nothing');
})()`);
const stateOf = (page, id) => page.locator(`[data-map-control="${id}"] [data-control-state]`).innerText().catch(() => '');
const press = (page, id) => page.locator(`[data-map-control="${id}"]`).dispatchEvent('click');
const view = (page) => page.evaluate(`document.querySelector('[data-azimuthal-view]') ? 'azimuthal' : document.querySelector('.azimuthal-globe-container canvas') ? 'globe' : document.querySelector('.maplibregl-map') ? 'street' : 'none'`);

const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 900 } },
};

for (const [name, device] of Object.entries(DEVICES)) {
  const tag = `[${name}]`;
  const { ctx, page, errs, calls } = await open(device);

  // ── ONE RAIL, ON THE RIGHT, EVERY BUTTON REACHABLE WITHOUT FULL SCREEN ─────
  const rail = await page.locator('[data-map-rail]').boundingBox();
  const mapBox = await page.locator('#truegle-map-container').boundingBox();
  check(rail && mapBox && rail.x + rail.width > mapBox.x + mapBox.width - 16 && rail.x > mapBox.x + mapBox.width / 2, `${tag} the controls are one column down the RIGHT side of the map`, rail && mapBox ? `rail x ${Math.round(rail.x)}–${Math.round(rail.x + rail.width)} of map ${Math.round(mapBox.x)}–${Math.round(mapBox.x + mapBox.width)}` : 'missing');
  for (const id of ['zoom-in', 'zoom-out', 'locate', 'globe', 'azimuthal', 'style', 'layers', 'directions', 'fullscreen', 'close']) {
    let r = await reach(page, id);
    if (r === 'OFF SCREEN') { await page.locator(`[data-map-control="${id}"]`).scrollIntoViewIfNeeded().catch(() => {}); r = await reach(page, id); }
    check(r === 'ok', `${tag} "${id}" can be pressed without going full screen`, r);
  }
  check(!(await page.locator('[data-map-control="map"], [title="Standard Map View"]').count()), `${tag} there is no "Map" view button`);
  const oldBars = await page.evaluate(`[...document.querySelectorAll('button')].filter((b) => /^(Toggle Traffic|Traffic Cameras|Search Cameras|Enter Fullscreen|Reset View)$/.test(b.title)).length`);
  check(oldBars === 0, `${tag} the old scattered buttons are gone (traffic-cam menu, camera search, separate full-screen, Reset View)`, `${oldBars} left`);
  check(!(await page.locator('.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-compass').count()), `${tag} no second zoom/compass control in a corner`);

  // ── EVERY BUTTON SAYS ITS STATE ────────────────────────────────────────────
  const style0 = await stateOf(page, 'style');
  await press(page, 'style');
  await page.waitForTimeout(300);
  const style1 = await stateOf(page, 'style');
  await press(page, 'style');
  await page.waitForTimeout(300);
  const style2 = await stateOf(page, 'style');
  check(style0 && style1 && style2 && new Set([style0, style1, style2]).size === 3, `${tag} Style names the basemap it is on, and each press shows the next one`, `${style0} → ${style1} → ${style2}`);
  check(['Here', 'Go back', 'Find', 'Blocked'].includes(await stateOf(page, 'locate')), `${tag} Me says where your location stands`, await stateOf(page, 'locate'));
  check(await stateOf(page, 'globe') === 'Off' && await stateOf(page, 'layers') === 'Off', `${tag} Globe and Layers say Off before use`);

  // ── LAYERS: CAMERAS AS AN OVERLAY, ONE AT A TIME OR ALL ────────────────────
  await press(page, 'layers');
  await until(() => page.locator('[data-map-layers]').count(), { what: 'the layers panel' });
  const rows = await page.locator('[data-layer-switch]').evaluateAll((els) => els.map((e) => e.getAttribute('data-layer-switch')));
  check(rows.includes('all') && rows.includes('cameras') && rows.includes('flights') && !rows.includes('cctv'), `${tag} Layers lists each layer by name, a Cameras overlay, and an all-at-once switch`, rows.join(','));
  const flightsSw = page.locator('[data-layer-switch="flights"]');
  check(await flightsSw.getAttribute('aria-checked') === 'false' && /Off/.test(await flightsSw.innerText()), `${tag} each switch SAYS Off…`);
  await flightsSw.dispatchEvent('click');
  await page.waitForTimeout(400);
  check(await flightsSw.getAttribute('aria-checked') === 'true' && /On/.test(await flightsSw.innerText()), `${tag} …and On once pressed`);
  check(await stateOf(page, 'layers') === '1 on', `${tag} the rail counts the layers that are on`, await stateOf(page, 'layers'));
  await page.locator('[data-layer-switch="all"]').dispatchEvent('click');
  await page.waitForTimeout(600);
  const allOn = await page.locator('[data-layer-switch]').evaluateAll((els) => els.every((e) => e.getAttribute('aria-checked') === 'true'));
  check(allOn, `${tag} "God's eye" turns every layer on at once`);
  await page.locator('[data-layer-switch="all"]').dispatchEvent('click');
  await page.waitForTimeout(400);
  const allOff = await page.locator('[data-layer-switch]').evaluateAll((els) => els.every((e) => e.getAttribute('aria-checked') === 'false'));
  check(allOff, `${tag} …and off again`);

  // Cameras: zoom in close, switch them on, icons appear with live previews.
  await page.locator('[data-layer-switch="cameras"]').dispatchEvent('click');
  // A street-level view of where the cameras are (the map opened on the
  // visitor, in Los Angeles): one step out so they are all in frame.
  await press(page, 'zoom-out');
  await page.waitForTimeout(1500);
  await until(() => page.locator('.truegle-camera-marker').count(), { what: 'camera icons', timeout: 8000 }).catch(() => {});
  const icons = await page.locator('.truegle-camera-marker').count();
  check(icons >= 2, `${tag} with Cameras on, camera ICONS sit on the map where cameras are (both sources)`, `${icons} icons`);
  check(calls.some((c) => c.startsWith('/api/maps/traffic-cameras/bbox/')) && calls.some((c) => c.startsWith('/api/osiris/cctv')), `${tag} …asked for the cameras in view from both sources`);
  if (icons) {
    if (name === 'desktop') {
      await page.locator('.truegle-camera-marker').first().hover();
      await page.waitForTimeout(500);
      check(await page.locator('.truegle-camera-marker img, .truegle-camera-marker video').count() > 0, `${tag} hovering a camera shows its live picture`);
    }
    await page.locator('.truegle-camera-marker').first().dispatchEvent('click');
    await until(() => page.locator('[role="dialog"]').count(), { what: 'the camera opened', timeout: 4000 }).catch(() => {});
    check(await page.locator('[role="dialog"]').count() > 0, `${tag} a tap opens the camera full size`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  if (!(await page.locator('[data-map-layers]').count())) await press(page, 'layers');
  await until(() => page.locator('[data-camera-wall-open]').count(), { what: 'the wall button', timeout: 4000 }).catch(() => {});
  if (await page.locator('[data-camera-wall-open]').count()) {
    await page.locator('[data-camera-wall-open]').dispatchEvent('click');
    await page.waitForTimeout(500);
    check(await page.locator('[data-camera-tile]').count() >= 2, `${tag} "Watch all in view" shows every camera on screen at once`, `${await page.locator('[data-camera-tile]').count()} tiles`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/rail-${name}-wall.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    check(false, `${tag} "Watch all in view" is offered when cameras are on screen`);
  }
  if (await page.locator('[data-map-layers]').count()) await press(page, 'layers');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rail-${name}.png` });

  // ── AZIMUTHAL: REAL, DRAGGABLE, ZOOMABLE, HANDS BACK ON ZOOM-IN ────────────
  await press(page, 'azimuthal');
  await until(async () => (await view(page)) === 'azimuthal', { what: 'the azimuthal view', timeout: 6000 }).catch(() => {});
  check(await view(page) === 'azimuthal', `${tag} Azimuthal opens`);
  check(await stateOf(page, 'azimuthal') === 'On', `${tag} …and its button says On`);
  await until(() => page.locator('[data-azimuthal-view] path').count().then((n) => n >= 3), { what: 'the coastlines', timeout: 6000 }).catch(() => {});
  const landPaths = await page.locator('[data-azimuthal-view] path').count();
  check(landPaths >= 4, `${tag} it draws the real world (sphere, graticule, land, borders)`, `${landPaths} paths`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rail-${name}-azimuthal.png` });
  const az = page.locator('[data-azimuthal-view]');
  const bb = await az.boundingBox();
  const c0 = await az.getAttribute('data-center');
  // Drag with a real pointer (touch on the phone).
  if (device.hasTouch) {
    const cdp = await ctx.newCDPSession(page);
    const x = bb.x + bb.width / 2; const y = bb.y + bb.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 10, y: y - i * 5 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const c1 = await az.getAttribute('data-center');
    check(c1 !== c0, `${tag} one finger drags the azimuthal world (it used to stay put)`, `${c0} → ${c1}`);
    const z0 = Number(await az.getAttribute('data-zoom'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30 - i * 12, y, id: 1 }, { x: x + 30 + i * 12, y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    const z1 = Number(await az.getAttribute('data-zoom'));
    check(z1 > z0 * 1.5, `${tag} two fingers pinch-zoom the azimuthal view`, `${z0} → ${z1}`);
  } else {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width / 2 - 80, bb.y + bb.height / 2 - 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    check(await az.getAttribute('data-center') !== c0, `${tag} dragging moves the azimuthal world`);
    const z0 = Number(await az.getAttribute('data-zoom'));
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(300);
    check(Number(await az.getAttribute('data-zoom')) > z0, `${tag} the wheel zooms the azimuthal view (and does not scroll the page)`);
  }
  // Zoom in from the rail until it hands over.
  for (let i = 0; i < 12 && (await view(page)) === 'azimuthal'; i++) { await press(page, 'zoom-in'); await page.waitForTimeout(350); }
  check(await view(page) === 'street', `${tag} zooming in on Azimuthal switches to the street map by itself`);

  // ── GLOBE: OPENS, ZOOM-IN HANDS BACK ───────────────────────────────────────
  await press(page, 'globe');
  await until(async () => (await view(page)) === 'globe', { what: 'the globe', timeout: 8000 }).catch(() => {});
  const g = await view(page);
  check(g === 'globe', `${tag} Globe opens`, g);
  if (g === 'globe') {
    check(await stateOf(page, 'globe') === 'On', `${tag} …and its button says On`);
    await page.waitForTimeout(1200);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/rail-${name}-globe.png` });
    for (let i = 0; i < 14 && (await view(page)) === 'globe'; i++) { await press(page, 'zoom-in'); await page.waitForTimeout(300); }
    check(await view(page) === 'street', `${tag} zooming in on the Globe switches to the street map by itself`);
  }

  // ── FULL SCREEN keeps the same rail ────────────────────────────────────────
  await press(page, 'fullscreen');
  await page.waitForTimeout(600);
  check(await stateOf(page, 'fullscreen') === 'On', `${tag} Full says On in full screen`);
  check(await reach(page, 'layers') === 'ok' && await reach(page, 'zoom-in') === 'ok', `${tag} the same rail, still pressable, in full screen`);
  const fsBox = await page.locator('#truegle-map-container').boundingBox();
  check(fsBox && fsBox.width >= device.viewport.width - 2 && fsBox.height >= device.viewport.height - 2, `${tag} full screen fills the screen (works without the browser API too)`, fsBox ? `${Math.round(fsBox.width)}x${Math.round(fsBox.height)}` : '');
  await press(page, 'fullscreen');
  await page.waitForTimeout(300);
  check(await stateOf(page, 'fullscreen') === 'Off', `${tag} …and Off again`);

  check(errs.length === 0, `${tag} nothing threw`, errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
