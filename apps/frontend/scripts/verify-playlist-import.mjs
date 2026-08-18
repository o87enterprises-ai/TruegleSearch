/* Importing a whole YouTube playlist from its URL.
 *
 * The ask was "captures ALL available links", and `available` is the word doing
 * the work. Two things make that less than "all", and both have to reach the
 * user rather than being rounded up to success:
 *
 *   THE KEYLESS PATH IS CAPPED. Without a YOUTUBE_API_KEY the backend can only
 *   read the playlist's RSS feed — the most recent ~15 entries, with no page
 *   parameter. That is a complete answer for a short playlist and a partial one
 *   for a long list. Importing 15 of somebody's 200 saved videos and reporting
 *   success is the worst outcome available here: they find out later, by
 *   missing something.
 *
 *   PRIVATE AND DELETED ENTRIES HAVE NO ID. They remain in a playlist as
 *   placeholders nobody can play. Skipping them is why an import can honestly
 *   be smaller than the count YouTube shows.
 *
 * Run it:  npm run playlist:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/playlist-test.mjs';
mkdirSync('dev/.build', { recursive: true });

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

let served = null;
globalThis.fetch = async () => {
  if (!served) return { ok: false, status: 502, json: async () => ({}) };
  if (served.status && served.status !== 200) {
    return { ok: false, status: served.status, json: async () => ({}) };
  }
  return { ok: true, status: 200, json: async () => served.body };
};

execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/utils/playlistImport.js', '--bundle', '--format=esm', '--platform=node',
  '--define:import.meta.env={"DEV":false}', '--external:react',
  `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const { isPlaylistUrl, importPlaylist, importMessage, playlistNameFrom } = await import(`../${OUT}`);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const vid = (id, extra = {}) => ({
  videoId: id,
  title: `Video ${id}`,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ...extra,
});

// ── 1. recognising one ──────────────────────────────────────────────────────
check(isPlaylistUrl('https://www.youtube.com/playlist?list=PLabcdefghijklmno'),
  'a playlist URL is recognised');
check(isPlaylistUrl('https://www.youtube.com/watch?v=abc&list=PLabcdefghijklmno'),
  '…including a watch link that carries one');
check(!isPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  'a plain video link is not a playlist');
check(!isPlaylistUrl('https://example.com/playlist?list=PLabcdefghijklmno'),
  'and neither is somebody else\'s site with the same query string');
check(!isPlaylistUrl(''), 'nor is nothing');
check(!isPlaylistUrl('not a url at all'), 'nor is prose');

// ── 2. the honest import ────────────────────────────────────────────────────
const URL_ = 'https://www.youtube.com/playlist?list=PLabcdefghijklmno';
served = { body: { videos: [vid('aaaaaaaaaaa'), vid('bbbbbbbbbbb')], complete: true, source: 'api' } };
const full = await importPlaylist(URL_, { name: 'My list' });
check(full.ok && full.count === 2, 'a complete playlist imports every video', JSON.stringify(full));
check(full.complete === true, '…and says so');
check(/Saved 2 videos/.test(importMessage(full)), '…in plain English', importMessage(full));
check(!/API key/.test(importMessage(full)), '…without a caveat it does not need');

// ── 3. THE ONE THAT MATTERS: a partial import must not read as a whole one ──
served = { body: { videos: [vid('ccccccccccc')], complete: false, source: 'rss' } };
const partial = await importPlaylist(URL_, { name: 'Long list' });
check(partial.ok, 'a truncated playlist still imports what it got');
check(partial.complete === false, '…and reports that it is not everything');
check(/more in it|API key/.test(importMessage(partial)),
  '…and SAYS so, rather than reporting plain success', importMessage(partial));

// ── 4. unplayable entries are dropped, not imported as dead rows ────────────
served = {
  body: {
    videos: [vid('ddddddddddd'), { title: 'Deleted video', url: '' }, { title: 'Private', url: 'https://example.com/nope' }],
    complete: true,
  },
};
const mixed = await importPlaylist(URL_, { name: 'Mixed' });
check(mixed.ok && mixed.count === 1,
  'entries the player cannot host are left out rather than saved as dead rows',
  JSON.stringify(mixed));

// ── 5. failures are messages, never exceptions ──────────────────────────────
served = { body: { videos: [], complete: true } };
const empty = await importPlaylist(URL_);
check(!empty.ok && empty.reason === 'empty', 'an empty playlist is a reason, not a crash');
check(/Nothing in that playlist/.test(importMessage(empty)), '…with a message', importMessage(empty));

served = { status: 404 };
const gone = await importPlaylist(URL_);
check(!gone.ok && gone.reason === 'not_found', 'a private or deleted playlist says which');
check(/private, deleted/.test(importMessage(gone)), '…in words', importMessage(gone));

served = { status: 500 };
const down = await importPlaylist(URL_);
check(!down.ok && down.reason === 'unreachable', 'an upstream failure is reported as one');

const wrong = await importPlaylist('https://example.com/x');
check(!wrong.ok && wrong.reason === 'not_a_playlist', 'and a non-playlist never leaves the browser');

// ── 6. a name, even when the feed gives none ────────────────────────────────
check(playlistNameFrom(URL_, [{ channel: 'Deep Sea Diaries' }]) === 'Deep Sea Diaries — playlist',
  'the channel names the list when one is known');
check(/PLabcdef/.test(playlistNameFrom(URL_, [])),
  'and the playlist id does when it is not', playlistNameFrom(URL_, []));

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
