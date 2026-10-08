import { useState, useRef, useEffect, useCallback } from 'react';
import { getPlayable, mediaKey, embedFromIframeSrc, embedFromCode } from '../utils/videoEmbed';
import { resolveShareInput, titleFromUrl } from '../utils/playerLink';
import { parsePlayerQuery, rankPlayable, isolatePlatform, isShortsScope, toHandle } from '../utils/playerQuery';
import { withoutBroken, loadBrokenList } from '../utils/broken';
import { isPlaylistUrl } from '../utils/playlistImport';
import { isShortForm, asReel } from '../utils/shortForm';
import { authHeader, storedSafeSearch } from '../utils/authHeader';

// A video result whose URL we can't classify is sometimes still a YouTube
// video — the search backend hands back a watch page on a host we don't
// accept, or a redirect, while the thumbnail is unmistakably i.ytimg.com/vi/<id>.
// That id is enough to play it, so recover it rather than throwing the result
// away: this is the difference between "59 results" and "nothing here can play".
/** Fisher-Yates on a copy — never sort the caller's array in place. */
function shuffled(rows) {
  const out = [...(rows || [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const YT_THUMB = /\/vi(?:_webp)?\/([\w-]{6,20})\//;
function fromThumbnail(image) {
  const id = typeof image === 'string' ? YT_THUMB.exec(image)?.[1] : null;
  return id ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
}

// A player source, kept only if it is genuinely short-form.
//
// Bridges the two shapes: shortForm.js speaks the search-result vocabulary
// (`url`, `duration`), while everything downstream of toSource speaks the
// player-source one (`pageUrl`, `src`). Running asReel across that gap also
// preserves the promotion the old /shorts page did — a YouTube watch URL that
// is tagged #shorts and short enough is rewritten to its canonical /shorts/
// form rather than being thrown away.
function asShortSource(row) {
  const link = row?.pageUrl || row?.src;
  if (!link) return null;
  const promoted = asReel({ url: link, title: row.title, snippet: row.snippet, duration: row.duration });
  if (!promoted || !isShortForm(promoted)) return null;
  return promoted.url === link ? row : { ...row, pageUrl: promoted.url };
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
  const base = getPlayable(r.url) || embedFromIframeSrc(r.iframeSrc) || fromThumbnail(r.image);
  if (!base) return null;
  if (base.kind === 'reddit' && !allowReddit) return null;
  return {
    ...base,
    title: r.title || titleFromUrl(r.url),
    pageUrl: r.url,
    poster: r.image,
    duration: r.duration,
    // The channel was being dropped here, so every row that HAD one still
    // showed nothing under the title. Different providers name the field
    // differently and none of them is guaranteed, so take whichever arrived.
    channel: r.channel || r.author || r.uploader || r.creator || null,
    // WHEN IT WAS PUBLISHED, and only when that is actually known. The search
    // backend used to stamp today's date on every result whose provider gave
    // none (see calculateRecency in SearchService.js), so carrying this field
    // through before that was fixed would have printed "today" over a video
    // from 2019 — worse than the blank it replaced. Null now means null.
    published: r.date || r.published || r.publishedAt || null,
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
  // ── MORE PAGES ────────────────────────────────────────────────────────────
  // One ask of 20 was the whole search: type two words, get twenty rows, and
  // that is everything Truegle will ever show you for it. The backend has
  // always honoured `filters.page` on every provider (Google `start`, Brave
  // `offset`, SearXNG `pageno`) — nothing here ever asked for a second one.
  //
  // What gets asked again is the rung of the fallback ladder that ACTUALLY
  // ANSWERED, not the ladder from the top. Re-running the ladder for page two
  // would hand back page one of a different rung, which reads as the button
  // doing nothing while quietly duplicating rows.
  const wonRef = useRef(null);          // { category, query } — the rung that answered
  const pageRef = useRef(1);
  const seenRef = useRef(new Set());    // mediaKeys already on screen, across pages
  const [more, setMore] = useState(false);      // is another page worth asking for
  const [loadingMore, setLoadingMore] = useState(false);

  const run = useCallback((raw, activeScope, activeProvider) => {
    abortRef.current?.abort();
    // A new query is a new deck: the winning rung, the page counter and the
    // cross-page dedupe set all belong to the search that is being replaced.
    wonRef.current = null;
    pageRef.current = 1;
    seenRef.current = new Set();
    setMore(false);
    setLoadingMore(false);
    const q = raw.trim();
    if (q.length < MIN_CHARS) { setResults(null); setLoading(false); setError(''); return; }

    // A pasted EMBED CODE (a site's <iframe src=…> snippet): play its player.
    const coded = embedFromCode(q);
    if (coded) {
      const host = (() => { try { return new URL(coded.src).hostname.replace(/^www\./, ''); } catch { return 'embed'; } })();
      setLoading(false);
      setError('');
      setUnsupported('');
      setTrace(null);
      setResults([{ ...coded, title: `Video from ${host}`, pageUrl: coded.src, channel: host }]);
      return;
    }

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
      if (isPlaylistUrl(q)) {
        // A WHOLE PLAYLIST. Not "one video": YouTube's playlist embed shows
        // "This video is unavailable" here. One card, whose only action is
        // Play All (PlayerBrowse) — saved to Lists, replaces the queue, plays.
        setResults([{ ...(pasted[0] || {}), src: pasted[0]?.src || q, kind: 'youtube', playlistUrl: q, title: 'YouTube playlist', pageUrl: q }]);
        setUnsupported('');
        setTrace(null);
        return;
      }
      if (pasted.length) {
        setResults(pasted);
        setUnsupported('');
        setTrace(null);
        // Show the row immediately, then upgrade it. A pasted link starts as
        // "soundcloud.com/duck-e-duck" because that is all a URL tells us;
        // the platform's own public oEmbed turns it into the real title,
        // artist and artwork. Keyless and free — and the reason this matters
        // is that a general web index cannot find a small artist at all, so
        // the link IS the discovery path and it should look like one.
        fetch(`${BACKEND}/api/media/resolve?url=${encodeURIComponent(q)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const m = d && d.media;
            if (!m || !(m.title || m.poster)) return;
            setResults((prev) => (prev || []).map((row, i) => (i === 0 ? {
              ...row,
              title: m.title || row.title,
              poster: m.poster || row.poster,
              channel: m.channel || row.channel,
            } : row)));
          })
          .catch(() => { /* offline or a private track — the plain row still plays */ });
        return;
      }
      // ANY OTHER SITE: ask the backend to find the embed the page offers
      // (oEmbed, og:video, a player card, an embed code on the page — see
      // EmbedDiscovery.js). Owner, 2026-10-08: "If there's a free embed code
      // listed on a site I want Truegle to be able to play it, period." Only
      // when there is none does it say so — naming the host, plainly.
      const host = asUrl.hostname.replace(/^www\./, '');
      setResults(null);
      setUnsupported('');
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`${BACKEND}/api/media/resolve?url=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (controller.signal.aborted) return;
          const m = d && d.media;
          setLoading(false);
          if (!m || !m.src) { setResults([]); setUnsupported(host); return; }
          setResults([{
            kind: m.kind, src: m.src, ...(m.vertical ? { vertical: true } : {}),
            title: m.title || host, pageUrl: q, poster: m.poster || null, channel: m.channel || host,
          }]);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
          setResults([]);
          setUnsupported(host);
        });
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
    const once = (category, query, page = 1) => fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ query, filters: { category, bias: 'all', dateRange: 'any', perPage: 20, page, safeSearch: storedSafeSearch() } }),
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
      // Whichever rung produced rows is the one page two comes from.
      .then((rows) => { if (rows.length) wonRef.current = { category, query }; return rows; })
      .catch((e) => { if (e.name === 'AbortError') throw e; return []; });

    // REDDIT ASKS REDDIT.
    //
    // The Reddit chip went through /api/search with category 'social', which
    // is served by SearXNG's social-media engines and a Google CSE query. Both
    // are optional infrastructure: the self-hosted SearXNG box is often cold
    // and the Google key is frequently absent, and when neither answers the
    // backend queues NO providers at all and returns an empty list. That is a
    // Reddit search that is broken for reasons that have nothing to do with
    // Reddit.
    //
    // Reddit's own search.json is public, keyless and always up, and the
    // backend already speaks it for the feed page — so ask it directly and
    // keep the index path as the fallback rather than the only route.
    //
    // The PERMALINK is the URL that matters. A Reddit post's `url` is whatever
    // it links to (an imgur page, a news site, a v.redd.it blob), and none of
    // those is a post the redditmedia embed can play. `permalink` is the
    // /r/<sub>/comments/<id> form getPlayable() accepts.
    const redditQuery = [
      intent.text || q,
      intent.channel ? `subreddit:${String(toHandle(intent.channel, 'reddit')).replace(/^r\//i, '')}` : '',
    ].filter(Boolean).join(' ').trim();

    const redditDirect = () => fetch(`${BACKEND}/api/social/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: redditQuery, platforms: ['reddit'], limit: 25 }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { platforms: {}, errors: { reddit: `HTTP ${r.status}` } }))
      .then((d) => {
        const posts = d.platforms?.reddit || [];
        const rows = posts.map((p) => toSource({
          url: p.permalink,
          title: p.title,
          image: p.thumbnail,
          channel: p.subreddit || p.author,
          date: p.date || null,
        }, true)).filter(Boolean);
        // The upstream's own words, kept for the trace. Reddit refusing a
        // request from our deployment and Reddit having nothing for this
        // query both produce an empty list; only one of them is a bug, and
        // without this there is no way to tell which one happened.
        const why = d.errors?.reddit;
        steps.push(`reddit ${posts.length}→${rows.length}${why ? ` (${why})` : ''}`);
        return rows;
      })
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
    const web = (intent.platform === 'reddit' ? redditDirect() : Promise.resolve([]))
      .then((rows) => (rows.length ? rows : ask(first, intent.backendQuery, true)))
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
          poster: v.thumbnail, channel: v.channel, published: v.published || null,
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

    // The submitted-REELS pool, which lives in its own table (community_reels,
    // not community_media) and was only ever reachable from the /shorts page.
    // Folding that page into the player without folding this would have
    // orphaned every reel anyone had submitted — the links would still be in
    // the database and nothing on the site would ever show them again.
    //
    // Only fetched in the Shorts scope: it is a whole pool, not a search, so
    // merging it into an ordinary query would put unrelated clips at the top
    // of every list.
    const shortsScope = isShortsScope(activeScope);
    const reels = shortsScope
      ? fetch(`${BACKEND}/api/reels?limit=40`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { reels: [] }))
        .then((d) => (d.reels || []).map((x) => toSource({
          url: x.url, title: x.title, image: x.thumbnail, channel: x.author,
        }, true)).filter(Boolean))
        .catch(() => [])
      : Promise.resolve([]);

    Promise.all([web, community, reels])
      .then(([webRows, communityRows, reelRows]) => {
        // De-duplicate by MEDIA, not by URL: a search for a song comes back
        // with the same upload four times over — youtu.be, /watch?v=,
        // /embed/…?si=, a mirror — and every one of those is a different
        // `src`. Keying on src is why the list looked padded with repeats and
        // why auto-advance rolled straight into another copy of the same clip.
        const seen = new Set();
        // THE SUBMITTED POOL IS A POOL, NOT AN ANSWER — and pinning it to the
        // top of the Shorts deck is why the feed opened on the same handful of
        // clips every single time. /api/reels is `ORDER BY created_at DESC`, a
        // fixed list in a fixed order, so leading with it meant the identical
        // first six or eight reels on every launch and every query. It also
        // put clips that have nothing to do with what was typed above the ones
        // that do.
        //
        // Community submissions still lead OUTSIDE Shorts, where the reason
        // holds: somebody vouched that those play, and they are rows the web
        // index does not carry. Inside Shorts the query's own results lead,
        // and the pool is shuffled in behind them — still reachable, no longer
        // the fixed front page of a feed that is supposed to feel endless.
        const tail = shortsScope ? shuffled(reelRows) : [];
        const merged = [...communityRows, ...webRows, ...tail].filter((row) => {
          const key = row && (mediaKey(row) || row.src);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // Two filters before ranking, in this order:
        //   1. ISOLATE the chosen platform. The chip is enforced on rows we
        //      can inspect rather than trusted to a site: operator the index
        //      may ignore or answer with zero.
        //   2. DROP anything known not to play — flagged by this browser or by
        //      enough other people. A result that looks playable and isn't is
        //      the worst kind, because it costs a press to discover.
        const isolated = isolatePlatform(merged, intent.platform);
        const alive = withoutBroken(isolated);
        // Shorts means SHORT. The backend's videos category returns long-form
        // too, so without this the Shorts scope is just search with a
        // different label on it — which is exactly what made the old page's
        // "reels" filter decorative.
        //
        // NOTE THE FIELD. By this point rows are player SOURCES, which carry
        // the original link as `pageUrl`; `url` belongs to the search-result
        // shape these helpers were written for. Filtering on `url` here reads
        // undefined for every row and silently empties the deck.
        const scoped = shortsScope ? alive.map(asShortSource).filter(Boolean) : alive;
        // The dedupe set carries across pages, so page two cannot re-show what
        // page one already did — the ladder's rungs overlap heavily and
        // without this "more" mostly returned the same twenty rows again.
        scoped.forEach((row) => { const k = mediaKey(row) || row.src; if (k) seenRef.current.add(k); });
        // OFFER ANOTHER PAGE WHENEVER A RUNG ANSWERED AT ALL.
        //
        // This used to require 15 rows before it would page. That number was
        // measured against the wrong list: `webRows` has already been through
        // toSource(), so it counts PLAYABLE videos, not results. A 20-result
        // page yields three to eight playable ones on a good day and never
        // fifteen — so the condition was false on every search ever run, `more`
        // was permanently off, and the swipe deck could only show page one. The
        // reported symptom was "it stops discovering new videos".
        //
        // Being liberal here is self-correcting: loadMore() withdraws the offer
        // the moment a page comes back empty or entirely duplicated, so the
        // worst case is one wasted request at the true end of the results.
        setMore(!!wonRef.current && scoped.length > 0);
        setResults(rankPlayable(scoped, intent));
        setTrace({
          steps,
          community: communityRows.length,
          ...(shortsScope ? { reels: reelRows.length } : {}),
          query: intent.backendQuery,
        });
      })
      // An aborted request is a newer keystroke, not a failure.
      .catch((e) => { if (e.name !== 'AbortError') setError('Search is unreachable right now.'); })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, []);

  /**
   * The next page of whatever answered, appended.
   *
   * Deliberately NOT a re-run of the fallback ladder: the ladder starts at the
   * top and would hand back page one of a different rung. `wonRef` is the rung
   * that produced the rows on screen, so that is the one asked again.
   *
   * Community submissions and the Reddit direct path are seeds rather than
   * pages — they are asked once, at the top of the deck, and are not re-asked
   * here. Paging them would mean carrying a second cursor for a handful of
   * rows that already all fit on page one.
   */
  const loadMore = useCallback(() => {
    const won = wonRef.current;
    if (!won) return;
    const controller = new AbortController();
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        query: won.query,
        filters: { category: won.category, bias: 'all', dateRange: 'any', perPage: 20, page: nextPage, safeSearch: storedSafeSearch() },
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        const raw = d.results || [];
        const rows = raw.map((r) => toSource(r, won.category === 'social')).filter(Boolean);
        const fresh = withoutBroken(rows).filter((row) => {
          const k = mediaKey(row) || row.src;
          if (!k || seenRef.current.has(k)) return false;
          seenRef.current.add(k);
          return true;
        });
        pageRef.current = nextPage;
        // A page that came back empty, or entirely of things already shown, is
        // the end. Say so by withdrawing the offer rather than letting people
        // press a button that does nothing.
        //
        // Keyed on FRESH rows, not on the raw count, for the same reason as
        // above: a page can be full of results and still yield nothing new, and
        // it can be half full and still yield plenty. What decides whether
        // there is more to see is whether this page showed you anything.
        setMore(fresh.length > 0);
        if (fresh.length) setResults((prev) => [...(prev || []), ...fresh]);
      })
      .catch(() => { setMore(false); })
      .finally(() => setLoadingMore(false));
  }, []);

  // Once per page load — the blocklist moves on the scale of days, and
  // re-fetching per search would be a request per keystroke.
  useEffect(() => { loadBrokenList(); }, []);

  useEffect(() => {
    const id = setTimeout(() => run(query || '', scope, provider), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, scope, provider, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { results, loading, error, unsupported, trace, more, loadMore, loadingMore };
}
