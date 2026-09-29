/* A YouTube clip that never talks is skipped; one that does is left alone.
 *
 * Seen on the live site (2026-09-29): region-blocked news clips render YouTube's
 * own "Video unavailable" page and post NOT ONE message to us — no error code,
 * so nothing told the player, and it sat on a dead frame. useEmbedPlayback now
 * treats 15 seconds of silence from a frame on a visible tab as "unplayable"
 * and the run moves on, the way it already does for clips that report errors.
 *
 * The embeds are stubbed at the browser: a SILENT page (says "Video
 * unavailable", posts nothing) and a CHATTY one (posts what YouTube's player
 * posts when it starts). Served from the real embed origin, so the hook's
 * origin and source checks are exercised for real.
 *
 * Takes about 45 seconds — the timeout being tested is real. Run it:
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

const SILENT = 'silentAAAA1'; const TALK1 = 'talkAAAAAA1'; const TALK2 = 'talkAAAAAA2';
const SILENT_PAGE = '<html><body style="background:#000;color:#fff">Video unavailable. This content isn’t available.</body></html>';
const CHATTY_PAGE = `<html><body style="background:#000"><script>
  var send = function (o) { parent.postMessage(JSON.stringify(o), '*'); };
  send({ event: 'onReady', info: null, channel: 'widget', id: 1 });
  setInterval(function () { send({ event: 'infoDelivery', info: { playerState: 1, currentTime: 1, duration: 200 }, channel: 'widget', id: 1 }); }, 1000);
</script></body></html>`;

async function run(ids) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({
    status: 200, contentType: 'text/html', body: r.request().url().includes(SILENT) ? SILENT_PAGE : CHATTY_PAGE,
  }));
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
  await page.waitForTimeout(9000);
  check((await src()).includes(SILENT), 'a clip that has been quiet for nine seconds is NOT skipped yet (slow connections)');
  await until(async () => (await src() || '').includes(TALK2), { timeout: 20000, what: 'the run to move past the silent clip' }).catch(() => {});
  const took = Math.round((Date.now() - started) / 1000);
  check((await src()).includes(TALK2), 'a clip that never speaks is skipped and the next one plays', `after ~${took}s`);
  check(took >= 14, 'not before the fifteen-second timeout', `${took}s`);
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a clip that speaks is never skipped ─────────────────────────────────────
{
  const { ctx, page, src } = await run([TALK1, TALK2]);
  await until(async () => (await src() || '').includes(TALK1), { what: 'the chatty clip to load' });
  await page.waitForTimeout(19000);
  check((await src()).includes(TALK1), 'a clip that reports in is still playing well past the timeout');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
