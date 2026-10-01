/* A YouTube clip that never talks is skipped; one that does is left alone.
 *
 * Seen on the live site (2026-09-29): region-blocked news clips render YouTube's
 * own "Video unavailable" page and post NOT ONE message to us — no error code,
 * so nothing told the player, and it sat on a dead frame. useEmbedPlayback now
 * treats 25 seconds of silence AFTER THE FRAME HAS LOADED, on a visible tab, as
 * "unplayable" and the run moves on.
 *
 * And the other side of it (2026-10-01): the clock used to start at mount, so
 * on a phone connection — where YouTube's player takes longer than that just
 * to download — good videos were skipped every fifteen seconds ("Tube changes
 * tracks at random"; and a Feed clip skipped 10s in on a real phone, 2026-10-01,
 * when YouTube's player took ~23s to start talking). The SLOW case pins that: a
 * frame that takes 20 seconds to arrive and then 16 more to boot is never
 * skipped.
 *
 * The embeds are stubbed at the browser, served from the real embed origin so
 * the hook's origin and source checks are exercised for real: a SILENT page
 * (says "Video unavailable", posts nothing) and a CHATTY one that behaves like
 * YouTube's player — it says nothing until it hears "listening", and it only
 * starts listening once it has booted.
 *
 * Takes about a minute and a half — the timeouts being tested are real. Run it:
 *   npm run silentembed:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5204;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const SILENT = 'silentAAAA1'; const TALK1 = 'talkAAAAAA1'; const TALK2 = 'talkAAAAAA2'; const SLOW = 'slowAAAAAA1';
// How long the SLOW clip's download takes, and how long its player then boots.
const SLOW_NET_MS = 20000; const SLOW_BOOT_MS = 16000;
const SILENT_PAGE = '<html><body style="background:#000;color:#fff">Video unavailable. This content isn’t available.</body></html>';
// Like YouTube's player: silent until it hears "listening", deaf until booted.
const chattyPage = (bootMs) => `<html><body style="background:#000"><script>
  var send = function (o) { parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  setTimeout(function () {
    addEventListener('message', function (e) {
      var d; try { d = JSON.parse(e.data); } catch (x) { return; }
      if (!d || d.event !== 'listening' || talking) return;
      talking = true;
      send({ event: 'onReady', info: null, channel: 'widget', id: 1 });
      setInterval(function () { send({ event: 'infoDelivery', info: { playerState: 1, currentTime: 1, duration: 200 }, channel: 'widget', id: 1 }); }, 1000);
    });
  }, ${bootMs});
</script></body></html>`;

async function run(ids) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', async (r) => {
    const url = r.request().url();
    if (url.includes(SLOW)) await new Promise((ok2) => setTimeout(ok2, SLOW_NET_MS));
    await r.fulfill({
      status: 200, contentType: 'text/html',
      body: url.includes(SILENT) ? SILENT_PAGE : chattyPage(url.includes(SLOW) ? SLOW_BOOT_MS : 3000),
    }).catch(() => { /* the frame was torn down while we waited */ });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied/.test(e.message)) errs.push(e.message); });
  const query = ids.map((id) => `u=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`).join('&');
  await page.goto(`${BASE}/tube?${query}`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the share gate' });
  await page.locator('[data-share-gate]').click();
  await page.evaluate("if (document.fullscreenElement) document.exitFullscreen()").catch(() => {});
  const src = () => page.locator('[data-mini] iframe').first().getAttribute('src').catch(() => '');
  return { ctx, page, errs, src, started: Date.now() };
}

// ── a silent first clip is skipped, and not before the timeout ──────────────
{
  const { ctx, page, errs, src, started } = await run([SILENT, TALK2]);
  await until(async () => (await src() || '').includes(SILENT), { what: 'the silent clip to load' });
  await page.waitForTimeout(8000);
  check((await src()).includes(SILENT), 'a clip that has been quiet for eight seconds is NOT skipped yet');
  await until(async () => (await src() || '').includes(TALK2), { timeout: 40000, what: 'the run to move past the silent clip' }).catch(() => {});
  const took = Math.round((Date.now() - started) / 1000);
  check((await src()).includes(TALK2), 'a clip that never speaks is skipped and the next one plays', `after ~${took}s`);
  check(took >= 24, 'not before the 25-second timeout', `${took}s`);
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a clip that speaks is never skipped ─────────────────────────────────────
{
  const { ctx, page, src } = await run([TALK1, TALK2]);
  await until(async () => (await src() || '').includes(TALK1), { what: 'the chatty clip to load' });
  await page.waitForTimeout(30000);
  check((await src()).includes(TALK1), 'a clip that only talks after the handshake (as YouTube does) is still playing well past the timeout');
  await ctx.close();
}

// ── a phone connection: slow to download, slow to boot — never skipped ──────
{
  const { ctx, page, src } = await run([SLOW, TALK2]);
  await until(async () => (await src() || '').includes(SLOW), { what: 'the slow clip to mount' });
  await page.waitForTimeout(SLOW_NET_MS + SLOW_BOOT_MS + 8000);
  check((await src()).includes(SLOW),
    `a clip that takes ${SLOW_NET_MS / 1000}s to arrive and ${SLOW_BOOT_MS / 1000}s to boot is NOT skipped (the 2026-10-01 bug)`,
    (await src()).slice(0, 60));
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
