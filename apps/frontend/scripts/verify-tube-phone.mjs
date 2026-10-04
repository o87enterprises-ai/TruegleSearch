/* Tube on a phone, the way it is actually used: a queue from last time, the
 * player starting minimized, a search typed into the Tube bar.
 *
 * Owner, 2026-10-04 (searching "meant to be acoustic rebelution" and "Mistah
 * FAB new album"): the player "wouldn't drop down results from the search bar
 * … had to pop out to continue, results were horrible". Reproduced on the live
 * site: the search DID return the right videos, but into a player that was
 * minimized to a "Nothing playing" strip — all that showed were the page's web
 * results underneath. Then a pick emptied the box ("No results yet") under a
 * /tube?q=… address, and popping out on a phone gave a window half the screen
 * wide, under the ☰ and ← buttons.
 *
 * Pinned:
 *   - nothing playing: after the search the player's result cards are ON SCREEN
 *   - something playing: the results list is ON SCREEN
 *   - after a pick the Tube bar still holds the query, the page results stay
 *   - popped out on a phone: full width, below ☰/←, nothing covering its header
 *
 * Run it:  npm run tubephone:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5291;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const QUERY = 'meant to be acoustic rebelution';
const vid = (n) => `rebel${String(n).padStart(6, '0')}`;
const QUEUE = Array.from({ length: 21 }, (_, i) => ({
  kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/queue${String(i).padStart(6, '0')}`,
  title: `Queued ${i}`, pageUrl: `https://www.youtube.com/watch?v=queue${String(i).padStart(6, '0')}`,
}));

async function open({ playing = false } = {}) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const saved = { current: null, queue: QUEUE, history: [], poppedOut: false, expanded: false, minimized: true, dock: 'float', footerView: 'watch', locked: false, volume: 1, list: null };
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_swipe_hint_seen', '1');
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
    if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('truegle_player_queue_v2', ${JSON.stringify(JSON.stringify(saved))}); }`);
  await ctx.route('**/api/**', (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').trim();
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (new URL(r.request().url()).pathname === '/api/search' && q) {
      if (b.filters?.category === 'videos') {
        return json({ success: true, results: Array.from({ length: 8 }, (_, i) => ({ title: `${q} video ${i}`, url: `https://www.youtube.com/watch?v=${vid(i)}`, duration: `4:0${i}` })) });
      }
      return json({ success: true, results: Array.from({ length: 6 }, (_, i) => ({ title: `${q} web page ${i}`, url: `https://example.com/page-${i}`, snippet: 'a web page' })) });
    }
    return json({ success: true, data: [], results: [] });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]:visible').first();
  await until(() => bar.count(), { what: 'the Tube bar' });
  if (playing) {
    await bar.click(); await bar.fill('warm up'); await bar.press('Enter');
    await until(() => page.locator('[aria-label="Play warm up video 0 now"]').count(), { what: 'warm-up results' });
    await page.locator('[aria-label="Play warm up video 0 now"]').first().dispatchEvent('click');
    await until(() => page.locator('iframe[src*="youtube"]').count(), { what: 'something playing' });
    await page.waitForTimeout(800);
    // Minimize, as the player is on every visit.
    const min = page.locator('[aria-label="Minimize the player"]:visible, [title="Minimize the player"]:visible').first();
    if (await min.count()) await min.dispatchEvent('click');
    await page.waitForTimeout(500);
  }
  return { ctx, page, errs, bar };
}
// On screen = inside the viewport and actually the top element at its centre.
const onScreen = (page, sel) => page.evaluate(`(() => [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => {
  const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return false;
  const cx = r.left + r.width / 2, cy = Math.min(innerHeight - 2, Math.max(1, r.top + Math.min(r.height / 2, 20)));
  const t = document.elementFromPoint(cx, cy); return !!t && (e === t || e.contains(t));
}).length)()`);
const search = async (page, bar) => {
  await bar.click(); await bar.fill(''); await page.keyboard.type(QUERY, { delay: 0 }); await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
};

// ── nothing playing: the results come up in the player ──────────────────────
{
  const { ctx, page, errs, bar } = await open();
  const start = await page.evaluate("JSON.parse(localStorage.getItem('truegle_player_queue_v2') || '{}')");
  check(start.minimized === true && !start.current && (start.queue || []).length === 21,
    'starts as the report did: a minimized player, nothing playing, 21 queued', `minimized=${start.minimized} queue=${(start.queue || []).length}`);
  await search(page, bar);
  await until(async () => (await onScreen(page, '[data-browse-actions]')) > 0, { what: 'player results on screen', timeout: 6000 }).catch(() => {});
  const n = await onScreen(page, '[data-browse-actions]');
  check(n > 0, 'nothing playing: after the search, the player\'s video results are ON SCREEN (not hidden behind "Nothing playing")', `${n} visible`);
  const first = await page.locator('[aria-label^="Play meant to be acoustic rebelution video 0"]').count();
  check(first > 0, '…and they are the videos for the query');

  // A pick keeps the query and the page's results.
  await page.locator(`[aria-label="Play ${QUERY} video 0 now"]`).first().dispatchEvent('click');
  await until(() => page.locator(`iframe[src*="${vid(0)}"]`).count(), { what: 'the pick to play' });
  await page.waitForTimeout(1200);
  check(await bar.inputValue() === QUERY, 'after a pick the Tube bar still holds the query (it used to empty)', `"${await bar.inputValue()}"`);
  check(!(await page.getByText('No results yet').count()), '…and the page does not say "No results yet"');
  check(errs.length === 0, 'nothing threw (nothing playing)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── something playing (minimized): the results list comes up ────────────────
{
  const { ctx, page, errs, bar } = await open({ playing: true });
  await search(page, bar);
  await until(async () => (await onScreen(page, '[data-player-results]')) > 0, { what: 'the results list on screen', timeout: 6000 }).catch(() => {});
  const list = await onScreen(page, '[data-player-results]');
  check(list > 0, 'something playing: after the search the player\'s results list is ON SCREEN', `${list}`);
  const rows = await page.getByText(`${QUERY} video 0`).count();
  check(rows > 0, '…holding the videos for the query');
  check(errs.length === 0, 'nothing threw (something playing)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── popped out on a phone ───────────────────────────────────────────────────
{
  const { ctx, page, errs, bar } = await open({ playing: true });
  await search(page, bar);
  const pop = page.locator('[aria-label="Pop out the player"]:visible').first();
  await until(() => pop.count(), { what: 'the pop-out button', timeout: 6000 }).catch(() => {});
  if (await pop.count()) await pop.dispatchEvent('click');
  await until(() => page.locator('[data-mini]:visible').count(), { what: 'the popped-out player' }).catch(() => {});
  await page.waitForTimeout(600);
  const box = await page.locator('[data-mini]').first().boundingBox();
  check(!!box && box.width >= 390 - 24, 'popped out on a phone, the player is the width of the screen', box ? `${Math.round(box.width)}px of 390` : 'not found');
  check(!!box && box.y >= 100, '…and sits below the ☰ and ← buttons', box ? `top ${Math.round(box.y)}` : '');
  const covered = await page.evaluate(`(() => { const f = document.querySelector('[data-mini]'); if (!f) return 'none';
    const r = f.getBoundingClientRect(); const pts = [[r.left + 24, r.top + 22], [r.left + r.width / 2, r.top + 22], [r.right - 24, r.top + 22]];
    return pts.map(([x, y]) => { const t = document.elementFromPoint(x, y); return t && f.contains(t) ? 'ok' : (t ? t.tagName + ' ' + (t.getAttribute('aria-label') || '') : 'none'); }).join(' | '); })()`);
  check(/^ok \| ok \| ok$/.test(covered), '…with nothing drawn over its header', covered);
  check(errs.length === 0, 'nothing threw (popped out)', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
