import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlayable, mediaKey } from '../utils/videoEmbed';
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
//
// `allowReddit` is a quality gate, not a capability one. A `site:reddit.com`
// search returns text posts, image posts and link posts alongside the videos,
// and getPlayable() will happily wrap any of them in the redditmedia embed —
// which would fill a list whose entire promise is "things to watch" with
// things to read. So Reddit rows only survive when the user actually asked
// for Reddit (!reddit / !r). Pasting a Reddit link still always works: that
// path never comes through here.
function toSource(r, allowReddit = false) {
  const base = getPlayable(r.url) || fromThumbnail(r.image);
  if (!base) return null;
  if (base.kind === 'reddit' && !allowReddit) return null;
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
// The providers YouTube's own search can stand in for. Anything else asked for
// explicitly must come back empty rather than come back wrong.
const YT_FALLBACK_OK = new Set([null, undefined, 'youtube', 'any']);

export function usePlayerSearch(query, scope = 'all', provider = 'all') {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // A pasted link we can't host — kept apart from `error`, because it isn't a
  // failure, it's an honest "not this provider".
  const [unsupported, setUnsupported] = useState('');
  // What was actually asked, and what came back. An empty list is currently
  // indistinguishable from a broken one, which is why "no results" took three
  // rounds of guessing to diagnose — the UI knew nothing and so did I.
  const [trace, setTrace] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback((raw, activeScope, activeProvider) => {
    abortRef.current?.abort();
    const q = raw.trim();
    if (q.length < MIN_CHARS) { setResults(null); setLoading(false); setError(''); return; }

    // Typed or pasted a link? Resolve it directly — no round trip, and it
    // accepts Truegle player links as well as raw media URLs. A link that
    // plays is fair game: nothing to sign in for, nothing to submit, it just
    // goes in the player.
    let asUrl = null;
    try {
      const u = new URL(q);
      if (u.protocol === 'http:' || u.protocol === 'https:') asUrl = u;
    } catch { /* not a URL — fall through to searching */ }

    if (asUrl) {
      const pasted = resolveShareInput(q);
      setLoading(false);
      setError('');
      if (pasted.length) { setResults(pasted); setUnsupported(''); return; }
      // A real link we simply can't play. Say which host, and say it plainly.
      setResults([]);
      setUnsupported(asUrl.hostname.replace(/^www\./, ''));
      return;
    }
    setUnsupported('');

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
    const intent = parsePlayerQuery(q, activeScope, activeProvider);
    const allowReddit = intent.platform === 'reddit';

    // The provider is often cold and answers the first ask with nothing, which
    // is exactly the "took three tries" symptom. One retry, and a ceiling so a
    // hung request can't leave the spinner running forever.
    const steps = [];
    const once = (category, query) => fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters: { category, bias: 'all', dateRange: 'any', perPage: 20 } }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        const raw = (d.results || []).length;
        const rows = (d.results || []).map((r) => toSource(r, allowReddit)).filter(Boolean);
        // raw vs playable is the whole diagnosis: 0/0 means the backend found
        // nothing, 12/0 means it found plenty and none of it can be played.
        steps.push(`${category} ${raw}→${rows.length}`);
        // `raw` rides along so the retry can tell those two apart.
        rows.raw = raw;
        return rows;
      });

    // One retry, on the FIRST ask only. Retrying every rung of the fallback
    // chain turned an empty search into eight sequential requests and ten
    // seconds of spinner before the last resort was even tried.
    //
    // And retry only when the provider returned NOTHING AT ALL. The retry
    // exists for a cold SearXNG that answers the first ask with an empty body;
    // if it returned twelve results and none were playable, it answered fine
    // and asking again will produce the same twelve. The live trace showed
    // exactly that waste: 5 raw results, 0 playable, asked twice.
    const ask = (category, query, retry = false) => once(category, query)
      .then((rows) => (rows.length || rows.raw > 0 || !retry
        ? rows
        : new Promise((res) => { setTimeout(res, 500); }).then(() => once(category, query))))
      .catch((e) => { if (e.name === 'AbortError') throw e; return []; });

    // WHICH INDEX FIRST. Each provider names the backend category that can
    // actually hold it (see PROVIDERS). Reddit is 'social' — the backend's own
    // Reddit path, which queries SearXNG's social-media category AND builds its
    // own Google query, so it still answers when SearXNG is cold. Asking
    // 'videos' first for Reddit meant two guaranteed-empty requests, the first
    // retried, before anything that could possibly answer — most of the 20s
    // budget spent proving a video index has no Reddit posts in it.
    const first = intent.category || 'videos';

    // Scoped first, then progressively looser — but never so loose that an
    // explicit ask ("!yt", "@channel", the Reddit chip) is quietly ignored.
    const web = ask(first, intent.backendQuery, true)
      // Second rung: the SAME need, a DIFFERENT question — keyword instead of
      // site: operator. Repeating the failed query here is what produced
      // `web 5→0 · web 5→0 · web 5→0` in the live trace.
      .then((rows) => (rows.length ? rows : ask('web', intent.keywordQuery)))
      .then((rows) => (rows.length || intent.explicit ? rows : ask('videos', q)))
      .then((rows) => (rows.length ? rows : (intent.explicit ? [] : ask('web', q))))
      // The last resort is YouTube's OWN search, so it can only ever answer a
      // YouTube-shaped question. Firing it for an explicit Reddit or SoundCloud
      // ask returned YouTube videos for a Reddit search — and burned 100 quota
      // units of 10k/day to do it.
      .then((rows) => (rows.length || !YT_FALLBACK_OK.has(intent.platform) ? rows : youtube()))
      .catch((e) => { if (e.name === 'AbortError') throw e; return []; });

    // Last resort: YouTube's own search. It answers "find me this video"
    // properly, but costs 100 quota units against 10k/day, so it is only asked
    // when everything else came back with nothing playable — and the backend
    // caches each query for an hour on top of that.
    const youtube = () => fetch(
      `${BACKEND}/api/creators/search?q=${encodeURIComponent(intent.text || q)}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => (d.videos || []).map((v) => {
        const base = getPlayable(v.url);
        return base ? {
          ...base, title: v.title || titleFromUrl(v.url), pageUrl: v.url,
          poster: v.thumbnail, channel: v.channel,
        } : null;
      }).filter(Boolean))
      .catch(() => []);

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
        // De-duplicate by MEDIA, not by URL: a search for a song comes back
        // with the same upload four times over — youtu.be, /watch?v=,
        // /embed/…?si=, a mirror — and every one of those is a different
        // `src`. Keying on src is why the list looked padded with repeats and
        // why auto-advance rolled straight into another copy of the same clip.
        const seen = new Set();
        const merged = [...communityRows, ...webRows].filter((row) => {
          const key = row && (mediaKey(row) || row.src);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // YouTube first, then the rest — and anything matching the channel
        // that was asked for above its own group.
        setResults(rankPlayable(merged, intent));
        setTrace({ steps, community: communityRows.length, query: intent.backendQuery });
      })
      // An aborted request is a newer keystroke, not a failure.
      .catch((e) => { if (e.name !== 'AbortError') setError('Search is unreachable right now.'); })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => run(query || '', scope, provider), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, scope, provider, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { results, loading, error, unsupported, trace };
}
