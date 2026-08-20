/* Inline completion, and the rules about when NOT to offer one.
 *
 * REPORTED: "I've had to fully type in the same query too many times… if the
 * history is still stored when a user types a duplicate query, they should only
 * have to type a few letters."
 *
 * The interesting cases are all refusals. A completion is an assertion about
 * what somebody meant, and the ways it can be wrong — completing from the
 * middle of a phrase, completing something they are deleting, completing from
 * trending topics they have never searched — are each worse than not offering
 * one at all.
 *
 * Run it:  npm run autocomplete:test
 */
import { completeFrom } from '../src/utils/autocomplete.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const history = [
  'how do tides work',
  'how to search privately',
  'monoatomic gold',
  'Caterpillar dump truck',
];

// ── the point of the feature ────────────────────────────────────────────────
let r = completeFrom(history, 'how do');
check(r?.match === 'how do tides work', 'a few letters finds the whole query', r?.match);
check(r?.completion === ' tides work', '…and offers only the part not yet typed', JSON.stringify(r?.completion));
check('how do' + r.completion === r.match, '…which joins back to exactly the match');

// Newest first wins when several could match — the list is already in that
// order, so the most recent thing you searched is the one offered.
check(completeFrom(history, 'how ')?.match === 'how do tides work',
  'the most recent match wins', completeFrom(history, 'how ')?.match);

// ── case ────────────────────────────────────────────────────────────────────
// The typed part is echoed from the ENTRY, not the input, or a case difference
// renders the letters twice: "caterCaterpillar dump truck".
r = completeFrom(history, 'cater');
check(r?.completion === 'pillar dump truck', 'a case mismatch still completes cleanly',
  JSON.stringify(r?.completion));
check('cater'.length + r.completion.length === r.match.length,
  '…without duplicating the letters already typed');

// ── the refusals ────────────────────────────────────────────────────────────
check(completeFrom(history, 'tides') === null,
  'no completion from the MIDDLE of a phrase — that would rewrite the front of it');
check(completeFrom(history, 'h') === null, 'one letter is not enough to guess from');
check(completeFrom(history, '') === null, 'an empty box offers nothing');
check(completeFrom(history, '   ') === null, 'nor does whitespace');
check(completeFrom(history, 'how do tides work') === null,
  'a fully typed query has nothing left to complete');
check(completeFrom(history, 'how do tides work extra') === null,
  'and neither does one that has gone past it');
check(completeFrom([], 'how do') === null, 'an empty history offers nothing');
check(completeFrom(history, 'zzz') === null, 'a query matching nothing offers nothing');

// Trailing space is meaningful — you are starting the next word — so it is kept
// and still matches. A LEADING space is not, and is trimmed.
check(completeFrom(history, 'how do ')?.completion === 'tides work',
  'a trailing space is part of what has been typed',
  JSON.stringify(completeFrom(history, 'how do ')?.completion));
check(completeFrom(history, '  how do')?.match === 'how do tides work',
  'a leading space is not');

// ── junk in ─────────────────────────────────────────────────────────────────
check(completeFrom(null, 'how') === null, 'a missing history is not a crash');
check(completeFrom(history, null) === null, 'nor is a missing value');
check(completeFrom([null, undefined, 42, 'how do tides work'], 'how do')?.match === 'how do tides work',
  'non-strings in storage are stepped over rather than thrown on');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
