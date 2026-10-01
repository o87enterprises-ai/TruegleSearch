import { useEffect, useRef, useCallback } from 'react';

// Swipe up for the next thing, swipe down for the last one — the gesture every
// short-form feed has trained people to make, on the one surface where it
// can't collide with the page: full screen.
//
// WHY AN OVERLAY IS UNAVOIDABLE: the picture is a cross-origin <iframe>. It
// swallows every touch it receives and we cannot listen inside it, so a
// listener on our container never fires over the video. A transparent sheet on
// top is the only way to see the gesture at all — the same reason the move
// handler needs one.
//
// The cost of that sheet is the embed's own controls, so this only goes up in
// full screen, where our transport bar is already on screen and pinned. A tap
// falls through to play/pause so the sheet never feels like a dead zone.
// TUNED DOWN (less sensitive) after accidental pauses and track changes: a
// swipe now needs a longer, clearly vertical, reasonably quick flick with one
// finger, and a tap has to be short and still. Anything in between — a slow
// drag, a diagonal, a resting thumb, a pinch — does nothing.
const DISTANCE = 110;       // px before a drag counts as a swipe
const SWIPE_MAX_MS = 800;   // slower than this is a drag, not a flick
const VERTICAL_RATIO = 1.8; // |dy| must dominate |dx| by this much
const TAP_SLOP = 10;        // px of wander still counted as a tap
const TAP_MS = 280;
const DOUBLE_MS = 280; // second tap has to land inside this to count as a pair

export function useSwipeNav({ active, onNext, onPrev, onTap, onDoubleTap, doubleTap = false }) {
  const start = useRef(null);
  // The last tap that has not yet been resolved into single-or-double, and the
  // timer that will resolve it.
  const lastTap = useRef(null);
  const pending = useRef(null);

  const clearPending = () => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
  };

  const onTouchStart = useCallback((e) => {
    // A second finger makes it a pinch or a grip, never a swipe or tap.
    if ((e.touches?.length || 0) > 1) { start.current = null; clearPending(); return; }
    const t = e.touches?.[0];
    start.current = t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
    // A new touch always cancels a tap that is still waiting to see whether it
    // was the first half of a double. If this touch turns out to be the second
    // tap we handle it below; if it turns out to be a swipe, the pending
    // play/pause SHOULD be cancelled — reaching to swipe is not a request to
    // pause.
    clearPending();
  }, []);

  const onTouchEnd = useCallback((e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (Math.abs(dy) >= DISTANCE && Math.abs(dy) > Math.abs(dx) * VERTICAL_RATIO
      && Date.now() - s.at <= SWIPE_MAX_MS) {
      lastTap.current = null;
      // Up = forward. Matches the feeds, and matches "the next one is below,
      // pull it into view".
      if (dy < 0) onNext?.();
      else onPrev?.();
      return;
    }
    if (Math.abs(dx) >= TAP_SLOP || Math.abs(dy) >= TAP_SLOP || Date.now() - s.at >= TAP_MS) return;

    // ── it was a tap ────────────────────────────────────────────────────
    if (!doubleTap) { onTap?.(); return; }

    // WHICH SIDE, measured against the sheet rather than the window: the sheet
    // is a band in the middle of the screen, so window-relative maths would
    // put the midpoint in the wrong place on any non-full-bleed layout.
    const rect = e.currentTarget?.getBoundingClientRect?.();
    const side = rect && (t.clientX - rect.left) < rect.width / 2 ? 'left' : 'right';

    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.at < DOUBLE_MS && prev.side === side) {
      lastTap.current = null;
      onDoubleTap?.(side);
      return;
    }

    lastTap.current = { at: now, side };
    // Play/pause has to WAIT for the double-tap window, or every jump would
    // also toggle pause on its way through. It is the same ~280ms delay the
    // native video apps accept for the same reason, and it is only paid where
    // seeking is possible at all — `doubleTap` is false otherwise, and the tap
    // fires immediately as before.
    pending.current = setTimeout(() => {
      pending.current = null;
      lastTap.current = null;
      onTap?.();
    }, DOUBLE_MS);
  }, [onNext, onPrev, onTap, onDoubleTap, doubleTap]);

  // Leaving full screen (or locking) mid-gesture must not fire a tap a beat
  // later at whatever is on screen by then.
  useEffect(() => () => clearPending(), []);
  useEffect(() => { if (!active) { clearPending(); lastTap.current = null; } }, [active]);

  // The keyboard is NOT handled here any more: TrueglePlayer has one handler
  // with YouTube's layout for every presentation. This one also answered
  // Space in full screen, so a press paused and resumed in the same keystroke,
  // and its arrows changed track where YouTube's seek (2026-10-01).

  if (!active) return null;
  return { onTouchStart, onTouchEnd };
}

export default useSwipeNav;
