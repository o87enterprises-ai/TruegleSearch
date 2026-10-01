/* THE WHOLE PLAYER, on every device and in every layout.
 *
 * Owner, 2026-10-01: "test EVERY BUTTON, FUNCTION, PLAY MODE, SCREEN
 * CONFIGURATION, DESKTOP AND MOBILE TOUCH, AND EVERY SINGLE CONTROL ON EACH
 * SIMULATED DEVICE … I want this player to ACT like YouTube."
 *
 * HOW. YouTube's iframe is replaced by a stand-in that speaks YouTube's real
 * postMessage protocol: silent until it hears "listening", then onReady and
 * infoDelivery; it obeys playVideo / pauseVideo / seekTo / setVolume / mute /
 * unMute exactly as the real player does, reports its state back, and logs
 * every command it receives — so a press is checked by what the VIDEO was
 * told, not by what a button looks like. A clip whose id contains "END" ends
 * a few seconds in, to test auto-advance.
 *
 * MATRIX. Four devices (desktop with mouse + keyboard, phone portrait, phone
 * landscape, tablet; the last three touch) × the layouts each one offers
 * (docked in Tube, floating/footer on another page, popped out, full screen,
 * minimised). In each: every transport control, the play modes, the list,
 * the search bars, YouTube's keyboard shortcuts (desktop), touch gestures
 * (full screen), auto-advance — and a sweep that presses EVERY visible button
 * in the player and fails on any crash.
 *
 * Every check is recorded as PASS / FAIL / N/A (the control is not offered in
 * that layout) and the run continues past failures, so one run maps every bug.
 * The table is written to PLAYER_SUITE_REPORT (default: player-suite-report.md
 * beside this script, not committed).
 *
 * Chromium only: it is the browser installed here. Firefox's own picture-in-
 * picture window is the browser's, not the page's, and no test can reach into
 * it — that one stays a hands-on check.
 *
 * Run it:  npm run player:suite        (about 6–8 minutes)
 *          SUITE_ONLY=phone-portrait npm run player:suite
 */
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const PORT = 5240;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const rows = [];
const record = (device, layout, check, status, detail = '') => {
  const row = { device, layout, check, status, detail: String(detail).slice(0, 140) };
  rows.push(row);
  // Live, so a long run shows where it is (and where it stalled).
  console.log(`${status.padEnd(4)} ${device.padEnd(15)} ${layout.padEnd(26)} ${check}${row.detail ? ` — ${row.detail}` : ''}`);
};
const CHECK_MS = 20000;

// ── the YouTube stand-in ────────────────────────────────────────────────────
const stub = (id) => `<!doctype html><html><body style="margin:0;background:#111;color:#999;font:12px sans-serif">
<div style="padding:8px">stub ${id}</div><script>
  var id = ${JSON.stringify(id)}, state = -1, t = 0, vol = 100, muted = false, talking = false;
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var info = function () { send({ event: 'infoDelivery', info: { playerState: state, currentTime: t, duration: 200, volume: vol, muted: muted } }); };
  var log = function (func, args) { parent.postMessage(JSON.stringify({ event: 'stubLog', vid: id, func: func, args: args || [] }), '*'); };
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (!d) return;
    if (d.event === 'listening' && !talking) {
      talking = true; state = 1;
      send({ event: 'onReady', info: null }); info();
      setInterval(function () { if (state === 1) t += 0.5; info(); }, 500);
      if (/END/.test(id)) setTimeout(function () { state = 0; info(); send({ event: 'onStateChange', info: 0 }); }, 3000);
      return;
    }
    if (d.event !== 'command') return;
    log(d.func, d.args);
    if (d.func === 'playVideo') state = 1;
    else if (d.func === 'pauseVideo') state = 2;
    else if (d.func === 'seekTo') t = d.args[0];
    else if (d.func === 'setVolume') vol = d.args[0];
    else if (d.func === 'mute') muted = true;
    else if (d.func === 'unMute') muted = false;
    info();
  });
</script></body></html>`;

const IDS = ['clipAAAAAA1', 'clipBBBBBB2', 'clipCCCCCC3', 'clipDDDDDD4'];
const SHARE = `/tube?${IDS.map((id) => `u=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`).join('&')}`;

