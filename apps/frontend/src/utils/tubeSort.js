import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';
import { SORT_IDS, sortResults, fetchScores } from './resultSort';

// ONE ORDER FOR TUBE, shared by the player's list, its browse deck and the
// page's grid. Change it in the player and the page follows, and back — two
// independent sort controls showing two different orders of the same results
// would read as one of them being broken. Remembered in this browser only.
const KEY = 'truegle_tube_sort';
let current = (() => {
  try { const v = localStorage.getItem(KEY); return SORT_IDS.has(v) ? v : 'relevant'; } catch { return 'relevant'; }
})();
const listeners = new Set();

export function setTubeSort(next) {
  if (!SORT_IDS.has(next) || next === current) return;
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useTubeSort = () => useSyncExternalStore(subscribe, () => current, () => 'relevant');

// Popularity scores, learned once per media key for the page's lifetime, so
// three surfaces sorting by Popular cost one request rather than three.
const known = new Map();

/** `rows` in the shared Tube order. */
export function useSortedRows(rows) {
  const sort = useTubeSort();
  const [, bump] = useState(0);
  useEffect(() => {
    if (sort !== 'popular' || !rows?.length) return undefined;
    const missing = rows.filter((r) => !known.has(mediaKey(r) || r.src));
    if (missing.length === 0) return undefined;
    const ac = new AbortController();
    fetchScores(missing, ac.signal).then((scores) => {
      if (ac.signal.aborted) return;
      // Mark every asked-for key as known, scored or not, so nothing is asked twice.
      missing.forEach((r) => { const k = mediaKey(r) || r.src; if (!known.has(k)) known.set(k, scores[k]); });
      bump((n) => n + 1);
    });
    return () => ac.abort();
  }, [sort, rows]);
  // `bump` re-renders; the memo key below is rows + sort, plus the scores read fresh.
  const scores = sort === 'popular' ? Object.fromEntries(known) : null;
  const size = known.size;
  return useMemo(
    () => (sort === 'relevant' || !rows ? rows : sortResults(rows, sort, scores || {})),
     
    [rows, sort, size],
  );
}
