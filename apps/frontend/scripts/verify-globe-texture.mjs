/* The globe's Earth texture, and the reprojection that makes it an Earth.
 *
 * WHAT WENT WRONG. The globe textured its sphere from NASA GIBS and fell back
 * to the bundled Azimuthal-satellite-view.png. GIBS is a public science
 * service with no uptime promise, so the fallback ran often — and that file is
 * an AZIMUTHAL projection. Wrapping a polar disc onto a lat/lon sphere puts
 * every continent in the wrong place, and since the disc is mostly pale, users
 * got a featureless white ball and reported "the globe doesn't render".
 *
 * THE TRAP IN THE REPLACEMENT. Web Mercator tiles are not equirectangular.
 * Pasting a tile grid straight onto UV space LOOKS right — it fills the sphere,
 * the colours are real satellite imagery — while dragging Greenland over the
 * pole and squashing the tropics. It is a bug you cannot see without measuring,
 * which is exactly why it is measured here rather than eyeballed.
 *
 * HOW. Each Esri tile is stubbed with a solid colour keyed to its ROW, so the
 * latitude a given output row was sampled from is readable straight off the
 * pixels. The assertions target rows where a correct inverse-Mercator and a
 * naive stretch DISAGREE — otherwise the test would pass on the bug.
 *
 * Run it:  npm run globetex:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5198';
const browser = await launchChromium();

// One solid-colour 8x8 PNG per Mercator tile ROW. Row is what latitude maps
// to, so the colour of an output row names the source row it came from.
const ROW_COLOURS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
const NAMES = ['red(row0)', 'green(row1)', 'blue(row2)', 'yellow(row3)'];

const ctx = await browser.newContext();
let served = 0;
await ctx.route('**/server.arcgisonline.com/**', async (route) => {
  // .../tile/{z}/{y}/{x} — Esri puts the ROW before the column, which is the
  // reverse of the usual convention and the easiest thing to get backwards.
  const m = /\/tile\/(\d+)\/(\d+)\/(\d+)/.exec(route.request().url());
  const row = m ? Number(m[2]) : 0;
  served += 1;
  return route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${ROW_COLOURS[row] || '#000000'}"/></svg>`,
  });
});
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async () => {
  const mod = await import('/src/components/map/utils/earthTexture.js');
  const canvas = await mod.buildEquirectangularEarth();
  const c = canvas.getContext('2d');
  const at = (x, y) => {
    const d = c.getImageData(x, y, 1, 1).data;
    return `${d[0]},${d[1]},${d[2]}`;
  };
  // Row index for a latitude in a 512-tall equirectangular image.
  const rowFor = (lat) => Math.floor(((90 - lat) / 180) * 512);
  return {
    w: canvas.width,
    h: canvas.height,
    lat80: at(512, rowFor(80)),
    lat45: at(512, rowFor(45)),
    latMinus45: at(512, rowFor(-45)),
    latMinus80: at(512, rowFor(-80)),
    topEdge: at(512, 0),
    bottomEdge: at(512, 511),
  };
});

const RGB = { '255,0,0': 0, '0,255,0': 1, '0,0,255': 2, '255,255,0': 3 };
const rowOf = (rgb) => (rgb in RGB ? RGB[rgb] : -1);

ok('the texture is 2:1, the equirectangular aspect',
  result.w === 1024 && result.h === 512, `${result.w}x${result.h}`);
ok('every tile of the grid was fetched', served >= 16, `${served} tiles`);

// ── The rows a correct projection and a naive stretch agree on ─────────────
ok('80°N samples the top Mercator row', rowOf(result.lat80) === 0, NAMES[rowOf(result.lat80)] ?? result.lat80);
ok('45°N samples the second row', rowOf(result.lat45) === 1, NAMES[rowOf(result.lat45)] ?? result.lat45);

// ── The row that CATCHES the bug ──────────────────────────────────────────
// A naive stretch maps 45°S to source y≈768, which is row 3. The inverse
// Mercator puts it at y≈656, which is row 2. This single assertion is the
// difference between an Earth and a plausible-looking smear.
ok('45°S samples the THIRD row, not the fourth — the inverse Mercator ran',
  rowOf(result.latMinus45) === 2,
  `${NAMES[rowOf(result.latMinus45)] ?? result.latMinus45} (a naive stretch gives ${NAMES[3]})`);
ok('80°S samples the bottom row', rowOf(result.latMinus80) === 3,
  NAMES[rowOf(result.latMinus80)] ?? result.latMinus80);

// ── The poles Mercator cannot reach ───────────────────────────────────────
// Mercator stops at ±85.05°, so without the cap fill the sphere has a
// transparent hole at each pole.
ok('the north cap is filled rather than left transparent', rowOf(result.topEdge) === 0,
  NAMES[rowOf(result.topEdge)] ?? result.topEdge);
ok('the south cap is filled too', rowOf(result.bottomEdge) === 3,
  NAMES[rowOf(result.bottomEdge)] ?? result.bottomEdge);

// ── Refusing a half-drawn Earth ───────────────────────────────────────────
// Showing a mostly-empty grid would repeat the original bug in a new costume,
// so too few tiles must THROW and let the caller fall back.
{
  const ctx2 = await browser.newContext();
  let n = 0;
  await ctx2.route('**/server.arcgisonline.com/**', (route) => {
    n += 1;
    // Only a quarter of the grid answers.
    return n <= 4
      ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ff0000"/></svg>' })
      : route.abort();
  });
  await ctx2.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const threw = await p2.evaluate(async () => {
    const mod = await import('/src/components/map/utils/earthTexture.js');
    try { await mod.buildEquirectangularEarth(); return false; } catch { return true; }
  });
  ok('a mostly-failed tile grid throws instead of returning a broken Earth', threw);
  await ctx2.close();
}

// ── The sphere must actually SHOW it ──────────────────────────────────────
// Everything above can pass while the globe renders pure white, and it did.
// React sets `map` on a material three.js has ALREADY compiled a shader for,
// and that program contains no texture sampling — so the sphere drew `color`
// alone with the texture bound, uploaded and correct. Only a rendered pixel
// catches that, which is why this phase drives the real page.
{
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx3.route('**/server.arcgisonline.com/**', (route) => {
    const m = /\/tile\/(\d+)\/(\d+)\/(\d+)/.exec(route.request().url());
    const row = m ? Number(m[2]) : 0;
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${ROW_COLOURS[row] || '#000000'}"/></svg>`,
    });
  });
  await ctx3.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], results: [] }) }));
  const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  for (const p of ['**/tile.openstreetmap.org/**', '**/*.basemaps.cartocdn.com/**']) {
    await ctx3.route(p, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
  }
  for (const p of ['**/*.mapbox.com/**', '**/nominatim.openstreetmap.org/**', '**/overpass-api.de/**', '**/gibs.earthdata.nasa.gov/**']) {
    await ctx3.route(p, (r) => r.abort());
  }

  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/search?q=coffee+near+me`, { waitUntil: 'domcontentloaded' });
  const until = async (fn, ms = 30000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await fn()) return true; await p3.waitForTimeout(300); }
    return false;
  };

  await until(() => p3.locator('button', { hasText: /^\s*Maps\s*$/ }).count().then((n) => n > 0));
  // The first-search modal is portalled and animates in, so it can arrive
  // AFTER the category row and swallow every click until dismissed.
  for (let i = 0; i < 15; i++) {
    if (!(await p3.locator('div.z-\\[9999\\]').count())) { await p3.waitForTimeout(300); continue; }
    await p3.locator('div.z-\\[9999\\] button').first().click({ force: true }).catch(() => {});
    await p3.waitForTimeout(500);
    if (!(await p3.locator('div.z-\\[9999\\]').count())) break;
  }
  await p3.locator('button', { hasText: /^\s*Maps\s*$/ }).first().click();
  await p3.waitForTimeout(1200);
  const mapBtn = p3.locator('button', { hasText: /map/i });
  if (await mapBtn.count()) await mapBtn.last().click();
  const mounted = await until(() => p3.locator('#truegle-map-container').count().then((n) => n === 1));
  ok('the map opens', mounted);

  const globeBtn = p3.locator('button[title*="lobe" i], button[aria-label*="lobe" i]');
  if (mounted && await globeBtn.count()) {
    await globeBtn.first().click({ force: true });
    await p3.waitForTimeout(6000);

    // Sample the WebGL canvas across the sphere. The stub tiles are strongly
    // saturated, so a correctly textured globe cannot come back grey.
    const shot = await p3.locator('#truegle-map-container').screenshot();
    const stats = await p3.evaluate(async (b64) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let coloured = 0; let near = 0;
      for (let i = 0; i < d.length; i += 4 * 37) {           // sparse sample
        const [r, gg, bb] = [d[i], d[i + 1], d[i + 2]];
        const max = Math.max(r, gg, bb); const min = Math.min(r, gg, bb);
        if (max < 40) continue;                              // page background
        near += 1;
        if (max - min > 60) coloured += 1;                   // saturated => textured
      }
      return { coloured, near, ratio: near ? coloured / near : 0 };
    }, shot.toString('base64'));

    ok('the sphere renders the texture rather than flat white',
      stats.ratio > 0.2,
      `${(stats.ratio * 100).toFixed(1)}% of lit pixels are saturated (white sphere scores ~0)`);
  } else {
    ok('the globe control is reachable', false, 'no globe button found');
  }
  await ctx3.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
await server.close();
process.exit(failed === 0 ? 0 : 1);
