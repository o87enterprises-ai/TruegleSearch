/* The landing page's modules: one grid of tiles, opened one at a time by hand.
 *
 * Owner, 2026-09-29: the landing cards become modular tiles in a GRID (not a
 * vertical list), on desktop and phone alike; each is a one-word title in its
 * pill's colour and an elevator pitch of ten words or fewer; pressing one opens
 * its content directly under its row, pressing it again retracts it completely;
 * only one is open at a time; and only Why Truegle ever opens by itself, on a
 * phone, as you scroll down to it.
 *
 *   - seven tiles in a grid: 4 columns on desktop, 2 on a phone, equal heights
 *   - titles: Why Truegle? · Search · Chat · Tube · Feed · News · Markets
 *   - each wears its pill's colour; News and Markets are shades of Feed's
 *   - each pitch is ten words or fewer
 *   - none open at load; nothing fetched while closed
 *   - press → a panel under that tile's row, and NO tile moves; press again →
 *     gone, layout exactly as before; another tile → the first closes
 *   - a press inside an open panel does not close it
 *   - opening a lens inside Search leaves Search open (it used to close it)
 *   - desktop: nothing opens by itself; phone: only Why Truegle does, on scroll
 *   - a news thumbnail opens the Feed's News timeline with that clip playing
 *
 * The API is stubbed at the browser. Run it:  npm run landing:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
// A step that errors is a FAIL with its message, not a crash that hides every
// result before it.
const guarded = async (label, fn) => { try { await fn(); } catch (e) { bad.push(`FAIL ${label} — ${String(e.message).split('\n')[0]}`); } };

const PORT = 5201;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const VIDEOS = Array.from({ length: 5 }, (_, i) => ({
  id: `vidAAAA000${i}`, title: `Report number ${i} on the biggest story`, url: `https://www.youtube.com/watch?v=vidAAAA000${i}`,
  thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg', at: Date.now() - i * 36e5, duration: 200 + i, channel: 'Some Channel',
}));
const MARKETS = { at: Date.now(), stocks: [{ id: 'a', label: 'S&P 500', price: 5000, changePct: 0.4, spark: [1, 2, 3, 2, 4] }, { id: 'b', label: 'Nasdaq', price: 16000, changePct: -0.2, spark: [3, 2, 3, 1, 2] }], crypto: [], commodities: [] };
const CREATOR_POSTS = Array.from({ length: 3 }, (_, i) => ({
  id: `c${i}`, platform: 'Creators', title: `Creator upload ${i}`, url: `https://www.youtube.com/watch?v=creatr000${i}`,
  permalink: `https://www.youtube.com/watch?v=creatr000${i}`, author: 'A Creator', date: '2026-09-28T00:00:00Z', thumbnail: null,
}));

const TITLES = ['Why Truegle?', 'Search', 'Chat', 'Tube', 'Feed', 'News', 'Markets'];
const IDS = ['why', 'search', 'chat', 'tube', 'feed', 'news', 'markets'];
const ACCENT = { why: '#a855f7', search: '#3b82f6', chat: '#e5e7eb', tube: '#9aa7b8', feed: '#eab308', news: '#facc15', markets: '#ca8a04' };
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
const tile = (id) => `[data-tile="${id}"]`;
const panel = (id) => `[data-panel="${id}"]`;

async function open(viewport, mobile) {
  const ctx = await testContext(browser, { viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  const asked = [];
  // Generic first: Playwright tries the LAST-registered matching route first.
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  await ctx.route('**/api/news/**', (r) => {
    const u = new URL(r.request().url()); asked.push(u.pathname);
    const body = u.pathname.endsWith('/videos') ? { videos: VIDEOS, country: 'US' } : u.pathname.endsWith('/markets') ? MARKETS : { country: 'US', print: { local: [], world: [] }, markets: MARKETS };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('**/api/social/feed', (r) => {
    asked.push('/api/social/feed');
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch { /* none */ }
    const lane = (body.platforms || []).find((p) => p === 'newsvideo' || p === 'marketsvideo');
    const results = lane
      ? VIDEOS.map((v) => ({ id: v.url, platform: lane === 'newsvideo' ? 'News Video' : 'Market Analysis', title: v.title, url: v.url, permalink: v.url, author: v.channel, date: new Date(v.at).toISOString(), thumbnail: v.thumbnail, score: null, comments: null }))
      : CREATOR_POSTS;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results, errors: {}, nextCursor: {} }) });
  });
  for (const h of ['**/*youtube*.com/**', '**/i.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied|isExternalMethodAvailable/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-tile]').count().then((n) => n === 7), { what: 'the seven tiles' });
  return { ctx, page, errs, asked };
}
// Position of every tile, in document coordinates.
const tiles = (page) => page.evaluate(`[...document.querySelectorAll('[data-tile]')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.tile, name: e.querySelector('span span:nth-child(2)').innerText, open: e.dataset.open, x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })`);
const openOf = (page, id) => page.locator(tile(id)).getAttribute('data-open');
const press = (page, id) => page.locator(tile(id)).dispatchEvent('click'); // the early-access banner floats over the page's foot; press the tile itself
const shape = (t) => JSON.stringify(t.map((x) => [x.x, x.y, x.w, x.h]));

