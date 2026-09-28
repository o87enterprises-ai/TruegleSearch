/* Reels: its own shorts-only feed, one tap from Tube.
 *
 * Owner, 2026-09-28: the Reels tab opened on "No reels right now"; wide videos
 * could reach the reel player; there was no way back, no search and no
 * shuffle inside it, and no quick Tube ⇄ Reels switch. This pins:
 *
 *   - Reels fills itself on open, with nothing typed.
 *   - ONLY vertical short-form (YouTube Shorts, TikTok). A YouTube clip must
 *     be PROVEN a Short (portrait oEmbed via /api/media/titles): a brief
 *     landscape upload is refused, a proven 2:40 Short is allowed, nothing
 *     over 3:00 ever is. OLD_BACKEND=1 runs the fallback (no dimensions →
 *     strict 2:00 + #shorts).
 *   - The top bar: back leaves Reels, search refills it, Shuffle redraws.
 *   - The Tube/Reels toggle on Tube's bar opens Reels, and the one on Reels'
 *     bar returns to Tube.
 *
 * The API is stubbed at the browser: no backend, no network.
 * Run it:  npm run reels:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5193;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// Eleven-character ids, as YouTube's are. `seed` keeps each query's rows apart
// so the test can tell which search filled the grid.
const id = (seed, n) => `${seed.replace(/[^a-z]/gi, '').slice(0, 6).padEnd(6, 'x')}${String(n).padStart(5, '0')}`;
const webRows = (q) => {
  const seed = q.replace(/#shorts/, '').trim() || 'blank';
  return [
    ...Array.from({ length: 6 }, (_, i) => ({
      title: `${seed} short ${i} #shorts`, url: `https://www.youtube.com/watch?v=${id(seed, i)}`, duration: '0:4' + i,
    })),
    { title: `${seed} full episode`, url: `https://www.youtube.com/watch?v=${id(seed, 90)}`, duration: '22:17' },
    { title: `${seed} too long #shorts`, url: `https://www.youtube.com/watch?v=${id(seed, 91)}`, duration: '3:30' },
    // Short and brief, but YouTube says landscape: an ordinary upload, not a Short.
    { title: `${seed} untagged clip`, url: `https://www.youtube.com/watch?v=${id(seed, 92)}`, duration: '0:30' },
    // Over 2:00 but YouTube says portrait: a real Short, allowed now it is proven.
    { title: `${seed} longer short #shorts`, url: `https://www.youtube.com/watch?v=${id(seed, 93)}`, duration: '2:40' },
  ];
};
const tiktokRows = (q) => Array.from({ length: 3 }, (_, i) => ({
  platform: 'TikTok', title: `${q || 'x'} tiktok ${i}`, author: '@maker',
  url: `https://www.tiktok.com/@maker/video/70000000${String(q.length).padStart(4, '0')}${i}`,
  permalink: `https://www.tiktok.com/@maker/video/70000000${String(q.length).padStart(4, '0')}${i}`,
}));

const asked = [];
// REELS_SHOTS=<dir> saves a screenshot of each view, for eyeballing layout.
const shot = (name) => (process.env.REELS_SHOTS ? page.screenshot({ path: `${process.env.REELS_SHOTS}/${name}.png` }) : null);
const ctx = await testContext(browser, {
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
// A string, not a function: this file is linted as node, where there is no
// localStorage — the code runs in the page.
await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
  + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
for (const host of ['**/*youtube*.com/**', '**/*tiktok.com/**', '**/*ytimg.com/**']) {
  await ctx.route(host, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
}
await ctx.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* GET */ }
  if (url.pathname === '/api/search') {
    asked.push(body.query);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: /#shorts/.test(body.query) ? webRows(body.query) : [] }) });
  }
  // YouTube's oEmbed shape, relayed by our backend: portrait for a real Short,
  // landscape for the one ordinary upload (id …00092). OLD_BACKEND drops the
  // dimensions, as the route did before it carried them.
  if (url.pathname === '/api/media/titles') {
    const titles = {};
    for (const u of body.urls || []) {
      titles[u] = { title: 't', ...(process.env.OLD_BACKEND ? {} : (/00092$/.test(u) ? { width: 200, height: 113 } : { width: 113, height: 200 })) };
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ titles }) });
  }
  if (url.pathname === '/api/social/feed') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: body.platforms?.includes('tiktok') ? tiktokRows(body.query || 'x') : [], errors: {} }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' });
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

// ── Tube → Reels ────────────────────────────────────────────────────────────
await openApp(page, `${BASE}/tube`);
await until(() => page.locator('[data-tube-reels-toggle="tube"]').count(), { what: 'the Tube/Reels toggle on Tube' });
check(true, 'Tube\'s search bar carries a Tube/Reels toggle');
await shot('tube');
await page.locator('[data-tube-reels-toggle="tube"] [data-toggle-to="reels"]').click();
await until(() => page.locator('[data-reels-surface="grid"]').count(), { what: 'Reels to open' });
check(true, '…and tapping Reels opens the reels feed');

