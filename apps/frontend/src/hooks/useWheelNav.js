import { useCallback, useRef } from 'react';

// Desktop's version of the swipe gesture: a mouse wheel or trackpad flick
// over a full-screen immersive surface (TrueglePlayer, Reels) moves to the
// next or previous item the same way a touch swipe does.
//
// Owner, 2026-10-10: "the scroll function on desktop for tube and reel
// doesn't work". useSwipeNav (its sibling) listens on TOUCH events only — on
// purpose, see its own header — so a desktop mouse or trackpad had NOTHING
// mapped to next/prev in full screen at all. This is that mapping, kept as
// its own hook because it answers a different INPUT, not a different
// gesture: both end up calling the same onNext/onPrev.
//
// A COOLDOWN, not a one-shot. A single trackpad "flick" fires a burst of
// wheel events — sometimes a dozen — so acting on every one would skip
// several items per gesture, the mouse equivalent of a swipe advancing the
// feed five times. The first big-enough delta inside a short window wins;
// the rest of that same gesture are ignored until the window closes.
const THRESHOLD = 24;      // deltaY below this reads as noise, not a scroll
const COOLDOWN_MS = 500;   // how long one gesture is allowed to own

export function useWheelNav({ active, onNext, onPrev }) {
  const cooling = useRef(false);

  const onWheel = useCallback((e) => {
    if (!active || cooling.current) return;
    if (Math.abs(e.deltaY) < THRESHOLD) return;
    cooling.current = true;
    setTimeout(() => { cooling.current = false; }, COOLDOWN_MS);
    // Down = forward, same direction as swiping up: the next thing is
    // "below", and scrolling down pulls it into view.
    if (e.deltaY > 0) onNext?.();
    else onPrev?.();
  }, [active, onNext, onPrev]);

  if (!active) return null;
  return { onWheel };
}

export default useWheelNav;
