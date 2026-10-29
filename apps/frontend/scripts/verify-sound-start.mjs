/* A clip STARTS WITH SOUND everywhere except where the platform forces silence.
 *
 * Owner, 2026-10-28 (Android phone): "the songs are still starting with the
 * volume turned all the way down. Let's not break playback on all devices
 * because of an iPhone playback issue — make sure Android and PC are unaffected
 * by the iPhone fallback methods."
 *
 * The iPhone is the one platform where a page cannot unmute a clip it
 * autoplayed (WebKit pauses it), so there — and only there — a clip starts
 * silent behind a "Tap for sound" pill. Everything built for that must stay
 * on the iPhone. This plays the same clip as three devices and pins:
 *
 *   desktop  the player UNMUTES the clip itself once it is playing, the volume
 *            control reads full, no "Tap for sound" pill
 *   android  exactly the same as desktop
 *   iphone   starts silent (volume control reads muted), shows the pill, sends
 *            NO unmute on its own — and one tap on the pill unmutes
 *   + a volume the listener set to zero is still respected on every device
 *   + a zero saved by an EARLIER build (no revision stamp) is reset once, so the
 *     clips are not silent for no reason; a zero saved by this one is kept
 *   + a frame that is alive but never says "playing" (seen on Android) still
 *     gets its unmute, once the player's alive override fires — and the iPhone
 *     stays silent behind its pill either way
 *   + the embed URL carries mute=1 on the iPhone ONLY. It was added for the
 *     iPhone (PR #54, 2026-10-20) but applied to every device, so Android and PC
 *     started every clip silent and depended on the page unmuting it afterwards
 *     (owner, 2026-10-29: "it didn't used to do that")
 *   + a browser that BLOCKS sound-on autoplay (the clip never starts) is rescued
 *     after a few seconds: muted autoplay, then the usual unmute — never on iOS
 *   + the frame REPORTS whether it is muted, and the page believes it: a browser
 *     that refuses the unmute (Android, owner 2026-10-29: "songs are still
 *     starting with the volume off") gets retries and then the one-tap
 *     "Tap for sound", on any platform; a frame that accepts it never shows one
 *
 * The YouTube frame is stubbed: it reports "playing" and records every command
 * the player sends it. Run it:  npm run soundstart:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5314;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 900 } },
  android: {
    viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  },
  iphone: {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
};

// A YouTube frame that says it is playing and tells the page every command it gets.
const FRAME = `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'command') { parent.postMessage('PROBE:' + d.func + ':' + JSON.stringify(d.args || []), '*'); return; }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      var t = 0;
      setInterval(function () { t += 0.5; send({ event: 'infoDelivery', info: { playerState: 1, currentTime: t, duration: 200 } }); }, 500);
    }
  });
</script></body></html>`;

// A frame that is alive and talking but never reports "playing" (playerState 1).
const FRAME_ALIVE = `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'command') { parent.postMessage('PROBE:' + d.func + ':' + JSON.stringify(d.args || []), '*'); return; }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      var t = 0;
      setInterval(function () { t += 0.5; send({ event: 'infoDelivery', info: { currentTime: t, duration: 200 } }); }, 500);
    }
  });
</script></body></html>`;


// A browser that blocks SOUND-ON autoplay: the frame is alive (says so, and says
// "unstarted") but the clip only starts once it has been muted and told to play.
const FRAME_BLOCKED = `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false; var muted = false; var started = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'command') {
      parent.postMessage('PROBE:' + d.func + ':' + JSON.stringify(d.args || []), '*');
      if (d.func === 'mute') { muted = true; send({ event: 'infoDelivery', info: { muted: true } }); }
      if (d.func === 'unMute') { muted = false; send({ event: 'infoDelivery', info: { muted: false } }); }
      if (d.func === 'playVideo' && muted) started = true;
      return;
    }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      var t = 0;
      setInterval(function () { t += 0.5; send({ event: 'infoDelivery', info: started ? { playerState: 1, currentTime: t, duration: 200 } : { playerState: -1 } }); }, 500);
    }
  });
</script></body></html>`;

// Frames that REPORT their muted state, the way YouTube's infoDelivery does.
// 'coop' accepts the unmute; 'refuse' ignores it until the test says a gesture
// happened (window.__allow), which is what a browser that wants a tap does.
const mutedFrame = (refuse) => `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false; var muted = true; window.__allow = ${refuse ? 'false' : 'true'};
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'command') {
      parent.postMessage('PROBE:' + d.func + ':' + JSON.stringify(d.args || []), '*');
      if (d.func === 'unMute' && window.__allow && muted) { muted = false; send({ event: 'infoDelivery', info: { muted: false, volume: 100 } }); }
      if (d.func === 'mute') { muted = true; send({ event: 'infoDelivery', info: { muted: true } }); }
      return;
    }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      send({ event: 'infoDelivery', info: { muted: true, volume: 100 } });
      var t = 0;
      setInterval(function () { t += 0.5; send({ event: 'infoDelivery', info: { playerState: 1, currentTime: t, duration: 200 } }); }, 500);
    }
  });
</script></body></html>`;
const FRAME_COOP = mutedFrame(false);
const FRAME_REFUSE = mutedFrame(true);

async function run(device, { saved = null, frame = 'playing', settleMs = 3000 } = {}) {
  const ctx = await testContext(browser, DEVICES[device]);
  await ctx.addInitScript(`
    window.__cmds = [];
    addEventListener('message', function (e) { if (typeof e.data === 'string' && e.data.indexOf('PROBE:') === 0) window.__cmds.push(e.data.slice(6)); });
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_swipe_hint_seen', '1');
    ${saved ? `if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('truegle_player_queue_v2', ${JSON.stringify(JSON.stringify(saved))}); }` : ''}
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').trim();
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (new URL(r.request().url()).pathname === '/api/search' && q && b.filters?.category === 'videos') {
      return json({ success: true, results: Array.from({ length: 6 }, (_, i) => ({ title: `${q} video ${i}`, url: `https://www.youtube.com/watch?v=sound${String(i).padStart(6, '0')}`, duration: `3:0${i}` })) });
    }
    return json({ success: true, data: [], results: [] });
  });
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: ({ alive: FRAME_ALIVE, coop: FRAME_COOP, refuse: FRAME_REFUSE, blocked: FRAME_BLOCKED })[frame] || FRAME }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]:visible').first();
  await until(() => bar.count(), { what: 'the Tube bar' });
  await bar.click(); await bar.fill('warm up'); await bar.press('Enter');
  const playNow = page.locator('[aria-label="Play warm up video 0 now"]').first();
  await until(() => playNow.count(), { what: 'results' });
  await playNow.dispatchEvent('click');
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'the clip' });
  // The player re-sends its volume at 250ms, 900ms and 2s after a clip starts.
  await until(async () => (await page.evaluate('window.__cmds.length')) > 0, { what: 'the player to talk to the frame', timeout: frame === 'alive' ? 15000 : 8000 }).catch(() => {});
  await page.waitForTimeout(settleMs);
  const cmds = await page.evaluate('window.__cmds');
  const volLabel = await page.locator('button[aria-label^="Volume"], button[aria-label="Unmute"]').first().getAttribute('aria-label').catch(() => null);
  const pill = await page.locator('[data-sound-tap]').count();
  const frameSrc = await page.locator('iframe[src*="youtube"]').first().getAttribute('src').catch(() => '');
  return { ctx, page, errs, cmds, volLabel, pill, frameSrc };
}

for (const device of ['desktop', 'android']) {
  const r = await run(device);
  const unmuted = r.cmds.some((c) => c.startsWith('unMute'));
  const mutedCmd = r.cmds.some((c) => c.startsWith('mute'));
  check(unmuted, `${device}: the player unmutes the clip itself once it is playing`, JSON.stringify(r.cmds));
  check(!mutedCmd, `${device}: …and never sends a mute`, JSON.stringify(r.cmds));
  check(/100 percent/.test(r.volLabel || ''), `${device}: the volume control reads full`, r.volLabel);
  check(r.pill === 0, `${device}: no "Tap for sound" pill`);
  check(r.errs.length === 0, `${device}: nothing threw`, r.errs.join(' | ') || 'clean');
  await r.ctx.close();
}

{
  const r = await run('iphone');
  check(r.volLabel === 'Unmute', 'iphone: starts silent — the volume control reads muted', r.volLabel);
  check(r.pill === 1, 'iphone: the "Tap for sound" pill is showing');
  check(!r.cmds.some((c) => c.startsWith('unMute')), 'iphone: the page does NOT unmute on its own (WebKit would freeze the clip)', JSON.stringify(r.cmds));
  await r.page.locator('[data-sound-tap]').dispatchEvent('click');
  await until(async () => (await r.page.evaluate('window.__cmds')).some((c) => c.startsWith('unMute')), { what: 'the unmute after the tap', timeout: 5000 }).catch(() => {});
  check((await r.page.evaluate('window.__cmds')).some((c) => c.startsWith('unMute')), 'iphone: one tap on the pill unmutes it');
  check(await r.page.locator('[data-sound-tap]').count() === 0, 'iphone: …and the pill goes away');
  await r.ctx.close();
}

// ── a saved zero ────────────────────────────────────────────────────────────
for (const device of ['android', 'desktop']) {
  const old = await run(device, { saved: { volume: 0 } });
  check(/100 percent/.test(old.volLabel || ''), `${device}: a zero saved by an earlier build is reset — the control reads full`, old.volLabel);
  check(old.cmds.some((c) => c.startsWith('unMute')), `${device}: …and the clip is unmuted`, JSON.stringify(old.cmds));
  await old.ctx.close();
  const chosen = await run(device, { saved: { volume: 0, volumeRev: 2 } });
  check(chosen.volLabel === 'Unmute', `${device}: a zero saved by this build is a choice and is kept`, chosen.volLabel);
  check(!chosen.cmds.some((c) => c.startsWith('unMute')), `${device}: …and no unmute is sent over it`, JSON.stringify(chosen.cmds));
  await chosen.ctx.close();
}

// ── a frame that is alive but never says "playing" ──────────────────────────
for (const device of ['android', 'desktop']) {
  const r = await run(device, { frame: 'alive', settleMs: 9000 });
  check(r.cmds.some((c) => c.startsWith('unMute')), `${device}: a live frame that never reports "playing" still gets its unmute (after the alive override)`, JSON.stringify(r.cmds));
  check(await r.page.locator('[data-player-alive-override="yes"]').count() === 1, `${device}: …and that is the alive override firing`);
  await r.ctx.close();
}
{
  const r = await run('iphone', { frame: 'alive', settleMs: 9000 });
  check(!r.cmds.some((c) => c.startsWith('unMute')), 'iphone: an alive-but-silent frame is still NOT unmuted by the page', JSON.stringify(r.cmds));
  await r.ctx.close();
}

// ── the frame says it is still muted ────────────────────────────────────────
for (const device of ['android', 'desktop']) {
  const coop = await run(device, { frame: 'coop', settleMs: 6000 });
  check(coop.cmds.some((c) => c.startsWith('unMute')), `${device}: a frame that accepts the unmute is unmuted`);
  check(await coop.page.locator('[data-sound-tap]').count() === 0, `${device}: …and never shows a "Tap for sound"`);
  await coop.ctx.close();

  const ref = await run(device, { frame: 'refuse', settleMs: 6500 });
  const unmutes = ref.cmds.filter((c) => c.startsWith('unMute')).length;
  check(unmutes >= 5, `${device}: a refused unmute is retried`, `${unmutes} unmute commands`);
  check(await ref.page.locator('[data-sound-tap]').count() === 1, `${device}: …and then the one-tap "Tap for sound" is offered`);
  // The browser wants a gesture: the person's tap is one.
  for (const f of ref.page.frames()) await f.evaluate('window.__allow = true').catch(() => {});
  // (If no pill was offered the check above has already failed; don't also crash here.)
  await ref.page.locator('[data-sound-tap]').dispatchEvent('click', undefined, { timeout: 2000 }).catch(() => {});
  await until(async () => (await ref.page.locator('[data-sound-tap]').count()) === 0, { what: 'the pill to go once the frame is unmuted', timeout: 8000 }).catch(() => {});
  check(await ref.page.locator('[data-sound-tap]').count() === 0, `${device}: …a tap unmutes it and the pill goes away`);
  await ref.ctx.close();
}
{
  const r = await run('iphone', { frame: 'refuse', settleMs: 6500 });
  check(!r.cmds.some((c) => c.startsWith('unMute')), 'iphone: with a refusing frame the page still sends no unmute of its own', JSON.stringify(r.cmds));
  check(await r.page.locator('[data-sound-tap]').count() === 1, 'iphone: its own "Tap for sound" is still the one showing');
  await r.ctx.close();
}

// ── mute=1 is for the iPhone only ───────────────────────────────────────────
for (const device of ['desktop', 'android']) {
  const r = await run(device);
  check(!/[?&]mute=1/.test(r.frameSrc || ''), `${device}: the embed loads WITH sound — no mute=1 in its URL`, (r.frameSrc || '').slice(0, 110));
  check(/autoplay=1/.test(r.frameSrc || '') && /enablejsapi=1/.test(r.frameSrc || ''), `${device}: …and is otherwise as before (autoplay, JS API)`);
  await r.ctx.close();
}
{
  const r = await run('iphone');
  check(/[?&]mute=1/.test(r.frameSrc || ''), 'iphone: the embed still starts muted (iOS refuses sound-on autoplay in a frame)', (r.frameSrc || '').slice(0, 110));
  await r.ctx.close();
}

// ── a browser that blocks sound-on autoplay ─────────────────────────────────
for (const device of ['android', 'desktop']) {
  const early = await run(device, { frame: 'blocked', settleMs: 2000 });
  check(!early.cmds.some((c) => c.startsWith('mute')), `${device}: it does not jump in early — a slow start is given its few seconds`, JSON.stringify(early.cmds));
  await early.ctx.close();
  const r = await run(device, { frame: 'blocked', settleMs: 10000 });
  const i = (name) => r.cmds.findIndex((c) => c.startsWith(name));
  check(i('mute') >= 0 && i('playVideo') >= 0, `${device}: a clip the browser would not start is muted and played`, JSON.stringify(r.cmds.slice(0, 6)));
  check(i('unMute') > i('mute'), `${device}: …and then unmuted again once it is playing`, JSON.stringify(r.cmds.slice(0, 10)));
  check(await r.page.locator('[data-sound-tap]').count() === 0, `${device}: …with no "Tap for sound" needed`);
  await r.ctx.close();
}
{
  const r = await run('iphone', { frame: 'blocked', settleMs: 6000 });
  check(!r.cmds.some((c) => c.startsWith('mute')), 'iphone: the fallback never runs there (its URL already starts muted)', JSON.stringify(r.cmds));
  await r.ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
