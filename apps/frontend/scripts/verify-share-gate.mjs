/* The shared-link door's safety net.
 *
 * Tester, 2026-10-22 (iPhone, Chrome): tapped Play on a shared /tube?p= link
 * and was left on the bare Tube page — no player, no message. Not reproducible
 * here, so the door now checks its own work: if no player is on screen a few
 * seconds after the tap, it says so and offers Try again and Report.
 *
 * Pinned here:
 *   1. a normal tap opens the player and the safety net stays out of the way;
 *   2. a player that never shows (sabotaged with CSS) brings up the help card,
 *      whose Report is a mailto: carrying the page URL — nothing is sent;
 *   3. Try again, once the cause is gone, opens the player;
 *   4. Close dismisses the card.
 *
 * Run it:  npm run sharegate:test
 */
import { createServer } from 'vite';
import { launchChromium, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5297;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();
const ctx = await testContext(browser, {
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript(`
  delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen;
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  localStorage.setItem('truegle_swipe_hint_seen', '1');
  localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const LINK = `http://localhost:${PORT}/tube?p=1s9XhWZr9BtHI.yJWtC87gdsgo.y6tynWSAesAo`;
// The player never showing: hide the docked frame AND the iPhone stage (which lives in <body>).
const SABOTAGE = '[data-mini],[data-player-root]{display:none!important}';
const failedCard = (p) => p.locator('[data-share-gate-failed]');
const playerShown = (p) => p.evaluate(() => {
  const el = document.querySelector('[data-player-root]');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 40 && r.height > 40;
});

// 1. Normal tap.
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await playerShown(page), '1 a normal tap opens the player');
  check(await failedCard(page).count() === 0, '1 the safety net stays out of the way');
  check(await page.locator('[data-share-gate]').count() === 0, '1 the door is gone');
  await page.close();
}

// 2-4. A player that never shows.
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  const style = await page.addStyleTag({ content: SABOTAGE });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await failedCard(page).isVisible().catch(() => false), '2 a player that never shows brings up the help card');
  const href = await page.locator('[data-share-report]').getAttribute('href').catch(() => '');
  check(href?.startsWith('mailto:truegleai@proton.me?'), '2 Report is a mailto: (nothing sent by us)', href?.slice(0, 40));
  check(decodeURIComponent(href || '').includes('/tube?p=1s9XhWZr9BtHI'), '2 the report carries the page URL');
  check(await page.locator('[data-share-retry]').isVisible().catch(() => false), '2 Try again is offered');

  await style.evaluate((n) => n.remove());
  await page.tap('[data-share-retry]');
  await page.waitForTimeout(4500);
  check(await failedCard(page).count() === 0, '3 Try again clears the card once the player shows');
  check(await playerShown(page), '3 Try again opens the player');
  await page.close();
}
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.addStyleTag({ content: SABOTAGE });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  await page.tap('[data-share-dismiss]').catch(() => {});
  await page.waitForTimeout(400);
  check(await failedCard(page).count() === 0, '4 Close dismisses the card');
  await page.close();
}

// 5-7. iPHONE (2026-11-07): the fixed "full screen" box trapped by an
// ancestor transform — what the tester's recording shows (bare Tube page,
// player strip at the bottom, NO help card). The sabotage out-ranks the
// index.css :has() override, i.e. simulates WebKit not applying it.
const TRAP = 'div[data-mini][data-mini]{transform:translateX(0)!important}';
const covers = (p) => p.evaluate(() => {
  const el = document.querySelector('[data-player-root]');
  if (!el) return false;
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const r = el.getBoundingClientRect();
  return el.contains(hit) && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.6;
});
{
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.addStyleTag({ content: TRAP });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await covers(page), '5 iPhone: a trapped full-screen box is freed and covers the screen');
  check(await failedCard(page).count() === 0, '5 iPhone: no help card once it is freed');
  const tr = await page.evaluate(() => sessionStorage.getItem('truegle_ptrace_v1') || '');
  // The stage now lives in <body>, so there is nothing for an ancestor to trap
  // and no 'untrap' step to record — the sabotage above cannot touch it.
  check(tr.includes('"s":"covered"') && !tr.includes('"s":"untrap"'), '5 iPhone: the stage escapes the trap, and the debug trace records covered');
  // Leaving full screen hands the frame its own transform back.
  await page.evaluate(() => document.querySelector('[data-player-root]')?.removeAttribute('data-pseudo-fullscreen'));
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => [...document.querySelectorAll('[style]')].some((n) => /2147483000/.test(n.getAttribute('style'))));
  check(!left, '6 iPhone: inline untrap styles are removed when full screen ends');
  await page.close();
}
{
  // Returning visitor whose player is MINIMISED (inert) when the link opens.
  const page = await ctx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.addStyleTag({ content: TRAP });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(3500);
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await covers(page), '7 iPhone: second open (existing player) still covers the screen');
  check(await failedCard(page).count() === 0, '7 iPhone: no help card on the second open');
  await page.close();
}

