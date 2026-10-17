/* Radio keeps the music going by itself.
 *
 * Owner, 2026-10-17: "the Radio button is working perfectly on the song
 * selection, it's just not firing the next song autonomously — I have to press
 * Next." This plays a song, lets the (fake) YouTube frame report it ENDED, and
 * checks the player moves to another song with nobody pressing anything.
 *
 *   A. Radio ON, nothing queued   → the next song is by the artist or a similar
 *                                   artist, and it starts by itself
 *   B. Radio OFF (control)        → still moves on by itself, so a failure in A
 *                                   is about Radio and not about auto-advance
 *
 * Run it:  npm run radioauto:test
 */
import { createServer } from 'vite';
import { launchChromium, openApp, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5311;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = `http://localhost:${PORT}`;
const browser = await launchChromium();

// YouTube's postMessage protocol, trimmed: answers "listening", reports
// playing, and — for ids starting "clipA" only — reports ENDED after 2.5s.
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

const SIMILAR = ['Muse', 'Coldplay'];
const ID = { Radiohead: 'radioHead0', Muse: 'radioMuse0', Coldplay: 'radioCold0' };
const rows = (artist) => [1, 2, 3].map((n) => {
  const id = `${ID[artist]}${n}`.padEnd(11, 'x').slice(0, 11);
  return { title: `${artist} - Song ${n} (Official Video)`, url: `https://www.youtube.com/watch?v=${id}`, snippet: 'music', domain: 'youtube.com', category: 'videos', channel: artist };
});

async function run(radio) {
  const ctx = await testContext(browser, { viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(`localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));
    localStorage.setItem('truegle_swipe_hint_seen', '1');
    localStorage.setItem('truegle_player_radio_v1', '${radio ? '1' : '0'}');
    localStorage.setItem('truegle_tutorials', JSON.stringify({ dismissed: {}, neverShowAgain: true, lastSeen: null, hintsOptIn: false }));`);
  const asked = { music: [], search: [] };
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[],"results":[],"keys":[]}' }));
  await ctx.route('**/api/music/similar**', (r) => { asked.music.push(new URL(r.request().url()).searchParams.get('artist')); return r.fulfill({ json: { artist: 'Radiohead', similar: SIMILAR } }); });
  await ctx.route('**/api/search', (r) => {
    let q = '';
    try { q = JSON.parse(r.request().postData() || '{}').query || ''; } catch { /* none */ }
    asked.search.push(q);
    const who = ['Muse', 'Coldplay', 'Radiohead'].find((a) => q.includes(a));
    return r.fulfill({ json: { success: true, results: who ? rows(who) : rows('Radiohead') } });
  });
  await ctx.route('**/www.youtube-nocookie.com/embed/**', (r) => {
    const id = new URL(r.request().url()).pathname.split('/').pop();
    return r.fulfill({ status: 200, contentType: 'text/html', body: stub(id) });
  });
  await ctx.route('**/*.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const link = `/tube?u=${encodeURIComponent('https://www.youtube.com/watch?v=clipAAAAAA1')}&t=${encodeURIComponent('Radiohead - Creep (Official Video)')}`;
  await openApp(page, `${BASE}${link}`);
  // A shared link opens behind a play door — one tap, as a person would.
  await until(() => page.locator('[data-share-gate]').count(), { what: 'the play door' });
  await page.locator('[data-share-gate]').click();
  const nowPlaying = () => page.locator('iframe[src*="youtube-nocookie"]').first().getAttribute('src')
    .then((s) => (/embed\/([\w-]{11})/.exec(s || '') || [])[1] || '').catch(() => '');
  await until(async () => (await nowPlaying()) === 'clipAAAAAA1', { what: 'the first song to load', timeout: 15000 });
  // Nobody touches anything from here. The frame reports ENDED at 2.5s.
  const moved = await until(async () => { const n = await nowPlaying(); return n && n !== 'clipAAAAAA1'; }, { what: 'the next song, by itself', timeout: 20000 }).then(() => true, () => false);
  const next = await nowPlaying();
  await ctx.close();
  return { moved, next, asked, errs };
}

const on = await run(true);
check(on.moved, 'Radio ON: the next song starts by itself when the song ends', `now playing "${on.next}"`);
check(on.asked.music.includes('Radiohead'), 'Radio ON: asked for artists similar to the one playing', JSON.stringify(on.asked.music));
const byArtist = /^(radioHead|radioMuse0|radioCold0)/.test(on.next);
check(on.moved && byArtist, 'Radio ON: and it is by that artist or a similar one, not a random pick', on.next);
check(on.errs.length === 0, 'Radio ON: nothing threw', on.errs.join(' | ') || 'clean');

const off = await run(false);
check(off.moved, 'Radio OFF (control): the next song also starts by itself', `now playing "${off.next}"`);
check(off.asked.music.length === 0, 'Radio OFF: no similar-artist lookup is made', JSON.stringify(off.asked.music));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
