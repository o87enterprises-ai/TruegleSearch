/* Tube: a fresh search + play, with Radio on, hands "next" to Radio — and full
 * screen takes the clip's own shape however the clip was started.
 *
 * Owner, 2026-10-24:
 *   "if radio is on and I search 'sade smooth criminal', after the song plays
 *    another version of the same song plays next, continuously, because it's
 *    going from one query result to the next."
 *   "pasted links get the orientation right, but a playlist or a search + play
 *    defaults to landscape, especially in full screen."
 *
 *   A. Radio ON, a queue waiting, play result 1 → the queue is CLEARED, the other
 *      results are NOT lined up, and when the song ends the next one comes from
 *      Radio (the similar-artist lookup + a search for those artists) — never a
 *      later search result, never the queued song.
 *   B. Radio OFF (control) → the results still play in order, as before.
 *   C. A Short that reached the player as a plain /watch link (no `vertical`)
 *      locks full screen to PORTRAIT once the backend's oEmbed says it is tall;
 *      a normal video still locks to LANDSCAPE.
 *   D. Saved lists and history keep the `vertical` flag.
 *
 * The backend and YouTube are stubbed. Run it:  npm run searchradio:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5313;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// ── D. the pure part: the stores keep `vertical` ───────────────────────────
{
  const { createPlaylist, playlists } = await server.ssrLoadModule('/src/utils/playlists.js').catch(() => ({}));
  if (createPlaylist) {
    globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem: () => {} };
    const id = createPlaylist('shorts', [
      { src: 'https://www.youtube-nocookie.com/embed/shortAAAAA1', kind: 'youtube', title: 'a short', pageUrl: 'https://www.youtube.com/shorts/shortAAAAA1', vertical: true },
      { src: 'https://www.youtube-nocookie.com/embed/wideBBBBBB2', kind: 'youtube', title: 'wide', pageUrl: 'https://www.youtube.com/watch?v=wideBBBBBB2' },
    ]);
    const list = playlists().find((p) => p.id === id);
    check(list?.items[0]?.vertical === true, 'a saved list keeps a Short\'s vertical flag');
    check(list?.items[1] && !('vertical' in list.items[1]), '…and does not invent one for a widescreen video');
  } else {
    check(false, 'playlists module loads');
  }
}

// YouTube's postMessage protocol, trimmed: listens, reports playing, and — for
// ids starting "clipA" — reports ENDED after 2.5s.
const stub = (id) => `<!doctype html><html><body style="margin:0;background:#111"><script>
  var send = function (o) { o.channel = 'widget'; o.id = 1; parent.postMessage(JSON.stringify(o), '*'); };
  var talking = false;
  addEventListener('message', function (e) {
    var d; try { d = JSON.parse(e.data); } catch (x) { return; }
    if (d && d.event === 'listening' && !talking) {
      talking = true;
      send({ event: 'onReady', info: null });
      var t = 0;
      setInterval(function () { t += 0.5; send({ event: 'infoDelivery', info: { playerState: 1, currentTime: t, duration: 200 } }); }, 500);
      ${id.startsWith('clipA') ? "setTimeout(function () { send({ event: 'infoDelivery', info: { playerState: 0, currentTime: 200, duration: 200 } }); }, 2500);" : ''}
    }
  });
</script></body></html>`;

const GIF = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');
const IS_RADIO_PICK = /^radio[MC]\d{5}$/;
const VERSIONS = ['clipAAAAAA1', 'songBBBBBB2', 'songCCCCCC3', 'songDDDDDD4'];
const QUEUED = 'songDDDDDD4';
let serial = 0;
const radioRows = (artist) => [1, 2, 3].map((n) => {
  const id = `radio${artist[0]}${String(serial += 1).padStart(5, '0')}`;
  return { title: `${artist} - Song ${n} (Official Video)`, url: `https://www.youtube.com/watch?v=${id}`, snippet: 'music', domain: 'youtube.com', category: 'videos', channel: artist };
});
const versionRows = () => VERSIONS.map((id, i) => ({
  title: `Sade - Smooth Criminal ${['(Official Video)', '(Live)', '(Lyrics)', '(Cover)'][i]}`,
  url: `https://www.youtube.com/watch?v=${id}`, snippet: 'music', domain: 'youtube.com', category: 'videos', channel: 'Sade',
}));

async function openTube(ctx, { radio }) {
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_player_radio_v1', '${radio ? '1' : '0'}');
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  const asked = { similar: [], search: [] };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/api/music/similar**', (r) => { asked.similar.push(new URL(r.request().url()).searchParams.get('artist')); return r.fulfill({ json: { artist: 'Sade', similar: ['Muse', 'Coldplay'] } }); });
  await ctx.route('**/api/search', (r) => {
    let q = '';
    try { q = JSON.parse(r.request().postData() || '{}').query || ''; } catch { /* none */ }
    asked.search.push(q);
    if (/official audio/.test(q)) {
      const who = ['Muse', 'Coldplay', 'Sade'].find((a) => q.includes(a));
      return r.fulfill({ json: { success: true, results: who === 'Sade' ? [] : radioRows(who) } });
    }
    return r.fulfill({ json: { success: true, results: versionRows() } });
  });
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: stub(new URL(r.request().url()).pathname.split('/').pop()) }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: GIF }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]:visible');
  await until(() => bar.count(), { what: 'the Tube bar' });
  await bar.first().click(); await bar.first().fill('sade smooth criminal'); await bar.first().press('Enter');
  await until(() => page.locator('[data-tube-grid] [data-tube-card]').count(), { what: 'search results', timeout: 15000 });
  const nowPlaying = () => page.locator('iframe[src*="youtube-nocookie"]').first().getAttribute('src')
    .then((s) => (/embed\/([\w-]{11})/.exec(s || '') || [])[1] || '').catch(() => '');
  return { page, asked, errs, nowPlaying };
}