// 8. ANDROID must not touch the iPhone path at all: real Fullscreen API,
// the old >=40px check, no gate trace events.
{
  const actx = await testContext(browser, {
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  await actx.addInitScript(`
    window.__fsCalls = 0; const orig = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () { window.__fsCalls++; return orig ? orig.call(this).catch(() => {}) : Promise.resolve(); };
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  await actx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[]}' }));
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await actx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await actx.newPage();
  await page.goto(LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  check(await page.evaluate(() => window.__fsCalls) >= 1, '8 Android: real requestFullscreen is used');
  check(await playerShown(page) && await failedCard(page).count() === 0, '8 Android: player opens, no help card');
  const tr = await page.evaluate(() => sessionStorage.getItem('truegle_ptrace_v1') || '');
  check(!tr.includes('"e":"gate"'), '8 Android: iPhone path never runs (no gate events)');
  check(await page.locator('[data-pseudo-fullscreen]').count() === 0, '8 Android: no pseudo full-screen box');
  await actx.close();
}

// 9-14. THE IPHONE STAGE (2026-11-08). Real iPhone, iMessage in-app browser: the
// full-screen player was nested inside the docked frame (overflow hidden, rounded,
// scrolling) and was never painted — a 2px sliver, no picture, no controls, the
// clip playing muted where nobody could tap for sound. On iPhone the root is now
// rendered straight into <body>. Proven here with an embed that really talks
// (YouTube's postMessage protocol), so sound and playback are checked too.
const CHATTY = `<html><body style="background:#123;color:#fff">PLAYING<script>
  var send=function(o){parent.postMessage(JSON.stringify(o),'*')};var t=false;
  addEventListener('message',function(e){var d;try{d=JSON.parse(e.data)}catch(x){return}
    if(d&&d.event==='command'){parent.postMessage(JSON.stringify({event:'stub-command',func:d.func}),'*');return}
    if(!d||d.event!=='listening'||t)return;t=true;
    send({event:'onReady',info:null,channel:'widget',id:1});
    setInterval(function(){send({event:'infoDelivery',info:{playerState:1,currentTime:1,duration:200},channel:'widget',id:1})},500)});
</script></body></html>`;
const STAGE_LINK = `http://localhost:${PORT}/tube?u=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DplaysBBBBB1&t=A%20Shared%20Clip`;
async function stageContext(opts, iphone) {
  const c = await testContext(browser, opts);
  await c.addInitScript(`${iphone ? 'delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen;' : ''}
    window.__cmds = []; addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d && d.event === 'stub-command') window.__cmds.push(d.func); } catch (x) { /* not ours */ } });
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  await c.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await c.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await c.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: CHATTY }));
  return c;
}
const stageFacts = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-player-root]');
  if (!root) return { root: false };
  const r = root.getBoundingClientRect();
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  // Every ancestor up to <body>: anything that can clip, scroll, round or composite a fixed child away.
  const risky = [];
  for (let el = root.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    const c = getComputedStyle(el);
    if (el !== document.body && (c.overflow !== 'visible' || c.transform !== 'none' || c.filter !== 'none'
      || (c.backdropFilter || 'none') !== 'none' || c.contain !== 'none' || c.willChange !== 'auto' || c.borderRadius !== '0px')) risky.push(el.tagName);
  }
  return {
    root: true, inBody: root.parentElement === document.body, inMini: !!root.closest('[data-mini]'),
    pseudo: root.hasAttribute('data-pseudo-fullscreen'), risky,
    w: Math.round(r.width), h: Math.round(r.height), covers: root.contains(hit) && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.6,
    soundTap: !!document.querySelector('[data-sound-tap]'), buttons: root.querySelectorAll('button').length,
  };
});
{
  const ictx = await stageContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  }, true);
  const page = await ictx.newPage();
  await page.goto(STAGE_LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  const f = await stageFacts(page);
  check(f.root && f.pseudo && f.inBody && !f.inMini, '9 iPhone: the full-screen player is attached straight to <body>, not nested in the docked frame', JSON.stringify({ inBody: f.inBody, inMini: f.inMini }));
  check(f.root && f.risky.length === 0, '10 iPhone: nothing between the stage and <body> can clip, scroll, round or composite it', f.risky.join(',') || 'clean');
  check(f.covers && f.w >= 380 && f.h >= 600, '11 iPhone: the stage fills the screen and is what you touch in the middle of it', `${f.w}x${f.h}`);
  check(f.buttons >= 5 && f.soundTap, '12 iPhone: the controls and the Tap for sound prompt are on it', `${f.buttons} buttons, soundTap=${f.soundTap}`);
  const tr0 = await page.evaluate(() => sessionStorage.getItem('truegle_ptrace_v1') || '');
  check(tr0.includes('"yt":1') && !(await page.locator('[data-player-loading]').count()), '12 iPhone: the NEW frame is heard — it reports playing and the spinner is gone', tr0.includes('"yt":1') ? 'playing' : 'never heard');
  // iOS pauses a video that is unmuted without a real tap, so nothing may do it by itself.
  const before = await page.evaluate('window.__cmds');
  check(!before.includes('unMute'), '12 iPhone: nothing unmutes the video before a real tap', before.join(',') || 'no commands');
  check(await failedCard(page).count() === 0, '12 iPhone: and the safety net stays out of the way');
  // Sound: the tap must reach the (reloaded) embed in the same gesture.
  await page.tap('[data-sound-tap]').catch(() => {});
  await page.waitForTimeout(800);
  const cmds = await page.evaluate('window.__cmds');
  check(cmds.includes('unMute'), '13 iPhone: Tap for sound reaches the video — the embed received unMute', cmds.join(',') || 'nothing');
  // And the way out: Leave full screen puts the player back in the docked frame, still playing.
  await page.locator('button[aria-label="Leave full screen"]').first().dispatchEvent('click');
  await page.waitForTimeout(1500);
  const back = await stageFacts(page);
  check(back.root && !back.pseudo && back.inMini && !back.inBody, '14 iPhone: leaving full screen returns the player to the docked frame', JSON.stringify({ pseudo: back.pseudo, inMini: back.inMini }));
  check(await page.evaluate(() => document.querySelectorAll('[data-player-root]').length) === 1, '14 iPhone: exactly one player on the page — nothing left behind in <body>');
  const tr2 = await page.evaluate(() => sessionStorage.getItem('truegle_ptrace_v1') || '');
  const heardCount = (tr2.match(/"heard":true/g) || []).length;
  check(heardCount >= 3 && !(await page.locator('[data-player-loading]').count()), '14 iPhone: the frame is re-bound on the way out too — heard again, still playing', `heard ${heardCount}x`);
  await ictx.close();
}
{
  // Android must be untouched: the root stays inside the docked frame, never in <body>.
  const actx = await stageContext({
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  }, false);
  const page = await actx.newPage();
  await page.goto(STAGE_LINK);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.tap('[data-share-gate]');
  await page.waitForTimeout(4500);
  const f = await stageFacts(page);
  check(f.root && f.inMini && !f.inBody && !f.pseudo, '15 Android: the player stays in the docked frame — no portal, no pseudo box', JSON.stringify({ inMini: f.inMini, inBody: f.inBody, pseudo: f.pseudo }));
  await actx.close();
}

await browser.close();
await server.close();
for (const l of [...ok, ...bad]) console.log(l);
console.log(`${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
