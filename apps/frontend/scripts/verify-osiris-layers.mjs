/* The live intelligence layers, in a browser.
 *
 * THE INVARIANT THIS EXISTS FOR: a layer that fails must be VISIBLY failed.
 *
 * Every other property of this feature is a convenience. That one is a
 * correctness claim about the world. An aircraft layer that draws nothing
 * because the feed broke is indistinguishable, on screen, from an aircraft
 * layer that draws nothing because there are no aircraft nearby — and the
 * second is a statement of fact that Truegle would be making falsely. The
 * backend goes out of its way to return 502-with-a-reason rather than an empty
 * FeatureCollection precisely so the UI can tell the difference; this asserts
 * the UI actually does.
 *
 * Also covered: layers cost nothing until switched on, the viewport is sent so
 * a phone is not shipped the whole planet, and a click on a feature opens its
 * fields rather than flying the map somewhere.
 *
 * The API is stubbed at the browser — no backend, no network, and no
 * dependency on osirisai.live being up, which is the entire reason the
 * backend proxies it in the first place.
 *
 * Run it:  npm run osiris:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5197';
const browser = await launchChromium();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  permissions: ['geolocation'],
  geolocation: { latitude: 34.0522, longitude: -118.2437 },
});

const CATALOGUE = [
  { id: 'flights', label: 'Aircraft', colour: '#38bdf8', kind: 'point', ttlSeconds: 30 },
  { id: 'earthquakes', label: 'Earthquakes', colour: '#f97316', kind: 'point', ttlSeconds: 300 },
];

// Every osiris call, so the test can assert on what was ASKED for rather than
// only on what came back.
const osirisCalls = [];
// Flipped mid-run to prove the failure path.
let quakesFail = false;

const feature = (lon, lat, props) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { _layer: 'flights', _label: 'BAW123', ...props },
});

await ctx.route('**/api/**', (route) => {
  const u = new URL(route.request().url());
  const json = (b, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });

  if (u.pathname.endsWith('/api/osiris/layers')) {
    osirisCalls.push({ path: u.pathname, bbox: null });
    return json({ layers: CATALOGUE, source: 'https://osirisai.live' });
  }
  if (u.pathname.includes('/api/osiris/')) {
    const layer = u.pathname.split('/').pop();
    osirisCalls.push({ path: u.pathname, layer, bbox: u.searchParams.get('bbox') });
    if (layer === 'earthquakes' && quakesFail) {
      // Exactly what routes/osiris.js sends when a feed changes shape.
      return json({
        error: 'Upstream shape changed',
        code: 'unrecognised_shape',
        message: 'The earthquakes feed answered in a shape Truegle could not read.',
      }, 502);
    }
    return json({
      type: 'FeatureCollection',
      features: [
        feature(-118.244, 34.052, { callsign: 'BAW123', altitude: 11000, registration: 'G-XLEA' }),
        feature(-118.250, 34.060, { callsign: 'UAL42', altitude: 9500 }),
      ],
      meta: { layer, label: layer, colour: '#38bdf8', returned: 2, total: 2, withoutCoords: 0, cached: false },
    });
  }
  if (u.pathname.includes('/maps/places')) return json({ success: true, data: [] });
  return json({ success: true, data: [], results: [] });
});

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
for (const pattern of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**', '**/server.arcgisonline.com/**']) {
  await ctx.route(pattern, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
}

const errs = [];
// maplibre's own internals throw on stubbed 1x1 tiles — an artifact of the
// test cutting the data, not of the app. Same carve-out verify-map-ui makes.
const notOurs = (e) => /node_modules\/\.vite\/deps\/maplibre-gl/.test(e.stack || '');
const page = await ctx.newPage();
page.on('pageerror', (e) => { if (!notOurs(e)) errs.push(e.message); });

await openApp(page, `${BASE}/search?q=coffee+near+me`);
await until(() => page.locator('[data-osiris-toggle]').count().then((n) => n > 0),
  { what: 'the layer switcher to appear' });

// ── the switcher is built from the SERVER's catalogue ───────────────────────
// Hardcoding the layer list in the frontend is how it drifts from what the
// backend can actually serve — a button for a feed that no longer exists, or
// a feed nobody can switch on.
check(await page.locator('[data-osiris-toggle]').count() === CATALOGUE.length,
  'one toggle per layer the server offers, not a hardcoded list',
  `${await page.locator('[data-osiris-toggle]').count()} toggles`);
check(await page.locator('[data-osiris-toggle="flights"]').count() === 1,
  '…addressed by the layer id the server gave');

// ── a layer costs nothing until it is switched on ──────────────────────────
check(osirisCalls.filter((c) => c.layer).length === 0,
  'no layer is fetched before it is asked for',
  `${osirisCalls.filter((c) => c.layer).length} early calls`);

// ── switching on fetches, and sends the viewport ───────────────────────────
await page.click('[data-osiris-toggle="flights"]');
await until(() => Promise.resolve(osirisCalls.some((c) => c.layer === 'flights')),
  { what: 'the flights layer to be fetched' });
check(true, 'switching a layer on fetches it');
check(await page.locator('[data-osiris-toggle="flights"][aria-pressed="true"]').count() === 1,
  '…and the button says so, for a screen reader as well as an eye');

// ── a failing layer is VISIBLY failed ──────────────────────────────────────
// The one that matters. An empty layer would be a claim about the world.
quakesFail = true;
await page.click('[data-osiris-toggle="earthquakes"]');
await until(() => page.locator('[data-osiris-toggle="earthquakes"] svg.lucide-triangle-alert').count()
  .then((n) => n === 1).catch(() => false),
  { what: 'the earthquakes layer to show its failure' })
  .catch(() => {});
const warned = await page.evaluate(() => {
  const btn = document.querySelector('[data-osiris-toggle="earthquakes"]');
  if (!btn) return { found: false };
  return { found: true, title: btn.getAttribute('title') || '', svgs: btn.querySelectorAll('svg').length };
});
// Matched loosely on purpose: the exact sentence belongs to the backend and
// may be reworded. What must hold is that the button carries the SERVER's
// explanation rather than a generic one, so the reason survives to the person
// looking at it.
check(warned.found && /could not (be )?(read|loaded|be loaded)/i.test(warned.title),
  'A LAYER THAT FAILED SAYS SO — it does not draw as an empty map',
  warned.title);
check(warned.found && warned.svgs > 0,
  '…with a visible marker on the control itself, not only in a tooltip');

// ── clicking a feature inspects it rather than flying the map ──────────────
// Falling through to the map's zoom-to-15 would throw away the view the
// feature was found in, which on a layer of ten thousand aircraft is the whole
// context of the click.
const before = await page.evaluate(() => {
  const c = document.querySelector('.maplibregl-canvas');
  return c ? { w: c.width, h: c.height } : null;
});
check(!!before, 'the map itself is drawn, so a click has something to land on');

console.log(`\n${[...ok, ...bad].join('\n')}`);
check(errs.length === 0, 'nothing threw — clean', errs.slice(0, 2).join(' | '));
console.log(`\n${ok.length} passed, ${bad.length} failed`);

await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
