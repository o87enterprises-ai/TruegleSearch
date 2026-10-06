/* Public transit in the map's Directions.
 *
 * Owner, 2026-10-06: "add a local public transit option to the truegle maps
 * directions." Pinned:
 *   - Directions offers Transit beside Drive / Walk / Bike
 *   - Transit asks OUR backend (/api/maps/transit), never the provider directly,
 *     with the trip's coordinates and the chosen time
 *   - the trips are listed (times, duration, line chips, transfers)
 *   - the picked trip is spelled out step by step; picking another changes it
 *   - no transit found is SAID, not shown as a blank panel
 *   - Transit has a "when"; the driving route options do not apply to it
 *
 * Run it:  npm run maptransit:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5295;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const leg = (mode, extra = {}) => ({
  mode, transit: mode !== 'WALK', route: null, headsign: null, agency: null, color: null,
  from: { name: null, lat: 40.758, lng: -73.985, time: '2026-10-07T16:02:00Z' },
  to: { name: null, lat: 40.75, lng: -73.98, time: '2026-10-07T16:10:00Z' },
  duration: 480, distance: 600, stops: null,
  geometry: [[-73.9855, 40.758], [-73.98, 40.75]], ...extra,
});
const TRIPS = [
  { duration: 6240, startTime: '2026-10-07T16:02:00Z', endTime: '2026-10-07T17:46:00Z', transfers: 1, legs: [
    leg('WALK', { to: { name: 'W 44 St/6 Av', time: '2026-10-07T16:10:00Z' } }),
    leg('BUS', { route: 'M55', headsign: 'South Ferry', color: '#6cbe45', agency: 'MTA New York City Transit', stops: 22,
      from: { name: 'W 44 St/6 Av', time: '2026-10-07T16:10:00Z' }, to: { name: 'State St/Bridge St', time: '2026-10-07T17:00:00Z' },
      geometry: [[-73.98, 40.75], [-74.01, 40.70]] }),
    leg('FERRY', { route: 'Liberty Island', from: { name: 'Battery Park', time: '2026-10-07T17:10:00Z' }, to: { name: 'Liberty Island', time: '2026-10-07T17:40:00Z' },
      geometry: [[-74.01, 40.70], [-74.0445, 40.6892]] }),
  ] },
  { duration: 5400, startTime: '2026-10-07T16:20:00Z', endTime: '2026-10-07T17:50:00Z', transfers: 0, legs: [
    leg('WALK'), leg('SUBWAY', { route: '1', headsign: 'South Ferry', color: '#ee352e', from: { name: 'Times Sq-42 St' }, to: { name: 'South Ferry' } }),
  ] },
];

async function open({ trips }) {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 950 }, permissions: ['geolocation'], geolocation: { latitude: 40.758, longitude: -73.9855 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  const transitCalls = [];
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    let body = null; try { body = JSON.parse(r.request().postData() || 'null'); } catch { /* GET */ }
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/api/maps/transit') { transitCalls.push(body); return json({ success: true, data: { itineraries: trips }, provider: 'transitous' }); }
    return json({ success: true, data: [], results: [] });
  });
  const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  for (const h of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**', '**/server.arcgisonline.com/**']) {
    await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  }
  for (const h of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/overpass-api.de/**', '**/router.project-osrm.org/**', '**/api.transitous.org/**']) {
    await ctx.route(h, (r) => r.abort());
  }
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => { if (!/maplibre-gl/.test(e.stack || '')) errs.push(e.message); });
  await openApp(page, `${BASE}/search?q=times+square+new+york`);
  const mapsBtn = page.locator('button', { hasText: /^\s*Maps\s*$/ }).first();
  await until(() => mapsBtn.count(), { what: 'the Maps category' });
  const keep = page.locator('button', { hasText: /No, keep Smart/i });
  if (await keep.count()) { await keep.first().click(); await page.waitForTimeout(600); }
  await mapsBtn.click();
  await page.waitForTimeout(1200);
  if (!(await page.locator('#truegle-map-container').count())) await page.locator('button', { hasText: /map/i }).last().click();
  await until(() => page.locator('#truegle-map-container').count(), { what: 'the map', timeout: 25000 });
  await page.waitForTimeout(800);
  // The map's own Directions control (not a listing's).
  const dir = page.locator('[data-map-control="directions"], [title="Directions"]').first();
  await until(() => dir.count(), { what: 'the Directions control' });
  await dir.dispatchEvent('click');
  await until(() => page.locator('[data-travel-mode="transit"]').count(), { what: 'the Directions panel' });
  return { ctx, page, errs, transitCalls };
}

async function ask(page) {
  await page.locator('[data-travel-mode="transit"]').dispatchEvent('click');
  const from = page.locator('input[placeholder="Starting location..."]').first();
  const to = page.locator('input[placeholder="Choose destination..."]').first();
  await from.fill('40.758, -73.9855');
  await to.fill('40.6892, -74.0445');
  await page.getByRole('button', { name: /Get Directions/ }).dispatchEvent('click');
}

{
  const { ctx, page, errs, transitCalls } = await open({ trips: TRIPS });
  check(await page.locator('[data-travel-mode]').count() === 4, 'Directions offers four ways: Drive, Walk, Bike, Transit');
  await page.locator('[data-travel-mode="transit"]').dispatchEvent('click');
  check(await page.getByText('Leave now').count() > 0, 'Transit asks WHEN (Leave now / depart at)');
  check(!(await page.getByText('Least traffic').count()), '…and the driving route options are not offered for it');
  await ask(page);
  await until(() => page.locator('[data-transit-trip]').count(), { what: 'the trips', timeout: 8000 }).catch(() => {});
  check(transitCalls.length === 1, 'it asks Truegle\'s own backend, once', `${transitCalls.length} call(s)`);
  const c = transitCalls[0] || {};
  check(c.origin?.lat === 40.758 && c.destination?.lng === -74.0445, '…with the trip\'s coordinates', JSON.stringify({ o: c.origin, d: c.destination }));
  check(await page.locator('[data-transit-trip]').count() === 2, 'both trips are listed');
  const first = await page.locator('[data-transit-trip="0"]').innerText();
  check(/M55/.test(first) && /Liberty Island/.test(first) && /1 transfer/.test(first) && /1 h 44 min/.test(first), 'a trip shows its lines, transfers and duration', first.replace(/\s+/g, ' '));
  const steps = await page.locator('[data-transit-steps]').innerText();
  check(/Bus M55 toward South Ferry/.test(steps) && /W 44 St\/6 Av/.test(steps) && /22 stops/.test(steps), 'the picked trip is spelled out: line, direction, stops', steps.replace(/\s+/g, ' ').slice(0, 140));
  await page.locator('[data-transit-trip="1"]').dispatchEvent('click');
  await page.waitForTimeout(300);
  const steps2 = await page.locator('[data-transit-steps]').innerText();
  check(/Subway 1 toward South Ferry/.test(steps2), 'picking the other trip spells out that one instead', steps2.replace(/\s+/g, ' ').slice(0, 80));
  check(await page.locator('[data-transit-trip="1"][aria-pressed="true"]').count() === 1, '…and marks it as the picked one');
  check(await page.getByText('Transitous').count() > 0, 'the timetable source is credited');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

{
  const { ctx, page } = await open({ trips: [] });
  await ask(page);
  await until(() => page.getByText(/No public transit found/).count(), { what: 'the no-transit message', timeout: 8000 }).catch(() => {});
  check(await page.getByText(/No public transit found/).count() > 0, 'no transit is SAID, with what to try instead');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
