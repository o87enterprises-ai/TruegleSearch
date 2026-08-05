import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlayable } from '../utils/videoEmbed';
import { resolveShareInput, titleFromUrl } from '../utils/playerLink';
import { parsePlayerQuery, rankPlayable } from '../utils/playerQuery';

// A video result whose URL we can't classify is sometimes still a YouTube
// video — the search backend hands back a watch page on a host we don't
// accept, or a redirect, while the thumbnail is unmistakably i.ytimg.com/vi/<id>.
// That id is enough to play it, so recover it rather than throwing the result
// away: this is the difference between "59 results" and "nothing here can play".
const YT_THUMB = /\/vi(?:_webp)?\/([\w-]{6,20})\//;
function fromThumbnail(image) {
  const id = typeof image === 'string' ? YT_THUMB.exec(image)?.[1] : null;
  return id ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
}

// One search result → a player source, or null if there's no way to play it.
function toSource(r) {
  const base = getPlayable(r.url) || fromThumbnail(r.image);
  if (!base) return null;
  return {
    ...base,
    title: r.title || titleFromUrl(r.url),
    pageUrl: r.url,
    poster: r.image,
    duration: r.duration,
  };
}

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
// Long enough for a cold SearXNG plus a retry; short enough that a dead
// request doesn't spin forever.
const REQUEST_TIMEOUT_MS = 20000;

export function usePlayerSearch(query, scope = 'all') {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const run = useCallback((raw, activeScope) => {
    abortRef.current?.abort();
    const q = raw.trim();
    if (q.length < MIN_CHARS) { setResults(null); setLoading(false); setError(''); return; }

    // Typed or pasted a link? Resolve it directly — no round trip, and it
    // accepts Truegle player links as well as raw media URLs.
    const pasted = resolveShareInput(q);
    if (pasted.length) { setResults(pasted); setLoading(false); setError(''); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoading(true);
    setError('');

    // People type into this the way they type into YouTube — a channel, an
    // @handle, "videos by someone" — so the query is read for that intent and
    // site-scoped before it goes anywhere. Asking a general index for an
    // artist's name returns lyric sites and reposts; asking it for
    // `site:youtube.com "<name>"` returns the videos.
    const intent = parsePlayerQuery(q, activeScope);

    // The provider is often cold and answers the first ask with nothing, which
    // is exactly the "took three tries" symptom. One retry, and a ceiling so a
    // hung request can't leave the spinner running forever.
    const once = (category, query) => fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters: { category, bias: 'all', dateRange: 'any', perPage: 20 } }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => (d.results || []).map(toSource).filter(Boolean));

    const ask = (category, query) => once(category, query)
      .then((rows) => (rows.length ? rows : new Promise((res) => { setTimeout(res, 600); })
        .then(() => once(category, query))))
      .catch((e) => { if (e.name === 'AbortError') throw e; return []; });

    // Scoped first, then progressively looser — but never so loose that an
    // explicit ask ("!yt", "@channel") is quietly ignored.
    const web = ask('videos', intent.backendQuery)
      .then((rows) => (rows.length ? rows : ask('web', intent.backendQuery)))
      .then((rows) => (rows.length || intent.explicit ? rows : ask('videos', q)))
      .then((rows) => (rows.length ? rows : (intent.explicit ? [] : ask('web', q))))
      .catch((e) => { if (e.name === 'AbortError') throw e; return []; });

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
        // YouTube first, then the rest — and anything matching the channel
        // that was asked for above its own group.
        setResults(rankPlayable(merged, intent));
      })
      // An aborted request is a newer keystroke, not a failure.
      .catch((e) => { if (e.name !== 'AbortError') setError('Search is unreachable right now.'); })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(query || '', scope), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, scope, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { results, loading, error };
}