async function playFirstThenWait({ radio }) {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  const t = await openTube(ctx, { radio });
  // A song is waiting in the queue before anything is played.
  await t.page.locator('[data-tube-grid] [data-tube-card]').nth(3).locator('button[aria-label$="to the queue"]').click();
  await t.page.locator('[data-tube-grid] [data-tube-card]').first().locator('button[aria-label^="Play "]').first().click();
  await until(async () => (await t.nowPlaying()) === 'clipAAAAAA1', { what: 'the first result to play', timeout: 15000 });
  const moved = await until(async () => { const n = await t.nowPlaying(); return n && n !== 'clipAAAAAA1'; }, { what: 'the next song, by itself', timeout: 20000 }).then(() => true, () => false);
  const next = await t.nowPlaying();
  await ctx.close();
  return { moved, next, asked: t.asked, errs: t.errs };
}

const on = await playFirstThenWait({ radio: true });
check(on.moved, 'A. Radio ON: the next song starts by itself', `now playing "${on.next}"`);
check(on.asked.similar.includes('Sade'), 'A. Radio asked for artists similar to the one playing', JSON.stringify(on.asked.similar));
check(IS_RADIO_PICK.test(on.next), 'A. …and the next song is a Radio pick, not another search result', on.next);
check(!VERSIONS.includes(on.next), 'A. …in particular not another version of the song, and not the queued one', `${on.next} vs ${QUEUED}`);
check(on.errs.length === 0, 'A. nothing threw', on.errs.join(' | ') || 'clean');

const off = await playFirstThenWait({ radio: false });
check(off.moved && VERSIONS.includes(off.next), 'B. Radio OFF (control): the results still play in order', `now playing "${off.next}"`);
check(off.asked.similar.length === 0, 'B. …and no similar-artist lookup is made', JSON.stringify(off.asked.similar));

// ── C. full screen follows the clip's own shape ─────────────────────────────
async function lockFor(id, oembed) {
  const ctx = await testContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(`window.__locks = [];
    try { Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: (o) => { window.__locks.push(o); return Promise.resolve(); } }); } catch (e) {}
    localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  const shortsUrl = `https://www.youtube.com/shorts/${id}`;
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/api/media/titles', (r) => r.fulfill({ json: { titles: { [shortsUrl]: { title: 'x', ...oembed } } } }));
  await ctx.route('**/api/search', (r) => r.fulfill({ json: { success: true, results: [
    { title: 'A clip', url: `https://www.youtube.com/watch?v=${id}`, snippet: 'x', domain: 'youtube.com', category: 'videos', channel: 'Ch' },
  ] } }));
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: stub('other') }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: GIF }));
  const page = await ctx.newPage();
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]:visible');
  await until(() => bar.count(), { what: 'the Tube bar' });
  await bar.first().click(); await bar.first().fill('a clip'); await bar.first().press('Enter');
  await until(() => page.locator('[data-tube-grid] [data-tube-card]').count(), { what: 'search results', timeout: 15000 });
  await page.locator('[data-tube-grid] [data-tube-card]').first().locator('button[aria-label^="Play "]').first().click();
  const enter = page.locator('[aria-label="Full screen"]:visible').first();
  await until(() => enter.count(), { what: 'the Full screen button' });
  await enter.click();
  await page.waitForTimeout(1200);
  const locks = await page.evaluate(() => window.__locks);
  await ctx.close();
  return locks;
}

const tall = await lockFor('shortAAAAA1', { width: 113, height: 200 });
check(tall[tall.length - 1] === 'portrait', 'C. a Short started from a plain /watch link: full screen locks PORTRAIT', JSON.stringify(tall));
const wide = await lockFor('wideBBBBBB2', { width: 200, height: 113 });
check(wide[wide.length - 1] === 'landscape', 'C. a normal video: full screen still locks LANDSCAPE', JSON.stringify(wide));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
