/* When the controls over the picture appear, and — mostly — when they do NOT.
 *
 * The brief is unusually precise about the negative case:
 *
 *   "These buttons disappear with no overlay tap or motion on mouse for 5
 *    seconds. If repeat quick tap / click is detected, overlay doesn't fire
 *    fully. If tap / hold is detected, overlay fires (non persistent and non
 *    intrusive, deliberate touch allows for use otherwise is null)"
 *
 * The picture already answers quick presses — one click pauses, two seek — so
 * an overlay that also appeared on those would arrive on top of the video every
 * single time somebody paused. Only a deliberate hold summons it.
 *
 * The hook is pure timers and pointer maths, so this runs in node with a fake
 * clock rather than a browser: real 400ms and 5s waits would make the suite
 * take a minute to say very little.
 *
 * Run it:  npm run overlayreveal:test
 */
import { useOverlayReveal } from '../src/hooks/useOverlayReveal.js';
import { __reset, __setRender, __begin } from './stubs/react.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// A fake clock, so 5-second rules cost no seconds.
let now = 0;
const timers = new Map();
let nextId = 1;
globalThis.setTimeout = (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + (ms || 0) }); return id; };
globalThis.clearTimeout = (id) => timers.delete(id);
const tick = (ms) => {
  const until = now + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at);
    if (!due.length) break;
    const [id, t] = due[0];
    timers.delete(id);
    now = t.at;
    t.fn();
  }
  now = until;
};

let api = null;
const rerender = () => { __begin(); api = useOverlayReveal({ enabled: true }); };
__setRender(() => rerender());
const mount = () => { __reset(); rerender(); };
const press = (x = 0, y = 0, pointerType = 'touch') => api.handlers.onPointerDown({ clientX: x, clientY: y, pointerType });
const move = (x, y, pointerType = 'touch') => api.handlers.onPointerMove({ clientX: x, clientY: y, pointerType });
const release = () => api.handlers.onPointerUp();

// ── a quick tap must NOT summon it ──────────────────────────────────────────
mount();
check(!api.visible, 'nothing is showing to begin with');
press(); tick(120); release(); tick(50);
check(!api.visible, 'a quick tap does not summon the overlay — a tap already means pause');

// Repeated quick taps — a double-click seek — must stay quiet too.
for (let i = 0; i < 4; i += 1) { press(); tick(80); release(); tick(60); }
check(!api.visible, 'repeated quick taps still do not summon it');

// ── a hold does ─────────────────────────────────────────────────────────────
press(); tick(450);
check(api.visible, 'holding for four hundred milliseconds summons it');
check(api.wasHeld(), '…and the click that ends the hold can be told from a tap');
release();

// ── it leaves on its own ────────────────────────────────────────────────────
tick(4000);
check(api.visible, '…and is still there four seconds later');
tick(1200);
check(!api.visible, '…but gone by five — non-persistent, as asked');

// ── a hold that turns into a drag is not a hold ─────────────────────────────
mount();
press(100, 100); move(140, 100); tick(600);
check(!api.visible, 'a press that wanders is a drag, not a summon');

// ── a mouse moving reveals; a finger scrolling does not ─────────────────────
mount();
move(10, 10, 'mouse');
check(api.visible, 'moving a mouse reveals the controls, as on any desktop player');
tick(5200);
check(!api.visible, '…and they time out from that too');

mount();
move(10, 10, 'touch'); move(10, 80, 'touch');
check(!api.visible, 'a finger dragging past the player reveals nothing');

// ── switched off ────────────────────────────────────────────────────────────
__reset(); __begin();
const off = useOverlayReveal({ enabled: false });
off.handlers.onPointerDown({ clientX: 0, clientY: 0, pointerType: 'touch' });
tick(600);
check(!off.visible, 'a locked player summons nothing at all');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
