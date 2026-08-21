import { useCallback, useEffect, useRef, useState } from 'react';

// When the controls over the picture are visible.
//
// THE RULE THAT MAKES THIS AWKWARD, and the reason it is its own hook: the
// picture already answers quick presses. A single click pauses, a double click
// seeks ten seconds. If the overlay also appeared on those, then every pause
// would be followed by a rail of buttons nobody asked for, sitting on top of
// the thing they were trying to watch.
//
// So a tap does NOT summon it. A DELIBERATE press does:
//
//   press and hold (≥ HOLD_MS)  → show. Holding still is unambiguous — nothing
//                                 else on the surface is waiting on it, and
//                                 nobody holds a finger down by accident.
//   pointer movement (a mouse)  → show. This is what every desktop video player
//                                 does and what a mouse user expects; there is
//                                 no hold gesture on a pointing device that is
//                                 already hovering.
//   nothing for HIDE_MS         → hide again.
//
// "Non-persistent and non-intrusive": it goes away on its own, and it never
// arrives because of a press that meant something else.
const HOLD_MS = 400;
const HIDE_MS = 5000;
// A hold that WANDERS is a drag, not a press — resizing the window, scrolling
// the page. Past this many pixels the hold is abandoned.
const SLOP_PX = 10;

export function useOverlayReveal({ enabled = true, holdMs = HOLD_MS, hideMs = HIDE_MS } = {}) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);
  const holdTimer = useRef(null);
  const holdFrom = useRef(null);
  // Set when a hold actually fired, so the click that follows a long press can
  // be told apart from a real tap by whoever is handling clicks.
  const heldRef = useRef(false);

  const clear = () => { clearTimeout(hideTimer.current); clearTimeout(holdTimer.current); };
  useEffect(() => clear, []);

  const reveal = useCallback(() => {
    if (!enabled) return;
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), hideMs);
  }, [enabled, hideMs]);

  const hide = useCallback(() => {
    clearTimeout(hideTimer.current);
    setVisible(false);
  }, []);

  useEffect(() => { if (!enabled) hide(); }, [enabled, hide]);

  // ── the gesture ───────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (!enabled) return;
    heldRef.current = false;
    holdFrom.current = { x: e.clientX, y: e.clientY };
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { heldRef.current = true; reveal(); }, holdMs);
  }, [enabled, holdMs, reveal]);

  const onPointerMove = useCallback((e) => {
    if (!enabled) return;
    const from = holdFrom.current;
    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > SLOP_PX) {
      clearTimeout(holdTimer.current);   // it became a drag
      holdFrom.current = null;
    }
    // A MOUSE ONLY. On touch, pointermove fires throughout a scroll, which
    // would leave the overlay up for five seconds after every flick past the
    // player — the opposite of non-intrusive.
    if (e.pointerType === 'mouse') reveal();
  }, [enabled, reveal]);

  const endHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    holdFrom.current = null;
  }, []);

  return {
    visible,
    reveal,
    hide,
    /** True if the press that just ended was a long one — check it in onClick. */
    wasHeld: () => heldRef.current,
    /** Spread onto the surface that should answer the gesture. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endHold,
      onPointerCancel: endHold,
      onPointerLeave: endHold,
    },
  };
}

export default useOverlayReveal;
