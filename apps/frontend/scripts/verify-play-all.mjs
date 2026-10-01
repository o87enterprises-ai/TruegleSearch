/* A playlist link does one thing, everywhere: Play All.
 *
 * Owner, 2026-10-01: "Play in Truegle" played something else, "Import
 * playlist" imported and then lost it, and the card offered Play now / Queue /
 * List — none of which played the list. Play All must:
 *   1. save the playlist to Lists (once — a second press refreshes it),
 *   2. REPLACE the queue (nothing old plays after it),
 *   3. play track one with the rest up next.
 * Checked from the Tube/player bar, the pasted-link card on the search page,
 * and a shared /tube?u=<playlist> link.
 *
 * Run it:  npm run playall:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5234;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const LIST = 'PL85Bc8o61N2cNssXddDIb0FapG86INO3d';
const PLAYLIST = `https://youtube.com/playlist?list=${LIST}&si=pAwEnteK-wLx9owm`;
const IDS = ['plistAAAAA1', 'plistBBBBB2', 'plistCCCCC3'];

async function context() {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));"
    + "localStorage.setItem('truegle_swipe_hint_seen', '1');");
  await ctx.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (u.pathname === '/api/creators/playlist') {
      return json({ complete: true, source: 'api', videos: IDS.map((id, i) => ({ url: `https://www.youtube.com/watch?v=${id}`, title: `Track ${i + 1}`, channel: 'Mixer' })) });
    }
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
    const q = String(b.query || '').trim();
    const rows = q && !/^https?:/.test(q) ? Array.from({ length: 4 }, (_, i) => ({ title: `${q} result ${i}`, url: `https://www.youtube.com/watch?v=oldqueue000${i}` })) : [];
    return json({ success: true, results: rows, data: [] });
  });
  for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  return ctx;
}
const playing = (page) => page.locator('iframe[src*="youtube"]').first().getAttribute('src').catch(() => '');
const lists = (page) => page.evaluate("JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]')");
const next = (page) => page.locator('[aria-label="Next"]').first().dispatchEvent('click');

// ── the Tube bar, with an old queue already going ───────────────────────────
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]').first();
  await bar.click(); await bar.fill('old'); await bar.press('Enter');
  await until(() => page.locator('[aria-label="Play old result 0 now"]').count(), { what: 'old results' });
  await page.locator('[aria-label="Play old result 0 now"]').first().dispatchEvent('click');
  for (const n of [1, 2, 3]) await page.locator(`[aria-label="Add old result ${n} to the queue"]`).first().dispatchEvent('click').catch(() => {});
  await until(async () => /oldqueue/.test(await playing(page)), { what: 'the old run to play' });

  // Entered in the Tube bar, a link opens the tap-to-play door (the same one
  // a shared link gets); typed in the player's own box it is a card. Either
  // way the one action must be Play All.
  const press = async () => {
    await until(async () => (await page.locator('[data-share-gate]').count()) || (await page.locator('[data-play-all]').count()),
      { what: 'the door or the Play All card', timeout: 8000 }).catch(() => {});
    if (await page.locator('[data-share-gate]').count()) {
      check(/playlist/i.test(await page.locator('[data-share-gate]').getAttribute('aria-label')), 'the Tube bar opens the tap-to-play door for the playlist');
      await page.locator('[data-share-gate]').click();
      return 'door';
    }
    const card = page.locator('[data-browse-actions]').filter({ has: page.locator('[data-play-all]') });
    check(await card.locator('[data-browse-action]').count() === 0, 'the playlist card offers only Play All — no Play now / Queue / List');
    await page.locator('[data-play-all]').first().dispatchEvent('click');
    return 'card';
  };
  await bar.click(); await bar.fill(PLAYLIST); await bar.press('Enter');
  const how = await press();
  check(!!how, `a pasted playlist leads to Play All (${how})`);
  await until(async () => (await playing(page)).includes(IDS[0]), { what: 'track one to play', timeout: 8000 }).catch(() => {});
  check((await playing(page)).includes(IDS[0]), 'Play All plays track one', (await playing(page)).slice(0, 60));
  await next(page);
  await until(async () => (await playing(page)).includes(IDS[1]), { what: 'track two' }).catch(() => {});
  check((await playing(page)).includes(IDS[1]), 'Next plays track two — the rest are up next');
  await next(page);
  await until(async () => (await playing(page)).includes(IDS[2]), { what: 'track three' }).catch(() => {});
  check((await playing(page)).includes(IDS[2]), '…then track three');
  await next(page);
  await page.waitForTimeout(800);
  check(!/oldqueue/.test(await playing(page)), 'the old queue never comes back — Play All replaced it', (await playing(page)).slice(0, 60));

  let saved = await lists(page);
  const mine = saved.filter((l) => (l.items || []).some((i) => (i.pageUrl || i.src || '').includes(IDS[0])));
  check(mine.length === 1 && mine[0].items.length === 3, 'the playlist is saved to Lists with all three tracks', `${mine.length} list(s)`);

  // Press it again: one list, refreshed, not two.
  await page.goto(`${BASE}/tube?u=${encodeURIComponent(PLAYLIST)}`, { waitUntil: 'domcontentloaded' });
  await press();
  await until(async () => (await playing(page)).includes(IDS[0]), { what: 'track one again' }).catch(() => {});
  saved = await lists(page);
  check(saved.filter((l) => (l.items || []).some((i) => (i.pageUrl || i.src || '').includes(IDS[0]))).length === 1, 'a second Play All refreshes the same list instead of adding a copy');
  check(errs.length === 0, 'nothing threw (Tube bar)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── the pasted-link card on the search page ─────────────────────────────────
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/search?q=${encodeURIComponent(PLAYLIST)}`);
  await until(() => page.locator('[data-play-all]').count(), { what: 'the link card\'s Play All', timeout: 15000 }).catch(() => {});
  check(await page.locator('[data-play-all]').count() >= 1, 'the "You pasted a link" card says Play All');
  check(await page.getByText('Play in Truegle').count() === 0, '…not "Play in Truegle"');
  await page.locator('[data-play-all]').first().dispatchEvent('click');
  await until(async () => (await playing(page)).includes(IDS[0]), { what: 'track one from the card', timeout: 8000 }).catch(() => {});
  check((await playing(page)).includes(IDS[0]), 'Play All from the card plays track one, on this page', page.url());
  check(errs.length === 0, 'nothing threw (link card)', errs.join(' | ') || 'clean');
  await ctx.close();
}

// ── a shared /tube?u=<playlist> link ────────────────────────────────────────
{
  const ctx = await context();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube?u=${encodeURIComponent(PLAYLIST)}`);
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the tap-to-play door' });
  await page.locator('[data-share-gate]').click();
  await until(async () => (await playing(page)).includes(IDS[0]), { what: 'track one from a shared link', timeout: 8000 }).catch(() => {});
  const src = await playing(page);
  check(src.includes(IDS[0]) && !src.includes('videoseries'), 'a shared playlist link plays track one — not YouTube\'s "unavailable" playlist embed', src.slice(0, 70));
  check(errs.length === 0, 'nothing threw (shared link)', errs.join(' | ') || 'clean');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
