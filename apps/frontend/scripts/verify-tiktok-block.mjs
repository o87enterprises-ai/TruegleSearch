/* A TikTok that refuses its player ("429 Too Many Requests").
 *
 * Owner, 2026-11-10, phone AND desktop: the Feed's TikTok player spun, then
 * showed TikTok's own error page — "The server at www.tiktok.com sent back an
 * error: 429 Too Many Requests". That page is TikTok's, drawn inside our frame;
 * it never says "ready". docs/TIKTOK-429-PLAN.md steps 1-3. Pinned here:
 *   1. a full player that has loaded and said nothing for ~4 s is given up on
 *      (it used to be 10 s from mount), and the card is shown for the SAME clip
 *   2. that is remembered for the tab: the next TikTok starts in the card, with
 *      NO request for the full player at all
 *   3. a quiet strip says "TikTok may be limiting playback" with Open on TikTok,
 *      Try the full player and Next — Next moves on, and Try the full player asks
 *      for the full player again, then waits 30 s before it can be pressed again
 *   4. a full player that works again ("ready") clears the memory
 *   5. the helpers survive blocked storage and expire on time
 *
 * Run it:  npm run tiktokblock:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5297;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const idOf = (n) => `7${String(n).padStart(18, '0')}`;
const tt = (n) => ({
  id: `tt${n}`, platform: 'Community', title: `TikTok clip ${n}`,
  url: `https://www.tiktok.com/@someone/video/${idOf(n)}`, permalink: `https://www.tiktok.com/@someone/video/${idOf(n)}`,
  snippet: null, author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z', score: null, comments: null, thumbnail: null, flair: null,
});
const POSTS = [1, 2, 3].map(tt);

const REFUSED = '<html><body style="background:#1b1b1b;color:#fff;font:14px sans-serif"><h3>Looks like there\'s a problem with this site</h3><p>The server at www.tiktok.com sent back an error: 429 Too Many Requests</p></body></html>';
const WORKS = `<!doctype html><html><body style="background:#111"><script>
  const say = (type, value) => parent.postMessage({ 'x-tiktok-player': true, type, value }, '*');
  addEventListener('message', (e) => { if (e.data && e.data.type === 'play') say('onStateChange', 1); });
  setTimeout(() => { say('onPlayerReady'); }, 300);
</script></body></html>`;
const CARD = '<html><body style="background:#fff">card</body></html>';

async function session(playerHtml) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');");
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/social/feed') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: '', results: POSTS, platforms: { community: POSTS }, nextCursor: {}, errors: {} }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const state = { player: playerHtml, requests: [] };
  await ctx.route('**/www.tiktok.com/**', (r) => {
    const url = r.request().url();
    state.requests.push({ url, at: Date.now() });
    if (/\/embed\/v2\//.test(url)) return r.fulfill({ status: 200, contentType: 'text/html', body: CARD });
    return r.fulfill({ status: 200, contentType: 'text/html', body: state.player });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/feed`);
  await until(() => page.locator('[data-feed-action="play"]').count(), { what: 'a feed card' });
  return { ctx, page, state, errs };
}
const frameSrc = (page) => page.locator('iframe[src*="tiktok.com"]').first().getAttribute('src').catch(() => '');
const v1For = (state, n) => state.requests.filter((r) => r.url.includes(`/player/v1/${idOf(n)}`)).length;
const cardFor = (state, n) => state.requests.filter((r) => r.url.includes(`/embed/v2/${idOf(n)}`)).length;

// ── a TikTok that refuses its player ───────────────────────────────────────
{
  const { ctx, page, state, errs } = await session(REFUSED);
  const t0 = Date.now();
  await page.locator('[data-feed-action="play"]').first().dispatchEvent('click');
  await until(async () => /player\/v1/.test(await frameSrc(page)), { what: 'the full player', timeout: 8000 }).catch(() => {});
  check(/player\/v1/.test(await frameSrc(page)), 'a TikTok first asks for the full player');

  await until(async () => /embed\/v2/.test(await frameSrc(page)), { what: 'the card fallback', timeout: 9000 }).catch(() => {});
  const took = Date.now() - t0;
  check(/embed\/v2/.test(await frameSrc(page)), 'a loaded-but-silent full player is given up on and the card is shown', `${took}ms`);
  check(took < 8000, '…in about four seconds after it loaded, not ten from mount', `${took}ms`);
  check((await frameSrc(page)).includes(idOf(1)), '…for the SAME clip (it is not skipped)');

  const until1 = await page.evaluate(() => Number(sessionStorage.getItem('truegle_tiktok_v1_blocked_until')));
  check(until1 > Date.now() + 9 * 60 * 1000 && until1 <= Date.now() + 10 * 60 * 1000 + 1000, 'the tab remembers it for ten minutes', String(until1 - Date.now()));

  // The strip: quiet at first, then a way out.
  check(await page.locator('[data-tiktok-help]').count() === 0, 'the strip is not there at the very start (it says "may", so it waits a few seconds)');
  await until(() => page.locator('[data-tiktok-help]').count(), { what: 'the helper strip', timeout: 6000 }).catch(() => {});
  check(await page.locator('[data-tiktok-help]').count() === 1, 'a strip appears: "TikTok may be limiting playback right now"');
  check((await page.locator('[data-tiktok-help]').innerText()).includes('may be limiting playback'), '…and says "may", not that it is');
  check(await page.locator('[data-tiktok-open]').getAttribute('href') === POSTS[0].url, '…with Open on TikTok pointing at the clip\'s own page');
  check(await page.locator('[data-tiktok-open]').getAttribute('target') === '_blank' && /noopener/.test(await page.locator('[data-tiktok-open]').getAttribute('rel')), '…that opens in a new tab with noopener');
  check(await page.locator('[data-tiktok-retry]').isEnabled(), '…and Try the full player is available the first time');

  // Next: the following TikTok must NOT ask for the full player.
  const before = state.requests.length;
  await page.locator('[data-tiktok-next]').dispatchEvent('click');
  await until(async () => (await frameSrc(page)).includes(idOf(2)), { what: 'the next clip', timeout: 6000 }).catch(() => {});
  const second = await frameSrc(page);
  check(second.includes(idOf(2)), 'Next moves on to the next TikTok');
  check(/embed\/v2/.test(second), 'the next TikTok starts straight in the card', second.slice(0, 70));
  await page.waitForTimeout(800);
  check(v1For(state, 2) === 0, 'the full player is never even requested for it (one request, not two)', `${v1For(state, 2)} requests`);
  check(state.requests.slice(before).every((r) => !/player\/v1/.test(r.url)), '…and no full-player request left the page after Next');
  check(cardFor(state, 2) >= 1, '…the card is what was asked for', `${cardFor(state, 2)}`);

  // Try the full player, on clip 2: asks again, then has to wait.
  await until(() => page.locator('[data-tiktok-retry]').count(), { what: 'the strip again', timeout: 6000 }).catch(() => {});
  await page.locator('[data-tiktok-retry]').dispatchEvent('click');
  await until(() => v1For(state, 2) > 0, { what: 'the full player to be asked for again', timeout: 5000 }).catch(() => {});
  check(v1For(state, 2) === 1, 'Try the full player asks for the full player again, for this clip', `${v1For(state, 2)} requests`);
  await until(async () => /embed\/v2/.test(await frameSrc(page)), { what: 'the card again', timeout: 9000 }).catch(() => {});
  await until(() => page.locator('[data-tiktok-retry]').count(), { what: 'the strip again', timeout: 6000 }).catch(() => {});
  const label = await page.locator('[data-tiktok-retry]').innerText().catch(() => '');
  check(await page.locator('[data-tiktok-retry]').isDisabled().catch(() => false) && /in \d+s/.test(label), 'pressed again at once, it waits (it cannot be hammered)', label);
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a full player that works again clears the memory ───────────────────────
{
  const { ctx, page, state, errs } = await session(REFUSED);
  await page.locator('[data-feed-action="play"]').first().dispatchEvent('click');
  await until(async () => /embed\/v2/.test(await frameSrc(page)), { what: 'the card fallback', timeout: 9000 }).catch(() => {});
  check(await page.evaluate(() => !!sessionStorage.getItem('truegle_tiktok_v1_blocked_until')), '[recovers] it was blocked');
  state.player = WORKS;                                  // TikTok lets us back in
  await until(() => page.locator('[data-tiktok-retry]').count(), { what: 'the strip', timeout: 6000 }).catch(() => {});
  await page.locator('[data-tiktok-retry]').dispatchEvent('click');
  await until(async () => /player\/v1/.test(await frameSrc(page)), { what: 'the full player again', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  check(/player\/v1/.test(await frameSrc(page)), '[recovers] the full player is back for this clip');
  check(await page.locator('[data-tiktok-help]').count() === 0, '[recovers] the strip is gone once it plays');
  check(await page.evaluate(() => !sessionStorage.getItem('truegle_tiktok_v1_blocked_until')), '[recovers] "ready" clears the ten-minute memory');
  check(errs.length === 0, '[recovers] nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── the helpers on their own ───────────────────────────────────────────────
{
  const m = await server.ssrLoadModule('/src/utils/tiktokBlock.js');
  const mem = () => { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };
  const s = mem();
  check(m.tiktokBlocked(1000, s) === false, '[helpers] nothing is blocked to begin with');
  m.markTikTokBlocked(1000, s);
  check(m.tiktokBlocked(1000 + m.TIKTOK_BLOCK_MS - 1, s) === true, '[helpers] blocked for the whole ten minutes');
  check(m.tiktokBlocked(1000 + m.TIKTOK_BLOCK_MS + 1, s) === false, '[helpers] ...and not a moment longer');
  m.markTikTokBlocked(1000, s); m.clearTikTokBlocked(s);
  check(m.tiktokBlocked(1001, s) === false, '[helpers] a working player clears it');
  check(m.tiktokRetryWaitMs(5000, s) === 0, '[helpers] the first retry is free');
  m.noteTikTokRetry(5000, s);
  check(m.tiktokRetryWaitMs(5000 + 10000, s) === m.TIKTOK_RETRY_GAP_MS - 10000, '[helpers] a second retry waits out the rest of 30 s');
  check(m.tiktokRetryWaitMs(5000 + m.TIKTOK_RETRY_GAP_MS, s) === 0, '[helpers] ...then it is free again');
  const hostile = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  let threw = false;
  try { m.markTikTokBlocked(1, hostile); m.clearTikTokBlocked(hostile); m.noteTikTokRetry(1, hostile); check(m.tiktokBlocked(1, hostile) === false && m.tiktokRetryWaitMs(1, hostile) === 0, '[helpers] blocked storage means "not blocked", never an error'); } catch { threw = true; }
  check(!threw, '[helpers] blocked storage never throws');
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
