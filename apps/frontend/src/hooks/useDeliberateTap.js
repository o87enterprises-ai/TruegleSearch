import { useMemo, useRef } from 'react';

// A TAP, NOT A TOUCH. A finger resting on the screen, brushing past a button
// on the way to scrolling, or a palm landing on the phone all produce a
// `click` on whatever was under them — and on the player that click paused
// the video. This only lets the action through when the press was a real
// tap: down and up on the same control, barely moving, and released quickly.
// A keyboard press (Enter/Space on a focused button) is always deliberate and
// always goes through.
export function useDeliberateTap(action, { maxMs = 600, maxMove = 10 } = {}) {
  const start = useRef(null);
  const armed = useRef(false);
  const actionRef = useRef(action);
  actionRef.current = action;
  return useMemo(() => ({
    onPointerDown: (e) => {
      if (e.button > 0) return;
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      armed.current = false;
    },
    onPointerUp: (e) => {
      const s = start.current;
      start.current = null;
      armed.current = !!s
        && Date.now() - s.t <= maxMs
        && Math.hypot(e.clientX - s.x, e.clientY - s.y) <= maxMove;
    },
    onPointerCancel: () => { start.current = null; armed.current = false; },
    onClick: (e) => {
      // A keyboard click carries no pointer type (and detail 0); a click that
      // came from a finger or mouse must have been armed by a clean press on
      // THIS control — a press that began elsewhere (say, the tap that just
      // revealed the on-screen controls) never counts.
      const keyboard = e.detail === 0 && !e.nativeEvent?.pointerType;
      const fire = keyboard || armed.current;
      armed.current = false;
      if (fire) actionRef.current?.(e);
    },
  }), [maxMs, maxMove]);
}
