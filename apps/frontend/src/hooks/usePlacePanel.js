import { useEffect, useRef, useState } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * The local panel for a search, or nothing.
 *
 * Deliberately fires on the SUBMITTED query, not on the input — this reaches
 * a geocoding provider, and doing that per keystroke would burn a quota that
 * has a free tier for a card most searches never show.
 *
 * The backend runs its own cheap gate before touching any provider, and
 * returns `panel: null` for everything that isn't a real place with something
 * actionable on it. So the honest client-side contract is simply: ask once per
 * query, render if something comes back, otherwise behave exactly as before.
 */
export function usePlacePanel(query, { lat = null, lng = null } = {}) {
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(false);
  // Ignore a response that lands after the query has moved on — otherwise a
  // slow lookup for the previous search paints a panel over the new one.
  const seq = useRef(0);

  useEffect(() => {
    const q = (query || '').trim();
    const mine = ++seq.current;
    if (q.length < 4) { setPanel(null); setLoading(false); return undefined; }

    const ctrl = new AbortController();
    setLoading(true);
    fetch(`${BACKEND}/api/maps/place-panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, ...(lat !== null && lng !== null ? { lat, lng } : {}) }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (mine !== seq.current) return;
        setPanel(d?.panel || null);
      })
      .catch(() => { if (mine === seq.current) setPanel(null); })
      .finally(() => { if (mine === seq.current) setLoading(false); });

    return () => ctrl.abort();
  }, [query, lat, lng]);

  return { panel, loading };
}

export default usePlacePanel;
