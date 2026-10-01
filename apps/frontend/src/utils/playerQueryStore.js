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
let snapshot = 'all\u0000all\u0000';
const listeners = new Set();

export function setPlayerQuery(next, scope = 'all', provider = 'all') {
  const value = `${scope || 'all'}\u0000${provider || 'all'}\u0000${next || ''}`;
  if (value === snapshot) return;
  snapshot = value;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => snapshot;
const EMPTY = 'all\u0000all\u0000';

// scope \0 provider \0 text. Packed into one string because
// useSyncExternalStore compares snapshots by identity, and an object rebuilt
// on every read loops forever.
function split(raw) {
  const i = raw.indexOf('\u0000');
  const j = raw.indexOf('\u0000', i + 1);
  return {
    scope: raw.slice(0, i),
    provider: raw.slice(i + 1, j),
    text: raw.slice(j + 1),
  };
}

export function usePlayerQuery() {
  return split(useSyncExternalStore(subscribe, getSnapshot, () => EMPTY));
}

// THE LAST REAL SEARCH MADE ON TUBE. Unlike the snapshot above, this is NOT
// cleared when the player leaves the page's bar — that is exactly the moment a
// pick happens (the player undocks to play), and clearing it there is how the
// query and its results were lost after the first selection (2026-10-01).
// MiniPlayer reads it when something new starts playing.
let lastTubeSearch = '';
export function rememberTubeSearch(text) {
  const t = String(text || '').trim();
  if (t.length >= 2 && !/^https?:\/\//i.test(t)) lastTubeSearch = t;
}
export const getLastTubeSearch = () => lastTubeSearch;
