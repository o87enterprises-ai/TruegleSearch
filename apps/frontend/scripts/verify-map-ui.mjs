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
 *   THREE TRUEGLE LOGOS IN ONE CORNER, in three different treatments.
 *     TruegleMap drew the 1200x630 og-image SHARE CARD squashed into a 120x40
 *     box and straight through the Reset View button; MapViewWrapper drew the
 *     real mark again at h-8; LogoOverlay drew it a third time at 100px inside
 *     a rounded, shadowed card with no mixBlendMode, so its black backdrop sat
 *     on the map as a grey tile.
 *   THE MAP DID NOT DRAW AT ALL. Every style was a `mapbox://` URL needing an
 *     access token the deployment does not have, so mapbox-gl threw on the
 *     first one and nothing ever painted. This file passed throughout, because
 *     it only ever measured the CHROME around the map. Section 0 is the fix
 *     for that: it asserts there is a sized canvas and that tiles were
 *     actually requested — the difference between "the map is mounted" and
 *     "the map is showing you something".
 *
 * Geometry, not pixels: tiles are stubbed with a 1x1 image (the sandbox denies
 * every tile host) and a screenshot diff would fail on a starfield that is
 * different every frame.
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

// Every outbound call, so the test can assert on what was ASKED for.
const calls = [];
await ctx.route('**/api/**', (route) => {
  const req = route.request();
  const u = new URL(req.url());
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  calls.push({ path: u.pathname, body });
  const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (u.pathname.includes('/maps/geocode')) {
    return json({ success: true, provider: 'mapbox', data: [
      { address: 'Los Angeles, California', position: { lon: -118.2437, lat: 34.0522 }, type: 'place', relevance: 0.99 },
    ] });
  }
  if (u.pathname.includes('/maps/places')) {
    return json({ success: true, provider: 'mapbox', data: [
      { name: 'Blue Bottle Coffee', address: '300 S Broadway', position: { lon: -118.244, lat: 34.051 }, type: 'poi' },
    ] });
  }
  return json({ success: true, data: [], results: [] });
});
// TILES ARE SERVED, not blocked. The style is built in the app now
// (config/basemap.js) rather than fetched, so the only thing standing between
// "mounted" and "drawn" is whether the raster source resolves — which is
// exactly what section 0 measures. Every tile host is denied by the sandbox's
// network policy, so each one is answered with a 1x1 PNG and recorded.
const TILE_HOSTS = [
  '**/tile.openstreetmap.org/**',
  '**/*.basemaps.cartocdn.com/**',
  '**/server.arcgisonline.com/**',
];
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const tileRequests = [];
for (const pattern of TILE_HOSTS) {
  await ctx.route(pattern, (r) => {
    tileRequests.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
  });
}
// A token would be a bug now — nothing here should be asking Mapbox anything.
const mapboxRequests = [];
await ctx.route('**/*.mapbox.com/**', (r) => { mapboxRequests.push(r.request().url()); return r.abort(); });
await ctx.route('**/nominatim.openstreetmap.org/**', (r) => r.abort());
await ctx.route('**/overpass-api.de/**', (r) => r.abort());
await ctx.route('**/router.project-osrm.org/**', (r) => r.abort());

const errs = [];
// APP errors only, and two things are deliberately not app errors:
//
//   The RENDERER's own internals. Tiles here are a 1x1 stub, so maplibre can
//   throw inside its own unproject()/queryTerrain paths on a pointer move —
//   an artifact of the test cutting the data, not of the app.
//   The AD IFRAME's localStorage access. Ad frames are sandboxed WITHOUT
//   `allow-same-origin` — that is the non-negotiable rule in docs/AD-POLICY.md,
//   written after an ad navigated the whole tab away — so any storage access
//   inside one throws by design. Counting it would mean the policy working
//   correctly fails the test.
const notOurs = (e) => /node_modules\/\.vite\/deps\/maplibre-gl/.test(e.stack || '')
  || /localStorage.+(sandboxed|Access is denied)/i.test(e.message || '');
const watchErrors = (p) => p.on('pageerror', (e) => { if (!notOurs(e)) errs.push(e.message); });

const page = await ctx.newPage();
watchErrors(page);

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