// ── fills itself, shorts only ───────────────────────────────────────────────
const cells = page.locator('[data-reels-surface] [data-reel-root] button');
await until(() => cells.count().then((n) => n >= 6), { what: 'reels to fill with nothing typed' }).catch(() => {});
const n = await cells.count();
await shot('grid');
check(n >= 6, 'Reels fills itself on open — no "No reels right now"', `${n} reels`);
check(asked.some((q) => /#shorts$/.test(q)), 'the draw asks the index for tagged Shorts', asked.join(' | '));
const titles = await cells.allInnerTexts();
check(!titles.some((t) => /full episode|too long|untagged/.test(t)),
  'no full-length upload, nothing over 3:00, and a brief LANDSCAPE clip is refused', titles.filter((t) => /full|too long|untagged/.test(t)).join(' | ') || 'clean');
check(process.env.OLD_BACKEND ? !titles.some((t) => /longer short/.test(t)) : titles.some((t) => /longer short/.test(t)),
  process.env.OLD_BACKEND
    ? 'backend without dimensions: falls back to the strict 2:00 + #shorts rule'
    : 'a 2:40 clip YouTube confirms is a Short is allowed');
check(titles.some((t) => /tiktok/.test(t)) && titles.some((t) => /short \d/.test(t)),
  'both sources arrive: YouTube Shorts and TikToks');

// ── the top bar ─────────────────────────────────────────────────────────────
check(await page.locator('[data-reels-back]').count() === 1, 'the top bar has a back button');
check(await page.locator('[data-reels-shuffle]').count() === 1, '…a shuffle button');
check(await page.locator('[data-reels-search]').count() === 1, '…a search bar');
check(await page.locator('[data-tube-reels-toggle="reels"]').count() === 1, '…and the Tube/Reels toggle, Reels lit');

// ── the player: opens, swipes, stays shorts ─────────────────────────────────
await cells.first().click();
await until(() => page.locator('[data-reels-surface="player"]').count(), { what: 'a reel to open' });
const frameSrc = () => page.locator('[data-reels-surface="player"] iframe').first().getAttribute('src');
const first = await frameSrc();
check(/youtube|tiktok/.test(first), 'tapping a reel plays it', first?.slice(0, 60));
check(await page.locator('[data-reels-topbar]').count() === 1, 'the top bar stays over the player');
const swipe = async (dy) => {
  const box = await page.locator('[data-reels-surface="player"] [data-reel-root]').boundingBox();
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(300);
};
await swipe(-200);
await shot('player');
const second = await frameSrc();
check(second && second !== first, 'swiping up plays the next reel', second?.slice(0, 60));
await swipe(200);
check(await frameSrc() === first, 'swiping down goes back to the one before');
const shortIds = new Set();
for (let i = 0; i < 8; i++) { await swipe(-200); shortIds.add(await frameSrc()); }
check([...shortIds].every((s) => !/0009[012]/.test(s)), 'eight swipes on, still only shorts', [...shortIds].filter((s) => /0009[012]/.test(s)).join(' ') || 'clean');
await page.locator('[data-reels-grid]').click();
await until(() => page.locator('[data-reels-surface="grid"]').count(), { what: 'the grid button to return to the grid' });
check(true, 'the grid button returns to all reels');

// ── search and shuffle ──────────────────────────────────────────────────────
await page.locator('[data-reels-search]').fill('trailer park boys');
await page.locator('[data-reels-search]').press('Enter');
await until(() => page.locator('[data-reels-surface] [data-reel-root] button').first().innerText().then((t) => /trailer/i.test(t)), { what: 'search results to fill the grid' }).catch(() => {});
check(asked.includes('trailer park boys #shorts'), 'searching in Reels searches shorts', asked.slice(-2).join(' | '));
const afterSearch = await page.locator('[data-reels-surface] [data-reel-root] button').allInnerTexts();
check(afterSearch.length > 0 && afterSearch.every((t) => /trailer/i.test(t)), '…and the grid holds only what was searched', `${afterSearch.length} reels`);
const before = asked.length;
await page.locator('[data-reels-shuffle]').click();
await until(() => asked.length > before, { what: 'shuffle to draw' }).catch(() => {});
check(asked.length > before && !/trailer/.test(asked[asked.length - 1]), 'Shuffle draws a fresh feed away from the search', asked[asked.length - 1]);
check(await page.locator('[data-reels-search]').inputValue() === '', '…and clears the search box');

// ── back to Tube ────────────────────────────────────────────────────────────
await page.locator('[data-tube-reels-toggle="reels"] [data-toggle-to="tube"]').click();
await until(() => page.locator('[data-reels-surface]').count().then((c) => c === 0), { what: 'Reels to close' });
check(new URL(page.url()).pathname === '/tube', 'the toggle\'s Tube side returns to Tube', page.url());
await page.locator('[data-tube-reels-toggle="tube"] [data-toggle-to="reels"]').click();
await until(() => page.locator('[data-reels-surface]').count(), { what: 'Reels to reopen' });
await page.locator('[data-reels-back]').click();
await until(() => page.locator('[data-reels-surface]').count().then((c) => c === 0), { what: 'back to close Reels' });
check(true, 'back leaves Reels for the page it was opened from');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
