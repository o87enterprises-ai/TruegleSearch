/* The player's own self-diagnosis: a stuck spinner that clears itself when
 * the clip is actually alive, a Report link with real technical detail on
 * the states that are genuinely wrong, and tap-for-sound on Android as well
 * as iPhone.
 *
 * Owner, 2026-10-23, on Android (Firefox) after the last update: clips
 * "can keep spinning the entire video sometimes" even once playing, play
 * muted with no way to unmute, and — when something really is wrong — "I
 * can't get a reliable bug report from anyone else; add a debug state and
 * an auto report system, that's the best answer I can give you." Real
 * playback cannot be reproduced here at all (YouTube refuses embeds from
 * this container's IP outright), so what this proves is OUR OWN state
 * machine: the postMessage handshake is stubbed, same trick
 * verify-silent-embed.mjs uses, served from the real embed origin so the
 * hook's own origin/source checks run for real.
 *
 * Run it:  npm run playerreport:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5296;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const SILENT = 'silentBBBB1';     // never posts anything
const STUCK = 'stuckBBBBB1';      // posts, boots, but never reports playerState===1
const PLAYS = 'playsBBBBB1';      // posts, boots, reports playerState===1 — a normal clip
const SILENT_PAGE = '<html><body style="background:#000;color:#fff">Video unavailable. This content isn’t available.</body></html>';

// Like YouTube's real player: silent until it hears "listening", then posts
// onReady and starts a steady infoDelivery stream. `playingState` is what
// that stream reports — 1 for a clip that actually starts, 3 (buffering,
// YouTube's real code for "not yet playing") for one that boots and talks
// but never gets there, matching a handshake that heard something and
// stalled rather than one that heard nothing at all.
const chattyPage = (playingState) => `<html><body style="background:#000"><script>
  var send = function (o) { parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (!d || d.event !== 'listening' || talking) return;
    talking = true;
    send({ event: 'onReady', info: null, channel: 'widget', id: 1 });
    setInterval(function () { send({ event: 'infoDelivery', info: { playerState: ${playingState}, currentTime: 1, duration: 200 }, channel: 'widget', id: 1 }); }, 500);
  });
</script></body></html>`;

async function open(ids, { userAgent } = {}) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, ...(userAgent ? { userAgent, isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', async (r) => {
    const url = r.request().url();
    const body = url.includes(SILENT) ? SILENT_PAGE : url.includes(STUCK) ? chattyPage(3) : chattyPage(1);
    await r.fulfill({ status: 200, contentType: 'text/html', body }).catch(() => {});
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied/.test(e.message)) errs.push(e.message); });
  const query = ids.map((id) => `u=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`).join('&');
  await page.goto(`${BASE}/tube?${query}`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the share gate' });
  await page.locator('[data-share-gate]').click();
  await page.evaluate("if (document.fullscreenElement) document.exitFullscreen()").catch(() => {});
  return { ctx, page, errs };
}

const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// ── alive but never "started": the overlay stops waiting on it ─────────────
{
  const { ctx, page, errs } = await open([STUCK]);
  await until(() => page.locator('[data-player-loading]').count(), { what: 'the loading overlay' });
  await page.waitForTimeout(4000);
  check(await page.locator('[data-player-loading]').count() === 1, 'before the grace window: still showing — a chatty-but-unconfirmed clip is not trusted instantly');
  await until(() => page.locator('[data-player-alive-override="yes"]').count(), { timeout: 10000, what: 'the alive override' });
  check(await page.locator('[data-player-loading]').count() === 0, 'once the grace window passes: the overlay clears on its own — "spinning the entire video" fixed');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a normal clip never trips the override or the silence pill ─────────────
{
  const { ctx, page } = await open([PLAYS]);
  await until(async () => (await page.locator('[data-player-loading]').count()) === 0, { what: 'the overlay to clear normally' });
  await page.waitForTimeout(2000);
  check(await page.locator('[data-player-alive-override]').count() === 0, 'a clip that properly reports playing never needed the override');
  await page.close();
  await ctx.close();
}

// ── a genuinely dead clip: Skip AND Report, with real technical detail ─────
{
  const { ctx, page } = await open([SILENT]);
  await until(() => page.locator('[data-embed-silent-skip]').count(), { timeout: 32000, what: 'the silence watchdog (25s)' });
  check(await page.locator('[data-player-loading-report], [data-embed-silent-report]').count() >= 1, 'a Report link appears alongside Skip');
  const href = await page.locator('[data-player-loading-report], [data-embed-silent-report]').first().getAttribute('href');
  check(href?.startsWith('mailto:truegleai@proton.me?'), 'it is a mailto: — nothing sent unless the person sends it', href?.slice(0, 50));
  const body = decodeURIComponent(href || '');
  check(body.includes('Kind: youtube'), 'the report names the kind');
  check(body.includes('Host: www.youtube-nocookie.com'), 'and the host actually used');
  check(/Heard anything from the embed\?: no/.test(body), 'and that nothing was ever heard — a genuinely dead frame, not a slow one');
  check(/Browser: Mozilla/.test(body), 'and the browser, for a report with no other way to ask');
  await ctx.close();
}

// ── tap-for-sound on Android too, not only iPhone ───────────────────────────
for (const [label, ua] of [['Android (Firefox)', ANDROID_FIREFOX], ['iPhone (Safari)', IPHONE_SAFARI]]) {
  const { ctx, page } = await open([PLAYS], { userAgent: ua });
  await until(() => page.locator('[data-sound-tap]').count(), { timeout: 10000, what: `${label}: the sound prompt` });
  check(true, `${label}: a playing clip that autoplayed muted shows "Tap for sound"`);
  await page.locator('[data-sound-tap]').click();
  await until(async () => (await page.locator('[data-sound-tap]').count()) === 0, { what: `${label}: the prompt to clear after the tap` });
  check(true, `${label}: tapping it asks for sound and the prompt goes away`);
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
