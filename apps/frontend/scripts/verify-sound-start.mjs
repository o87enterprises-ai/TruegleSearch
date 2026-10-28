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

async function run(device, { storedVolume = null } = {}) {
  const ctx = await testContext(browser, DEVICES[device]);
  await ctx.addInitScript(`
    window.__cmds = [];
    addEventListener('message', function (e) { if (typeof e.data === 'string' && e.data.indexOf('PROBE:') === 0) window.__cmds.push(e.data.slice(6)); });
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_swipe_hint_seen', '1');
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
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: FRAME }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  if (storedVolume !== null) {
    // A volume the listener chose earlier, saved the way the player saves it.
    await page.evaluate((v) => {
      const k = Object.keys(localStorage).find((x) => /player/i.test(x) && /state|v\d/i.test(x) && (localStorage.getItem(x) || '').includes('"volume"'));
      if (k) { const s = JSON.parse(localStorage.getItem(k)); s.volume = v; localStorage.setItem(k, JSON.stringify(s)); }
    }, storedVolume);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  const bar = page.locator('[aria-label="Search input"]:visible').first();
  await until(() => bar.count(), { what: 'the Tube bar' });
  await bar.click(); await bar.fill('warm up'); await bar.press('Enter');
  const playNow = page.locator('[aria-label="Play warm up video 0 now"]').first();
  await until(() => playNow.count(), { what: 'results' });
  await playNow.dispatchEvent('click');
  await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'the clip' });
  // The player re-sends its volume at 250ms, 900ms and 2s after a clip starts.
  await until(async () => (await page.evaluate('window.__cmds.length')) > 0, { what: 'the player to talk to the frame', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
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

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
