/* Tube "Lists" + ONE search bar on Tube.
 *
 *  1. A "Lists" chip sits above the bar; searching it shows YOUR saved lists
 *     first, then public playlists, each with the right actions.
 *  2. Tapping a playlist PLAYS it (a saved list plays its tracks; a public one
 *     is imported via /api/creators/playlist, then plays) — not a dead embed.
 *  3. "Save list" adds a public playlist to Lists without playing it.
 *  4. On Tube, popped out: exactly ONE search bar (the player's), carrying the
 *     typed text and the category; results open in the player's list; docking
 *     back returns ONE page bar with the same search.
 *  5. Everywhere else: two bars, each keeping its own text.
 *
 * Run it:  node scripts/verify-tube-lists.mjs
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, d = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${d ? ` — ${d}` : ''}`);

const PORT = 5295;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const SAVED = [{
  id: 'saved1', name: 'Road trip mix', createdAt: Date.now(),
  items: [
    { key: null, src: 'https://www.youtube-nocookie.com/embed/roadAAAAAA1', kind: 'youtube', title: 'Road song one', pageUrl: 'https://www.youtube.com/watch?v=roadAAAAAA1', poster: '', channel: 'A' },
    { key: null, src: 'https://www.youtube-nocookie.com/embed/roadBBBBBB2', kind: 'youtube', title: 'Road song two', pageUrl: 'https://www.youtube.com/watch?v=roadBBBBBB2', poster: '', channel: 'B' },
  ],
}];
await ctx.addInitScript(`localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  if (!localStorage.getItem('truegle_playlists_v1')) localStorage.setItem('truegle_playlists_v1', ${JSON.stringify(JSON.stringify(SAVED))});`);

const importedFor = [];
await ctx.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname === '/api/creators/playlists/search') {
    return json({ playlists: [
      { playlistId: 'PLpublicaaaaaaa', title: 'Road songs of the 70s', channel: 'DJ Ann', count: 25, thumbnail: '', url: 'https://www.youtube.com/playlist?list=PLpublicaaaaaaa' },
      { playlistId: 'PLpublicbbbbbbb', title: 'Road trip classics', channel: 'DJ Bo', count: 40, thumbnail: '', url: 'https://www.youtube.com/playlist?list=PLpublicbbbbbbb' },
    ] });
  }
  if (u.pathname === '/api/creators/playlist') {
    importedFor.push(u.searchParams.get('url'));
    return json({ playlistId: 'x', source: 'invidious', complete: true, videos: [
      { url: 'https://www.youtube.com/watch?v=plvideo0001', title: 'PL one', channel: 'Ch' },
      { url: 'https://www.youtube.com/watch?v=plvideo0002', title: 'PL two', channel: 'Ch' },
    ] });
  }
  if (u.pathname === '/api/search') {
    return json({ success: true, results: Array.from({ length: 3 }, (_, i) => ({ title: `video ${i}`, url: `https://www.youtube.com/watch?v=vid${String(i).padStart(8, '0')}` })) });
  }
  return json({ success: true, data: [], results: [], videos: [] });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
try {
await openApp(page, `${BASE}/tube`);
const pageBar = page.locator('[aria-label="Search input"]:visible');
const playerBar = page.locator('input[aria-label="Search the player"]:visible');
await until(() => pageBar.count(), { what: 'the Tube bar' });
const nowId = async () => ((await page.evaluate(() => document.querySelector('iframe[src*="youtube"]')?.src || '')).match(/embed\/([\w-]{11})/) || [])[1] || '';

// ── 1. the chip, and the results ─────────────────────────────────────────
const chip = page.locator('[data-tube-scope-bar] button', { hasText: 'Lists' });
check(await chip.count() === 1, 'a "Lists" chip is in the Tube category row');
const chipBox = await chip.first().boundingBox(); const barBox = await pageBar.first().boundingBox();
check(!!chipBox && !!barBox && chipBox.y < barBox.y, '…above the search bar');
await chip.first().click();
await pageBar.first().click(); await pageBar.first().fill('road'); await pageBar.first().press('Enter');
const cards = page.locator('[data-tube-grid] [data-tube-card]');
await until(() => page.locator('[data-tube-grid] [data-list-actions="public"]').count(), { what: 'playlist results', timeout: 8000 }).catch(() => {});
check(await page.locator('[data-tube-grid] [data-list-actions="saved"]').count() === 1, 'your saved list "Road trip mix" is in the results');
check(await page.locator('[data-tube-grid] [data-list-actions="public"]').count() === 2, '…and the public playlists');
const firstIsSaved = await cards.first().locator('[data-list-actions]').first().getAttribute('data-list-actions');
check(firstIsSaved === 'saved', 'saved lists come BEFORE public ones', firstIsSaved);

// ── 1b. your lists are ALWAYS there when Lists is selected ──────────────
const yours = page.locator('[data-tube-grid] [data-list-actions="saved"]');
await pageBar.first().fill('zzzz nothing matches this');
await pageBar.first().press('Enter');
await page.waitForTimeout(1200);
check(await yours.count() === 1, 'Lists selected + a query that matches nothing: your saved list is STILL shown', `${await yours.count()}`);
check(await page.locator('[data-lists-heading="yours"]').count() === 1, '…under a "Your lists" heading');
await pageBar.first().fill('');
await page.waitForTimeout(900);
check(await yours.count() === 1, 'Lists selected + an EMPTY box: your saved list is shown');
await pageBar.first().fill('road'); await pageBar.first().press('Enter');
await until(() => page.locator('[data-tube-grid] [data-list-actions="public"]').count(), { what: 'playlist results again', timeout: 8000 }).catch(() => {});
check(await yours.count() === 1, 'a matching query lists your saved list ONCE (not duplicated by the search)', `${await yours.count()}`);
check(await page.locator('[data-lists-heading="public"]').count() === 1, '…with public playlists under their own heading');
await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]');
  l.push({ id: 'saved2', name: 'Gym songs', createdAt: Date.now(), items: [{ key: null, src: 'https://www.youtube-nocookie.com/embed/gymAAAAAAA1', kind: 'youtube', title: 'Gym one', pageUrl: 'https://www.youtube.com/watch?v=gymAAAAAAA1', poster: '', channel: 'G' }] });
  localStorage.setItem('truegle_playlists_v1', JSON.stringify(l));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await until(() => pageBar.count(), { what: 'the bar after reload' });
await page.locator('[data-tube-scope-bar] button', { hasText: 'Lists' }).first().click();
await page.waitForTimeout(1200);
check(await yours.count() === 2, 'every saved list shows — including ones that do not match the box', `${await yours.count()}`);
await pageBar.first().click(); await pageBar.first().fill('road'); await pageBar.first().press('Enter');
await until(() => page.locator('[data-tube-grid] [data-list-actions="public"]').count(), { what: 'results after reload', timeout: 8000 }).catch(() => {});
const order = await page.locator('[data-tube-grid] [data-tube-card]').evaluateAll((els) => els.slice(0, 2).map((e) => e.querySelector('h3')?.innerText || ''));
check(/Road trip mix/.test(order[0] || ''), 'lists matching the query float to the top', order.join(' | '));

// ── 2. tapping plays ─────────────────────────────────────────────────────
await cards.first().locator('[data-list-play]').click();
await until(async () => (await nowId()) === 'roadAAAAAA1', { what: 'the saved list to play', timeout: 5000 }).catch(() => {});
check((await nowId()) === 'roadAAAAAA1', 'Play on a saved list plays its first track', await nowId());

const pub = page.locator('[data-tube-grid] [data-list-actions="public"]').first();
await pub.locator('[data-play-all]', { hasText: 'Play All' }).click();
await until(async () => (await nowId()) === 'plvideo0001', { what: 'the public playlist to play', timeout: 6000 }).catch(() => {});
check(importedFor.length >= 1 && (await nowId()) === 'plvideo0001', 'Play All on a public playlist imports it and plays track one', `${importedFor.length} import(s), now ${await nowId()}`);

// ── 3. Save list ─────────────────────────────────────────────────────────
const second = page.locator('[data-tube-grid] [data-list-actions="public"]').nth(1);
await second.locator('[data-list-save]').click();
await until(async () => (await second.locator('[data-list-save]').innerText()).includes('Saved'), { what: 'Saved', timeout: 4000 }).catch(() => {});
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]'));
check(stored.some((l) => /^yt:PLpublicbbbbbbb$/.test(l.origin || '')), 'Save list adds the public playlist to Lists, without a second tap', stored.map((l) => l.name).join(' | '));
check((await nowId()) === 'plvideo0001', '…and does not interrupt what is playing', await nowId());

// ── 3b. add-to-list works IN FULL SCREEN ─────────────────────────────────
// The sheet used to portal into <body>, which the Fullscreen API does not paint
// — it landed in the page under the picture and could not be reached.
await page.locator('[aria-label="Full screen"]:visible').first().click();
await until(() => page.evaluate(() => !!document.fullscreenElement), { what: 'native full screen', timeout: 4000 }).catch(() => {});
check(await page.evaluate(() => !!document.fullscreenElement), 'entered native full screen (setup)');
await page.locator('[aria-label="Add to a list"]:visible').first().click();
await until(() => page.locator('[data-add-to-list]').count(), { what: 'the add-to-list sheet', timeout: 4000 }).catch(() => {});
const sheet = await page.evaluate(() => {
  const d = document.querySelector('[data-add-to-list]');
  if (!d) return { found: false };
  const r = d.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { found: true, inside: !!document.fullscreenElement && document.fullscreenElement.contains(d), onTop: !!hit && d.contains(hit) };
});
check(sheet.found && sheet.inside, 'in full screen the add-to-list sheet opens INSIDE the full-screen surface', JSON.stringify(sheet));
check(sheet.onTop, '…and is on top, where it can be tapped');
await page.locator('[data-add-to-list] [data-list-id="saved2"]').click();
const gym = await page.evaluate(() => (JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]').find((l) => l.id === 'saved2') || { items: [] }).items.length);
check(gym === 2, 'tapping a list in that sheet adds the playing video to it', `${gym} items in "Gym songs"`);
await page.locator('[data-add-to-list] button', { hasText: 'Done' }).click();
check(await page.locator('[data-add-to-list]').count() === 0, '…and Done closes it');
await page.evaluate(() => document.exitFullscreen?.());
await page.waitForTimeout(500);

// ── 4. ONE bar on Tube ───────────────────────────────────────────────────
check(await pageBar.count() === 1 && await playerBar.count() === 0, 'docked: exactly one search bar (the page\'s)');
await pageBar.first().fill('road trip');
await page.evaluate(() => document.activeElement?.blur());
await page.waitForTimeout(400);
await page.locator('[aria-label="Pop out the player"]:visible').first().click();
await until(() => playerBar.count(), { what: 'the popped player bar', timeout: 4000 }).catch(() => {});
await page.waitForTimeout(500);
check(await pageBar.count() === 0 && await playerBar.count() === 1, 'popped out on Tube: exactly ONE search bar, and it is the player\'s', `page ${await pageBar.count()} / player ${await playerBar.count()}`);
check(await page.locator('[data-tube-scope-above]').count() === 0, '…and the page\'s category row is gone');
check((await playerBar.first().inputValue()) === 'road trip', '…the typed text moved into the player\'s bar', await playerBar.first().inputValue());
const sel = page.locator('[data-player-scope]');
check(await sel.count() === 1 && (await sel.inputValue()) === 'lists', '…and the category (Lists) came with it', await sel.count() ? await sel.inputValue() : 'no dropdown');
await playerBar.first().fill('road songs'); await playerBar.first().press('Enter');
await until(() => page.locator('[data-mini] [data-list-actions]').count(), { what: 'results in the player\'s list', timeout: 8000 }).catch(() => {});
check(await page.locator('[data-mini] [data-list-actions]').count() > 0, 'its results open in the PLAYER\'s list (playlist rows with Play All / Save list)');
await until(() => page.locator('[data-tube-grid]').count(), { what: 'page grid', timeout: 3000 }).catch(() => {});
const gridText = await page.locator('[data-tube-grid]').first().innerText().catch(() => '');
check(/Road songs of the 70s/.test(gridText), 'the page grid follows the player\'s search', gridText.slice(0, 60).replace(/\s+/g, ' '));

await page.locator('[aria-label="Dock the player back into the search bar"]:visible').first().click();
await until(() => pageBar.count(), { what: 'the page bar back', timeout: 4000 }).catch(() => {});
await page.waitForTimeout(400);
check(await pageBar.count() === 1 && await playerBar.count() === 0, 'docked again: one bar, back on the page');
check((await pageBar.first().inputValue()) === 'road songs', '…carrying the search the player\'s bar had', await pageBar.first().inputValue());

// ── 5. other pages keep TWO bars ─────────────────────────────────────────
await page.locator('[aria-label="Pop out the player"]:visible').first().click();
await page.waitForTimeout(400);
await page.evaluate("history.pushState({}, '', '/search?q=hello'); dispatchEvent(new PopStateEvent('popstate'))");
await page.waitForTimeout(1500);
const expand = page.locator('[aria-label="Expand the player"]:visible').first();
if (await expand.count()) await expand.click();
await page.waitForTimeout(600);
const pageBar2 = page.locator('[aria-label="Search input"]:visible');
check(await pageBar2.count() === 1 && await playerBar.count() === 1, 'off Tube: TWO bars, the page\'s and the player\'s', `page ${await pageBar2.count()} / player ${await playerBar.count()}`);
await pageBar2.first().fill('page text');
await playerBar.first().fill('player text');
check((await pageBar2.first().inputValue()) === 'page text' && (await playerBar.first().inputValue()) === 'player text', '…each keeps its own text');
check(await page.locator('[data-player-scope]').count() === 0, '…and the player has no category dropdown there');

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
} catch (e) { check(false, 'the run completed', String(e.message).split('\n')[0]); }
await ctx.close(); await browser.close(); await server.close();
console.log(ok.concat(bad).join('\n')); console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
