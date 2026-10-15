/* The loader, the start-kick and replay (owner, 2026-10-15: "sometimes they
 * wont start at all", "it's very difficult to restart a video", "add a loading
 * animation with the truegle logo").
 *
 * The embeds are stubbed at the browser and served from the real embed origin,
 * so the hook's origin and source checks run for real. Three behaviours of
 * YouTube's player are imitated:
 *   AUTO  boots after 2.5s, then starts by itself after 4s more
 *   KICK  boots after 2.5s and then plays ONLY if it is told to (a blocked
 *         autoplay — what a phone does) — the retry must rescue it
 *   END   plays, then reports the clip ended
 *
 *   npm run playerloading:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5206;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const AUTO = 'autoAAAAAA1'; const KICK = 'kickAAAAAA1'; const END = 'endAAAAAAA1';

const stub = (mode) => `<html><body style="background:#000"><script>
  var send = function (o) { parent.postMessage(JSON.stringify(o), '*'); };
  var playing = false; var talking = false; var ended = false;
  ${mode === 'AUTO' ? 'setTimeout(function () { playing = true; }, 6500);' : ''}
  ${mode === 'END' ? 'setTimeout(function () { playing = true; setTimeout(function () { ended = true; }, 1500); }, 3000);' : ''}
  setTimeout(function () {
    addEventListener('message', function (e) {
      var d; try { d = JSON.parse(e.data); } catch (x) { return; }
      if (!d) return;
      if (d.event === 'command' && d.func === 'playVideo') playing = true;
      if (d.event !== 'listening' || talking) return;
      talking = true;
      setInterval(function () {
        send({ event: 'infoDelivery', info: { playerState: ended ? 0 : (playing ? 1 : 3), currentTime: playing ? 1 : 0, duration: 200 }, channel: 'widget', id: 1 });
      }, 500);
    });
  }, 2500);
</script></body></html>`;

async function run(id, viewport) {
  const ctx = await testContext(browser, { viewport });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  const hits = { n: 0 };
  await ctx.route('**/www.youtube-nocookie.com/embed/**', async (r) => {
    hits.n += 1;
    const url = r.request().url();
    const mode = url.includes(KICK) ? 'KICK' : url.includes(END) ? 'END' : 'AUTO';
    await r.fulfill({ status: 200, contentType: 'text/html', body: stub(mode) }).catch(() => {});
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (!/Access is denied/.test(e.message)) errs.push(e.message); });
  await page.goto(`${BASE}/tube?u=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { waitUntil: 'domcontentloaded' });
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the share gate' });
  await page.locator('[data-share-gate]').click();
  await page.evaluate('if (document.fullscreenElement) document.exitFullscreen()').catch(() => {});
  const loader = () => page.locator('[data-mini] [data-player-loading]').count();
  const src = () => page.locator('[data-mini] iframe').first().getAttribute('src').catch(() => '');
  return { ctx, page, errs, hits, loader, src };
}

const shots = process.env.SHOTS_DIR;

// ── the loader shows while a clip boots, then clears when it plays ──────────
{
  const { ctx, page, errs, loader, src, hits } = await run(AUTO, { width: 390, height: 844 });
  await until(async () => (await src() || '').includes(AUTO), { what: 'the clip to load' });
  check((await src()).includes('playsinline=1'), 'the YouTube embed asks for inline playback (no iOS native full-screen takeover)');
  await until(loader, { timeout: 5000, what: 'the loader' }).catch(() => {});
  check(await loader() === 1, 'a loader is on the picture while the clip has not started');
  check(await page.locator('[data-mini] [data-player-loading] img[src="/truegle.png"]').count() === 1, '…and it carries the Truegle logo');
  if (shots) await page.screenshot({ path: `${shots}/loading-mobile.png` });
  await until(async () => !(await loader()), { timeout: 20000, what: 'the loader to clear' }).catch(() => {});
  check(await loader() === 0, 'the loader clears once the embed reports playing');

  // ── replay remounts the clip and the loader comes back ────────────────────
  const before = hits.n;
  const btn = page.locator('[data-mini] [data-player-replay-btn]').first();
  check(await btn.count() === 1, 'the transport has a Replay button');
  await btn.click();
  await until(() => hits.n > before, { timeout: 8000, what: 'the embed to reload' }).catch(() => {});
  check(hits.n > before, 'Replay reloads the clip from the start', `${hits.n - before} new load(s)`);
  await until(loader, { timeout: 6000, what: 'the loader after replay' }).catch(() => {});
  check(await loader() === 1, '…and the loader is back while it restarts');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a clip that ignores autoplay is rescued by the retry ────────────────────
{
  const { ctx, page, loader, src } = await run(KICK, { width: 390, height: 844 });
  await until(async () => (await src() || '').includes(KICK), { what: 'the clip to load' });
  await until(async () => !(await loader()), { timeout: 15000, what: 'the stubborn clip to start' }).catch(() => {});
  check(await loader() === 0, 'a clip whose autoplay was blocked is started by the retry (no tap needed)');
  await ctx.close();
}

// ── the ended card, and Replay from it (desktop width) ──────────────────────
{
  const { ctx, page, errs, hits } = await run(END, { width: 1280, height: 800 });
  await until(() => page.locator('[data-mini] [data-player-ended]').count(), { timeout: 25000, what: 'the ended card' }).catch(() => {});
  check(await page.locator('[data-mini] [data-player-ended]').count() === 1, 'a finished clip with nothing after it offers Replay');
  if (shots) await page.screenshot({ path: `${shots}/ended-desktop.png` });
  const before = hits.n;
  await page.locator('[data-mini] [data-player-replay]').click();
  await until(() => hits.n > before, { timeout: 8000, what: 'the embed to reload' }).catch(() => {});
  check(hits.n > before, 'Replay on the ended card restarts the clip');
  check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}

await browser.close();
await server.close();
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
