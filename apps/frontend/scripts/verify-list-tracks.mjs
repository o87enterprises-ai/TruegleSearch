/* Tube "Lists": the "List" button — see the videos in one of YOUR lists and pick one.
 *
 *  1. Every saved list has a "List" button beside Play / Shuffle all / Add to queue.
 *  2. It opens a dialog naming the list and showing every track in its saved order.
 *  3. Pressing a track plays THE LIST FROM THAT TRACK (not just that one clip):
 *     the dialog closes, that track plays, and Next goes to the track after it.
 *  4. Reopening marks the track that is playing now.
 *  5. Escape, the Close button and the backdrop each close it; opening it plays nothing.
 *
 * The backend is stubbed; nothing here depends on YouTube being reachable.
 *
 * Run it:  npm run listtracks:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, d = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${d ? ` — ${d}` : ''}`);

const PORT = 5298;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const IDS = ['trackAAAAA1', 'trackBBBBB2', 'trackCCCCC3', 'trackDDDDD4']; // 11 chars, like a real video id
const TITLES = ['Song one', 'Song two', 'Song three', 'Song four'];
const SAVED = [{
  id: 'saved1', name: 'Road trip mix', createdAt: Date.now(),
  items: IDS.map((id, i) => ({
    key: null, src: `https://www.youtube-nocookie.com/embed/${id}`, kind: 'youtube', title: TITLES[i],
    pageUrl: `https://www.youtube.com/watch?v=${id}`, poster: '', channel: `Channel ${i + 1}`,
  })),
}];
await ctx.addInitScript(`localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  if (!localStorage.getItem('truegle_playlists_v1')) localStorage.setItem('truegle_playlists_v1', ${JSON.stringify(JSON.stringify(SAVED))});`);

await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], results: [], videos: [], playlists: [] }) }));
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const nowId = async () => ((await page.evaluate(() => document.querySelector('iframe[src*="youtube"]')?.src || '')).match(/embed\/([\w-]{11})/) || [])[1] || '';
const dialog = page.locator('[data-list-tracks]');
const openList = async () => { await page.locator('[data-tube-grid] [data-list-actions="saved"] [data-list-open]').first().click(); await until(() => dialog.count(), { what: 'the track dialog', timeout: 5000 }).catch(() => {}); };

try {
  await openApp(page, `${BASE}/tube`);
  const pageBar = page.locator('[aria-label="Search input"]:visible');
  await until(() => pageBar.count(), { what: 'the Tube bar' });
  await page.locator('[data-tube-scope-bar] button', { hasText: 'Lists' }).first().click();
  await until(() => page.locator('[data-tube-grid] [data-list-actions="saved"]').count(), { what: 'your saved list', timeout: 8000 });

  // ── 1. the button ───────────────────────────────────────────────────────────
  const btn = page.locator('[data-tube-grid] [data-list-actions="saved"] [data-list-open]');
  check(await btn.count() === 1, 'a saved list has a "List" button');
  check(/List/.test(await btn.first().innerText()), '…labelled "List"');
  check(await dialog.count() === 0, '…and opening nothing until it is pressed');

  // ── 2. the dialog ───────────────────────────────────────────────────────────
  await openList();
  check(await dialog.count() === 1, 'pressing it opens the track dialog');
  check((await page.locator('[data-list-tracks-title]').innerText()) === 'Road trip mix', '…titled with the list\'s name');
  const rows = await page.locator('[data-list-track]').allInnerTexts();
  check(rows.length === 4, '…showing all four tracks', `${rows.length}`);
  check(TITLES.every((t, i) => rows[i]?.includes(t)), '…in the list\'s saved order', rows.map((r) => r.replace(/\s+/g, ' ')).join(' | '));
  check(rows[0]?.includes('Channel 1'), '…with each track\'s channel');
  check(await nowId() === '', 'opening the dialog played nothing', await nowId());

  // ── 5a. ways to close it ────────────────────────────────────────────────────
  await page.keyboard.press('Escape');
  await until(async () => (await dialog.count()) === 0, { what: 'Escape to close', timeout: 3000 }).catch(() => {});
  check(await dialog.count() === 0, 'Escape closes it');
  await openList();
  await page.locator('[data-list-tracks-close]').click();
  check(await dialog.count() === 0, 'the Close button closes it');
  await openList();
  await page.locator('[data-list-tracks-backdrop]').click({ position: { x: 5, y: 5 } });
  check(await dialog.count() === 0, 'tapping outside it closes it');
  check(await nowId() === '', '…and none of that played anything', await nowId());

  // ── 3. pick a track ─────────────────────────────────────────────────────────
  await openList();
  await page.locator('[data-list-track="2"]').click();
  await until(async () => (await nowId()) === IDS[2], { what: 'track three to play', timeout: 6000 }).catch(() => {});
  check(await nowId() === IDS[2], 'pressing track three plays track three', await nowId());
  check(await dialog.count() === 0, '…and closes the dialog');
  await page.locator('[aria-label="Next"]').first().dispatchEvent('click');
  await until(async () => (await nowId()) === IDS[3], { what: 'Next to play track four', timeout: 6000 }).catch(() => {});
  check(await nowId() === IDS[3], 'Next then plays track four: it played the LIST from there, not one clip', await nowId());

  // ── 4. the playing track is marked ──────────────────────────────────────────
  await openList();
  const current = await page.locator('[data-list-track][aria-current="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-list-track')));
  check(current.length === 1 && current[0] === '3', 'reopening marks the track that is playing now', JSON.stringify(current));
  await page.keyboard.press('Escape');
} finally {
  check(errs.length === 0, 'nothing threw in the page', errs.join(' | ') || 'clean');
  await browser.close();
  await server.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
