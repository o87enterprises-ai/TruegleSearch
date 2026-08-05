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
// Snapshot is a single string so useSyncExternalStore can compare it by
// identity — an object rebuilt each read would loop forever.
let snapshot = 'all\u0000';
const listeners = new Set();

export function setPlayerQuery(next, scope = 'all') {
  const value = `${scope || 'all'}\u0000${next || ''}`;
  if (value === snapshot) return;
  snapshot = value;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => snapshot;
const EMPTY = 'all\u0000';

function split(raw) {
  const i = raw.indexOf('\u0000');
  return { scope: raw.slice(0, i), text: raw.slice(i + 1) };
}

export function usePlayerQuery() {
  return split(useSyncExternalStore(subscribe, getSnapshot, () => EMPTY));
}
