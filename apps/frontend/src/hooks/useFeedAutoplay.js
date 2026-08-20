import { useState, useRef, useEffect, useCallback } from 'react';

// Which result the feed is on, and walking the page down to the next one.
//
// THIS NO LONGER PLAYS ANYTHING. It used to: each card mounted its own muted
// iframe, and "stopping" meant unmounting it. The comment here said that was
// "the only reliable way to stop a cross-origin player we don't control (there's
// no pause() to call on a YouTube iframe without loading their SDK)" — which was
// true when written and stopped being true when useEmbedPlayback opened a
// postMessage channel to exactly those iframes, with no SDK. The cards were the
// last place still working around a problem that had been solved.
//
// Playback belongs to the one player now. This hook's job is narrower and
// clearer: track which playable card is the active one, and optionally scroll to
// the next. The page turns that into player commands.
//
// AUTO-ADVANCE IS DRIVEN BY THE VIDEO ENDING, not by this hook's timer. The
// timer exists because a card's embed fired no `ended` event, so a 30-second
// guess was the only option; the player has the real signal. What remains here
// is the fallback for media that still gives us nothing to listen to.
//
// Both behaviours are off unless switched on, and the choice is remembered.
// A search results page that starts moving and playing unasked is hostile;
// one you switch into is a feed.

const AUTOPLAY_KEY = 'truegle_feed_autoplay';
const ADVANCE_KEY = 'truegle_feed_autoadvance';
const DEFAULT_DWELL_MS = 30000;

const loadFlag = (key) => {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
};
const saveFlag = (key, value) => {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* private mode */ }
};

export function useFeedAutoplay() {
  const [autoplay, setAutoplay] = useState(() => loadFlag(AUTOPLAY_KEY));
  const [autoAdvance, setAutoAdvance] = useState(() => loadFlag(ADVANCE_KEY));
  const [activeIndex, setActiveIndex] = useState(null);
  const [interaction, setInteraction] = useState(0);

  // index -> element, for the cards that can actually play something.
  const nodes = useRef(new Map());
  const observer = useRef(null);
  const ratios = useRef(new Map()); // index -> in the play band

  useEffect(() => { saveFlag(AUTOPLAY_KEY, autoplay); }, [autoplay]);
  useEffect(() => { saveFlag(ADVANCE_KEY, autoAdvance); }, [autoAdvance]);

  const bumpInteraction = useCallback(() => setInteraction((n) => n + 1), []);

  // Whichever card is crossing the middle of the screen is the one that plays.
  //
  // A visibility-RATIO test looks obvious and is wrong here: a result card is
  // often taller than a phone viewport, so its ratio can never reach a
  // meaningful threshold and nothing would ever play. Shrinking the observer
  // root to a band across the middle of the screen instead is independent of
  // element size — the card under your eyeline wins.
  //
  // The observer only reports candidates; the winner is computed from live
  // rects. That matters because mounting an embed changes the playing card's
  // height, which reflows the page — so the decision has to be re-checked
  // after the layout settles, not just when an intersection event fires.
  useEffect(() => {
    if (!autoplay) { setActiveIndex(null); return undefined; }

    let frame = 0;
    let settle = 0;

    const evaluate = () => {
      const middle = window.innerHeight / 2;
      let best = null;
      let bestDistance = Infinity;
      for (const idx of ratios.current.keys()) {
        const el = nodes.current.get(idx);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) { bestDistance = distance; best = idx; }
      }
      // Nothing in the band means the gap BETWEEN two cards, not "stop" —
      // clearing here would kill playback every time you crossed a card
      // boundary. Whatever is playing keeps playing until another card
      // actually claims the band.
      if (best != null) setActiveIndex(best);
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(evaluate);
      // Swapping the embed resizes a card and shifts everything below it, so
      // re-check once the reflow has landed. Without this the handoff sticks
      // on whichever card happened to win mid-reflow.
      clearTimeout(settle);
      settle = setTimeout(evaluate, 450);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.dataset.feedIndex);
          if (Number.isNaN(idx)) continue;
          if (entry.isIntersecting) ratios.current.set(idx, 1);
          else ratios.current.delete(idx);
        }
        schedule();
      },
      { threshold: 0, rootMargin: '-40% 0px -40% 0px' },
    );
    observer.current = io;
    for (const el of nodes.current.values()) io.observe(el);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Start at the top result rather than waiting for one to reach the band.
    // The results sit below the fold on a phone, so without this, switching
    // autoplay on appears to do nothing until you scroll.
    const first = [...nodes.current.keys()].sort((a, b) => a - b)[0];
    if (first != null) setActiveIndex(first);

    return () => {
      io.disconnect();
      observer.current = null;
      ratios.current.clear();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [autoplay]);

  /** Ref callback for a card that has playable media. */
  const register = useCallback((index, el) => {
    const existing = nodes.current.get(index);
    if (existing && observer.current) observer.current.unobserve(existing);
    if (el) {
      el.dataset.feedIndex = String(index);
      nodes.current.set(index, el);
      if (observer.current) observer.current.observe(el);
    } else {
      nodes.current.delete(index);
      ratios.current.delete(index);
    }
  }, []);

  /** Scroll the page to the next playable card. */
  const advanceToNext = useCallback(() => {
    const indices = [...nodes.current.keys()].sort((a, b) => a - b);
    if (!indices.length) return;
    const next = indices.find((i) => i > (activeIndex ?? -1));
    // Wrapping to the top would replay the list forever. Stopping at the end is
    // what lets the player fall through to finding something new, which is the
    // point of "if the feed is empty, the random similar videos begin".
    if (next == null) return;
    nodes.current.get(next)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  // THE FALLBACK, not the mechanism. The page advances the feed when the player
  // reports a video has ENDED; this timer only covers media that reports
  // nothing, and it is deliberately long enough not to interrupt anything the
  // real signal would have handled first.
  useEffect(() => {
    if (!autoplay || !autoAdvance || activeIndex == null) return undefined;
    const timer = setTimeout(advanceToNext, DEFAULT_DWELL_MS);
    return () => clearTimeout(timer);
    // `interaction` is a dependency on purpose: any touch restarts the dwell.
  }, [autoplay, autoAdvance, activeIndex, interaction, advanceToNext]);

  return {
    autoplay,
    setAutoplay,
    autoAdvance,
    setAutoAdvance,
    activeIndex,
    register,
    advanceToNext,
    bumpInteraction,
    hasFeed: nodes.current.size > 0,
  };
}
