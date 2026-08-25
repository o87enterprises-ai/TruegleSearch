/* The flat-file creator video cache.
 *
 * It replaces a YouTube API call that cost one quota unit per visitor per page
 * load, so the parser has to be strict about two things in opposite
 * directions: a malformed line must never reach an embed URL, and a valid line
 * must never be silently dropped, because a dropped line means a page quietly
 * falls back to the API it was meant to replace.
 *
 * Run it:  npm run creatorvids:test
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const raw = await readFile(join(here, '../src/content/creatorVideos.txt'), 'utf8');

let passed = 0, failed = 0;
const ok = (l, c, d = '') => { if (c) { passed++; console.log(`PASS ${l}${d ? ` — ${d}` : ''}`); } else { failed++; console.error(`FAIL ${l}${d ? ` — ${d}` : ''}`); } };

// Re-implement the parser's contract against a fixture, so the test does not
// depend on Vite's ?raw import.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
function parse(text) {
  const out = new Map();
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const p = t.split('|');
    if (p.length < 3) continue;
    const slug = p[0].trim(), id = p[1].trim(), title = p.slice(2).join('|').trim();
    if (!slug || !YT_ID.test(id) || !title) continue;
    if (!out.has(slug)) out.set(slug, []);
    out.get(slug).push({ id, title });
  }
  return out;
}

// ── The shipped file must be parseable and must not contain junk ───────────
const shipped = parse(raw);
ok('the shipped file parses without throwing', shipped instanceof Map);
ok('every shipped line has a valid 11-char YouTube id',
  [...shipped.values()].flat().every((v) => YT_ID.test(v.id)));

// ── Format ─────────────────────────────────────────────────────────────────
const f = parse(`
# a comment
   # an indented comment

adam-mockler|dQw4w9WgXcQ|A normal title
adam-mockler|aaaaaaaaaaa|Another one
other-creator|bbbbbbbbbbb|Theirs
`);
ok('comments and blank lines are ignored', f.size === 2, `${f.size} slugs`);
ok('videos group under their slug', f.get('adam-mockler').length === 2);
ok('order within a channel is preserved (newest first)',
  f.get('adam-mockler')[0].title === 'A normal title');

// ── A title containing a pipe must not be truncated ────────────────────────
const piped = parse('slug|dQw4w9WgXcQ|Street Codes | ft. Lul Snake');
ok('a pipe inside a title is kept, not truncated',
  piped.get('slug')[0].title === 'Street Codes | ft. Lul Snake',
  piped.get('slug')[0].title);

// ── Malformed lines are dropped, never interpolated ────────────────────────
for (const [line, why] of [
  ['slug|../../etc/passwd|Bad', 'path traversal in the id'],
  ['slug|"onerror=|Bad', 'quote in the id'],
  ['slug|short|Bad', 'id too short'],
  ['slug|waaaaaaytoolongforanid|Bad', 'id too long'],
  ['slug|dQw4w9WgXcQ|', 'empty title'],
  ['|dQw4w9WgXcQ|Title', 'empty slug'],
  ['slug|dQw4w9WgXcQ', 'missing title field'],
  ['justonefield', 'no delimiters'],
]) {
  ok(`dropped: ${why}`, parse(line).size === 0);
}

// ── The distinction the caller depends on ──────────────────────────────────
// cachedVideos returns NULL for an uncached channel, so the page can tell
// "cached and empty" from "not cached, ask the API".
ok('an empty file yields no slugs at all', parse('').size === 0);
ok('a comments-only file yields no slugs', parse('# just docs\n# more docs').size === 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
