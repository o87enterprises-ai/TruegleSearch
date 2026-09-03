/* The seeder that fills creatorVideos.txt.
 *
 * creatorVideos.txt exists so a creator page stops spending a YouTube quota
 * unit per visitor. It shipped empty because the command it told people to run
 * — npm run creators:fetch — had never been written. This is that command, and
 * these are the four ways it could quietly do the wrong thing:
 *
 *   1. ASK FOR THE WRONG THING. A channel's uploads are a playlist whose id is
 *      the channel id with UC swapped for UU. Send the UC id and YouTube
 *      returns nothing, for a channel that is perfectly fine.
 *
 *   2. ACCEPT THE RSS FALLBACK AS SUCCESS. Without a key the backend answers
 *      from RSS, which caps at ~15 videos. Fifteen rows look exactly like a
 *      good seed. A channel with 400 uploads would sit at fifteen forever and
 *      nobody would know from reading the file.
 *
 *   3. DUPLICATE ON RE-RUN. The file is meant to be topped up. Appending
 *      instead of replacing gives every video twice, and the parser has no
 *      reason to reject it.
 *
 *   4. TRASH THE NEIGHBOURS. Seeding one creator must not disturb another's
 *      lines, or the header that documents the format.
 *
 * The real script is run as a subprocess against a stub backend, so what is
 * tested is the shipped file rather than a copy of its logic.
 *
 * Run it:  npm run creatorsfetch:test
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, '../src/content/creatorVideos.txt');
const BACKUP = `${CACHE}.verifybak`;

let passed = 0, failed = 0;
const ok = (l, c, d = '') => { if (c) { passed++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`); } else { failed++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`); } };

// The file is real and committed, so it is put back exactly as found.
copyFileSync(CACHE, BACKUP);
const restore = () => { copyFileSync(BACKUP, CACHE); if (existsSync(BACKUP)) unlinkSync(BACKUP); };
process.on('exit', () => { if (existsSync(BACKUP)) restore(); });

const asked = [];
let mode = 'api';                       // 'api' | 'rss'
const video = (n) => ({ videoId: `vid${String(n).padStart(8, '0')}`, title: `Episode ${n}` });

const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  asked.push(u.searchParams.get('url'));
  const count = mode === 'rss' ? 15 : 120;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    videos: Array.from({ length: count }, (_, i) => video(i + 1)),
    source: mode,
    complete: mode !== 'rss',
  }));
});
await new Promise((r) => server.listen(0, r));
const BACKEND = `http://localhost:${server.address().port}`;

const fetchSlug = (slug) => run('node', [join(here, 'fetch-creator-videos.mjs'), slug, '--backend', BACKEND]);
const rows = (slug) => readFileSync(CACHE, 'utf8').split('\n').filter((l) => l.trim().startsWith(`${slug}|`));

// ── 1. the uploads id, not the channel id ──────────────────────────────────
await fetchSlug('dark-waters-9');
ok('a channel is fetched by its UPLOADS id, not its channel id',
  asked[0] === 'UUZw8SuiTYSvPKmnMe8LDtpA', asked[0]);

// ── the rows land in the documented format ─────────────────────────────────
const first = rows('dark-waters-9');
ok('every video is written as slug|videoId|title', first.length === 120
  && first.every((l) => l.split('|').length === 3 && /^[A-Za-z0-9_-]{11}$/.test(l.split('|')[1])),
  `${first.length} rows`);

// ── the header survives, because it is the file's documentation ────────────
const text = readFileSync(CACHE, 'utf8');
ok('the format header is left intact', text.startsWith('# Creator videos'),
  text.slice(0, 24).replace(/\n/g, ' '));

// ── 2. re-running replaces, never duplicates ───────────────────────────────
await fetchSlug('dark-waters-9');
ok('re-running a creator replaces their block instead of doubling it',
  rows('dark-waters-9').length === 120, `${rows('dark-waters-9').length} rows`);

// ── 4. a second creator does not disturb the first ─────────────────────────
await fetchSlug('true-story');
ok('seeding a second creator leaves the first alone',
  rows('dark-waters-9').length === 120 && rows('true-story').length === 120,
  `${rows('dark-waters-9').length} + ${rows('true-story').length}`);

// ── the loader's contract: what was written is what comes back ─────────────
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const parsed = new Map();
for (const line of readFileSync(CACHE, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const p = t.split('|');
  if (p.length < 3 || !YT_ID.test(p[1].trim())) continue;
  const slug = p[0].trim();
  if (!parsed.has(slug)) parsed.set(slug, []);
  parsed.get(slug).push({ videoId: p[1].trim(), title: p.slice(2).join('|').trim() });
}
ok('the cache parser reads back every row the seeder wrote',
  parsed.get('dark-waters-9')?.length === 120 && parsed.get('true-story')?.length === 120,
  `${parsed.get('dark-waters-9')?.length} + ${parsed.get('true-story')?.length}`);
ok('…titles included, in order', parsed.get('dark-waters-9')?.[0]?.title === 'Episode 1',
  parsed.get('dark-waters-9')?.[0]?.title);

// ── a title containing a pipe cannot break the format it is written into ───
mode = 'api';
server.removeAllListeners('request');
server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    videos: [{ videoId: 'aBcDeFgHiJk', title: 'Part 1 | The pipe | and a\nnewline' }],
    source: 'api', complete: true,
  }));
});
await fetchSlug('bass-forge');
const piped = rows('bass-forge')[0];
ok('a pipe or newline in a title cannot split the line it lives on',
  piped?.split('|').length === 3 && piped.endsWith('Part 1 The pipe and a newline'), piped);

// ── 3. an RSS answer is a failure, not a result ────────────────────────────
mode = 'rss';
server.removeAllListeners('request');
server.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    videos: Array.from({ length: 15 }, (_, i) => video(i + 1)),
    source: 'rss', complete: false,
  }));
});
let rssExit = 0;
let rssErr = '';
try {
  await fetchSlug('wright-7x');
} catch (e) {
  rssExit = e.code;
  rssErr = `${e.stdout || ''}${e.stderr || ''}`;
}
ok('an RSS answer exits non-zero instead of passing for a good seed', rssExit === 1, `exit ${rssExit}`);
ok('…and says plainly that the deployment has no YOUTUBE_API_KEY',
  /YOUTUBE_API_KEY/.test(rssErr) && /caps at ~15/.test(rssErr),
  rssErr.split('\n').filter(Boolean).slice(-2)[0]?.slice(0, 60));

// ── an unknown slug is refused before anything is written ──────────────────
const before = readFileSync(CACHE, 'utf8');
let unknownExit = 0;
try { await fetchSlug('not-a-real-creator'); } catch (e) { unknownExit = e.code; }
ok('an unknown slug is refused and writes nothing',
  unknownExit === 2 && readFileSync(CACHE, 'utf8') === before, `exit ${unknownExit}`);

server.close();
restore();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
