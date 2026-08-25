/* Text selection: chrome opts out, prose opts back in.
 *
 * WHY THIS NEEDS A BROWSER, and why it needs to exist at all. CSS never
 * errors. A selector that loses a specificity fight is not a warning, not a
 * build failure and not a lint finding — it is a rule that silently does
 * nothing, and the page looks completely normal until somebody tries to select
 * something and cannot. There is no way to catch that by reading, which is
 * exactly how it shipped: the rule was written as
 *
 *     [data-player-root] *  { user-select: none }   ← (0,1,0)
 *     input                 { user-select: text }   ← (0,0,1)
 *
 * with a comment claiming the second won "because it comes last". Source order
 * only breaks ties at EQUAL specificity, so the blanket rule won and every
 * input inside the player — including the voice panel's own dictation box, the
 * one people need to correct a misheard word in — became unselectable.
 *
 * It looked PARTIALLY right, which is what made it convincing: `.truegle-
 * selectable` is also (0,1,0), so prose inside the player kept working while
 * bare `input` did not.
 *
 * The fix is :where(), which scores nothing, so every opt-in wins whatever it
 * is written as. This file pins the outcome rather than the mechanism: if
 * somebody "tidies" the :where() away, these assertions go red instead of the
 * bug going quietly back in.
 *
 * Run it:  npm run noselect:test
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launchChromium } from './lib/browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const css = await readFile(join(here, '../src/styles/no-select.css'), 'utf8');

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const browser = await launchChromium();
const page = await (await browser.newContext()).newPage();

await page.setContent(`<style>${css}</style>
  <div data-player-root>
    <input id="playerInput" value="a dictated query">
    <textarea id="playerTextarea">notes</textarea>
    <p class="truegle-selectable" id="playerProse">a title worth copying</p>
    <button id="playerButton"><span id="playerButtonLabel">Play</span></button>
    <div id="playerChrome">transport</div>
  </div>
  <div data-reel-root>
    <input id="reelInput" value="x">
    <button id="reelButton">Like</button>
  </div>
  <input id="freeInput" value="free">
  <p id="freeProse">an ordinary search snippet</p>
  <button id="freeButton"><span id="freeButtonLabel">Search</span></button>
  <a id="freeLink" href="#">a result title</a>`);

const style = (id, prop = 'userSelect') => page.evaluate(
  ([i, p]) => getComputedStyle(document.getElementById(i))[p],
  [id, prop],
);

// ── The regression itself ──────────────────────────────────────────────────
ok('an input INSIDE the player is selectable',
  await style('playerInput') === 'text', await style('playerInput'));
ok('…so is a textarea inside it',
  await style('playerTextarea') === 'text', await style('playerTextarea'));
ok('an input inside a REEL is selectable',
  await style('reelInput') === 'text', await style('reelInput'));

// ── The thing the blanket rule is for ──────────────────────────────────────
ok('a button inside the player is NOT selectable',
  await style('playerButton') === 'none', await style('playerButton'));
ok('…and neither is its label, since user-select inherits',
  await style('playerButtonLabel') === 'none', await style('playerButtonLabel'));
ok('ordinary chrome inside the player is not selectable',
  await style('playerChrome') === 'none', await style('playerChrome'));
ok('a reel button is not selectable',
  await style('reelButton') === 'none', await style('reelButton'));

// ── Opt-in prose, inside and out ───────────────────────────────────────────
ok('.truegle-selectable works INSIDE the player',
  await style('playerProse') === 'text', await style('playerProse'));
ok('a free input is selectable',
  await style('freeInput') === 'text', await style('freeInput'));
ok('ordinary prose outside the player keeps its default',
  await style('freeProse') !== 'none', await style('freeProse'));

// ── The three reported bugs, as behaviour ──────────────────────────────────
ok('a plain button anywhere is not selectable (rapid taps cannot highlight it)',
  await style('freeButton') === 'none', await style('freeButton'));
ok('…including its text, which is what was being highlighted',
  await style('freeButtonLabel') === 'none', await style('freeButtonLabel'));

// A STANDALONE LINK STAYS SELECTABLE, deliberately. `a` is in the
// tap-highlight rule but NOT the no-select list, because a search result's
// TITLE is a link and copying a title is a thing people legitimately do.
// Links that are chrome — the nav drawer, the brand bar — are covered by
// `nav` and inherit none from it, which is the distinction that matters:
// navigation is a control, a result title is content.
ok('a standalone content link stays selectable, so titles can be copied',
  await style('freeLink') !== 'none', await style('freeLink'));

// -webkit-touch-callout is asserted against the STYLESHEET, not the computed
// style. It is the half of the pill-hold fix that actually matters on a phone
// — Android pops the callout independently of user-select and that is what ate
// the 2.2s hold — but desktop Chromium does not implement the property at all,
// so getComputedStyle returns undefined here no matter what the CSS says.
// Checking the rule text is the only thing this environment can honestly
// verify; the behaviour itself needs a real handset.
const calloutOffOnChrome = /button,[\s\S]*?-webkit-touch-callout:\s*none/.test(css);
const calloutOnForInputs = /input,[\s\S]*?-webkit-touch-callout:\s*default/.test(css);
ok('the long-press callout is suppressed on chrome (Android ate the pill hold)',
  calloutOffOnChrome, calloutOffOnChrome ? 'declared' : 'MISSING');
ok('…and re-enabled on inputs, so the platform text handles still work',
  calloutOnForInputs, calloutOnForInputs ? 'declared' : 'MISSING');

// ── The mechanism, pinned directly ─────────────────────────────────────────
// Belt and braces: the assertions above would also pass if someone replaced
// :where() with a correct-but-different fix, which is fine. This one catches
// the specific "tidy-up" that reintroduces the bug.
// The detail deliberately re-runs the SAME regex rather than a looser
// `includes(':where(')` — that looser check matches the explanatory comment
// above the rule, so a real failure reported "present" and read like the test
// itself was broken. A misleading failure message costs more than no message.
const whereIntact = /:where\(\s*\[data-player-root\]/.test(css);
ok('the subtree rule is still specificity-zero (:where)',
  whereIntact,
  whereIntact ? 'present' : 'MISSING — inputs inside the player will silently stop being selectable');

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
