import { useSyncExternalStore } from 'react';

// The page's search text, published to the one player.
//
// On Tube the page's search bar IS the player's bar, but the player itself is
// now mounted above <Routes> (so its media node is never unmounted — see
// MiniPlayer), which puts it out of reach of the page's React state. This is
// the one value that has to cross that gap.
//
// Deliberately NOT in PlayerContext: that provider sits above the whole app,
// and pushing a keystroke through it would re-render every page on every
// letter typed.
let query = '';
const listeners = new Set();

export function setPlayerQuery(next) {
  const value = next || '';
  if (value === query) return;
  query = value;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => query;

export function usePlayerQuery() {
  return useSyncExternalStore(subscribe, getSnapshot, () => '');
}
