import { useCallback, useEffect, useRef, useState } from 'react';

// Which feed card is centered on screen — nothing more.
//
// A SIBLING OF useFeedAutoplay.js, NOT A REUSE OF IT. That hook exists to
// eventually turn "which card is active" into player commands: it carries an
// autoplay toggle, an autoAdvance toggle, a 30-second dwell timer, and both
// are persisted to localStorage and both default OFF specifically because a
// feed that starts moving and playing unasked is hostile. None of that applies
// here — the feed cards this hook drives never autoplay and never advance on
// a timer, by design (see FeedCards.jsx: focus only ever enlarges a card and
// shows its poster, it never loads media). Reusing useFeedAutoplay would mean
// carrying three pieces of state this hook has no use for, or fighting them
// off with props — a second, smaller hook is the honest shape.
//
// THE MECHANISM IS THE SAME ON PURPOSE: a visibility-RATIO test is wrong for
// the same reason it was wrong there — a card taller than the viewport can
// never cross a meaningful ratio threshold, so shrinking the observer root to
// a band across the middle of the screen is what makes "the card under your
// eyeline" computable regardless of how tall any one card is.

export function useFeedFocus() {
  const [activeIndex, setActiveIndex] = useState(null);

  const nodes = useRef(new Map());   // index -> element
  const inBand = useRef(new Set());  // indices currently crossing the middle band
  const observer = useRef(null);

  useEffect(() => {
    let frame = 0;

    const evaluate = () => {
      const middle = window.innerHeight / 2;
      let best = null;
      let bestDistance = Infinity;
      for (const idx of inBand.current) {
        const el = nodes.current.get(idx);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) { bestDistance = distance; best = idx; }
      }
      // Nothing in the band means the gap BETWEEN two cards, not "nothing is
      // focused" — clearing here would flicker the enlarge effect off every
      // time you crossed a card boundary. Whichever card last held focus keeps
      // it until another card actually claims the band.
      if (best != null) setActiveIndex(best);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(evaluate);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.dataset.feedFocusIndex);
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) inBand.current.add(idx);
          else inBand.current.delete(idx);
        }
        schedule();
      },
      { threshold: 0, rootMargin: '-40% 0px -40% 0px' },
    );
    observer.current = io;
    for (const el of nodes.current.values()) io.observe(el);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Start at the top card rather than waiting for one to reach the band —
    // the first card sits below the fold on a phone, so without this nothing
    // reads as focused until you scroll.
    const first = [...nodes.current.keys()].sort((a, b) => a - b)[0];
    if (first != null) setActiveIndex(first);

    return () => {
      io.disconnect();
      observer.current = null;
      inBand.current.clear();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
    // Runs once per mount. Cards register/unregister into the same Map as the
    // feed list re-renders; re-running this whole effect per render would
    // disconnect and reconnect the observer on every scroll-triggered update.
  }, []);

  /** Ref callback for a card. Every card registers, playable or not — the
   *  enlarge effect applies to any focused card, not just playable ones. */
  const register = useCallback((index, el) => {
    const existing = nodes.current.get(index);
    if (existing && observer.current) observer.current.unobserve(existing);
    if (el) {
      el.dataset.feedFocusIndex = String(index);
      nodes.current.set(index, el);
      if (observer.current) observer.current.observe(el);
      // The mount effect's "start at the top card" ran before the feed had
      // loaded (the rows arrive async), so it found no cards and nothing was
      // ever focused until a scroll. The first card to register claims focus
      // instead; the observer takes over from the first scroll.
      setActiveIndex((prev) => (prev == null ? index : prev));
    } else {
      nodes.current.delete(index);
      inBand.current.delete(index);
    }
  }, []);

  return { activeIndex, register };
}

export default useFeedFocus;
