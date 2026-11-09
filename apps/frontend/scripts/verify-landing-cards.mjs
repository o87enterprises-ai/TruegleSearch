/* The landing page's modules: one grid of tiles, opened one at a time by hand.
 *
 * Owner, 2026-09-29: the landing cards become modular tiles in a GRID (not a
 * vertical list), on desktop and phone alike; each is a one-word title in its
 * pill's colour and an elevator pitch of ten words or fewer; pressing one opens
 * its content directly under its row, pressing it again retracts it completely;
 * only one is open at a time.
 *
 * Owner, 2026-11-07: "Why Truegle?" and a new "Features" bar (which holds the
 * six tiles) both start RETRACTED and open only when pressed. Nothing opens by
 * itself any more, phone included.
 *
 *   - Why Truegle is ONE full-width card (its dropdown opens inside it), with
 *     Tube directly below; the other six tiles: 4 columns on desktop, 2 on a
 *     phone, equal heights
 *   - titles: Why Truegle? · Tube · Feed · Search · Chat · News · Markets
 *     (the pill's order, 2026-10-18: Tube · Feed · Green · Mainstream · Rabbit
 *     Hole · OSINT · Chat — the four search lenses live inside the Search tile)
 *   - each wears its pill's colour; News and Markets are shades of Feed's
 *   - each pitch is ten words or fewer
 *   - none open at load (Features and Why Truegle are retracted bars);
 *     nothing fetched while closed
 *   - press → a panel under that tile's row, and NO tile moves; press again →
 *     gone, layout exactly as before; another tile → the first closes
 *   - a press inside an open panel does not close it
 *   - opening a lens inside Search leaves Search open (it used to close it)
 *   - nothing opens by itself, on desktop or phone (scrolling opens nothing)
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

const TITLES = ['Why Truegle?', 'Tube', 'Feed', 'Search', 'Chat', 'News', 'Markets'];
const IDS = ['why', 'tube', 'feed', 'search', 'chat', 'news', 'markets'];
const ACCENT = { why: '#a855f7', search: '#3b82f6', chat: '#e5e7eb', tube: '#9aa7b8', feed: '#eab308', news: '#facc15', markets: '#ca8a04' };
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
const tile = (id) => `[data-tile="${id}"]`;
const panel = (id) => `[data-panel="${id}"]`;

// Press the "Features" bar and wait for the seven tiles to mount.
async function expand(page) {
  await page.locator('[data-features-toggle]').dispatchEvent('click');
  await until(() => page.locator('[data-tile]').count().then((n) => n === 7), { what: 'the seven tiles' });
}

async function open(viewport, mobile, { expanded = true } = {}) {
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
  await until(() => page.locator('[data-features-toggle]').count(), { what: 'the Features bar' });
  if (expanded) await expand(page);
  return { ctx, page, errs, asked };
}
// Position of every tile, in document coordinates.
const tiles = (page) => page.evaluate(`[...document.querySelectorAll('[data-tile]')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.tile, name: e.querySelector('[data-tile-title]').innerText, open: e.dataset.open, x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; })`);
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
  // Why Truegle is a full-width card on its own row (2026-10-17); Search is
  // the first tile directly under it, then four across, then News + Markets.
  const ys = [...new Set(t.map((x) => x.y))];
  const row2 = t.filter((x) => x.y === ys[1]);
  // Two rows of three under it (owner, 2026-11-05), at every width.
  check(ys.length === 3 && t.filter((x) => x.y === ys[0]).length === 1 && row2.length === 3 && t.filter((x) => x.y === ys[2]).length === 3 && new Set(row2.map((x) => x.x)).size === 3, 'desktop: Why Truegle alone on row one, then two rows of three', `${ys.length} rows, ${row2.length} in the second`);
  check(t.filter((x) => x.y === ys[1]).every((x) => x.h === row2[0].h) && t.filter((x) => x.y === ys[2]).every((x) => x.h === t.find((y) => y.y === ys[2]).h), 'tiles in a row are the same height');
  check(t.find((x) => x.id === 'why').w > t.find((x) => x.id === 'search').w * 2.5, 'Why Truegle is a full-width card');
  check(t.find((x) => x.id === 'tube').y === ys[1] && t.find((x) => x.id === 'tube').y > t.find((x) => x.id === 'why').y, 'Tube is the first tile, in the row under Why Truegle and the Features bar');
  check(['news', 'markets'].every((id) => Math.abs(t.find((x) => x.id === id).w - t.find((x) => x.id === 'feed').w) <= 2), 'every tile is one column: no wide tiles, no orphan');
  check(t.every((x) => x.open === 'closed'), 'none is open at load');

  for (const [id, hex] of Object.entries(ACCENT)) {
    // An expression string: this file is linted as node, but it runs in the page.
    const got = await page.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(`${tile(id)} [data-tile-title]`)})).color`);
    check(got === rgbOf(hex), `${id}: title is its pill colour ${hex}`, got);
  }
  check(new Set([ACCENT.feed, ACCENT.news, ACCENT.markets]).size === 3, 'News and Markets are their own shades of the Feed yellow');
  // Minimal copy (owner, 2026-10-22): Why Truegle is a bare title; every
  // other tile keeps one short line (the owner's Tube copy is 11 words).
  check(await page.locator(`${tile('why')} [data-tile-pitch]`).count() === 0, 'why: a bare title, no line under it');
  // The pitch is hidden at rest and drops down on hover (or tap).
  check(await page.locator('[data-tile-pitch]').count() === 0, 'pitches are hidden at rest: one-word titles only');
  for (const id of IDS.filter((x) => x !== 'why')) {
    await page.locator(tile(id)).hover();
    await until(() => page.locator(`${tile(id)} [data-tile-pitch]`).count(), { what: `${id} pitch on hover` });
    const pitch = (await page.locator(`${tile(id)} [data-tile-pitch]`).innerText()).trim();
    const words = pitch.split(/\s+/).filter(Boolean).length;
    check(words > 0 && words <= 12, `${id}: pitch drops down on hover, twelve words or fewer`, `${words} — "${pitch}"`);
  }
  await page.mouse.move(0, 0);

  // scroll the whole page by hand: on a desktop nothing opens by itself
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(100); }
  await page.locator(tile('why')).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  check((await tiles(page)).every((x) => x.open === 'closed'), 'desktop: scrolling opens nothing, Why Truegle included');
  check(!asked.some((p) => p.startsWith('/api/news')), 'no tile fetches while closed (the Top posts frame below owns /api/social/feed)', asked.join(' ') || 'no requests');

  // Why Truegle's body opens INSIDE its own card, and Search stays directly under it
  await press(page, 'why');
  await until(() => page.locator('[data-card="why"] [data-panel="why"] [data-why-body]').count(), { what: 'the Why body inside its card' });
  await page.waitForTimeout(600);
  const whyBox = await page.locator('[data-card="why"]').boundingBox();
  const featBox = await page.locator('[data-features-card]').boundingBox();
  const gap = Math.round(featBox.y - (whyBox.y + whyBox.height));
  check(gap >= 0 && gap <= 16, 'Why Truegle and its dropdown are one card, with the Features bar directly below it', `gap ${gap}px`);
  check(await page.locator(panel('why')).count() === 1 && await page.locator('[data-panel]').evaluateAll((els) => els.every((e) => e.closest('[data-card]'))), 'the Why body is not a separate panel');
  await press(page, 'why');
  await until(() => page.locator('[data-panel]').count().then((n) => n === 0), { what: 'the Why card to retract' });

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
  check(await openOf(page, 'news') === 'open' && await page.locator(`${tile('news')} [aria-expanded]`).getAttribute('aria-expanded') === 'true', 'the tile reports itself open');
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
  // In view first, as a person would see it: a pinned lens closes itself once
  // scrolled out of view (CollapsibleCard's IntersectionObserver), so pinning
  // one that sits below the fold closes it again at once.
  await lens('blue').scrollIntoViewIfNeeded();
  await lens('blue').locator('[data-card-toggle]').dispatchEvent('click'); // dispatched, like press(): opening a lens reflows the grid under a moving pointer
  await until(() => lens('blue').getAttribute('data-open').then((s) => s === 'pinned'), { what: 'the Blue lens to open' });
  check(await openOf(page, 'search') === 'open' && await page.locator(panel('search')).count() === 1, 'opening a lens inside Search leaves Search open');
  await lens('red').locator('[data-card-toggle]').dispatchEvent('click'); // dispatched, like press(): opening a lens reflows the grid under a moving pointer
  await until(() => lens('red').getAttribute('data-open').then((s) => s === 'pinned'), { what: 'the Red lens to open' });
  check(await lens('blue').getAttribute('data-open') === 'closed' && await openOf(page, 'search') === 'open', 'lenses are one at a time among themselves, and Search stays open around them');
  await lens('red').locator('[data-card-toggle]').dispatchEvent('click'); // dispatched, like press(): opening a lens reflows the grid under a moving pointer
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
  check(ys.length === 3 && t.filter((x) => x.y === ys[0]).length === 1 && t.filter((x) => x.y === ys[1]).length === 3 && t.filter((x) => x.y === ys[2]).length === 3, 'phone: Why Truegle full width, then two rows of three', `${ys.length} rows`);
  check(t.find((x) => x.id === 'tube').y === ys[1], 'phone: Tube is directly under Why Truegle');
  check(t.every((x) => x.open === 'closed'), 'phone: every tile is retracted at load, Why Truegle included');

  // Scroll down to it by hand: it stays put. It used to descend by itself;
  // it opens by a press and only by a press (owner, 2026-11-07).
  for (let i = 0; i < 30; i++) {
    const top = await page.locator(tile('why')).evaluate((e) => e.getBoundingClientRect().top);
    if (top < 420) break;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  check(await openOf(page, 'why') === 'closed', 'phone: Why Truegle does NOT descend by itself as you scroll down');
  await press(page, 'why');
  await until(() => openOf(page, 'why').then((s) => s === 'open'), { what: 'Why Truegle to open on a press' });
  check((await tiles(page)).filter((x) => x.id !== 'why').every((x) => x.open === 'closed'), 'phone: pressing Why Truegle opens it alone');
  // "Surf Without..." heads each of the three promises (2026-10-02), where the
  // round minus icons used to be.
  const labels = await page.locator('[data-why-body] [data-surf-without]').allInnerTexts();
  check(labels.length === 3 && labels.every((t) => t.trim().toLowerCase() === 'surf without...'),
    'phone: each of the three Why modules is headed "Surf Without..."', JSON.stringify(labels));
  const order = await page.locator('[data-why-body] [data-surf-without]').evaluateAll((els) => els.map((e) => {
    const title = e.nextElementSibling; return !!title && e.getBoundingClientRect().bottom <= title.getBoundingClientRect().top + 1 && /^(Bias|Tracking|Censorship)$/.test(title.textContent.trim());
  }));
  check(order.length === 3 && order.every(Boolean), '…each sitting directly above its title (Bias, Tracking, Censorship)', JSON.stringify(order));
  check(await page.locator('[data-why-body] svg line').count() === 0, '…and the round minus icons are gone');
  const toggles = await page.locator('[data-why-body] button[aria-pressed]').allInnerTexts();
  check(toggles.length === 1 && /\+18 safe mode toggle/.test(toggles[0]), 'the +18 safe mode control is still there, as one button', JSON.stringify(toggles));
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

// ── the feed frame's heading follows the platform pill (owner, 2026-11-07) ─────
// And a first-time visitor meets no maintenance modal: the page is simply there.
await guarded('feed heading + no modal', async () => {
  const { ctx, page } = await open({ width: 1280, height: 900 }, false, { expanded: false });
  const title = () => page.locator('[data-landing-feed-title]').innerText().then((t) => t.trim());
  check(await page.locator('[data-maintenance-notice], [role="dialog"]').count() === 0, 'no maintenance modal covers the landing page');
  // The Feed frame lives in a card that is retracted at load: press it open.
  await page.locator('[data-feed-frame-toggle]').dispatchEvent('click');
  await until(() => page.locator('[data-landing-feed-title]').count(), { what: 'the Feed card to open' });
  check(await title() === 'Trending posts across all platforms', 'heading: "Trending posts across all platforms" with All selected', await title());
  const WANT = { instagram: 'Trending Posts on Instagram', facebook: 'Trending Posts on Facebook', x: 'Trending Posts on X', reddit: 'Trending Posts on Reddit', truthsocial: 'Trending Posts on Truth Social' };
  for (const [id, want] of Object.entries(WANT)) {
    await page.locator(`[data-landing-feed-server="${id}"]`).dispatchEvent('click');
    await until(() => title().then((t) => t === want), { what: `the heading for ${id}`, timeout: 4000 }).catch(() => {});
    check(await title() === want, `heading: picking ${id} reads "${want}"`, await title());
  }
  await page.locator('[data-landing-feed-server="all"]').dispatchEvent('click');
  await until(() => title().then((t) => t === 'Trending posts across all platforms'), { what: 'the heading to return', timeout: 4000 }).catch(() => {});
  check(await title() === 'Trending posts across all platforms', 'heading: back to All reads "Trending posts across all platforms"');
  await page.locator('[data-landing-feed-tab="news"]').dispatchEvent('click');
  await until(() => title().then((t) => t === 'News'), { what: 'the News tab heading', timeout: 4000 }).catch(() => {});
  check(await title() === 'News', 'heading: the other tabs keep their own names', await title());
  await ctx.close();
});

// ── the Feed card: same kind of card as Why Truegle and Features, retracted ───
// at load, opened and retracted by a press (owner, 2026-11-09).
for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  await guarded(`${label}: the Feed card`, async () => {
    const { ctx, page, asked } = await open(vp, mobile, { expanded: false });
    await page.waitForTimeout(1000);
    const bar = page.locator('[data-feed-frame-toggle]');
    check((await bar.innerText()).trim() === 'Feed', `${label}: a card titled "Feed"`, (await bar.innerText()).trim());
    check(await bar.getAttribute('data-open') === 'closed' && await bar.getAttribute('aria-expanded') === 'false', `${label}: the Feed card starts retracted`);
    check(await page.locator('[data-landing-feed]').count() === 0 && await page.locator('[data-feed-frame-panel]').count() === 0, `${label}: no feed is mounted while it is retracted`);
    check(!asked.includes('/api/social/feed'), `${label}: nothing is fetched for a retracted Feed card`, asked.join());
    // Same size and configuration as the Why Truegle and Features cards.
    const feedBox = await page.locator('[data-feed-frame-card]').boundingBox();
    const whyBox = await page.locator('[data-card="why"]').boundingBox();
    const featBox = await page.locator('[data-features-card]').boundingBox();
    check(Math.abs(feedBox.width - whyBox.width) <= 1 && Math.abs(feedBox.width - featBox.width) <= 1 && Math.abs(feedBox.x - whyBox.x) <= 1,
      `${label}: same width and left edge as Why Truegle and Features`, `${Math.round(feedBox.width)} vs ${Math.round(whyBox.width)}/${Math.round(featBox.width)}`);
    check(Math.abs(feedBox.height - featBox.height) <= 2, `${label}: a retracted bar the same height as Features`, `${Math.round(feedBox.height)} vs ${Math.round(featBox.height)}`);
    // A press opens it; the feed mounts and asks for its first page.
    await bar.dispatchEvent('click');
    await until(() => page.locator('[data-landing-feed-frame]').count(), { what: 'the feed frame inside the card' });
    check(await bar.getAttribute('aria-expanded') === 'true' && await page.locator('[data-feed-frame-card] [data-landing-feed-frame]').count() === 1, `${label}: pressing it opens the feed inside the card`);
    await until(() => asked.includes('/api/social/feed'), { what: 'the feed to load' });
    // The next press retracts it completely.
    await bar.dispatchEvent('click');
    await until(() => page.locator('[data-landing-feed]').count().then((n) => n === 0), { what: 'the feed to retract' });
    check(await bar.getAttribute('data-open') === 'closed' && await page.locator('[data-feed-frame-panel]').count() === 0, `${label}: pressing it again retracts it completely`);
    // Independent of the other two cards.
    check(await openOf(page, 'why') === 'closed' && await page.locator('[data-features-toggle]').getAttribute('aria-expanded') === 'false', `${label}: the other cards are untouched`);
    await ctx.close();
  });
}

// ── scroll chaining out of the feed frame (owner, 2026-11-09) ───────────────
// The feed frame scrolls INSIDE itself, but at its top or bottom the PAGE must
// carry on scrolling: reach the end of the frame and the whole screen continues.
// Mid-frame, a wheel still scrolls the frame and leaves the page where it is.
await guarded('feed frame scroll chaining', async () => {
  const { ctx, page } = await open({ width: 1280, height: 900 }, false, { expanded: false });
  // Plenty of posts, so the frame genuinely scrolls (registered after open()'s
  // generic stub, so it wins).
  const MANY = Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`, platform: 'Creators', title: `Long list post ${i}`, url: `https://example.com/long-${i}`,
    permalink: `https://example.com/long-${i}`, author: 'A Creator', date: '2026-09-28T00:00:00Z', thumbnail: null,
  }));
  await ctx.route('**/api/social/feed', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: MANY, platforms: { creators: MANY }, errors: {}, nextCursor: {} }) }));
  await page.locator('[data-feed-frame-toggle]').dispatchEvent('click');
  const frame = page.locator('[data-landing-feed-frame]');
  await frame.waitFor({ timeout: 20000 });
  await until(() => frame.evaluate((el) => el.scrollHeight > el.clientHeight + 200), { what: 'the frame to have more than it shows' });
  // Put the whole frame on screen, then wheel with the pointer over it.
  await frame.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const box = await frame.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const state = () => page.evaluate(() => ({ page: Math.round(scrollY), frame: Math.round(document.querySelector('[data-landing-feed-frame]').scrollTop) }));

  // 1. MID-FRAME: the wheel scrolls the frame, not the page.
  const a0 = await state();
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);
  const a1 = await state();
  check(a1.frame > a0.frame && a1.page === a0.page, 'mid-frame, the wheel scrolls the frame and not the page', `${JSON.stringify(a0)} -> ${JSON.stringify(a1)}`);

  // 2. BOTTOM OF THE FRAME: the page carries on scrolling.
  await frame.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(700);
  const b0 = await state();
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(700);
  const b1 = await state();
  check(b1.page > b0.page, 'at the bottom of the frame, the whole page keeps scrolling', `${JSON.stringify(b0)} -> ${JSON.stringify(b1)}`);

  // 3. TOP OF THE FRAME: scrolling up carries the page up.
  await frame.evaluate((el) => { el.scrollTop = 0; el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(700);
  const box2 = await frame.boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.evaluate(() => scrollBy(0, 200));
  await page.waitForTimeout(500);
  const c0 = await state();
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(700);
  const c1 = await state();
  check(c1.page < c0.page, 'at the top of the frame, scrolling up carries the whole page up', `${JSON.stringify(c0)} -> ${JSON.stringify(c1)}`);
  await ctx.close();
});

