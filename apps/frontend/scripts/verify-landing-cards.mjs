/* The landing page's cards: one line each, one open at a time, opened by hand.
 *
 * Owner, 2026-09-29: every card on the landing page must fully retract to a
 * single line and fully descend when pressed, with only one open at a time —
 * including Why Search Truegle, News, Markets and the Creators feed at the
 * bottom. The single exception is Why Search Truegle on a PHONE, which is
 * retracted by default and descends by itself as you scroll down to it.
 *
 *   - seven cards, all the same width and one line tall, none open at load
 *   - nothing is fetched while a card is one line (News, Markets, Creators)
 *   - press a header: it descends; press it again: it retracts completely;
 *     a press inside the open body (a tab, a video) does NOT close it
 *   - open one and another closes — only one open at a time
 *   - desktop: nothing ever opens by itself
 *   - phone: Why Search Truegle descends on scroll, but never over a card the
 *     visitor already opened
 *   - a news thumbnail plays in the Truegle player
 *
 * The API is stubbed at the browser. Run it:  npm run landing:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

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
  await ctx.route('**/api/social/feed', (r) => { asked.push('/api/social/feed'); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: CREATOR_POSTS, errors: {}, nextCursor: {} }) }); });
  for (const h of ['**/*youtube*.com/**', '**/i.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied|isExternalMethodAvailable/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-collapsible-card]').count().then((n) => n >= 7), { what: 'the seven cards' });
  return { ctx, page, errs, asked };
}
const cards = (page) => page.evaluate(`[...document.querySelectorAll('[data-collapsible-card]')].map((e) => { const r = e.getBoundingClientRect(); return { name: e.innerText.split('\\n')[0].slice(0, 20), open: e.dataset.open, w: Math.round(r.width), h: Math.round(r.height) }; })`);
const stateOf = (page, sel) => page.locator(sel).getAttribute('data-open');
const toggle = (page, sel) => page.locator(`${sel} [data-card-toggle]`).click();
const CARD = { why: '[data-why-card]', news: '[data-news-card="news"]', markets: '[data-news-card="markets"]', feeds: '[data-featured-feeds]' };

// A step that errors is a FAIL with its message, not a crash that hides every
// result before it.
const guarded = async (label, fn) => { try { await fn(); } catch (e) { bad.push(`FAIL ${label} — ${String(e.message).split('\n')[0]}`); } };

// ── desktop ─────────────────────────────────────────────────────────────────
await guarded('desktop run', async () => {
  const { ctx, page, errs, asked } = await open({ width: 1280, height: 900 }, false);
  await page.waitForTimeout(1200);
  const c = await cards(page);
  check(c.length === 7, 'seven cards on the landing page', c.map((x) => x.name).join(' · '));
  check(c.every((x) => x.h === c[0].h && x.h < 70), 'every card is one line tall', c.map((x) => x.h).join(','));
  check(c.every((x) => x.w === c[0].w), 'every card is the same width', c.map((x) => x.w).join(','));
  check(c.every((x) => x.open === 'closed'), 'none is open at load');

  // Scroll the whole page by hand: on a desktop nothing opens by itself.
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(120); }
  await page.locator(CARD.why).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  check((await cards(page)).every((x) => x.open === 'closed'), 'desktop: scrolling opens nothing, including Why Search Truegle');
  check(!asked.some((p) => p.startsWith('/api/news') || p === '/api/social/feed'), 'nothing is fetched while the cards are one line', asked.join(' ') || 'no requests');

  // press → descends, press → retracts completely
  await toggle(page, CARD.news);
  await until(() => stateOf(page, CARD.news).then((s) => s === 'pinned'), { what: 'News to open' });
  await until(() => page.locator('[data-news-video]').count().then((n) => n >= 3), { what: 'news thumbnails' });
  check(asked.includes('/api/news/videos'), 'opening News fetches its videos', asked.join(' '));
  check((await page.locator(`${CARD.news}`).boundingBox()).height > 150, 'News descends when pressed');

  // a press INSIDE the open body must not close it
  await page.locator('[data-news-tab="world"]').click();
  await page.waitForTimeout(400);
  check(await stateOf(page, CARD.news) === 'pinned', 'pressing a tab inside an open card keeps it open');

  await toggle(page, CARD.news);
  await until(() => stateOf(page, CARD.news).then((s) => s === 'closed'), { what: 'News to retract' });
  await page.waitForTimeout(500);
  check((await page.locator(CARD.news).boundingBox()).height < 70, 'pressing it again retracts it completely to one line');

  // one at a time
  await toggle(page, CARD.markets);
  await until(() => stateOf(page, CARD.markets).then((s) => s === 'pinned'), { what: 'Markets to open' });
  await toggle(page, CARD.feeds);
  await until(() => stateOf(page, CARD.feeds).then((s) => s === 'pinned'), { what: 'Creators to open' });
  const now = await cards(page);
  check(now.filter((x) => x.open !== 'closed').length === 1 && (await stateOf(page, CARD.markets)) === 'closed', 'only one card is open at a time', now.map((x) => x.open).join(','));
  await until(() => page.locator('[data-featured-feeds-body] button').count().then((n) => n >= 2), { what: 'creator cards' });
  check(asked.includes('/api/social/feed'), 'opening Creators fetches its feed', asked.join(' '));
  check(errs.length === 0, 'desktop: nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
});