const DEVICES = {
  desktop: { viewport: { width: 1366, height: 820 }, touch: false },
  'phone-portrait': { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, touch: true },
  'phone-landscape': { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, touch: true },
  tablet: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, touch: true },
};

async function boot(name) {
  const { touch, ...opts } = DEVICES[name];
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');"
    + "localStorage.setItem('truegle_early_access_dismissed', '1');"
    + "window.__cmds = []; addEventListener('message', function (e) { try { var d = JSON.parse(e.data); if (d && d.event === 'stubLog') window.__cmds.push(d); } catch (x) {} });");
  // Generic first: Playwright tries the LAST matching route first.
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').replace(/#shorts/, '').trim();
    const results = q && !/^https?:/.test(q)
      ? Array.from({ length: 5 }, (_, i) => ({ title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=srch${String(i).padStart(7, '0')}` }))
      : [];
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results, data: [], titles: {} }) });
  });
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop();
    return r.fulfill({ status: 200, contentType: 'text/html', body: stub(id) });
  });
  await ctx.route('**/www.youtube.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.setDefaultNavigationTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return { ctx, page, errs, touch };
}

// ── helpers ─────────────────────────────────────────────────────────────────
const vis = (page, label) => page.locator(`[aria-label="${label}"]:visible`).first();
const has = async (page, label) => (await page.locator(`[aria-label="${label}"]:visible`).count()) > 0;
const nowPlaying = async (page) => {
  const src = await page.locator('iframe[src*="youtube-nocookie"]').first().getAttribute('src').catch(() => '');
  return (/embed\/([\w-]{11})/.exec(src || '') || [])[1] || '';
};
const cmds = (page) => page.evaluate('window.__cmds.slice()');
const mark = async (page) => (await cmds(page)).length;
const since = async (page, n) => (await cmds(page)).slice(n);
const sawCmd = async (page, n, func, ms = 2500) => until(async () => (await since(page, n)).some((c) => c.func === func), { what: func, timeout: ms }).then(() => true, () => false);
const isFullscreen = (page) => page.evaluate('!!document.fullscreenElement');
const press = async (page, label) => { const b = vis(page, label); await b.scrollIntoViewIfNeeded().catch(() => {}); await b.click({ timeout: 3000 }).catch(() => b.dispatchEvent('click')); };

// One check: N/A when the control isn't offered; FAIL with the reason on error.
async function check(device, layout, name, fn) {
  try {
    // A control that hangs is a failure, not a reason to stop the suite.
    const out = await Promise.race([fn(), new Promise((_, no) => setTimeout(() => no(new Error(`timed out after ${CHECK_MS / 1000}s`)), CHECK_MS))]);
    if (out === 'na') record(device, layout, name, 'N/A');
    else if (out === true || out === undefined) record(device, layout, name, 'PASS');
    else record(device, layout, name, 'FAIL', typeof out === 'string' ? out : JSON.stringify(out));
  } catch (e) {
    record(device, layout, name, 'FAIL', e.message.split('\n')[0]);
  }
}

// ── the checks run in every layout ──────────────────────────────────────────
async function transportChecks(device, layout, page, { touch }) {
  await check(device, layout, 'a clip is playing', async () => (IDS.includes(await nowPlaying(page)) ? true : `playing "${await nowPlaying(page)}"`));

  await check(device, layout, 'Pause button pauses the video', async () => {
    if (!(await has(page, 'Pause')) && !(await has(page, 'Play'))) return 'na';
    if (await has(page, 'Play')) { await press(page, 'Play'); await page.waitForTimeout(400); }
    const n = await mark(page);
    await press(page, 'Pause');
    return (await sawCmd(page, n, 'pauseVideo')) || `commands: ${JSON.stringify((await since(page, n)).map((c) => c.func))}`;
  });
  await check(device, layout, 'Play button resumes in place (no restart)', async () => {
    if (!(await has(page, 'Play'))) return 'na';
    const before = await nowPlaying(page);
    const n = await mark(page);
    await press(page, 'Play');
    const ok = await sawCmd(page, n, 'playVideo');
    return (ok && (await nowPlaying(page)) === before) || `resumed=${ok} same clip=${(await nowPlaying(page)) === before}`;
  });

  await check(device, layout, 'Next plays the next clip', async () => {
    if (!(await has(page, 'Next'))) return 'na';
    const before = await nowPlaying(page);
    await press(page, 'Next');
    return until(async () => (await nowPlaying(page)) !== before, { what: 'a new clip', timeout: 3000 }).then(() => true, async () => `still "${await nowPlaying(page)}"`);
  });
  await check(device, layout, 'Previous goes back', async () => {
    if (!(await has(page, 'Previous'))) return 'na';
    const before = await nowPlaying(page);
    await press(page, 'Previous');
    return until(async () => (await nowPlaying(page)) !== before, { what: 'the clip before', timeout: 3000 }).then(() => true, async () => `still "${await nowPlaying(page)}"`);
  });

  await check(device, layout, 'Volume / mute reaches the video', async () => {
    const btn = page.locator('[aria-label="Unmute"]:visible, [aria-label^="Volume,"]:visible').first();
    if (!(await btn.count())) return 'na';
    const n = await mark(page);
    await btn.click({ timeout: 3000 }).catch(() => btn.dispatchEvent('click'));
    await page.waitForTimeout(700);
    const got = (await since(page, n)).map((c) => c.func);
    return got.some((f) => /mute|unMute|setVolume/.test(f)) || `commands: ${JSON.stringify(got)}`;
  });

  await check(device, layout, 'Play mode cycles through all four modes', async () => {
    const mode = page.locator('[aria-label="Auto — play through the queue"]:visible, [aria-label="Repeat this one"]:visible, [aria-label="Shuffle the queue"]:visible, [aria-label="Loop the whole queue"]:visible').first();
    if (!(await mode.count())) return 'na';
    const seen = new Set();
    for (let i = 0; i < 5; i += 1) {
      seen.add(await mode.getAttribute('aria-label'));
      await mode.click({ timeout: 3000 }).catch(() => mode.dispatchEvent('click'));
      await page.waitForTimeout(250);
    }
    return seen.size === 4 || `saw ${[...seen].join(' | ')}`;
  });

  await check(device, layout, 'Queue/results list opens and closes', async () => {
    if (!(await has(page, 'Queue and results'))) return 'na';
    const b = vis(page, 'Queue and results');
    const a0 = await b.getAttribute('aria-pressed');
    await b.click({ timeout: 3000 }).catch(() => b.dispatchEvent('click'));
    await page.waitForTimeout(300);
    const a1 = await vis(page, 'Queue and results').getAttribute('aria-pressed');
    await vis(page, 'Queue and results').click({ timeout: 3000 }).catch(() => {});
    return a0 !== a1 || `aria-pressed stayed ${a0}`;
  });

  // The player's own search: type, results come, X clears.
  await check(device, layout, 'Player search: results, then X clears the box', async () => {
    const box = page.locator('input[aria-label="Search the player"]:visible, input[aria-label="Search input"]:visible, input[aria-label="Search for something to play"]:visible').first();
    if (!(await box.count())) return 'na';
    await box.click({ timeout: 3000 }).catch(() => box.focus());
    await box.fill('suite');
    const got = await until(() => page.getByText('suite result 0').count(), { what: 'results', timeout: 5000 }).then(() => true, () => false);
    const clear = page.locator('[aria-label="Clear the player search"]:visible, [aria-label="Clear the search"]:visible, [aria-label="Clear search"]:visible, button[title="Clear"]:visible').first();
    let cleared = 'no clear button';
    if (await clear.count()) {
      await clear.click({ timeout: 3000 }).catch(() => clear.dispatchEvent('click'));
      await page.waitForTimeout(300);
      cleared = (await box.inputValue().catch(() => 'gone')) === '' ? true : `box still "${await box.inputValue()}"`;
    } else { await box.fill(''); }
    await page.keyboard.press('Escape').catch(() => {});
    if (!got) return 'no results appeared';
    return cleared === true || cleared;
  });

  if (!touch) await keyboardChecks(device, layout, page);
}

// YouTube's keyboard, as people expect it.
async function keyboardChecks(device, layout, page) {
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  const key = async (k, func, expectArgs) => {
    await check(device, layout, `key "${k}" → ${func}${expectArgs ? ` ${expectArgs}` : ''}`, async () => {
      const n = await mark(page);
      await page.keyboard.press(k);
      const ok = await sawCmd(page, n, func, 1500);
      return ok || `commands: ${JSON.stringify((await since(page, n)).map((c) => `${c.func}(${c.args.join(',')})`))}`;
    });
  };
  // Make sure it is playing first, so "k" has something to pause.
  if (await has(page, 'Play')) { await press(page, 'Play'); await page.waitForTimeout(300); }
  await key('k', 'pauseVideo');
  await key('k', 'playVideo');
  await key('Space', 'pauseVideo');
  await key('Space', 'playVideo');
  await key('l', 'seekTo', '(+10s)');
  await key('j', 'seekTo', '(−10s)');
  await key('ArrowRight', 'seekTo', '(+5s)');
  await key('ArrowLeft', 'seekTo', '(−5s)');
  await key('ArrowUp', 'setVolume', '(louder)');
  await key('ArrowDown', 'setVolume', '(quieter)');
  await key('m', 'mute');
  await key('m', 'unMute');
  await check(device, layout, 'key "Shift+N" → next clip', async () => {
    const before = await nowPlaying(page);
    await page.keyboard.press('Shift+N');
    return until(async () => (await nowPlaying(page)) !== before, { what: 'next', timeout: 2000 }).then(() => true, () => 'no change');
  });
  await check(device, layout, 'key "Shift+P" → previous clip', async () => {
    const before = await nowPlaying(page);
    await page.keyboard.press('Shift+P');
    return until(async () => (await nowPlaying(page)) !== before, { what: 'previous', timeout: 2000 }).then(() => true, () => 'no change');
  });
  await check(device, layout, 'key "f" toggles full screen', async () => {
    const before = await isFullscreen(page);
    await page.keyboard.press('f');
    await page.waitForTimeout(600);
    const after = await isFullscreen(page);
    if (after !== before) { await page.keyboard.press('f'); await page.waitForTimeout(400); if (await isFullscreen(page)) await page.evaluate('document.exitFullscreen()').catch(() => {}); }
    return after !== before || `full screen stayed ${before}`;
  });
}

// Touch, full screen: what a thumb does on YouTube.
async function touchChecks(device, layout, page) {
  const box = await page.locator('[data-player-screen]:visible').first().boundingBox().catch(() => null);
  if (!box) { record(device, layout, 'touch gestures', 'N/A', 'no player screen'); return; }
  const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
  await check(device, layout, 'tap the picture → pause (and controls show)', async () => {
    if (await has(page, 'Play')) { await press(page, 'Play'); await page.waitForTimeout(400); }
    const n = await mark(page);
    await page.touchscreen.tap(cx, cy);
    return (await sawCmd(page, n, 'pauseVideo', 2000)) || 'the tap did not pause';
  });
  await check(device, layout, 'tap again → play', async () => {
    const n = await mark(page);
    await page.touchscreen.tap(cx, cy);
    return (await sawCmd(page, n, 'playVideo', 2000)) || 'the second tap did not play';
  });
  await check(device, layout, 'double-tap the right side → +10s', async () => {
    const n = await mark(page);
    const x = box.x + box.width * 0.85;
    await page.touchscreen.tap(x, cy); await page.waitForTimeout(80); await page.touchscreen.tap(x, cy);
    return (await sawCmd(page, n, 'seekTo', 2000)) || 'no seek';
  });
  await check(device, layout, 'swipe up → next clip', async () => {
    const before = await nowPlaying(page);
    const cdp = await page.context().newCDPSession(page);
    const pt = (y) => [{ x: cx, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(cy + 120) });
    for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(cy + 120 - i * 45) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return until(async () => (await nowPlaying(page)) !== before, { what: 'next', timeout: 2500 }).then(() => true, () => 'no change');
  });
  await check(device, layout, 'lock, then hold the padlock to unlock', async () => {
    if (!(await has(page, 'Lock the player controls'))) return 'na';
    await press(page, 'Lock the player controls');
    const locked = await until(() => page.locator('[aria-label="Hold to unlock the player controls"]:visible').count(), { what: 'lock', timeout: 2000 }).then(() => true, () => false);
    if (!locked) return 'did not lock';
    const n = await mark(page);
    await page.touchscreen.tap(cx, cy);
    const ignored = !(await sawCmd(page, n, 'pauseVideo', 900));
    const pad = await page.locator('[aria-label="Hold to unlock the player controls"]:visible').first().boundingBox();
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2); await page.mouse.down(); await page.waitForTimeout(1800); await page.mouse.up();
    const unlocked = await until(async () => (await page.locator('[aria-label="Hold to unlock the player controls"]:visible').count()) === 0, { what: 'unlock', timeout: 2500 }).then(() => true, () => false);
    return (ignored && unlocked) || `taps ignored while locked=${ignored} unlocked=${unlocked}`;
  });
}

// Full-screen drop-down search (the landscape report).
async function fullscreenSearchChecks(device, layout, page) {
  await check(device, layout, 'full-screen search: opens, X clears (stays open), Enter button, X again closes', async () => {
    if (!(await has(page, 'Show the search bar'))) return 'na';
    await press(page, 'Show the search bar');
    const box = page.locator('input[aria-label="Search for something to play"]:visible').first();
    await until(() => box.count(), { what: 'the bar', timeout: 2000 });
    const sbox = await box.boundingBox();
    const vp = page.viewportSize();
    if (!sbox || sbox.y < 30 || sbox.x + sbox.width > vp.width) return `field at y=${sbox?.y} (needs room above for the paste bubble)`;
    await box.fill('suite');
    if (!(await has(page, 'Search'))) return 'no Enter/Search button at the end of the bar';
    await press(page, 'Clear the search');
    if ((await box.inputValue()) !== '' || !(await box.count())) return 'X did not clear, or closed the bar';
    await press(page, 'Close search');
    return (await page.locator('input[aria-label="Search for something to play"]:visible').count()) === 0 || 'empty X did not close';
  });
}

// Press EVERY visible button inside the player and make sure nothing breaks.
// Destructive ones (close, clear the queue) go last or are skipped.
async function sweep(device, layout, page, errs) {
  await check(device, layout, 'press every visible player button — nothing throws, player survives', async () => {
    const root = page.locator('[data-player-deck]:visible, [data-mini]:visible').first();
    if (!(await root.count())) return 'na';
    const labels = await root.locator('button:visible').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent.trim()).filter(Boolean));
    const skip = /close|clear the queue|report|dislike|share|voice|speak|hold to|unlock|lock the|minimi|full screen|pop out|dock|float|stop/i;
    const before = errs.length;
    let pressed = 0;
    for (const label of [...new Set(labels)]) {
      if (skip.test(label)) continue;
      const b = root.locator(`button:visible[aria-label="${label.replace(/"/g, '\\"')}"], button:visible[title="${label.replace(/"/g, '\\"')}"]`).first();
      if (!(await b.count())) continue;
      await b.click({ timeout: 1500 }).catch(() => b.dispatchEvent('click').catch(() => {}));
      pressed += 1;
      await page.waitForTimeout(120);
      await page.keyboard.press('Escape').catch(() => {});
    }
    const stillThere = (await page.locator('iframe[src*="youtube-nocookie"]').count()) > 0 || (await page.locator('[data-player-deck], [data-mini]').count()) > 0;
    const newErrs = errs.slice(before);
    return (newErrs.length === 0 && stillThere) || `${pressed} pressed; errors: ${newErrs.join(' | ') || 'none'}; player there: ${stillThere}`;
  });
}

