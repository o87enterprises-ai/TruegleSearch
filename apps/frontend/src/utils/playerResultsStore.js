import { useSyncExternalStore } from 'react';

// The docked player's search, published to the Tube page.
//
// On Tube the page's bar IS the player's bar, so the player is already running
// the playable-only search for what is typed there. The page's grid shows those
// SAME rows rather than asking again — two searches per query would double the
// load on the search box for an identical answer. The other half of
// playerQueryStore: that one carries the question down, this carries the answer
// back up.
const EMPTY = Object.freeze({ results: null, loading: false, error: '', more: false, loadMore: null, loadingMore: false });
let snapshot = EMPTY;
const listeners = new Set();

export function publishPlayerResults(search) {
  const next = search || EMPTY;
  if (
    next.results === snapshot.results && next.loading === snapshot.loading
    && next.error === snapshot.error && next.more === snapshot.more
    && next.loadingMore === snapshot.loadingMore && next.loadMore === snapshot.loadMore
  ) return;
  snapshot = {
    results: next.results, loading: next.loading, error: next.error,
    more: next.more, loadMore: next.loadMore, loadingMore: next.loadingMore,
  };
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const usePlayerResults = () => useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
