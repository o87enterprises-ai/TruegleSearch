import { useEffect, useRef } from 'react';

// WHEN DID THE PERSON LAST DO SOMETHING? A ref, not state: it changes on every
// keystroke and nothing should re-render for it — callers read it when they
// are about to do something the person might not want mid-gesture (switch
// page, close a panel), and `isIdle(ms)` answers.
//
// Deliberately NOT mouse movement: a cursor resting on the page, or drifting
// across it, is not someone in the middle of a thought. A key, a press, a
// touch, a wheel/scroll or an IME composition is.
//
// Owner, 2026-10-01: "when the timer runs out I want the page switch to stand
// by until the user's input is idle. I typed a long query and it switched
// before I was finished and I had to start all over."
export const IDLE_MS = 2000;

const EVENTS = ['keydown', 'input', 'compositionupdate', 'pointerdown', 'touchstart', 'wheel', 'scroll'];

export function useRecentActivity() {
  const last = useRef(0);
  useEffect(() => {
    const mark = () => { last.current = Date.now(); };
    // Capture + passive: scroll does not bubble, and none of this may ever
    // delay the gesture it is only watching.
    EVENTS.forEach((e) => window.addEventListener(e, mark, { capture: true, passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, mark, { capture: true }));
  }, []);
  return {
    /** Date.now() of the last activity, or 0 if there has been none. */
    lastAt: () => last.current,
    /** True when nothing has happened for at least `ms`. */
    isIdle: (ms = IDLE_MS) => Date.now() - last.current >= ms,
  };
}

export default useRecentActivity;
