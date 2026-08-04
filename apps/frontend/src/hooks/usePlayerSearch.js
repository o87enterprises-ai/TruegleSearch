import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlayable } from '../utils/videoEmbed';
import { resolveShareInput, titleFromUrl } from '../utils/playerLink';

// Debounced, playable-only search shared by every surface that feeds the
// player — the Tube search bar, the popped-out player's own bar, and the
// queue's "+" panel.
//
// Playable-only is the point: a result the player can't host is noise in a
// list whose only purpose is "things to watch". Everything returned here has
// already been through getPlayable(), so any row can go straight into the
// queue.
//
// A pasted URL short-circuits the search entirely — including a Truegle
// player link, so a shared link can be dropped straight back into the player.
//
// Results are web search PLUS what the community has submitted. Submissions
// come first: somebody vouched that those play, and they are the only way a
// link the web index doesn't carry becomes findable at all.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export function usePlayerSearch(query) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const run = useCallback((raw) => {
    abortRef.current?.abort();
    const q = raw.trim();
    if (q.length < MIN_CHARS) { setResults(null); setLoading(false); setError(''); return; }

    // Typed or pasted a link? Resolve it directly — no round trip, and it
    // accepts Truegle player links as well as raw media URLs.
    const pasted = resolveShareInput(q);
    if (pasted.length) { setResults(pasted); setLoading(false); setError(''); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');

    const web = fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 20 } }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => (d.results || []).map((r) => {
        const base = getPlayable(r.url);
        return base
          ? { ...base, title: r.title || titleFromUrl(r.url), pageUrl: r.url, poster: r.image, duration: r.duration }
          : null;
      }).filter(Boolean));

    // Community submissions. A failure here must never cost the user the web
    // results, so it resolves to nothing rather than rejecting.
    const community = fetch(
      `${BACKEND}/api/media/search?q=${encodeURIComponent(q)}&limit=8`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => (d.results || []))
      .catch(() => []);

    Promise.all([web, community])
      .then(([webRows, communityRows]) => {
        const seen = new Set();
        const merged = [...communityRows, ...webRows].filter((row) => {
          if (!row || seen.has(row.src)) return false;
          seen.add(row.src);
          return true;
        });
        setResults(merged);
      })
      // An aborted request is a newer keystroke, not a failure.
      .catch((e) => { if (e.name !== 'AbortError') setError('Search is unreachable right now.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(query || ''), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { results, loading, error };
}