// ── desktop ─────────────────────────────────────────────────────────────────
await guarded('desktop run', async () => {
  const { ctx, page, errs, asked } = await open({ width: 1280, height: 900 }, false);
  await page.waitForTimeout(1200);
  const t = await tiles(page);
  check(JSON.stringify(t.map((x) => x.name)) === JSON.stringify(TITLES), 'seven tiles with one-word titles', t.map((x) => x.name).join(' · '));

  // A GRID, not a list.
  const ys = [...new Set(t.map((x) => x.y))];
  const row1 = t.filter((x) => x.y === ys[0]);
  check(ys.length === 2 && row1.length === 4 && new Set(row1.map((x) => x.x)).size === 4, 'desktop: a grid of four columns, two rows (not a vertical list)', `${ys.length} rows, ${row1.length} in the first`);
  check(t.filter((x) => x.y === ys[0]).every((x) => x.h === row1[0].h) && t.filter((x) => x.y === ys[1]).every((x) => x.h === t.find((y) => y.y === ys[1]).h), 'tiles in a row are the same height');
  check(t.find((x) => x.id === 'markets').w > t.find((x) => x.id === 'feed').w * 1.9, 'the last tile spans two columns, so the grid has no orphan');
  check(t.every((x) => x.open === 'closed'), 'none is open at load');

  for (const [id, hex] of Object.entries(ACCENT)) {
    // An expression string: this file is linted as node, but it runs in the page.
    const got = await page.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(`${tile(id)} span span:nth-child(2)`)})).color`);
    check(got === rgbOf(hex), `${id}: title is its pill colour ${hex}`, got);
  }
  check(new Set([ACCENT.feed, ACCENT.news, ACCENT.markets]).size === 3, 'News and Markets are their own shades of the Feed yellow');
  for (const id of IDS) {
    const pitch = (await page.locator(`${tile(id)} [data-tile-pitch]`).innerText()).trim();
    const words = pitch.split(/\s+/).filter(Boolean).length;
    check(words > 0 && words <= 10, `${id}: pitch is ten words or fewer`, `${words} — "${pitch}"`);
  }

  // scroll the whole page by hand: on a desktop nothing opens by itself
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(100); }
  await page.locator(tile('why')).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  check((await tiles(page)).every((x) => x.open === 'closed'), 'desktop: scrolling opens nothing, Why Truegle included');
  check(!asked.some((p) => p.startsWith('/api/news') || p === '/api/social/feed'), 'nothing is fetched while every tile is closed', asked.join(' ') || 'no requests');

  // press → a panel under the row, no tile moves; press again → exactly as before
  const before = shape(t);
  await press(page, 'news');
  await until(() => page.locator(panel('news')).count(), { what: 'the News panel' });
  await until(() => page.locator('[data-news-video]').count().then((n) => n >= 3), { what: 'news thumbnails' });
  const after = await tiles(page);
  const newsTile = after.find((x) => x.id === 'news');
  const panelBox = await page.locator(panel('news')).boundingBox();
  const rowBottom = Math.max(...after.filter((x) => x.y === newsTile.y).map((x) => x.y + x.h));
  check(panelBox && Math.round(panelBox.y + await page.evaluate('scrollY')) >= rowBottom - 1, 'the panel opens directly under the tile\'s row', `panel top ${Math.round(panelBox?.y)}`);
  check(shape(after.filter((x) => x.y <= newsTile.y)) === shape(t.filter((x) => x.y <= newsTile.y)), 'no tile above or beside it moves');
  check(await openOf(page, 'news') === 'open' && await page.locator(tile('news')).getAttribute('aria-expanded') === 'true', 'the tile reports itself open');
  check(asked.includes('/api/news/videos'), 'opening News fetches its videos', asked.join(' '));

  await page.locator('[data-news-tab="world"]').click();
  await page.waitForTimeout(400);
  check(await openOf(page, 'news') === 'open', 'pressing a tab inside an open panel keeps it open');

  await press(page, 'markets');
  await until(() => page.locator(panel('markets')).count(), { what: 'the Markets panel' });
  await until(() => page.locator(panel('news')).count().then((n) => n === 0), { what: 'the News panel to close' });
  check((await page.locator('[data-panel]').count()) === 1 && await openOf(page, 'news') === 'closed', 'only one tile is open at a time');

  await press(page, 'markets');
  await until(() => page.locator('[data-panel]').count().then((n) => n === 0), { what: 'the panel to retract' });
  await page.waitForTimeout(500);
  check(shape(await tiles(page)) === before, 'pressing it again retracts it completely: the grid is exactly as it was');

  await press(page, 'feed');
  await until(() => page.locator('[data-feed-body] button').count().then((n) => n >= 2), { what: 'creator cards' });
  check(asked.includes('/api/social/feed'), 'opening Feed fetches its feed', asked.join(' '));
  await press(page, 'feed');

  // THE REPORTED BUG: opening a lens inside Search used to close Search itself
  await press(page, 'search');
  await until(() => page.locator('[data-mode-card]').count().then((n) => n === 5), { what: 'the five lenses' });
  const lens = (id) => page.locator(`[data-mode-card="${id}"]`);
  await lens('blue').locator('[data-card-toggle]').click();
  await until(() => lens('blue').getAttribute('data-open').then((s) => s === 'pinned'), { what: 'the Blue lens to open' });
  check(await openOf(page, 'search') === 'open' && await page.locator(panel('search')).count() === 1, 'opening a lens inside Search leaves Search open');
  await lens('red').locator('[data-card-toggle]').click();
  await until(() => lens('red').getAttribute('data-open').then((s) => s === 'pinned'), { what: 'the Red lens to open' });
  check(await lens('blue').getAttribute('data-open') === 'closed' && await openOf(page, 'search') === 'open', 'lenses are one at a time among themselves, and Search stays open around them');
  await lens('red').locator('[data-card-toggle]').click();
  await until(() => lens('red').getAttribute('data-open').then((s) => s === 'closed'), { what: 'the Red lens to close' });
  check(await openOf(page, 'search') === 'open', 'closing a lens leaves Search open too');
  await press(page, 'search');
  await until(() => page.locator('[data-panel]').count().then((n) => n === 0), { what: 'Search to retract' });
  check(shape(await tiles(page)) === before, 'pressing Search again retracts it, lenses and all');

  check(errs.length === 0, 'desktop: nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
});

// ── phone ───────────────────────────────────────────────────────────────────
await guarded('phone run', async () => {
  const { ctx, page, errs } = await open({ width: 390, height: 844 }, true);
  await page.waitForTimeout(1200);
  const t = await tiles(page);
  const ys = [...new Set(t.map((x) => x.y))];
  check(ys.length === 4 && t.filter((x) => x.y === ys[0]).length === 2, 'phone: a grid of two columns, four rows', `${ys.length} rows`);
  check(t.every((x) => x.open === 'closed'), 'phone: every tile is retracted at load, Why Truegle included');

  // Scroll down to it by hand: it descends by itself, alone.
  for (let i = 0; i < 30; i++) {
    const top = await page.locator(tile('why')).evaluate((e) => e.getBoundingClientRect().top);
    if (top < 420) break;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  }
  await until(() => openOf(page, 'why').then((s) => s === 'open'), { what: 'Why Truegle to descend by itself', timeout: 6000 }).catch(() => {});
  check(await openOf(page, 'why') === 'open', 'phone: Why Truegle descends by itself as you scroll down');
  check((await tiles(page)).filter((x) => x.id !== 'why').every((x) => x.open === 'closed'), '…and it is the only one that does');
  await press(page, 'why');
  await until(() => openOf(page, 'why').then((s) => s === 'closed'), { what: 'Why Truegle to retract' });
  await page.waitForTimeout(600);
  check(await openOf(page, 'why') === 'closed', 'phone: pressing it retracts it, and it does not spring back open');

  // A news thumbnail opens the Feed's News timeline, playing.
  await press(page, 'news');
  await until(() => page.locator('[data-news-video]').count().then((n) => n >= 3), { what: 'news thumbnails' });
  await page.locator('[data-news-video]').first().click();
  await until(() => Promise.resolve(new URL(page.url()).pathname === '/feed'), { what: 'the Feed to open' }).catch(() => {});
  const u = new URL(page.url());
  check(u.pathname === '/feed' && u.searchParams.get('category') === 'news' && /vidAAAA0000/.test(u.searchParams.get('play') || ''),
    'a news thumbnail opens the Feed\'s News timeline with that clip', page.url().replace(BASE, ''));
  await until(() => page.locator('[data-mini] iframe').count().then((n) => n === 1), { what: 'the clip to play in the Feed', timeout: 20000 }).catch(() => {});
  const src = await page.locator('[data-mini] iframe').first().getAttribute('src').catch(() => '');
  check(/youtube(-nocookie)?\.com\/embed\/vidAAAA0000/.test(src || ''), '…and it plays there', (src || '').slice(0, 70));
  check(errs.length === 0, 'phone: nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
});

// ── phone: it never descends over a tile the visitor already opened ─────────
await guarded('phone: visitor-first run', async () => {
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  await page.waitForTimeout(1200);
  await press(page, 'tube');
  await until(() => openOf(page, 'tube').then((s) => s === 'open'), { what: 'Tube to open' });
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(200); }
  await page.waitForTimeout(800);
  check(await openOf(page, 'why') === 'closed' && await openOf(page, 'tube') === 'open',
    'phone: Why Truegle does not descend over a tile the visitor opened');
  await ctx.close();
});

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