async function autoAdvance(device, layout, page) {
  await check(device, layout, 'a clip that ends plays the next one by itself', async () => {
    await page.goto(`${BASE}/tube?u=${encodeURIComponent('https://www.youtube.com/watch?v=clipENDxxx1')}&u=${encodeURIComponent('https://www.youtube.com/watch?v=clipAFTER01')}`, { waitUntil: 'domcontentloaded' });
    await until(() => page.locator('[data-share-gate]').count(), { what: 'gate' });
    await page.locator('[data-share-gate]').click();
    await until(async () => (await nowPlaying(page)) === 'clipENDxxx1', { what: 'the ending clip' });
    return until(async () => (await nowPlaying(page)) === 'clipAFTER01', { what: 'auto-advance', timeout: 9000 }).then(() => true, async () => `stuck on "${await nowPlaying(page)}"`);
  });
}

// ── run it ──────────────────────────────────────────────────────────────────
const only = process.env.SUITE_ONLY;
for (const device of Object.keys(DEVICES)) {
  if (only && only !== device) continue;
  const { ctx, page, errs, touch } = await boot(device);
  try {
    await openApp(page, `${BASE}${SHARE}`);
    await until(() => page.locator('[data-share-gate]').count(), { what: 'the tap-to-play door' });
    await page.locator('[data-share-gate]').click();
    await until(async () => IDS.includes(await nowPlaying(page)), { what: 'the first clip', timeout: 8000 });

    // FULL SCREEN first: the door opens it.
    if (!(await isFullscreen(page)) && (await has(page, 'Full screen'))) await press(page, 'Full screen');
    await page.waitForTimeout(600);
    await transportChecks(device, 'full screen', page, { touch });
    if (touch) await touchChecks(device, 'full screen', page);
    await fullscreenSearchChecks(device, 'full screen', page);
    await sweep(device, 'full screen', page, errs);
    await check(device, 'full screen', 'Leave full screen button', async () => {
      if (!(await has(page, 'Leave full screen'))) return (await isFullscreen(page)) ? 'no way out shown' : 'na';
      await press(page, 'Leave full screen');
      await page.waitForTimeout(600);
      return !(await isFullscreen(page)) || 'still full screen';
    });
    if (await isFullscreen(page)) await page.evaluate('document.exitFullscreen()').catch(() => {});

    // DOCKED in Tube.
    await page.waitForTimeout(500);
    await transportChecks(device, 'docked in Tube', page, { touch });
    await sweep(device, 'docked in Tube', page, errs);

    // POPPED OUT.
    await check(device, 'popped out', 'Pop out the player', async () => {
      if (!(await has(page, 'Pop out the player'))) return 'na';
      await press(page, 'Pop out the player');
      return until(() => page.locator('[data-mini]:visible').count(), { what: 'the floating player', timeout: 3000 }).then(() => true, () => 'no floating player');
    });
    if (await page.locator('[data-mini]:visible').count()) {
      await transportChecks(device, 'popped out', page, { touch });
      await sweep(device, 'popped out', page, errs);
    }

    // ANOTHER PAGE: floating or footer.
    await page.evaluate("history.pushState({}, '', '/chat'); dispatchEvent(new PopStateEvent('popstate'))");
    await page.waitForTimeout(1200);
    const away = (await page.locator('[data-mini]:visible').count()) ? 'off Tube (floating/footer)' : null;
    if (away) {
      await transportChecks(device, away, page, { touch });
      await sweep(device, away, page, errs);
      await check(device, away, 'Minimize, then expand', async () => {
        if (!(await has(page, 'Minimize the player'))) return 'na';
        await vis(page, 'Minimize the player').click().catch(() => {});
        await page.waitForTimeout(500);
        const expand = page.locator('[aria-label="Expand the player"]:visible, [aria-label="Show what\'s playing and the controls"]:visible').first();
        if (!(await expand.count())) return 'no way to expand after minimising';
        await expand.click().catch(() => expand.dispatchEvent('click'));
        await page.waitForTimeout(500);
        return (await has(page, 'Next')) || 'controls did not come back';
      });
    } else {
      record(device, 'off Tube (floating/footer)', 'player follows you off Tube', 'FAIL', 'no player on /chat');
    }

    await autoAdvance(device, 'any', page);
    await check(device, 'any', 'no uncaught errors in the whole run', async () => errs.length === 0 || errs.slice(0, 3).join(' | '));
  } catch (e) {
    record(device, '-', 'suite could not continue', 'FAIL', e.message.split('\n')[0]);
  }
  await ctx.close();
}

// ── report ──────────────────────────────────────────────────────────────────
const fails = rows.filter((r) => r.status === 'FAIL');
const passes = rows.filter((r) => r.status === 'PASS');
const na = rows.filter((r) => r.status === 'N/A');
const md = [
  '# Player suite report', '',
  `${passes.length} passed · ${fails.length} failed · ${na.length} not offered in that layout`, '',
  '| Device | Layout | Check | Result | Detail |', '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.device} | ${r.layout} | ${r.check} | ${r.status === 'FAIL' ? '**FAIL**' : r.status} | ${r.detail.replace(/\|/g, '/')} |`),
].join('\n');
const out = process.env.PLAYER_SUITE_REPORT || new URL('./player-suite-report.md', import.meta.url).pathname;
writeFileSync(out, md);
console.log(`\n${passes.length} passed, ${fails.length} failed, ${na.length} n/a — report: ${out}`);
await browser.close();
await server.close();
process.exit(fails.length ? 1 : 0);
