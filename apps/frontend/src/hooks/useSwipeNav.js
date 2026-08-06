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
const DISTANCE = 56;   // px before a drag counts as a swipe
const TAP_SLOP = 12;   // px of wander still counted as a tap
const TAP_MS = 350;

export function useSwipeNav({ active, onNext, onPrev, onTap }) {
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    const t = e.touches?.[0];
    start.current = t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
  }, []);

  const onTouchEnd = useCallback((e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;

    if (Math.abs(dy) >= DISTANCE && Math.abs(dy) > Math.abs(dx)) {
      // Up = forward. Matches the feeds, and matches "the next one is below,
      // pull it into view".
      if (dy < 0) onNext?.();
      else onPrev?.();
      return;
    }
    if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP && Date.now() - s.at < TAP_MS) onTap?.();
  }, [onNext, onPrev, onTap]);

  // Arrows do the same thing, for anyone in full screen on a laptop. Bound to
  // the document because full screen takes focus away from our buttons.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onNext?.(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onPrev?.(); }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); onTap?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onNext, onPrev, onTap]);

  if (!active) return null;
  return { onTouchStart, onTouchEnd };
}

export default useSwipeNav;