// ── retracted by default, opened by a press (desktop and phone alike) ───────
for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  await guarded(`${label}: retracted default`, async () => {
    const { ctx, page, asked } = await open(vp, mobile, { expanded: false });
    await page.waitForTimeout(1000);
    const bar = page.locator('[data-features-toggle]');
    check((await bar.innerText()).trim() === 'Features', `${label}: a bar titled "Features"`, (await bar.innerText()).trim());
    check(await bar.getAttribute('data-open') === 'closed' && await bar.getAttribute('aria-expanded') === 'false', `${label}: Features starts retracted`);
    check(await openOf(page, 'why') === 'closed', `${label}: Why Truegle starts retracted`);
    check(await page.locator('[data-tile]:not([data-tile="why"])').count() === 0, `${label}: no tile is on the page while Features is retracted`);
    check(await page.locator('[data-why-body]').count() === 0 && await page.locator('[data-features-panel]').count() === 0, `${label}: neither bar has a body mounted`);
    check(!asked.some((p) => p.startsWith('/api/news')), `${label}: nothing is fetched for a retracted bar`);
    // A press drops the six tiles down; every one still retracted.
    await bar.dispatchEvent('click');
    await until(() => page.locator('[data-tile]').count().then((n) => n === 7), { what: 'the tiles to drop down' });
    check(await bar.getAttribute('aria-expanded') === 'true' && (await tiles(page)).every((x) => x.open === 'closed'), `${label}: pressing Features drops the six tiles down, all retracted`);
    // An open tile goes away with the bar, and is not still open on return.
    await press(page, 'news');
    await until(() => page.locator(panel('news')).count(), { what: 'the News panel' });
    await bar.dispatchEvent('click');
    await until(() => page.locator('[data-tile]:not([data-tile="why"])').count().then((n) => n === 0), { what: 'Features to retract' });
    await bar.dispatchEvent('click');
    await until(() => page.locator('[data-tile]').count().then((n) => n === 7), { what: 'the tiles again' });
    check((await tiles(page)).every((x) => x.open === 'closed') && await page.locator('[data-panel="news"]').count() === 0, `${label}: retracting Features takes an open tile with it`);
    // Why Truegle opens and retracts by its own press, independent of Features.
    await press(page, 'why');
    await until(() => page.locator('[data-why-body]').count(), { what: 'the Why body' });
    await bar.dispatchEvent('click');
    await page.waitForTimeout(500);
    check(await openOf(page, 'why') === 'open', `${label}: retracting Features leaves Why Truegle as it was`);
    await ctx.close();
  });
}

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

// ── the coloured Go pill navigates straight to the page ─────────────────────
await guarded('go pills', async () => {
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  const ROUTES = { tube: '/tube', feed: '/feed', search: '/search', chat: '/chat', news: '/feed?category=news', markets: '/feed?category=markets' };
  for (const [id, want] of Object.entries(ROUTES)) {
    const bg = await page.locator(`[data-tile-go="${id}"]`).evaluate((e) => getComputedStyle(e).backgroundImage);
    check(bg.includes(rgbOf(ACCENT[id])), `${id}: Go pill wears its pill colour`, bg.slice(0, 60));
  }
  for (const [id, want] of Object.entries(ROUTES)) {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await until(() => page.locator('[data-features-toggle]').count(), { what: 'the Features bar' });
    await expand(page);
    await page.locator(`[data-tile-go="${id}"]`).dispatchEvent('click');
    await until(() => Promise.resolve(new URL(page.url()).pathname !== '/'), { what: `${id} to navigate` }).catch(() => {});
    const u = new URL(page.url());
    check(u.pathname + u.search === want, `${id}: Go opens ${want} at once, without opening the tile`, u.pathname + u.search);
  }
  await ctx.close();
});

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
