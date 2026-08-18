/* When a result says WHEN it was published — and when it says nothing.
 *
 * REPORTED: "Add a date to the tube search results." The date was already
 * arriving; it just wasn't true. Every normaliser in SearchService stamped
 * `new Date().toISOString()` on results whose provider gave no publish date,
 * which on SearXNG is most of them — so carrying the field through to the UI
 * would have printed today's date over a video from 2019.
 *
 * Two consequences, both fixed together: the backend returns null now, and
 * everything here treats null as null. The second half is the suspicious-value
 * guard — a timestamp in the future or from before the web is a parsing
 * accident, and rendering it confidently just moves the lie up a layer.
 *
 * Run it:  npm run published:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/published-test.mjs';
mkdirSync('dev/.build', { recursive: true });
execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/utils/published.js', '--bundle', '--format=esm', '--platform=node',
  `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const { publishedAt, publishedLabel, byNewest } = await import(`../${OUT}`);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const DAY = 86400000;

// ── 1. no date is not a date ────────────────────────────────────────────────
// The whole reason this file exists. Every one of these has to come back null
// rather than being quietly rendered as "just now".
for (const empty of [null, undefined, '', 0, 'not a date', NaN, {}]) {
  check(publishedAt(empty) === null && publishedLabel(empty) === null,
    `${JSON.stringify(empty) ?? String(empty)} is not a publish date`,
    String(publishedLabel(empty)));
}

// ── 2. a date that cannot be true is not shown ──────────────────────────────
check(publishedLabel(new Date(Date.now() + 7 * DAY).toISOString()) === null,
  'a video published next week is a parsing accident, not a scoop');
check(publishedLabel('1970-01-01T00:00:00Z') === null,
  'the unix epoch is not a publish date');
check(publishedLabel('1993-06-01T00:00:00Z') === null,
  'nor is anything from before the web');
// Clock skew between us and a provider is ordinary; a minute of slack absorbs it.
check(publishedLabel(new Date(Date.now() + 20000).toISOString()) !== null,
  'twenty seconds of clock skew is tolerated, not rejected');

// ── 3. relative while that reads, absolute once it does not ─────────────────
check(publishedLabel(ago(90000)) === '2 mins ago', 'minutes', publishedLabel(ago(90000)));
check(publishedLabel(ago(2 * 3600000)) === '2 hours ago', 'hours', publishedLabel(ago(2 * 3600000)));
check(publishedLabel(ago(1.2 * DAY)) === 'yesterday', 'yesterday', publishedLabel(ago(1.2 * DAY)));
check(publishedLabel(ago(3 * DAY)) === '3 days ago', 'days', publishedLabel(ago(3 * DAY)));
// Nobody benefits from "847 days ago".
const old = publishedLabel(ago(800 * DAY));
check(/\d{4}/.test(old || ''), 'anything over a year gets a month and a year', old);
const mid = publishedLabel(ago(60 * DAY));
check(!!mid && !/ago/.test(mid) && !/\d{4}/.test(mid),
  'and a couple of months gets a month and a day', mid);

// ── 4. sorting puts unknown last, not first and not oldest ──────────────────
// `new Date(null)` is 1970, so a naive comparator files every undated row
// under "ancient" — which is a different claim from "we don't know".
const rows = [
  { id: 'undated', published: null },
  { id: 'old', published: ago(400 * DAY) },
  { id: 'new', published: ago(DAY) },
];
const order = [...rows].sort(byNewest).map((r) => r.id);
check(JSON.stringify(order) === JSON.stringify(['new', 'old', 'undated']),
  'newest first, undated last', order.join(' → '));
const reversed = [...rows].reverse().sort(byNewest).map((r) => r.id);
check(JSON.stringify(reversed) === JSON.stringify(['new', 'old', 'undated']),
  '…whatever order they arrived in', reversed.join(' → '));

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