// ── 0. THE MAP ACTUALLY DRAWS ───────────────────────────────────────────────
// The one thing this file never checked, and the one thing that was broken.
//
// Polled rather than measured once: the map card opens on a height animation,
// and the renderer re-measures itself on a debounced ResizeObserver, so a
// single reading taken mid-animation catches a sliver and says "broken" about
// a map that is merely still growing. The question is whether it gets there,
// not whether it got there by a particular millisecond.
const drew = await page.waitForFunction(() => {
  const c = document.querySelector('#truegle-map-container canvas');
  if (!c) return false;
  const r = c.getBoundingClientRect();
  return r.width > 200 && r.height > 100;
}, null, { timeout: 20000 }).then(() => true).catch(() => false);

const canvas = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const c = box?.querySelector('canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return {
    width: Math.round(r.width),
    height: Math.round(r.height),
    // maplibre-gl.css is what positions this. It used to arrive as a CDN
    // <link> in index.html for a library the map no longer uses; it is a
    // module import now, so it is in the bundle rather than on the wire.
    positioned: getComputedStyle(c).position,
  };
});
check(!!canvas, 'there is a map canvas at all');
check(drew, '…that grows to fill the card, not a zero-height sliver',
  `${canvas?.width}x${canvas?.height}`);
check(canvas?.positioned === 'absolute',
  '…positioned by the map stylesheet, which now ships in the bundle',
  canvas?.positioned);
check(tileRequests.length > 0, 'the map asks for tiles — the thing a blank map never did',
  `${tileRequests.length} tile requests · ${tileRequests[0] || 'none'}`);
check(mapboxRequests.length === 0,
  'and asks Mapbox for nothing — no token, no licence, and no CDN stylesheet',
  mapboxRequests.slice(0, 2).join(' | ') || 'none');

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

// ── 4b. ONE logo, the legacy mark, clear of everything ──────────────────────
// Counted over the whole map view — the wrapper AND the container — because the
// duplicates were spread across both, which is exactly why nobody noticed.
const marks = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const view = box.closest('.rounded-2xl')?.parentElement || document.body;
  const logos = [...view.querySelectorAll('img')].filter((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && /truegle|logo/i.test(`${n.getAttribute('src')} ${n.alt}`);
  });
  const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const one = logos[0];
  const r = one?.getBoundingClientRect();
  const over = one
    ? [...box.querySelectorAll('button, input, .truegle-traditional-controls')]
      .filter((n) => { const q = n.getBoundingClientRect(); return q.width > 0 && q.height > 0 && hit(r, q); })
      .map((n) => (n.innerText || n.className || n.tagName).toString().replace(/\s+/g, ' ').slice(0, 30))
    : [];
  return {
    count: logos.length,
    srcs: logos.map((n) => n.getAttribute('src')),
    blend: one ? getComputedStyle(one).mixBlendMode : null,
    // 1024x1024 art. A letterboxed box means somebody set width AND height again.
    ratio: r ? +(r.width / r.height).toFixed(2) : null,
    clicks: one ? getComputedStyle(one).pointerEvents : null,
    over,
  };
});
check(marks.count === 1, 'the map view carries exactly one Truegle logo, not three',
  `${marks.count} · ${marks.srcs.join(' | ') || 'none'}`);
check(marks.srcs.every((s) => !/og-image/.test(s || '')),
  '…and it is the legacy brand mark, not the social share card', marks.srcs.join(' | '));
check(marks.blend === 'screen', '…blended like every other Truegle mark on black', marks.blend);
check(marks.ratio !== null && Math.abs(marks.ratio - 1) < 0.1,
  '…at its own aspect ratio, not stretched into a letterbox', `${marks.ratio}:1`);
check(marks.clicks === 'none', '…and never eating a click meant for the map', marks.clicks);
check(marks.over.length === 0, '…sitting on top of no control at all',
  marks.over.join(' | ') || 'clear');

// ── 5. the map answers the question that was asked ──────────────────────────
// "coffee near me" must search for COFFEE. The subject used to be discarded
// entirely: the query resolved to the PLACE "me" (the generic in|at|near
// pattern captured it before the geolocation pattern could run), and the
// nearby lookup was hardcoded to 'restaurant cafe shop'. So the map centred on
// a geocode of the word "me" and scattered restaurants over it.
const asked = calls.filter((c) => /\/maps\/(places|local-businesses)/.test(c.path));
check(asked.length > 0, 'the map looks for nearby places on its own',
  `${asked.length} place lookups`);
