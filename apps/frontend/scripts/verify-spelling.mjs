/* Spelling mode: spoken letters into a typed query.
 *
 * The point of testing this without a microphone is that the hard part is not
 * the microphone. A recogniser does not return letters — asked for "b" it
 * returns "be", for "c" it returns "see", for "u" it returns "you" — because it
 * is a language model returning the most likely English words for those sounds.
 * Every one of those is a fixture here, because getting them wrong is what
 * makes hands-free search useless in exactly the situation it exists for.
 *
 * Run it:  npm run spelling:test
 */
import { compileSpelling, compileDictation, modeTrigger } from '../src/utils/spellingMode.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};
const spell = (t, existing = '') => compileSpelling(t, existing);

// ── The whole point: sounds, not letters ───────────────────────────────────
ok('"be see dee" spells bcd', spell('be see dee').text === 'bcd', spell('be see dee').text);
ok('"you are el" spells url', spell('you are el').text === 'url', spell('you are el').text);
ok('"eye see you" spells icu', spell('eye see you').text === 'icu', spell('eye see you').text);
ok('"double you tee eff" spells wtf', spell('double you tee eff').text === 'wtf', spell('double you tee eff').text);
ok('bare letters still work', spell('a b c').text === 'abc', spell('a b c').text);
ok('NATO words work for anyone who knows them',
  spell('alpha bravo charlie').text === 'abc', spell('alpha bravo charlie').text);

// ── A real query, spelled ──────────────────────────────────────────────────
const lefty = spell('el e ef tee why space gee you en pee el a why');
ok('"lefty gunplay" can be spelled out', lefty.text === 'lefty gunplay', lefty.text);

// ── Punctuation ────────────────────────────────────────────────────────────
ok('space', spell('a space b').text === 'a b', spell('a space b').text);
ok('period', spell('a period b').text === 'a.b', spell('a period b').text);
ok('comma', spell('a comma b').text === 'a,b', spell('a comma b').text);
ok('"question mark" beats "question"',
  spell('a question mark').text === 'a?', spell('a question mark').text);
ok('"full stop" is one phrase, not "full" + "stop"',
  spell('a full stop').text === 'a.' && spell('a full stop').action === null,
  `${spell('a full stop').text} / ${spell('a full stop').action}`);
ok('at and dot, for a handle', spell('at dot').text === '@.', spell('at dot').text);
ok('dash', spell('a dash b').text === 'a-b', spell('a dash b').text);

// ── The recogniser's own punctuation is noise ──────────────────────────────
ok('trailing punctuation from the recogniser is stripped, not typed',
  spell('be, see. dee!').text === 'bcd', spell('be, see. dee!').text);

// ── Digits ─────────────────────────────────────────────────────────────────
ok('digits spell', spell('one two three').text === '123', spell('one two three').text);
ok('"oh" is the LETTER o when spelling, not a zero',
  spell('oh').text === 'o', spell('oh').text);

// ── Editing, hands-free ────────────────────────────────────────────────────
ok('delete removes one character', spell('delete', 'abc').text === 'ab', spell('delete', 'abc').text);
ok('clear empties it', spell('clear', 'abc').text === '', `"${spell('clear', 'abc').text}"`);
ok('delete on empty text does not throw or go negative',
  spell('delete', '').text === '', `"${spell('delete', '').text}"`);
ok('search submits', spell('search', 'abc').action === 'submit', spell('search', 'abc').action);
ok('…and keeps the text it is submitting', spell('search', 'abc').text === 'abc');
ok('cancel is distinct from stop',
  spell('cancel').action === 'cancel' && spell('stop').action === 'stop');

// ── Existing text is appended to, not replaced ─────────────────────────────
ok('spelling continues an existing query',
  spell('dee', 'abc').text === 'abcd', spell('dee', 'abc').text);

// ── The give-up case ───────────────────────────────────────────────────────
// Someone starts spelling and then just says the word. Dropping it silently is
// how a voice UI earns its reputation, so it is taken literally instead.
ok('an unrecognised word is typed rather than dropped',
  spell('gunplay').text === 'gunplay', spell('gunplay').text);

// ── Plain dictation ────────────────────────────────────────────────────────
ok('dictation takes the whole phrase',
  compileDictation('lefty gunplay blue print').text === 'lefty gunplay blue print');
ok('dictation appends with one space, never two',
  compileDictation('blue print', 'lefty ').text === 'lefty blue print',
  compileDictation('blue print', 'lefty ').text);
ok('dictation still honours the control words',
  compileDictation('search', 'abc').action === 'submit');
ok('an empty transcript changes nothing',
  compileDictation('', 'abc').text === 'abc' && spell('', 'abc').text === 'abc');

// ── The spelling trigger itself ────────────────────────────────────────────
ok('"spelling" turns it on', modeTrigger('spelling') === 'spell');
ok('"spelling mode" too', modeTrigger('Spelling mode.') === 'spell');
ok('"stop spelling" turns it off', modeTrigger('stop spelling') === 'dictate');
ok('an ordinary phrase is not a trigger', modeTrigger('spelling bee champion') === null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
