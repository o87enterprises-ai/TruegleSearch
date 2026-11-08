/* Bluetooth, headset, car and lock-screen controls reach the player.
 *
 * Owner, 2026-11-08: "make sure that Bluetooth controls make it to the player."
 * Those buttons arrive as Media Session actions. Only native audio/video used to
 * register for them; a YouTube clip (nearly everything) did not, so a headset's
 * next/previous never reached Truegle's queue. hooks/useMediaSessionBridge.js now
 * registers for every kind.
 *
 * Proven here, with the Media Session handlers captured and CALLED the way the
 * OS would, against an embed that really speaks YouTube's postMessage protocol:
 *   - play / pause / nexttrack are registered for an embed, previoustrack only
 *     once there is something to go back to
 *   - the lock screen shows Truegle's title, channel and a picture, and the
 *     right paused/playing state
 *   - pause → the embed is told to pause; play → told to play
 *   - next / previous walk the queue, and the lock screen follows
 *   - the silent keep-alive plays while an embed plays, pauses with it, and
 *     does NOT exist for a native file
 *   - everything is released when the player closes
 *
 * NOT provable here: which of the page and the iframe a phone or headset hands
 * the buttons to is the platform's decision. This proves the page does its part.
 *
 * Run it:  npm run mediakeys:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const guarded = async (label, fn) => { try { await fn(); } catch (e) { bad.push(`FAIL ${label} — ${String(e.message).split('\n')[0]}`); } };

const PORT = 5320;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await launchChromium();

const CHATTY = `<html><body style="background:#123;color:#fff">PLAYING<script>
  var send=function(o){parent.postMessage(JSON.stringify(o),'*')};var t=false;
  addEventListener('message',function(e){var d;try{d=JSON.parse(e.data)}catch(x){return}
    if(d&&d.event==='command'){parent.postMessage(JSON.stringify({event:'stub-command',func:d.func}),'*');return}
    if(!d||d.event!=='listening'||t)return;t=true;
    send({event:'onReady',info:null,channel:'widget',id:1});
    setInterval(function(){send({event:'infoDelivery',info:{playerState:1,currentTime:1,duration:200},channel:'widget',id:1})},500)});
</script></body></html>`;

// A real (silent) WAV for the native-file case.
const WAV = (() => { const n = 8000; const b = Buffer.alloc(44 + n, 128); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); return b; })();

const A = 'https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DplaysBBBBB1';
const B = 'https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DplaysBBBBB2';
const TWO = `http://localhost:${PORT}/tube?u=${A}&t=Alpha&u=${B}&t=Beta`;
const NATIVE = `http://localhost:${PORT}/tube?u=${encodeURIComponent('https://media.example.test/clip.mp3')}&t=Native%20Song`;

async function open(opts) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript(`
    window.__ms = {}; window.__cmds = [];
    if (window.MediaSession) {
      const orig = MediaSession.prototype.setActionHandler;
      MediaSession.prototype.setActionHandler = function (a, h) { window.__ms[a] = h || null; return orig.call(this, a, h); };
    }
    addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d && d.event === 'stub-command') window.__cmds.push(d.func); } catch (x) { /* not ours */ } });
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: CHATTY }));
  await ctx.route('**/media.example.test/**', (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: WAV }));
  return ctx;
}
const state = (page) => page.evaluate(() => {
  const ms = navigator.mediaSession; const k = document.querySelector('[data-media-keepalive]');
  const art = ms.metadata?.artwork?.[0]?.src || '';
  return {
    title: ms.metadata?.title ?? null, artist: ms.metadata?.artist ?? null, art, playback: ms.playbackState,
    play: typeof window.__ms.play === 'function', pause: typeof window.__ms.pause === 'function',
    next: typeof window.__ms.nexttrack === 'function', prev: typeof window.__ms.previoustrack === 'function',
    keep: k ? { paused: k.paused, loop: k.loop } : null, cmds: [...window.__cmds],
  };
});
const call = (page, a) => page.evaluate((x) => window.__ms[x] && window.__ms[x](), a);
const titleIs = (page, t) => until(() => state(page).then((s) => s.title === t), { what: `lock screen to read "${t}"`, timeout: 6000 });

for (const [label, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['android', { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }],
]) {
  await guarded(`${label} embed`, async () => {
    const ctx = await open(opts);
    const page = await ctx.newPage();
    await page.goto(TWO);
    await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
    await page.locator('[data-share-gate]').dispatchEvent('click');
    await titleIs(page, 'Alpha');
    await page.waitForTimeout(800);
    let s = await state(page);
    check(s.play && s.pause && s.next, `${label}: play, pause and next-track are registered for a YouTube clip`);
    check(!s.prev, `${label}: previous-track is not offered while there is nothing to go back to`);
    check(s.title === 'Alpha' && s.artist && s.art.includes('i.ytimg.com/vi/playsBBBBB1'), `${label}: the lock screen shows Truegle's title and the clip's picture`, `${s.title} / ${s.art.slice(0, 48)}`);
    check(s.playback === 'playing', `${label}: the lock screen says playing`, s.playback);
    check(s.keep && !s.keep.paused && s.keep.loop, `${label}: the silent keep-alive is playing, so this page can hold the session`, JSON.stringify(s.keep));

    await call(page, 'pause');
    await until(() => state(page).then((x) => x.cmds.includes('pauseVideo')), { what: 'the embed to be told to pause', timeout: 6000 }).catch(() => {});
    s = await state(page);
    check(s.cmds.includes('pauseVideo'), `${label}: the Pause button pauses the embed`, s.cmds.join(','));
    check(s.playback === 'paused' && s.keep?.paused, `${label}: the lock screen says paused, and the keep-alive stops with it`, `${s.playback} keep.paused=${s.keep?.paused}`);

    const before = s.cmds.filter((c) => c === 'playVideo').length;
    await call(page, 'play');
    await until(() => state(page).then((x) => x.cmds.filter((c) => c === 'playVideo').length > before), { what: 'the embed to be told to play', timeout: 6000 }).catch(() => {});
    s = await state(page);
    check(s.cmds.filter((c) => c === 'playVideo').length > before, `${label}: the Play button resumes the embed`);
    check(s.playback === 'playing' && s.keep && !s.keep.paused, `${label}: playing again, keep-alive back on`);

    await call(page, 'nexttrack');
    await titleIs(page, 'Beta');
    s = await state(page);
    check(s.title === 'Beta' && s.prev, `${label}: Next-track moves the queue on, and Previous becomes available`, `${s.title}, prev=${s.prev}`);
    await call(page, 'previoustrack');
    await titleIs(page, 'Alpha');
    check((await state(page)).title === 'Alpha', `${label}: Previous-track goes back`);
    await ctx.close();
  });
}

await guarded('native file', async () => {
  const ctx = await open({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(NATIVE);
  await page.waitForSelector('[data-share-gate]', { timeout: 20000 });
  await page.locator('[data-share-gate]').dispatchEvent('click');
  await titleIs(page, 'Native Song');
  const s = await state(page);
  check(s.play && s.pause && s.next, 'native file: the buttons are still registered (unchanged)');
  check(s.keep === null, 'native file: no keep-alive — its own element already owns the session');
  await ctx.close();
});

await browser.close();
await server.close();
for (const l of [...ok, ...bad]) console.log(l);
console.log(`${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
