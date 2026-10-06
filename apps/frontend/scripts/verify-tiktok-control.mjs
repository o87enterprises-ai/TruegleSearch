/* TikTok in the player: sound on, and the player's own buttons control it.
 *
 * Owner, 2026-10-06: "the tiktok feed / tube / reel audio bug (no audio plays
 * out loud upon start and there's no way to push play or pause once the video
 * begins)". TikTok was embedded as the /embed/v2 CARD, which has no control
 * channel — it autoplayed muted and nothing outside it could unmute, pause or
 * play it, and the player's Pause could only unmount it. Now it is TikTok's
 * player/v1 embed, which speaks postMessage (developers.tiktok.com/doc/embed-player).
 *
 * A stand-in TikTok player is served at www.tiktok.com/player/v1/* (so its
 * origin is real); it records every command it is sent and reports state the
 * way TikTok does. Pinned:
 *   - the frame is player/v1, never the old card
 *   - when it says ready, it is told unMute + play  (sound on start)
 *   - the player's Pause sends pause, Play sends play
 *   - a TikTok that ends (onStateChange 0) moves the queue on
 *   - an old saved /embed/v2 source is upgraded on the way to the screen
 *
 * Real TikTok playback cannot run in this headless browser; this pins the
 * wire protocol, which is exactly what was missing.
 *
 * Run it:  npm run tiktok:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5293;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const tt = (n) => ({
  id: `tt${n}`, platform: 'Community', title: `TikTok clip ${n}`,
  url: `https://www.tiktok.com/@someone/video/7${String(n).padStart(18, '0')}`,
  permalink: `https://www.tiktok.com/@someone/video/7${String(n).padStart(18, '0')}`,
  snippet: null, author: 'someone', subreddit: null, date: '2026-01-01T00:00:00Z', score: null, comments: null, thumbnail: null, flair: null,
});
const POSTS = [1, 2, 3].map(tt);

// The stand-in: records commands, answers like TikTok's player.
const FAKE_TIKTOK = `<!doctype html><html><body style="background:#111"><script>
  window.__got = [];
  const say = (type, value) => parent.postMessage({ 'x-tiktok-player': true, type, value }, '*');
  addEventListener('message', (e) => {
    const d = e.data; if (!d || d['x-tiktok-player'] !== true) return;
    window.__got.push(d.type);
    if (d.type === 'play') say('onStateChange', 1);
    if (d.type === 'pause') say('onStateChange', 2);
  });
  window.__end = () => say('onStateChange', 0);
  setTimeout(() => { say('onPlayerReady'); say('onCurrentTime', { currentTime: 1, duration: 30 }); }, 300);
</script></body></html>`;

const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
  + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');");
await ctx.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === '/api/social/feed') {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: '', results: POSTS, platforms: { community: POSTS }, nextCursor: {}, errors: {} }) });
  }
  return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
const requested = [];
await ctx.route('**/www.tiktok.com/**', (r) => {
  requested.push(r.request().url());
  return r.fulfill({ status: 200, contentType: 'text/html', body: FAKE_TIKTOK });
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));

await openApp(page, `${BASE}/feed`);
await until(() => page.locator('[data-feed-action="play"]').count(), { what: 'a feed card' });
await page.locator('[data-feed-action="play"]').first().dispatchEvent('click');
await until(() => page.locator('iframe[src*="tiktok.com"]').count(), { what: 'the TikTok frame' });

const src = await page.locator('iframe[src*="tiktok.com"]').first().getAttribute('src');
check(/\/player\/v1\/\d+/.test(src) && !/embed\/v2/.test(src), 'TikTok plays in the controllable player/v1 embed, not the old card', src);

const ttFrame = () => page.frames().find((f) => f.url().includes('tiktok.com/player/v1'));
const got = async () => (await ttFrame()?.evaluate('window.__got').catch(() => [])) || [];
await until(async () => (await got()).includes('play'), { what: 'the ready handshake', timeout: 5000 }).catch(() => {});
const first = await got();
check(first.includes('unMute'), 'when TikTok says it is ready, it is told to UNMUTE (sound on start)', first.join(','));
check(first.includes('play'), '…and to play', first.join(','));

// Pause from the player's own button.
const pic = await page.locator('iframe[src*="tiktok.com"]').first().boundingBox();
await page.touchscreen.tap(pic.x + pic.width / 2, pic.y + pic.height / 2); // reveal controls (and may toggle)
await page.waitForTimeout(400);
const before = (await got()).length;
const pauseBtn = page.locator('[aria-label="Pause"]:visible').first();
if (await pauseBtn.count()) await pauseBtn.dispatchEvent('click');
await page.waitForTimeout(500);
const afterPause = (await got()).slice(before);
check(afterPause.includes('pause'), "the player's Pause reaches TikTok", afterPause.join(',') || 'nothing sent');
check(await page.locator('iframe[src*="tiktok.com"]').count() > 0, '…and pausing keeps the clip (it used to unmount it)');

const before2 = (await got()).length;
const playBtn = page.locator('[aria-label="Play"]:visible').first();
if (await playBtn.count()) await playBtn.dispatchEvent('click');
await page.waitForTimeout(500);
const afterPlay = (await got()).slice(before2);
check(afterPlay.includes('play'), "the player's Play reaches TikTok", afterPlay.join(',') || 'nothing sent');

// The end of a TikTok moves the queue on.
const srcBefore = await page.locator('iframe[src*="tiktok.com"]').first().getAttribute('src');
await ttFrame()?.evaluate('window.__end()');
await until(async () => (await page.locator('iframe[src*="tiktok.com"]').first().getAttribute('src').catch(() => srcBefore)) !== srcBefore,
  { what: 'the next clip', timeout: 5000 }).catch(() => {});
const srcAfter = await page.locator('iframe[src*="tiktok.com"]').first().getAttribute('src').catch(() => null);
check(!!srcAfter && srcAfter !== srcBefore, 'when a TikTok ends, the queue moves on', `${srcBefore?.slice(-30)} → ${srcAfter?.slice(-30)}`);
check(requested.every((u) => !/embed\/v2/.test(u)), 'the old /embed/v2 card is never requested', requested.filter((u) => /embed\/v2/.test(u)).join(' ') || 'none');
check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
await ctx.close();

// An old queue saved with /embed/v2 is upgraded.
{
  const { upgradeTikTokSrc } = await server.ssrLoadModule('/src/utils/videoEmbed.js');
  const up = upgradeTikTokSrc('https://www.tiktok.com/embed/v2/7123456789012345678');
  check(up.startsWith('https://www.tiktok.com/player/v1/7123456789012345678'), 'a saved /embed/v2 source is upgraded to player/v1', up);
  check(upgradeTikTokSrc('https://www.youtube-nocookie.com/embed/abc') === 'https://www.youtube-nocookie.com/embed/abc', '…and nothing else is touched');
}


// ── when the controllable player cannot run: the card, not a black box ──────
// Owner, 2026-10-06, phone in a private window: "the tiktok player is still not
// playing" — a blank black frame. TikTok's player/v1 needs third-party storage,
// which private windows block, so it errors ("Player error") or never says
// ready. The card player draws the video regardless. Neither failure may skip
// the clip or leave the box blank.
for (const mode of ['error', 'silent']) {
  const c2 = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c2.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');");
  await c2.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/api/social/feed') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: '', results: POSTS, platforms: { community: POSTS }, nextCursor: {}, errors: {} }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const seen = [];
  await c2.route('**/www.tiktok.com/**', (r) => {
    const url = r.request().url();
    seen.push(url);
    if (/\/embed\/v2\//.test(url)) return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#fff">card</body></html>' });
    const body = mode === 'error'
      ? `<html><body><script>setTimeout(() => parent.postMessage({ 'x-tiktok-player': true, type: 'onPlayerError', value: { errorCode: 2001, errorType: 'SERVER_ERROR' } }, '*'), 300);</script></body></html>`
      : '<html><body style="background:#000"></body></html>';          // never says anything
    return r.fulfill({ status: 200, contentType: 'text/html', body });
  });
  const p2 = await c2.newPage();
  await openApp(p2, `${BASE}/feed`);
  await until(() => p2.locator('[data-feed-action="play"]').count(), { what: 'a feed card' });
  await p2.locator('[data-feed-action="play"]').first().dispatchEvent('click');
  await until(() => p2.locator('iframe[src*="tiktok.com"]').count(), { what: 'the TikTok frame' });
  const first = await p2.locator('iframe[src*="tiktok.com"]').first().getAttribute('src');
  check(/player\/v1/.test(first), `[${mode}] it tries the controllable player first`, first.slice(0, 60));
  await until(async () => /embed\/v2/.test((await p2.locator('iframe[src*="tiktok.com"]').first().getAttribute('src').catch(() => '')) || ''),
    { what: 'the card fallback', timeout: mode === 'silent' ? 14000 : 5000 }).catch(() => {});
  const after = await p2.locator('iframe[src*="tiktok.com"]').first().getAttribute('src').catch(() => '');
  check(/embed\/v2\/\d+/.test(after || ''), `[${mode}] ${mode === 'error' ? 'a player error' : 'a player that never answers'} falls back to the card player`, (after || '').slice(0, 60));
  check(after && after.includes(first.match(/\/(\d{10,})/)[1]), `[${mode}] …for the SAME clip (it is not skipped)`);
  const box = await p2.locator('iframe[src*="tiktok.com"]').first().boundingBox();
  check(box && box.height > box.width * 1.9, `[${mode}] …in the taller box the card needs`, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
  await c2.close();
}

// ── a pasted TikTok link can be PLAYED, not only posted ─────────────────────
// Owner, 2026-10-06: "I can't figure out how to search a TikTok link to test
// on feed." Pasting a link into the Feed bar offered only "Post" (share it with
// everyone). Now it offers Play.
{
  const c3 = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c3.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1'); localStorage.setItem('truegle_feed_defaulted_pop_v1', '1');"
    + "localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));");
  await c3.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: '', results: [], platforms: {}, nextCursor: {}, errors: {} }) }));
  await c3.route('**/www.tiktok.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: FAKE_TIKTOK }));
  const p3 = await c3.newPage();
  await openApp(p3, `${BASE}/feed`);
  const bar = p3.locator('textarea:visible, input[aria-label="Search input"]:visible').first();
  await until(() => bar.count(), { what: 'the Feed bar' });
  await bar.click();
  await bar.fill('https://www.tiktok.com/@mclauchner/video/7546605715763350815');
  await until(() => p3.locator('[data-feed-play-link]').count(), { what: 'the Play button', timeout: 5000 }).catch(() => {});
  check(await p3.locator('[data-feed-play-link]').count() === 1, 'pasting a TikTok link into the Feed bar offers Play');
  check(await p3.locator('[data-feed-submit-go]').count() === 1, '…as well as Post');
  await p3.locator('[data-feed-play-link]').dispatchEvent('click');
  await until(() => p3.locator('iframe[src*="7546605715763350815"]').count(), { what: 'it playing', timeout: 6000 }).catch(() => {});
  check(await p3.locator('iframe[src*="tiktok.com/player/v1/7546605715763350815"]').count() > 0, 'Play puts that TikTok in the player');
  await c3.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
