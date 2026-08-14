/* The Survivor's Encyclopedia — parse, index, and the offline copy.
 *
 * The promise this feature makes is narrow and absolute: what you save is the
 * whole book, and it works with nothing. So the checks that matter are not
 * "does it render" but:
 *
 *   1. NOTHING IS LOST between the markdown and the saved file. A parser that
 *      silently drops an entry is worse than no parser, because the index
 *      still looks complete.
 *   2. THE SAVED FILE REACHES FOR NOTHING. One external font, one CDN
 *      stylesheet, one tracking pixel, and the file is a brick on the day it
 *      is needed.
 *   3. The index is honest about what is an article and what is a pointer.
 *
 * Run it:  npm run vault:test
 */
import { BOOK, RAW, search, toDocument, blocks } from '../src/utils/encyclopedia.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// ── 1. the parse ───────────────────────────────────────────────────────────
check(BOOK.letters.length >= 20, 'the book has letter sections', `${BOOK.letters.length}`);
const letters = BOOK.letters.map((l) => l.letter);
check(letters.every((l) => /^[A-Z]$/.test(l)), 'every section is a single letter', letters.join(''));
check(new Set(letters).size === letters.length, 'no letter appears twice');
check(letters.join('') === [...letters].sort().join(''), 'the sections are in alphabetical order', letters.join(''));

check(BOOK.entries.length >= 50, 'the book has entries', `${BOOK.entries.length}`);
const ids = BOOK.entries.map((e) => e.id);
check(new Set(ids).size === ids.length, 'no duplicate entry ids',
  ids.filter((id, i) => ids.indexOf(id) !== i).join(',') || 'all unique');
check(BOOK.entries.every((e) => e.title && e.id), 'every entry has a title and an id');

// A heading can carry its article on the same line. If the split fails, the
// whole paragraph becomes the TITLE — which is exactly what happened, and it
// reads in the index as a wall of prose where a name should be.
const long = BOOK.entries.filter((e) => e.title.length > 60);
check(long.length === 0, 'no entry title is a runaway paragraph',
  long.map((e) => `${e.title.slice(0, 40)}…`).join(' | ') || 'all short');

const hollow = BOOK.entries.filter((e) => !e.seeAlso && !e.body.trim());
check(hollow.length === 0, 'every article has a body',
  hollow.map((e) => e.title).join(', ') || 'all filled');

const xrefs = BOOK.entries.filter((e) => e.seeAlso);
check(xrefs.length > 0 && xrefs.length < BOOK.entries.length / 2,
  'cross-references are marked as such, and are the minority',
  `${xrefs.length} of ${BOOK.entries.length}`);
check(BOOK.entries.every((e) => letters.includes(e.letter)),
  'every entry belongs to a letter section');
check(!/<!--/.test(RAW), 'the structure note is stripped from the saved markdown');
check(BOOK.intro && !BOOK.intro.includes('####'), 'the intro is prose, not a swallowed heading');

// ── 2. looking things up ───────────────────────────────────────────────────
// The words somebody actually types when it has gone wrong.
for (const [q, expect] of [
  ['water filter', 'Water Filter'],
  ['snare', 'Animal Traps'],
  ['bow drill', 'Fire Making'],
  ['solar', 'Electricity'],
  ['tannin', 'Leather Tanning'],
  ['soap', 'Soap Making'],
]) {
  const hits = search(q);
  check(hits.some((e) => e.title.startsWith(expect)),
    `searching "${q}" finds ${expect}`, hits.slice(0, 3).map((e) => e.title).join(' | ') || 'nothing');
}
check(search('a').length === 0, 'a single letter is not a search — it would match everything');
check(search('zzzzzz').length === 0, 'a word that is not in the book returns nothing');

// ── 3. the offline copy ────────────────────────────────────────────────────
const doc = toDocument();

check(doc.startsWith('<!doctype html>'), 'the saved file is a whole document, not a fragment');
check(!/https?:\/\//i.test(doc), 'it reaches for NOTHING on a network',
  (doc.match(/https?:\/\/\S{0,40}/i) || ['none'])[0]);
check(!/<script/i.test(doc), 'it runs no script — a reference should not need to execute');
check(!/url\(/i.test(doc), 'its CSS loads no external asset');
check(!/<link/i.test(doc), 'it links no stylesheet');
check(/<meta name="viewport"/.test(doc), 'it is readable on a phone');
check(/prefers-color-scheme/.test(doc), 'it respects dark mode, for reading at night');
check(/@media print/.test(doc), 'and it prints, because paper needs no battery at all');

// THE ONE THAT MATTERS. Every entry, and every line of every entry, survives
// the trip from markdown to saved file.
const missingTitles = BOOK.entries.filter((e) => !doc.includes(`>${escapeHtml(e.title)}<`));
check(missingTitles.length === 0, 'every entry title is in the saved file',
  missingTitles.map((e) => e.title).join(', ') || `all ${BOOK.entries.length}`);

// Compared as TEXT, not as markup. The first version matched the markdown
// line against the raw HTML, so anything containing bold or italic failed —
// "See *Foraging*" becomes "See <em>Foraging</em>" and the contiguous
// substring is gone. 163 false failures, none of them a lost line.
const docText = doc
  .replace(/<style[\s\S]*?<\/style>/g, '')
  // Tags come out with NOTHING in their place, not a space: an inline <em>
  // sits flush against its punctuation, so " " turned "Wild Foods, Food" into
  // "Wild Foods , Food" and every line containing an italic looked lost. The
  // newlines blocks() already puts between blocks keep the words apart.
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

let missingLines = 0; let firstMiss = '';
for (const e of BOOK.entries) {
  for (const line of e.body.split('\n')) {
    const plain = line.trim()
      .replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')   // list markers become <li>
      .replace(/[*]/g, '')                                 // bold/italic become tags
      .replace(/\s+/g, ' ');
    if (plain.length < 25) continue;                       // fragments and headings
    if (docText.includes(plain)) continue;
    missingLines += 1;
    if (!firstMiss) firstMiss = `${e.title}: ${plain.slice(0, 60)}…`;
  }
}
check(missingLines === 0, 'and every line of every entry survives the trip',
  missingLines ? `${missingLines} lost, first: ${firstMiss}` : 'nothing lost');

check(doc.length > 30000, 'the saved file is the whole book, not a summary', `${(doc.length / 1024).toFixed(1)} KB`);
const openArticles = (doc.match(/<article>/g) || []).length;
const closeArticles = (doc.match(/<\/article>/g) || []).length;
check(openArticles === closeArticles && openArticles === BOOK.entries.length,
  'the markup is balanced and complete', `${openArticles} open / ${closeArticles} closed / ${BOOK.entries.length} entries`);

// ── 4. the renderer ────────────────────────────────────────────────────────
check(blocks('1. one\n2. two') === '<ol>\n<li>one</li>\n<li>two</li>\n</ol>', 'numbered steps become an ordered list');
check(blocks('- a\n- b') === '<ul>\n<li>a</li>\n<li>b</li>\n</ul>', 'dashes become a bulleted list');
check(blocks('**bold** and *thin*') === '<p><strong>bold</strong> and <em>thin</em></p>', 'bold and italic survive');
// The source is ours, but the renderer must still not be a hole.
check(blocks('<img src=x onerror=alert(1)>') === '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
  'raw HTML in the source is escaped, not executed', blocks('<img src=x>'));

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
