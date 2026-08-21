/* Running the player with the controls locked and the screen apparently off.
 *
 * ASKED FOR: "user makes selection, full screen, locks screen, turns brightness
 * to 0 as if the screen was off visibly to the user but the full functions are
 * still available for expert users." Plus a gesture set: double tap to
 * play/pause, double-tap-and-hold left and right for back and skip, the middle
 * for voice, press-hold-slide for the dimmer, and shake to shuffle.
 *
 * WHY THIS IS TESTED AND NOT EYEBALLED. These run under a LOCK, whose entire
 * purpose is to ignore what a pocket does — so the interesting cases are all
 * the ones that must NOT fire. A gesture set that is 90% right is a lock that
 * skips your track in your pocket, which is worse than no lock.
 *
 * The one genuine ambiguity in the set is two kinds of hold, told apart by what
 * came before them. That is what most of this exercises.
 *
 * Run it:  npm run lockedgestures:test
 */
import { useLockedGestures, zoneOf } from '../src/hooks/useLockedGestures.js';
import { __reset, __setRender, __begin } from './stubs/react.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// Fake clock, so 420ms holds cost nothing.
let now = 1_000_000;
const timers = new Map();
let nextId = 1;
globalThis.setTimeout = (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => timers.delete(id);
const realNow = Date.now;
Date.now = () => now;
const tick = (ms) => {
  const until = now + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at);
    if (!due.length) break;
    const [id, t] = due[0];
    timers.delete(id); now = t.at; t.fn();
  }
  now = until;
};

const BOX = { left: 0, top: 0, width: 300, height: 600 };
const at = (x, y = 300) => ({
  clientX: x, clientY: y, currentTarget: { getBoundingClientRect: () => BOX },
});

let fired = [];
let api = null;
const opts = () => ({
  enabled: true,
  onTogglePause: () => fired.push('pause'),
  onNext: () => fired.push('next'),
  onPrev: () => fired.push('prev'),
  onVoice: () => fired.push('voice'),
  onShuffle: () => fired.push('shuffle'),
});
const rerender = () => { __begin(); api = useLockedGestures(opts()); };
__setRender(() => rerender());
const mount = () => { __reset(); fired = []; rerender(); };

const down = (x, y) => api.handlers.onPointerDown(at(x, y));
const move = (x, y) => api.handlers.onPointerMove(at(x, y));
const up = () => api.handlers.onPointerUp();
const tap = (x = 150, y = 300) => { down(x, y); tick(60); up(); };

// ── zones ───────────────────────────────────────────────────────────────────
check(zoneOf(10, 300) === 'left' && zoneOf(150, 300) === 'middle' && zoneOf(290, 300) === 'right',
  'the screen is read in thirds');
check(zoneOf(50, 0) === 'middle', 'a box with no width does not throw a zone');

// ── what a pocket does must do nothing ──────────────────────────────────────
mount();
tap(); tick(500);
check(fired.length === 0, 'ONE tap does nothing at all — that is what a pocket produces',
  fired.join(','));

mount();
down(150, 300); tick(900); up(); tick(500);
check(!fired.includes('pause') && !fired.includes('next') && !fired.includes('prev'),
  'a long lean against the screen fires no command', fired.join(',') || 'none');

mount();
tap(); tick(600); tap(); tick(400);
check(fired.length === 0, 'two taps too far apart are two single taps, not a double',
  fired.join(','));

// ── double tap plays and pauses ─────────────────────────────────────────────
mount();
tap(); tick(80); tap(); tick(50);
check(fired.join(',') === 'pause', 'two quick taps toggle play', fired.join(',') || 'nothing');

// ── double tap then hold, by zone ───────────────────────────────────────────
for (const [x, want] of [[10, 'prev'], [150, 'voice'], [290, 'next']]) {
  mount();
  tap(); tick(80);
  down(x, 300); tick(500);
  check(fired.join(',') === want, `two taps then a hold on the ${zoneOf(x, 300)} gives ${want}`,
    fired.join(',') || 'nothing');
  up();
  // The command must not ALSO register as the second half of a double tap.
  tick(50);
  check(!fired.includes('pause'), `…and does not also toggle play`, fired.join(','));
}

// ── the dimmer ──────────────────────────────────────────────────────────────
mount();
check(api.dim === 0, 'the screen starts undimmed');
down(150, 300); tick(500);           // hold with no tap before it = dimmer
check(api.sliding, 'a hold with no tap before it arms the dimmer');
move(150, 410);                      // downwards
check(api.dim > 0.4 && api.dim < 0.6, 'sliding down dims', String(api.dim));
move(150, 520);
check(api.dim === 1, 'far enough down is fully dark', String(api.dim));
move(150, 300);
check(api.dim === 0, 'and sliding back up returns the screen', String(api.dim));
up();
check(!api.sliding, 'letting go ends the slide');
check(!fired.includes('pause'), 'a dim slide never counts as a tap', fired.join(',') || 'none');

// ── a dim never outlives the lock ───────────────────────────────────────────
// A black sheet with no gesture left to undo it would be a dead screen.
__reset(); __begin();
let unlocked = useLockedGestures({ ...opts(), enabled: false });
check(unlocked.dim === 0, 'unlocking clears the dim');

// ── nothing fires while unlocked ────────────────────────────────────────────
fired = [];
unlocked.handlers.onPointerDown(at(290, 300));
tick(600);
unlocked.handlers.onPointerUp();
check(fired.length === 0, 'the gestures are inert when the player is not locked', fired.join(','));

Date.now = realNow;
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