const subjects = asked.map((c) => c.body?.options?.query ?? c.body?.query ?? '(none)');
check(subjects.some((q) => /coffee/i.test(q)),
  '…for COFFEE, because that is what was typed', subjects.join(' · '));
check(!subjects.some((q) => /restaurant cafe shop/i.test(q)),
  '…and not for a hardcoded category list', subjects.join(' · '));

// The geocode must never have been asked about the word "me".
const geocoded = calls.filter((c) => c.path.includes('/maps/geocode')).map((c) => c.body?.query);
check(!geocoded.some((q) => /^\s*me\s*$/i.test(q || '')),
  '"near me" is never geocoded as a place called "me"', geocoded.join(' · ') || '(no geocodes)');

// ── 6. the search bar takes more than an address ────────────────────────────
// It called geocode() and only geocode(), so it could find "1600 Pennsylvania
// Ave" and could not find "coffee near me" or a business by name — there is no
// place called "coffee near me" for a geocoder to resolve.
const searchBar = page.locator('#truegle-map-container input').first();
await searchBar.fill('coffee near me');
await page.waitForTimeout(2500);
const nearMeAsks = calls.filter((c) => /\/maps\/places/.test(c.path))
  .map((c) => c.body?.options?.query ?? '(none)');
check(nearMeAsks.some((q) => /^coffee$/i.test(q)),
  'typing "coffee near me" searches for COFFEE around you, not for a place called that',
  nearMeAsks.join(' · ') || 'no place lookup');
const suggestion = await page.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const btn = [...box.querySelectorAll('button')].find((b) => /Blue Bottle/i.test(b.innerText));
  return btn ? btn.innerText.replace(/\s+/g, ' ').trim() : null;
});
check(!!suggestion, 'the result is offered by NAME, not by street address', suggestion || 'no suggestion');

// ── 7. the map is not a mode you get stuck in ───────────────────────────────
// Opening it took over the page — on a phone it goes native-fullscreen and
// there is nothing else you can do until you close it. The player already
// solved this; the map now has the same control.
await searchBar.fill('');
await page.waitForTimeout(300);
const popOut = page.locator('#truegle-map-container button[title*="Pop the map out"]');
check(await popOut.count() === 1, 'the map has a pop-out control');
await popOut.first().click();
await page.waitForTimeout(1500);
const popped = await page.evaluate(() => {
  const frame = document.querySelector('[data-map-popout]');
  if (!frame) return null;
  const r = frame.getBoundingClientRect();
  return {
    // Portalled to body: a transformed ancestor would make `fixed` resolve
    // against the results column and clip the window inside what it escaped.
    inBody: frame.parentElement === document.body,
    fixed: getComputedStyle(frame).position,
    hasMap: !!frame.querySelector('#truegle-map-container canvas'),
    onScreen: r.width > 100 && r.height > 100
      && r.left >= 0 && r.top >= 0
      && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
    canDock: !!frame.querySelector('button[aria-label*="Dock the map"]'),
  };
});
check(!!popped, 'clicking it floats the map over the page');
check(popped?.inBody && popped?.fixed === 'fixed',
  '…as a fixed window portalled to the body, not trapped in the results column',
  `${popped?.fixed} · body child: ${popped?.inBody}`);
check(popped?.hasMap, '…carrying the same map, still drawn');
check(popped?.onScreen, '…entirely on screen');
check(popped?.canDock, '…with a way back into the page');

await page.locator('[data-map-popout] button[aria-label*="Dock the map"]').first().click();
await page.waitForTimeout(1200);
check(await page.locator('[data-map-popout]').count() === 0, 'docking back puts it away');
check(await page.locator('#truegle-map-container canvas').count() >= 1,
  '…and the map is still there, in the page');

