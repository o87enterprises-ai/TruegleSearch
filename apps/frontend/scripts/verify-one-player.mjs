/* One player. Video picked anywhere plays in the universal player — never in
 * a second frame that plays over it.
 *
 * Owner, 2026-10-01: the search page's Vids tab opened its own player, which
 * played at the same time as the universal one and any other link pressed;
 * chat answers did the same. This pins:
 *   - Vids tab: a tap plays the clip in the universal player; a second tap
 *     REPLACES it. There is only ever one video frame on the page.
 *   - Chat: ▶ links in an answer play in the universal player without leaving
 *     the chat or opening a tab.
 *
 * The API is stubbed at the browser. Run it:  npm run oneplayer:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5207;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const A = 'vidsAAAAAA1'; const B = 'vidsBBBBBB2'; const C = 'chatCCCCCC3';
const vids = [A, B].map((id, i) => ({
  title: `Duck Sauce clip ${i}`, url: `https://www.youtube.com/watch?v=${id}`,
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: '3:0' + i, engine: 'youtube',
}));
const ANSWER = `Here is the clip you asked about: [Duck Sauce — Quack](https://www.youtube.com/watch?v=${C}). Enjoy.`;

async function context() {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  // Generic first: Playwright tries the LAST registered match first.
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    let body = {};
    try { body = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/api/search' && body?.filters?.category === 'videos') return json({ success: true, results: vids });
    if (/\/api\/ai\//.test(u.pathname)) return json({ success: true, response: ANSWER, content: ANSWER, answer: ANSWER, data: { response: ANSWER } });
    return json({ success: true, data: [], results: [] });
  });
  for (const host of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) {
    await ctx.route(host, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  }
  return ctx;
}
const frames = (page) => page.$$eval('iframe', (fs) => fs.map((f) => f.src).filter((s) => /youtube/.test(s)));

// ── the Vids tab ────────────────────────────────────────────────────────────
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/search?q=${encodeURIComponent('duck sauce quack')}&category=vids`);
  const tile = (n) => page.getByText(`Duck Sauce clip ${n}`, { exact: true }).first();
  await until(() => tile(0).count(), { what: 'the Vids tab to show the clips', timeout: 25000 });
  await tile(0).click();
  await until(async () => (await frames(page)).some((s) => s.includes(A)), { what: 'the first clip to play' }).catch(() => {});
  let f = await frames(page);
  check(f.length === 1 && f[0].includes(A), 'tapping a clip in Vids plays it — in ONE frame', f.join(' | ') || 'no frame');
  check(await page.locator('[data-mini] iframe, [data-player-deck] iframe').count() === 1, '…and that frame is the universal player');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await tile(1).dispatchEvent('click'); // the early-access banner covers its title
  await until(async () => (await frames(page)).some((s) => s.includes(B)), { what: 'the second clip to play' }).catch(() => {});
  f = await frames(page);
  check(f.length === 1 && f[0].includes(B), 'a second tap REPLACES it — still one frame, the new clip', f.join(' | '));
  check(errs.length === 0, 'nothing threw (Vids)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a chat answer ───────────────────────────────────────────────────────────
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let popups = 0; ctx.on('page', () => { popups += 1; });
  await openApp(page, `${BASE}/chat?q=${encodeURIComponent('play duck sauce quack')}`);
  const link = page.locator('a', { hasText: 'Duck Sauce — Quack' }).first();
  await until(() => link.count(), { what: 'the chat answer with its link', timeout: 25000 });
  await link.click();
  await until(async () => (await frames(page)).some((s) => s.includes(C)), { what: 'the chat clip to play' }).catch(() => {});
  const f = await frames(page);
  check(f.length === 1 && f[0].includes(C), 'a video link in a chat answer plays in the universal player', f.join(' | ') || 'no frame');
  check(new URL(page.url()).pathname === '/chat' && popups === 0, '…without leaving the chat or opening a tab', `${page.url()} popups=${popups}`);
  check(errs.length === 0, 'nothing threw (Chat)', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
