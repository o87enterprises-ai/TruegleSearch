import { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';

/* The search you were doing before you pressed play — shared, because the two
 * halves of it live in different trees.
 *
 * The search page STASHES (it owns the query and the results). The player
 * RECALLS (the "tap near the top" gesture is on the locked overlay, and the
 * expanded player is mounted by MiniPlayer at app level, not inside the page).
 * There is no prop path between those two, and inventing one would mean
 * threading a callback through MiniPlayer, TrueglePlayer and the lock overlay
 * for a single edge.
 *
 * See hooks/useSearchStash for WHY the list is put down rather than thrown
 * away. This is the same object, hoisted so both ends can hold it.
 */

const SearchStashContext = createContext(null);

export function SearchStashProvider({ children }) {
  const [recalled, setRecalled] = useState(false);
  const [version, setVersion] = useState(0);
  const stash = useRef(null);
  // Set by the search page so a recall from the player can actually repopulate
  // it. Null on any page that has no search to restore, which is how the
  // player knows the gesture has nothing to do.
  const applyRef = useRef(null);

  const registerApply = useCallback((fn) => {
    applyRef.current = fn;
    return () => { if (applyRef.current === fn) applyRef.current = null; };
  }, []);

  const stashSearch = useCallback((query, results) => {
    const list = Array.isArray(results) ? results : [];
    if (!query && list.length === 0) return false;
    stash.current = { query: query || '', results: list, at: Date.now() };
    setRecalled(false);
    setVersion((v) => v + 1);
    return true;
  }, []);

  const recall = useCallback(() => {
    if (!stash.current || !applyRef.current) return false;
    applyRef.current(stash.current);
    setRecalled(true);
    return true;
  }, []);

  const dismiss = useCallback(() => setRecalled(false), []);

  const clear = useCallback(() => {
    stash.current = null;
    setRecalled(false);
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(() => ({
    recalled,
    // Read through `version` so a consumer re-renders when the stash appears or
    // goes away — a ref alone would leave the recall affordance stale.
    hasStash: version >= 0 && !!stash.current,
    peek: () => stash.current,
    stashSearch,
    recall,
    dismiss,
    clear,
    registerApply,
  }), [recalled, version, stashSearch, recall, dismiss, clear, registerApply]);

  return (
    <SearchStashContext.Provider value={value}>
      {children}
    </SearchStashContext.Provider>
  );
}

/* Safe outside the provider: every consumer is optional behaviour, so a null
 * context has to read as "nothing stashed" rather than throw. A page that
 * crashes because a convenience is unavailable is a worse bug than the
 * convenience being missing. */
const INERT = {
  recalled: false,
  hasStash: false,
  peek: () => null,
  stashSearch: () => false,
  recall: () => false,
  dismiss: () => {},
  clear: () => {},
  registerApply: () => () => {},
};

export const useSearchStashContext = () => useContext(SearchStashContext) || INERT;

export default SearchStashContext;
