/* Fill src/content/creatorVideos.txt — the command that file has been telling
 * people to run since the day it was written.
 *
 * WHAT WAS MISSING. creatorVideos.txt documents its own format, explains why it
 * is a flat file rather than a table, and signs off with
 *
 *     npm run creators:fetch -- <slug>     (writes lines here; needs a YT key)
 *
 * — a script that did not exist. So the cache shipped empty and every creator
 * page kept spending a YouTube quota unit per visitor, which is the exact cost
 * the file was created to avoid.
 *
 * THE KEY STAYS IN VERCEL. The obvious way to write this is to call the YouTube
 * Data API directly, which would mean a YOUTUBE_API_KEY on the laptop of
 * whoever runs it — a second copy of a secret, in the least controlled place.
 * The deployed backend already holds that key and already exposes the exact
 * call we need: GET /api/creators/playlist takes a playlist id, and a channel's
 * uploads ARE a playlist (id = channel id with UC swapped for UU). It pages to
 * 500 videos at 1 quota unit per 50. So this fetches through the backend, and
 * nothing here ever sees the key.
 *
 * IT REPORTS WHICH PATH ANSWERED, and that is the point of the `source` field
 * rather than decoration: without a key the backend silently falls back to
 * YouTube's RSS feed, which returns the newest ~15 videos and no more. Fifteen
 * rows look exactly like a working seed until someone notices a channel with
 * 400 uploads has fifteen of them cached. So an RSS answer is called out as a
 * failure to configure, not accepted as a result.
 *
 * Run it:
 *   npm run creators:fetch -- <slug>        one creator
 *   npm run creators:fetch -- all           every creator in content/creators.js
 *   npm run creators:fetch -- all --backend https://your-backend.example
 *
 * Re-running replaces that creator's block and leaves every other one alone, so
 * a partial run is safe and topping up one channel does not disturb the rest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, '../src/content/creatorVideos.txt');
const ROSTER = join(__dirname, '../src/content/creators.js');

const DEFAULT_BACKEND = 'https://backend-seven-khaki-60.vercel.app';

const argv = process.argv.slice(2);
const backendFlag = argv.indexOf('--backend');
const BACKEND = (backendFlag !== -1 ? argv[backendFlag + 1] : null)
  || process.env.TRUEGLE_BACKEND_URL
  || DEFAULT_BACKEND;
const targets = argv.filter((a, i) => !a.startsWith('--') && i !== backendFlag + 1);

if (targets.length === 0) {
  console.error('Usage: npm run creators:fetch -- <slug|all> [--backend <url>]');
  process.exit(2);
}

/* The roster is an ES module full of JSX-free object literals, but importing it
 * would drag in Vite's `?raw` graph. Two fields are needed and both are on
 * their own line, so it is read as text — no bundler, no dependency. */
function roster() {
  const src = readFileSync(ROSTER, 'utf8');
  const out = [];
  const re = /slug:\s*'([^']+)'[\s\S]{0,400}?channelId:\s*'(UC[A-Za-z0-9_-]{20,})'/g;
  let m;
  while ((m = re.exec(src))) out.push({ slug: m[1], channelId: m[2] });
  return out;
}

const ALL = roster();
if (ALL.length === 0) {
  console.error(`No creators parsed from ${ROSTER} — has its shape changed?`);
  process.exit(1);
}

const wanted = targets.includes('all')
  ? ALL
  : ALL.filter((c) => targets.includes(c.slug));

const unknown = targets.filter((t) => t !== 'all' && !ALL.some((c) => c.slug === t));
if (unknown.length) {
  console.error(`Unknown slug(s): ${unknown.join(', ')}`);
  console.error(`Known: ${ALL.map((c) => c.slug).join(', ')}`);
  process.exit(2);
}

/* A pipe would split a line into the wrong fields, and a newline would end it
 * early. Both are stripped rather than escaped — the format is deliberately
 * simple, and a title is display text, not data anyone parses back out. */
const clean = (s) => String(s || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchChannel({ slug, channelId }) {
  const uploads = `UU${channelId.slice(2)}`;
  const url = `${BACKEND.replace(/\/$/, '')}/api/creators/playlist?url=${uploads}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'TruegleSearch creators:fetch' } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const j = await r.json();
  const videos = (j.videos || []).filter((v) => /^[A-Za-z0-9_-]{11}$/.test(v.videoId || ''));
  return { slug, videos, source: j.source || 'unknown', complete: j.complete !== false };
}

/* Rewrite one slug's block in place: the header and every other creator's lines
 * are carried through untouched, so this is safe to run against a file someone
 * has hand-edited. */
function merge(existing, slug, videos) {
  const kept = existing
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return true;          // header + comments
      return t.split('|')[0].trim() !== slug;            // drop this slug's old rows
    });
  // Trailing blank lines would multiply on every run.
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  const rows = videos.map((v) => `${slug}|${v.videoId}|${clean(v.title)}`);
  return `${[...kept, '', ...rows].join('\n')}\n`;
}

let rssOnly = 0;
let total = 0;

for (const creator of wanted) {
  try {
    const { slug, videos, source, complete } = await fetchChannel(creator);
    if (videos.length === 0) {
      console.error(`${slug}: 0 videos — skipped (nothing to write)`);
      continue;
    }
    writeFileSync(CACHE, merge(readFileSync(CACHE, 'utf8'), slug, videos));
    total += videos.length;
    const note = source === 'rss'
      ? '  ← RSS, not the Data API: the backend has no YOUTUBE_API_KEY'
      : complete ? '' : '  (capped at 500)';
    console.log(`${slug}: ${videos.length} videos via ${source}${note}`);
    if (source === 'rss') rssOnly += 1;
  } catch (err) {
    console.error(`${creator.slug}: FAILED — ${err.message}`);
  }
}

console.log(`\n${total} videos cached from ${wanted.length} channel(s) via ${BACKEND}`);
if (rssOnly > 0) {
  // Loud, because fifteen rows is indistinguishable from a good seed by eye.
  console.error(
    `\n${rssOnly} channel(s) answered from RSS, which caps at ~15 videos.\n`
    + 'The backend could not reach the YouTube Data API — set YOUTUBE_API_KEY on\n'
    + 'the deployment and re-run. What was written is correct but far from complete.',
  );
  process.exit(1);
}
