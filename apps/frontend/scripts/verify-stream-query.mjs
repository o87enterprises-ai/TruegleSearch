/* Stream follows the artist the SEARCH named, when the clip names nobody.
 *
 * Owner, 2026-10-28: "the Last.fm / ListenBrainz function isn't auto taking over
 * to stream similar artists and sounds — it's defaulting to the YT Up Next
 * logic." The search was "larussel tweedlee dee"; the clip played was titled
 * "Tweedle Dee (Performed live on The Ed Sullivan Show 11/20/55)" — no
 * "Artist - Song" in it, so Stream had no artist to follow and fell back.
 *
 *   A. Stream at its default (never touched), a queue waiting, the clip names
 *      nobody but the query is a song the backend recognises → the queue is
 *      cleared, the results are NOT lined up, similar artists are asked for the
 *      artist the QUERY named, and when the clip ends the next one is a Stream
 *      pick — never a later result, never the queued song.
 *   B. The query is not a song (the backend says no idea) → nothing changes:
 *      the results still play in order, no similar-artist lookup.
 *   C. The query is a song but the clip pressed is something else → no stream.
 *
 * The backend and YouTube are stubbed. Run it:  npm run streamquery:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5315;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

const FRAME = (id) => `<!doctype html><html><body style="margin:0;background:#111"><script>
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
const RESULT_IDS = ['clipAAAAAA1', 'songBBBBBB2', 'songCCCCCC3', 'songDDDDDD4'];
const QUEUED = 'songDDDDDD4';
const IS_STREAM_PICK = /^strm[KL]\d{6}$/;
let serial = 0;
const streamRows = (artist) => [1, 2, 3].map((n) => {
  const id = `strm${artist[0]}${String(serial += 1).padStart(6, '0')}`;
  return { title: `${artist} - Song ${n} (Official Video)`, url: `https://www.youtube.com/watch?v=${id}`, snippet: 'music', domain: 'youtube.com', category: 'videos', channel: artist };
});
// The results page the owner saw: titled by the song, no "Artist - Song" in it.
const resultRows = () => [
  { title: 'Tweedle Dee (Performed live on The Ed Sullivan Show 11/20/55)', channel: 'The Ed Sullivan Show' },
  { title: 'LaVern Baker - Tomorrow Night', channel: 'LaVern Baker' },
  { title: 'Scotty Moore Lesson - How To Play Tweedle Dee', channel: 'Scotty Moore' },
  { title: 'Cooking pasta tutorial for beginners', channel: 'Farmees' },
].map((r, i) => ({ ...r, url: `https://www.youtube.com/watch?v=${RESULT_IDS[i]}`, snippet: 'x', domain: 'youtube.com', category: 'videos' }));

async function scenario({ identify, pressIndex = 0 }) {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  // Stream is left exactly as a new visitor has it: the switch never touched.
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  const asked = { identify: [], similar: [], search: [] };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/api/music/identify**', (r) => { asked.identify.push(new URL(r.request().url()).searchParams.get('q')); return r.fulfill({ json: identify }); });
  await ctx.route('**/api/music/artist**', (r) => r.fulfill({ json: { artist: null } }));
  await ctx.route('**/api/music/similar**', (r) => { asked.similar.push(new URL(r.request().url()).searchParams.get('artist')); return r.fulfill({ json: { artist: 'LaRussell', similar: ['Kendrick Lamar'] } }); });
  await ctx.route('**/api/search', (r) => {
    let q = '';
    try { q = JSON.parse(r.request().postData() || '{}').query || ''; } catch { /* none */ }
    asked.search.push(q);
    if (/official audio/.test(q)) {
      const who = ['LaRussell', 'Kendrick Lamar'].find((a) => q.includes(a));
      return r.fulfill({ json: { success: true, results: who ? streamRows(who) : [] } });
    }
    return r.fulfill({ json: { success: true, results: resultRows() } });
  });
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: FRAME(new URL(r.request().url()).pathname.split('/').pop()) }));
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: GIF }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await openApp(page, `${BASE}/tube`);
  const bar = page.locator('[aria-label="Search input"]:visible');
  await until(() => bar.count(), { what: 'the Tube bar' });
  await bar.first().click(); await bar.first().fill('larussel tweedlee dee'); await bar.first().press('Enter');
  await until(() => page.locator('[data-tube-grid] [data-tube-card]').count(), { what: 'search results', timeout: 15000 });
  const nowPlaying = () => page.locator('iframe[src*="youtube-nocookie"]').first().getAttribute('src')
    .then((s) => (/embed\/([\w-]{11})/.exec(s || '') || [])[1] || '').catch(() => '');
  // A song is already waiting in the queue.
  await page.locator('[data-tube-grid] [data-tube-card]').nth(3).locator('button[aria-label$="to the queue"]').click();
  await page.locator('[data-tube-grid] [data-tube-card]').nth(pressIndex).locator('button[aria-label^="Play "]').first().click();
  await until(async () => (await nowPlaying()) === RESULT_IDS[pressIndex], { what: 'the pressed result to play', timeout: 15000 });
  const moved = pressIndex === 0
    ? await until(async () => { const n = await nowPlaying(); return n && n !== RESULT_IDS[0]; }, { what: 'the next song, by itself', timeout: 20000 }).then(() => true, () => false)
    : false;
  const next = await nowPlaying();
  await ctx.close();
  return { moved, next, asked, errs };
}

const a = await scenario({ identify: { artist: 'LaRussell', track: 'Tweedledee' } });
check(a.asked.identify.length >= 1, 'A. the search query was read for who and what it was about', JSON.stringify(a.asked.identify));
check(a.asked.similar.includes('LaRussell'), 'A. similar artists were asked for the artist the QUERY named', JSON.stringify(a.asked.similar));
check(a.moved && IS_STREAM_PICK.test(a.next), 'A. when the clip ends the next one is a Stream pick', a.next);
check(!RESULT_IDS.includes(a.next), 'A. …not a later search result, and not the queued song', a.next);
check(a.errs.length === 0, 'A. nothing threw', a.errs.join(' | ') || 'clean');

const b = await scenario({ identify: { artist: null, track: null } });
check(b.moved && RESULT_IDS.includes(b.next) && b.next !== RESULT_IDS[0], 'B. a query that is not a song: the results still play in order', b.next);
check(b.asked.similar.length === 0, 'B. …and no similar-artist lookup is made', JSON.stringify(b.asked.similar));

const c = await scenario({ identify: { artist: 'LaRussell', track: 'Tweedledee' }, pressIndex: 3 });
check(c.asked.similar.length === 0, 'C. the pressed clip is not that song: no stream is started', JSON.stringify(c.asked.similar));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
