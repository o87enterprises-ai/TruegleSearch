/* Full-screen swipe/tap sensitivity (useSwipeNav).
 *
 * Reported: "touch sensitivity on the player is too high, causing accidental
 * pauses and track changes." These pin the tuned-down thresholds: short or
 * slow or diagonal drags, and two-finger touches, do nothing.
 *
 * Run it:  npm run swipenav:test
 */
import { useSwipeNav } from '../src/hooks/useSwipeNav.js';
import { __reset, __begin } from './stubs/react.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

globalThis.document = { addEventListener() {}, removeEventListener() {} };
let now = 1_000_000;
Date.now = () => now;

function harness() {
  __reset(); __begin();
  const log = [];
  const h = useSwipeNav({
    active: true,
    onNext: () => log.push('next'),
    onPrev: () => log.push('prev'),
    onTap: () => log.push('tap'),
  });
  const touch = (x, y) => ({ clientX: x, clientY: y });
  const gesture = ({ from, to, ms, fingers = 1 }) => {
    h.onTouchStart({ touches: Array.from({ length: fingers }, () => touch(...from)) });
    now += ms;
    h.onTouchEnd({ changedTouches: [touch(...to)], currentTarget: null });
  };
  return { log, gesture };
}

let t = harness();
t.gesture({ from: [200, 500], to: [200, 360], ms: 200 });
check(t.log.join() === 'next', 'a clear, quick upward flick goes to the next track', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [200, 430], ms: 150 });
check(t.log.length === 0, 'a short 70px drag no longer changes track', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [200, 340], ms: 1500 });
check(t.log.length === 0, 'a slow drag is not a flick', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [300, 360], ms: 200 });
check(t.log.length === 0, 'a diagonal drag is not a swipe', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [200, 360], ms: 200, fingers: 2 });
check(t.log.length === 0, 'two fingers never swipe or tap', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [203, 502], ms: 120 });
check(t.log.join() === 'tap', 'a short still touch is a tap (full screen: pause)', t.log.join());

t = harness();
t.gesture({ from: [200, 500], to: [202, 501], ms: 400 });
check(t.log.length === 0, 'a resting thumb is not a tap', t.log.join());

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
