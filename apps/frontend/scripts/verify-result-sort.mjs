/* Ordering a page of Tube results.
 *
 * "Filter by date and popular" sounds like two lines of sort code. The hard
 * part is that neither signal is reliably present:
 *
 *   DATE — the search index supplies a publish date for some providers and not
 *   others. It used to supply one for ALL of them by stamping today's date on
 *   anything undated (see SearchService.calculateRecency), which would have
 *   made "Newest" a shuffle that looked authoritative.
 *
 *   POPULAR — there is no view count anywhere in a search result, and
 *   YouTube's own costs a quota unit per video against an allowance shared by
 *   the whole site. So Popular means Truegle's own anonymous play and vote
 *   counts, most rows have none, and "no signal" must not collapse into zero:
 *   ranking an untouched video below one with a single thumb is a strong claim
 *   built on one press.
 *
 * Run it:  npm run resultsort:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/resultsort-test.mjs';
mkdirSync('dev/.build', { recursive: true });
execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/utils/resultSort.js', '--bundle', '--format=esm', '--platform=node',
  '--define:import.meta.env={"DEV":false}', `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const { sortResults, datedCount, SORTS } = await import(`../${OUT}`);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const DAY = 86400000;
const ago = (d) => new Date(Date.now() - d * DAY).toISOString();

const rows = [
  { id: 'a', src: 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa', kind: 'youtube', published: ago(30) },
  { id: 'b', src: 'https://www.youtube-nocookie.com/embed/bbbbbbbbbbb', kind: 'youtube', published: ago(2) },
  { id: 'c', src: 'https://www.youtube-nocookie.com/embed/ccccccccccc', kind: 'youtube', published: null },
  { id: 'd', src: 'https://www.youtube-nocookie.com/embed/ddddddddddd', kind: 'youtube', published: ago(400) },
];
const ids = (list) => list.map((r) => r.id).join('');

// ── 1. relevant is the order it arrived in ──────────────────────────────────
// It is what the search already ranked, so it must cost nothing and change
// nothing. A "sort" that reorders the default is a bug with a label on it.
check(ids(sortResults(rows, 'relevant')) === 'abcd', 'relevant leaves the search order alone',
  ids(sortResults(rows, 'relevant')));
check(sortResults(rows, 'relevant') !== rows, '…without handing back the caller\'s own array');
check(ids(rows) === 'abcd', '…and without mutating it');

// ── 2. newest, with undated last ────────────────────────────────────────────
check(ids(sortResults(rows, 'newest')) === 'badc', 'newest first, undated last',
  ids(sortResults(rows, 'newest')));

// ── 3. popular: no signal is not zero ───────────────────────────────────────
// The whole trap. Most rows have never been played on Truegle, so if absence
// read as 0 the entire result set would sort beneath whichever row happened to
// collect one thumb — and the rest would lose their relevance order too.
const key = (r) => `youtube:${r.src.slice(-11)}`;
const scores = { [key(rows[2])]: 0.9, [key(rows[3])]: 0.4 };
const pop = sortResults(rows, 'popular', scores);
check(ids(pop) === 'cdab', 'scored rows lead, best first', ids(pop));
check(ids(pop.slice(2)) === 'ab',
  'and everything unscored keeps its relevance order behind them', ids(pop.slice(2)));

// A row scored ZERO is not the same as a row with no signal: somebody
// interacted with it, and it still outranks silence.
const withZero = sortResults(rows, 'popular', { [key(rows[3])]: 0 });
check(withZero[0].id === 'd', 'a real score of zero still beats no score at all', ids(withZero));

// No scores at all — the backend was unreachable, or nothing here is known.
// That is a worse sort, not an error, so it must be the relevance order.
check(ids(sortResults(rows, 'popular', {})) === 'abcd',
  'with nothing known, popular falls back to relevance rather than shuffling');

// ── 4. the guard on offering Newest at all ──────────────────────────────────
check(datedCount(rows) === 3, 'dated rows are counted honestly', String(datedCount(rows)));
check(datedCount([{ published: null }, { published: 'nonsense' }]) === 0,
  'an unparseable date is not a date', String(datedCount([{ published: 'nonsense' }])));
check(datedCount(null) === 0, 'and no rows is no dates');

// ── 5. the labels are the promise ───────────────────────────────────────────
check(SORTS.map((s) => s.id).join(',') === 'relevant,newest,popular',
  'three sorts, relevance first', SORTS.map((s) => s.id).join(','));

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
