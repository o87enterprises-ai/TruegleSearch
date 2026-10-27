/* Radio: Start Radio from a song, the artist kept across the session, and the
 * MusicBrainz title lookup for clips that name no artist.
 *
 *   1. "Start Radio" on a Tube card plays that song and Radio picks what is
 *      next — even with a song waiting in the queue (the queue is parked).
 *   2. A clip whose title names no artist ("Untitled Groove (Lyrics)") is
 *      identified by /api/music/artist and Radio keeps following.
 *   3. When even that fails, Radio carries on with the artist it was already
 *      following instead of falling back to plain Up Next.
 *   4. Switching Radio off hands "next" back to the parked queue.
 *
 * Run it:  node scripts/verify-radio.mjs
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (cond, label, detail = '') => (cond ? ok : bad).push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);

const PORT = 5298;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();
const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(`localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));
  localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));`);

let n = 0;
const id = () => `v${String(n++).padStart(10, '0')}`;
// Each search answers with songs that NAME the searched artist, except the
// one title the identify step is for.
const titleLookups = [];
await ctx.route('**/api/**', (r) => {
  const u = new URL(r.request().url());
  let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch { /* GET */ }
  const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname === '/api/music/similar') return json({ artist: u.searchParams.get('artist'), similar: ['Daft Punk'] });
  if (u.pathname === '/api/music/artist') {
    const t = u.searchParams.get('title') || '';
    titleLookups.push(t);
    return json({ artist: /Untitled Groove/.test(t) ? 'Justice' : null });
  }
  if (u.pathname === '/api/search') {
    const q = String(b.query || '');
    const artist = q.replace(/ official audio$/, '');
    if (/official audio$/.test(q)) {
      // Radio's own searches: the artist's songs.
      return json({ success: true, results: Array.from({ length: 3 }, (_, i) => ({ title: `${artist} - Radio Song ${i}`, url: `https://www.youtube.com/watch?v=${id()}` })) });
    }
    return json({ success: true, results: [
      { title: 'Justice - Genesis', url: 'https://www.youtube.com/watch?v=justice0001' },
      { title: 'Queued Thing - Waiting', url: 'https://www.youtube.com/watch?v=queued00001' },
      { title: 'Untitled Groove (Lyrics)', url: 'https://www.youtube.com/watch?v=untitled001' },
      { title: 'my cat vlog day 3', url: 'https://www.youtube.com/watch?v=catvlog0001' },
    ] });
  }
  return json({ success: true, data: [], results: [], videos: [] });
});
for (const h of ['**/*youtube*.com/**', '**/*.ytimg.com/**']) await ctx.route(h, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));

const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await openApp(page, `${BASE}/tube`);
const bar = page.locator('[aria-label="Search input"]:visible').first();
await until(() => bar.count(), { what: 'the Tube bar' });
await bar.click(); await bar.fill('mix'); await bar.press('Enter');
await until(() => page.locator('[data-tube-grid] [data-start-radio]').count(), { what: 'Tube cards with Start Radio' });

const playingSrc = () => page.evaluate(() => document.querySelector('[data-player-root] iframe[src*="youtube"]')?.src || '');
const nowId = async () => ((await playingSrc()).match(/embed\/([\w-]{11})/) || [])[1] || '';

// Queue something first, so there is a queue for Radio to park.
await page.locator('[aria-label="Add Queued Thing - Waiting to the queue"]').first().click();
await page.waitForTimeout(600);
const firstId = await nowId();
check(firstId === 'queued00001', 'with nothing playing, adding to the queue plays it (setup)', firstId);

// 1. Start Radio from a card.
await page.locator('[aria-label="Start Stream from Justice - Genesis"]').first().click();
await until(async () => (await nowId()) === 'justice0001', { what: 'the Start Radio song to play', timeout: 4000 }).catch(() => {});
check((await nowId()) === 'justice0001', 'Start Radio plays that song now', await nowId());
const radioState = await page.locator('[data-player-radio]').first().getAttribute('data-player-radio');
check(radioState === 'on', '…and switches Radio on', radioState);

const pressNext = async () => {
  const before = await nowId();
  await page.locator('[data-player-root] button[aria-label="Next"]:visible').last().click();
  await until(async () => (await nowId()) !== before, { what: 'Next', timeout: 6000 }).catch(() => {});
  return page.evaluate(() => document.title + '|' + (document.querySelector('[data-player-root] iframe')?.title || ''));
};
await pressNext();
const afterRadio = await nowId();
check(afterRadio && afterRadio !== 'queued00001', 'Next goes to a Radio pick, not the parked queue', afterRadio);
const status1 = await page.locator('[data-player-radio]').first().getAttribute('title');
check(/following (Justice|Daft Punk)/.test(status1 || ''), 'Radio says who it is following', status1);

// Off → the parked queue is followed again. (Start Radio PARKS the queue; it is
// a fresh search + play from the grid, with Radio on, that clears it — covered
// by verify-search-radio.mjs. So this has to be checked before any grid play.)
await page.locator('[data-player-radio]').first().click();
await pressNext();
check((await nowId()) === 'queued00001', 'switching Radio off hands Next back to the parked queue', await nowId());

// 2 + 3: play a clip with no artist in its title, then one nothing identifies.
await page.locator('[aria-label="Play Untitled Groove (Lyrics)"]').first().click().catch(() => {});
await page.waitForTimeout(400);
// Playing from the grid starts a results run — start Radio again from the picture's rail.
await page.locator('[data-player-root]').first().hover();
await page.locator('[data-player-root] [data-start-radio]').first().click({ force: true }).catch(() => {});
await pressNext();
check(titleLookups.some((t) => /Untitled Groove/.test(t)), 'a title naming no artist is looked up on MusicBrainz', titleLookups.join(' / '));
const status2 = await page.locator('[data-player-radio]').first().getAttribute('title');
check(/following (Justice|Daft Punk)/.test(status2 || ''), '…and Radio follows the artist it found', status2);

await page.locator('[aria-label="Play my cat vlog day 3"]').first().click().catch(() => {});
await page.waitForTimeout(400);
await page.locator('[data-player-root]').first().hover();
await page.locator('[data-player-root] [data-start-radio]').first().click({ force: true }).catch(() => {});
await pressNext();
const status3 = await page.locator('[data-player-radio]').first().getAttribute('title');
check(/kept going/.test(status3 || ''), 'an unidentifiable clip keeps the artist Radio was following', status3);

check(errs.length === 0, 'nothing threw', errs.join(' | ') || 'clean');
await ctx.close(); await browser.close(); await server.close();
console.log(ok.concat(bad).join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
