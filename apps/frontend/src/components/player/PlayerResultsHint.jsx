import { useCallback, useEffect, useState } from 'react';
import { ChevronsDown } from 'lucide-react';

// The strip under a docked player's controls that says where the results went.
//
// A search used to drop a list out of the player, so the results were IN the
// player and the grid beneath it was an afterthought nobody scrolled to. Now
// that the list stays retracted, the only thing that tells someone their query
// worked is a clue that something happened below — this is that clue. It is
// also a button: one press scrolls the grid into view, which on a phone (where
// the player fills the screen) is the whole difference between "nothing
// happened" and "there they are".
//
// ONCE THE RESULTS ARE ON SCREEN IT QUIETENS, IT DOES NOT LEAVE. Pointing at
// something you can already see is noise, so it stops bouncing and fades — but
// it keeps its height. Removing it changed the player's height in the middle of
// a scroll, and the docked player must never resize while the page scrolls
// (verify-docked-scroll pins that).
const GRID = '[data-tube-grid]';

function gridOnScreen() {
  // The first RESULT, not the grid: its filter row peeks over the bottom of a
  // phone screen long before any result does, and "the results are showing"
  // has to mean a thumbnail is.
  const el = document.querySelector('[data-tube-card]') || document.querySelector(GRID);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  // Top three quarters of the screen: a card peeking in at the very bottom
  // edge is not "showing" — nobody sees a result in a 100px sliver.
  return r.top < window.innerHeight * 0.75 && r.bottom > 0;
}

export default function PlayerResultsHint({ query, count, accent = '#f43f5e' }) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSeen(gridOnScreen()));
    };
    check();
    // The grid mounts a beat after the results arrive; look again once it has.
    const late = setTimeout(check, 400);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(late);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [query, count]);

  const go = useCallback(() => {
    document.querySelector(GRID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const label = query.trim().length > 24 ? `${query.trim().slice(0, 24)}…` : query.trim();
  const chevron = `shrink-0 ${seen ? '' : 'animate-bounce motion-reduce:animate-none'}`;

  return (
    <button
      type="button"
      data-player-results-hint=""
      data-seen={seen ? 'yes' : undefined}
      onClick={go}
      aria-label={`Show the ${count} results for ${query.trim()}, below the player`}
      className={`relative z-30 w-full flex items-center justify-center gap-2 px-3 py-2 border-t border-white/10
                 text-xs font-semibold hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-[color,opacity] duration-300
                 ${seen ? 'text-white/40 opacity-70' : 'text-white/85'}`}
      style={{ boxShadow: seen ? undefined : `inset 0 -2px 0 ${accent}55` }}
    >
      <ChevronsDown size={16} style={{ color: seen ? undefined : accent }} className={chevron} aria-hidden="true" />
      <span className="truncate">{`Results for “${label}” are below`}</span>
      <ChevronsDown size={16} style={{ color: seen ? undefined : accent }} className={chevron} aria-hidden="true" />
    </button>
  );
}
