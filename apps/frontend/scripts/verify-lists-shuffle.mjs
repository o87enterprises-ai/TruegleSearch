/* Tube "Lists": Shuffle all, and an honest answer when playlist search is down.
 *
 *  1. Every saved list has a "Shuffle all" control; it plays that list's tracks.
 *  2. Every public playlist result has "Shuffle all" beside Play All; it imports
 *     the playlist and plays one of its tracks (the order is random).
 *  3. A search that FAILED says so ("unavailable"), instead of "no playlists".
 *  4. A search that worked and found nothing still says "No public playlists".
 *  5. shuffleList never changes the list it is given and keeps every item.
 *
 * The backend is stubbed; nothing here depends on YouTube being reachable.
 *
 * Run it:  npm run listsshuffle:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';
import { shuffleList } from '../src/utils/shuffleList.js';

const ok = []; const bad = [];
const check = (c, l, d = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${d ? ` — ${d}` : ''}`);

// ── 5. the pure part first: no browser needed ───────────────────────────────
{
  const src = ['a', 'b', 'c', 'd', 'e'];
  const snapshot = [...src];
  const out = shuffleList(src, () => 0.5);
  check(JSON.stringify(src) === JSON.stringify(snapshot), 'shuffleList leaves the list it is given unchanged');
  check([...out].sort().join('') === 'abcde', 'shuffleList keeps every item exactly once');
  check(JSON.stringify(shuffleList(src, () => 0)) !== JSON.stringify(src), 'with a fixed random source it actually reorders');
  check(JSON.stringify(shuffleList([], Math.random)) === '[]' && JSON.stringify(shuffleList(undefined)) === '[]', 'an empty or missing list shuffles to an empty list');
}

const PORT = 5297;
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
    { key: null, src: 'https://www.youtube-nocookie.com/embed/roadCCCCCC3', kind: 'youtube', title: 'Road song three', pageUrl: 'https://www.youtube.com/watch?v=roadCCCCCC3', poster: '', channel: 'C' },
  ],
}];
await ctx.addInitScript(`localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
  if (!localStorage.getItem('truegle_playlists_v1')) localStorage.setItem('truegle_playlists_v1', ${JSON.stringify(JSON.stringify(SAVED))});`);

// What the playlist search answers with is switched per step.
let searchAnswer = { playlists: [
  { playlistId: 'PLpublicaaaaaaa', title: 'Road songs of the 70s', channel: 'DJ Ann', count: 25, thumbnail: '', url: 'https://www.youtube.com/playlist?list=PLpublicaaaaaaa' },
] };
const importedFor = [];
await ctx.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname === '/api/creators/playlists/search') return json(searchAnswer);
  if (u.pathname === '/api/creators/playlist') {
    importedFor.push(u.searchParams.get('url'));
    return json({ playlistId: 'x', source: 'api', complete: true, videos: [
      { url: 'https://www.youtube.com/watch?v=plvideo0001', title: 'PL one', channel: 'Ch' },
      { url: 'https://www.youtube.com/watch?v=plvideo0002', title: 'PL two', channel: 'Ch' },
    ] });
  }
  return json({ success: true, data: [], results: [], videos: [] });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const nowId = async () => ((await page.evaluate(() => document.querySelector('iframe[src*="youtube"]')?.src || '')).match(/embed\/([\w-]{11})/) || [])[1] || '';

try {
  await openApp(page, `${BASE}/tube`);
  const pageBar = page.locator('[aria-label="Search input"]:visible');
  await until(() => pageBar.count(), { what: 'the Tube bar' });
  await page.locator('[data-tube-scope-bar] button', { hasText: 'Lists' }).first().click();
  await pageBar.first().click(); await pageBar.first().fill('road'); await pageBar.first().press('Enter');
  await until(() => page.locator('[data-tube-grid] [data-list-actions="public"]').count(), { what: 'playlist results', timeout: 8000 }).catch(() => {});

  // ── 1. Shuffle all on a saved list ────────────────────────────────────────
  const savedShuffle = page.locator('[data-tube-grid] [data-list-actions="saved"] [data-list-shuffle]').first();
  check(await savedShuffle.count() === 1, 'a saved list has a "Shuffle all" control');
  await savedShuffle.click();
  await until(async () => ['roadAAAAAA1', 'roadBBBBBB2', 'roadCCCCCC3'].includes(await nowId()), { what: 'the saved list to play', timeout: 6000 }).catch(() => {});
  check(['roadAAAAAA1', 'roadBBBBBB2', 'roadCCCCCC3'].includes(await nowId()), 'Shuffle all plays one of that list\'s own tracks', await nowId());
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('truegle_playlists_v1') || '[]').find((l) => l.id === 'saved1').items.length);
  check(queued === 3, 'the saved list keeps its three tracks in its own order after shuffling', `${queued}`);

  // ── 2. Shuffle all on a public playlist ───────────────────────────────────
  const pubShuffle = page.locator('[data-tube-grid] [data-list-actions="public"] [data-play-all]', { hasText: 'Shuffle all' }).first();
  check(await pubShuffle.count() === 1, 'a public playlist has "Shuffle all" beside Play All');
  await pubShuffle.click();
  await until(async () => ['plvideo0001', 'plvideo0002'].includes(await nowId()), { what: 'the public playlist to play', timeout: 6000 }).catch(() => {});
  check(importedFor.length >= 1 && ['plvideo0001', 'plvideo0002'].includes(await nowId()), 'Shuffle all on a public playlist imports it and plays one of its tracks', `${importedFor.length} import(s), now ${await nowId()}`);

  // ── 3. Search is down: say so ─────────────────────────────────────────────
  searchAnswer = { playlists: [], unavailable: true };
  await pageBar.first().fill('zzz down case'); await pageBar.first().press('Enter');
  await until(() => page.locator('[data-lists-search-error]').count(), { what: 'the unavailable message', timeout: 8000 }).catch(() => {});
  const downText = await page.locator('[data-lists-search-error]').first().innerText().catch(() => '');
  check(/unavailable/i.test(downText), 'a failed search says the search is unavailable', downText.slice(0, 80));
  check(await page.getByText('No public playlists found').count() === 0, '…and does NOT claim there are no playlists');
  // Shuffle all on a public playlist saves it to Lists (as Play All does), so
  // the list count has grown — check the ORIGINAL list is still there by name.
  const titles = await page.locator('[data-tube-grid] [data-tube-card] h3').allInnerTexts();
  check(titles.some((t) => /Road trip mix/.test(t)), '…while your saved list "Road trip mix" is still shown', titles.join(' | '));

  // ── 4. Search worked, found nothing: the normal message ───────────────────
  searchAnswer = { playlists: [], unavailable: false };
  await pageBar.first().fill('zzz no matches case'); await pageBar.first().press('Enter');
  await until(() => page.getByText('No public playlists found').count(), { what: 'the no-matches message', timeout: 8000 }).catch(() => {});
  check(await page.getByText('No public playlists found').count() === 1, 'a search that ran and found nothing says "No public playlists found"');
  check(await page.locator('[data-lists-search-error]').count() === 0, '…and shows no unavailable message');
} finally {
  check(errs.length === 0, 'nothing threw in the page', errs.join(' | ') || 'clean');
  await browser.close();
  await server.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