// ── phone ───────────────────────────────────────────────────────────────────
await guarded('phone run', async () => {
  const { ctx, page, errs } = await open({ width: 390, height: 844 }, true);
  await page.waitForTimeout(1200);
  check((await cards(page)).every((x) => x.open === 'closed'), 'phone: every card is retracted at load, Why Search Truegle included');

  // Scroll down to it by hand: it descends by itself.
  for (let i = 0; i < 30; i++) {
    const top = await page.locator(CARD.why).evaluate((e) => e.getBoundingClientRect().top);
    if (top < 420) break;
    await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  }
  await until(() => stateOf(page, CARD.why).then((s) => s === 'pinned'), { what: 'Why Search Truegle to descend by itself', timeout: 6000 }).catch(() => {});
  check(await stateOf(page, CARD.why) === 'pinned', 'phone: Why Search Truegle descends by itself on scroll');
  const others = (await cards(page)).filter((x) => !/^Why/.test(x.name));
  check(others.every((x) => x.open === 'closed'), '…and it is the only one that does');

  // The visitor takes over: opening another card closes it.
  await page.locator(CARD.news).scrollIntoViewIfNeeded();
  await toggle(page, CARD.news);
  await until(() => stateOf(page, CARD.news).then((s) => s === 'pinned'), { what: 'News to open' });
  check(await stateOf(page, CARD.why) === 'closed', 'phone: opening another card closes it');

  // A news thumbnail plays in the Truegle player.
  await until(() => page.locator('[data-news-video]').count().then((n) => n >= 3), { what: 'news thumbnails' });
  await page.locator('[data-news-video]').first().click();
  await until(() => page.locator('[data-mini] iframe').count().then((n) => n === 1), { what: 'the video to load in the player' }).catch(() => {});
  const src = await page.locator('[data-mini] iframe').first().getAttribute('src').catch(() => '');
  check(/youtube(-nocookie)?\.com\/embed\/vidAAAA0000/.test(src || ''), 'a news thumbnail plays in the Truegle player', (src || '').slice(0, 70));
  check(errs.length === 0, 'phone: nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
});

// ── phone: it never descends over a card the visitor already opened ────────
await guarded('phone: visitor-first run', async () => {
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  await page.waitForTimeout(1200);
  // True Tube sits just under Why Search Truegle, so both are on the first
  // screen. The early-access banner floats over that edge, so press the header
  // directly rather than through it.
  await page.locator('[data-collapsible-card]', { hasText: 'True Tube' }).locator('[data-card-toggle]').dispatchEvent('click');
  await until(() => page.locator('[data-collapsible-card]', { hasText: 'True Tube' }).getAttribute('data-open').then((s) => s === 'pinned'), { what: 'True Tube to open' });
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 40); await page.waitForTimeout(200); }
  await page.waitForTimeout(800);
  const c = await cards(page);
  check(c.find((x) => /^Why/.test(x.name)).open === 'closed' && c.find((x) => /^True Tube/.test(x.name)).open === 'pinned',
    'phone: Why Search Truegle does not descend over a card the visitor opened', c.map((x) => x.open).join(','));
  await ctx.close();
});

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