// ── 8. the player is reachable from inside the map ──────────────────────────
// The transport lives at the bottom of the PAGE, and the map covers the page —
// on a phone it goes native-fullscreen, which covers everything. So whatever
// was playing kept playing with no way to touch it without closing the map
// first. Five controls, and deliberately only five.
// Its own context, so a floating player cannot disturb the measurements
// above. The queue is seeded and then STARTED by pressing Next, because
// nothing auto-plays on load by design (PlayerContext.loadState) — the player
// is popped out so its controls exist on a page that is not Tube.
const ctx2 = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  permissions: ['geolocation'],
  geolocation: { latitude: 34.0522, longitude: -118.2437 },
});
await ctx2.route('**/api/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ success: true, data: [], results: [] }),
}));
for (const pattern of TILE_HOSTS) {
  await ctx2.route(pattern, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
}
await ctx2.route('**/*.mapbox.com/**', (r) => r.abort());
await ctx2.addInitScript(() => {
  localStorage.setItem('truegle_player_queue_v2', JSON.stringify({
    current: null,
    queue: [
      { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/aaa', title: 'First Track', pageUrl: 'https://youtu.be/aaa' },
      { kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/bbb', title: 'Second Track', pageUrl: 'https://youtu.be/bbb' },
    ],
    history: [], poppedOut: true, expanded: true, minimized: false,
    dock: 'float', footerView: 'watch', locked: false,
  }));
  // The map opens by itself for a "near me" query, which is the state being
  // measured; no need to drive the category chips again.
  localStorage.setItem('truegle_map_popped', '0');
});
const page2 = await ctx2.newPage();
watchErrors(page2);
await page2.goto(`${BASE}/search?q=coffee+near+me`, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(7000);
const keep2 = page2.locator('button', { hasText: /No, keep Smart/i });
if (await keep2.count()) { await keep2.first().click(); await page2.waitForTimeout(1000); }
const category2 = page2.locator('button', { hasText: /^\s*Maps\s*$/ }).first();
if (await category2.count()) { await category2.click(); await page2.waitForTimeout(1200); }
const openMap = page2.locator('button', { hasText: /^\s*(View )?map/i });
if (await openMap.count()) { await openMap.last().click(); }
await page2.waitForSelector('#truegle-map-container canvas', { timeout: 20000 }).catch(() => {});
await page2.waitForTimeout(2000);

await page2.locator('button[aria-label="Next"]').first().click();
await page2.waitForTimeout(1500);
const transport = await page2.evaluate(() => {
  const box = document.querySelector('#truegle-map-container');
  const bar = box?.querySelector('[data-map-player-transport]');
  if (!bar) return null;
  const labels = [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
  const r = bar.getBoundingClientRect(); const c = box.getBoundingClientRect();
  const other = [...box.querySelectorAll('button, img, input')]
    .filter((n) => !bar.contains(n))
    .map((n) => ({ n, q: n.getBoundingClientRect() }))
    .filter(({ q }) => q.width > 0 && q.height > 0
      && !(r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom))
    .map(({ n }) => (n.innerText || n.className || n.tagName).toString().replace(/\s+/g, ' ').slice(0, 30));
  return {
    labels,
    title: bar.innerText.split('\n')[0].trim(),
    inside: r.left >= c.left - 1 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1,
    over: other,
  };
});
check(!!transport, 'a transport appears in the map once something is playing');
check(transport?.title === 'First Track',
  '…saying what is playing', transport?.title || '(no title)');
check(JSON.stringify(transport?.labels) === JSON.stringify(['Previous', 'Play', 'Next', 'Stop'])
  || JSON.stringify(transport?.labels) === JSON.stringify(['Previous', 'Pause', 'Next', 'Stop']),
  '…with rewind, play/pause, fast forward and stop — and nothing else',
  JSON.stringify(transport?.labels));
check(transport?.inside, '…inside the map, so native fullscreen keeps it');
check(transport?.over.length === 0, '…on top of no other control',
  transport?.over.join(' | ') || 'clear');

// Stop puts it away: the bar is for when something is playing, not furniture.
await page2.locator('#truegle-map-container [data-map-player-transport] button[aria-label="Stop"]').click();
await page2.waitForTimeout(800);
check(await page2.locator('#truegle-map-container [data-map-player-transport]').count() === 0,
  'stopping clears the transport rather than leaving a dead bar on the map');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
