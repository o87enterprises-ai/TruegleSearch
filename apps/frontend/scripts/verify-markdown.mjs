/* Rendering an AI answer.
 *
 * REPORTED: an answer containing a markdown table arrived on screen as one
 * flat run of pipes —
 *
 *     | Method | Details | |--------|---------| | Search directly | Google …
 *
 * That is not the model getting it wrong. TABLES ARE NOT PART OF COMMONMARK;
 * they are a GitHub-Flavored Markdown extension. react-markdown on its own
 * implements CommonMark, so the table source was parsed as an ordinary
 * paragraph — and a paragraph folds its single newlines into spaces, which is
 * exactly the flat line that was reported.
 *
 * These render the real component (via react-dom/server, no browser needed)
 * and assert on the HTML it produces, because the bug lived entirely in which
 * plugins the parser was given.
 *
 * Run it:  npm run markdown:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/markdown-test.mjs';
mkdirSync('dev/.build', { recursive: true });

execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/components/ui/Markdown.jsx',
  '--bundle', '--format=esm', '--platform=node',
  '--external:react', '--external:react-dom',
  `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const { default: Markdown } = await import(`../${OUT}`);
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const html = (src) => renderToStaticMarkup(React.createElement(Markdown, null, src));

// ── 1. the reported failure ─────────────────────────────────────────────────
// The table from the "taxi cottage grove oregon" answer, trimmed to two rows.
const TABLE = `| Method | Details |
|--------|---------|
| Rideshare apps | Coverage in small towns can be limited |
| Hotel front desk | Usually has a reliable local number |`;

const table = html(TABLE);
check(table.includes('<table'), 'a markdown table renders as a table', table.slice(0, 90));
check((table.match(/<tr/g) || []).length === 3, '…with a header row and both body rows',
  `${(table.match(/<tr/g) || []).length} rows`);
check(table.includes('<th') && table.includes('Method'), '…and real header cells');
check(!table.includes('|--------|'), '…with the pipe syntax consumed, not printed');

// The old behaviour, stated as the thing that must not come back: one
// paragraph containing the raw pipes.
check(!/<p>[^<]*\|[^<]*\|[^<]*\|/.test(table),
  'the table is never flattened into a paragraph of pipes');

// ── 2. tables scroll instead of pushing the page sideways ───────────────────
// A five-column comparison must not force horizontal scroll on a phone.
check(/overflow-x-auto[^>]*>\s*<table|<div[^>]*overflow-x-auto/.test(table),
  'a wide table scrolls inside its own box');

// ── 3. links are safe and leave the tab alone ───────────────────────────────
const link = html('See [the transit page](https://example.gov/transit).');
check(link.includes('target="_blank"'), 'a link opens in a new tab');
check(/rel="[^"]*noopener/.test(link) && /rel="[^"]*noreferrer/.test(link),
  '…and cannot reach back into the tab that opened it', link.slice(0, 120));

// ── 4. bare URLs autolink without the hand-rolled workaround ────────────────
// TruegleChat used to wrap bare URLs in <…> by hand precisely because
// CommonMark does not autolink them. gfm's autolink-literal does, which is why
// that function could be deleted — so this is what proves the deletion safe.
const bare = html('Read more at https://truegle.info/about today.');
check(bare.includes('href="https://truegle.info/about"'),
  'a bare URL becomes a link with no pre-processing', bare.slice(0, 120));
check(bare.includes('target="_blank"'), '…and it is a safe one too');

// ── 5. ordinary markdown still works ────────────────────────────────────────
const basic = html('## Heading\n\n- one\n- two\n\n**bold** and `code`.');
check(basic.includes('<h2>') && basic.includes('<li>') && basic.includes('<strong>') && basic.includes('<code>'),
  'headings, lists, bold and code are untouched');

// ── 6. nothing to render is not a crash ─────────────────────────────────────
let empty = 'threw';
try { empty = html(''); } catch (e) { empty = `threw: ${e.message}`; }
check(typeof empty === 'string' && !empty.startsWith('threw'), 'an empty answer renders nothing, quietly', empty);

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
