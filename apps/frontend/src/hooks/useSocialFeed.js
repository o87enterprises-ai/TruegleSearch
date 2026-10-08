import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { authHeader } from '../utils/authHeader';
import { roundRobin } from '../utils/roundRobin';
import { hasSeenPost, markPostsSeen, forgetPostsSeen } from '../utils/feedSeen';

// The backend fans out to up to 16 sources with 8s upstream timeouts; 25s is
// well past a slow-but-working answer.
const FEED_TIMEOUT_MS = 25000;

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// The social feed: one page at a time, forever, across the connected platforms.
//
// ── THE CURSORS ARE THE WHOLE THING ─────────────────────────────────────────
//
// Each platform pages differently — Reddit hands back an opaque `after` token,
// HN and GitHub count pages — so the server carries a cursor per platform and
// this hook just gives back whatever it was last handed. Pretending one cursor
// covers three APIs is how a feed ends up serving page one over and over.
//
// A platform that returns a null cursor has run out and is not asked again.
// When every platform is exhausted the feed ends rather than spinning on
// endpoints that will keep returning the same rows.
//
// ── DEDUPED BY ID ───────────────────────────────────────────────────────────
//
// Reddit's `after` is positional, not a snapshot: posts move between the time
// page one is fetched and page two is asked for, so the same post genuinely
// can arrive twice. Keying on `platform:id` is what stops it rendering twice.

const PAGE = 20;
const emptyCursor = () => ({});

export function useSocialFeed({
  query = '', platforms = [], enabled = true,
  // OPT-IN, so the behaviour every existing caller and its browser suite
  // depends on is untouched. /feed/tube and the aggregated feed want the
  // round-robin ordering and the persistent ledger; the plain social feed
  // wants the server's date-sorted merge it has always had.
  interleave = false,
  rememberSeen = false,
} = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // Per-platform upstream failures, in the upstream's own words. Rendered by
  // the page so "Reddit refused this request" reaches the reader instead of
  // an empty list that explains nothing.
  const [platformErrors, setPlatformErrors] = useState([]);
  // EVERYTHING HERE HAS ALREADY BEEN SEEN — a distinct outcome from "this
  // feed is empty" and from "this feed is broken", and the only one of the
  // three the reader can actually do something about. Without it the
  // never-repeat ledger renders a blank page explaining nothing, which is
  // the same unreportable failure the upstream-errors field was added to fix.
  const [allSeen, setAllSeen] = useState(false);

  const cursor = useRef(emptyCursor());
  const seen = useRef(new Set());
  const abort = useRef(null);
  // Guards a second request while one is in flight. The scroll sentinel can
  // fire several times before the first page lands, and without this a single
  // fast scroll fetches page two four times.
  const inFlight = useRef(false);

  // A separator that cannot appear in either half. `\0` written as an
  // ESCAPE, not as a raw byte: it was a literal NUL in the source, which
  // makes this file read as binary to grep and every other line-based
  // tool, and is one careless formatter away from being silently
  // stripped — at which point two different feeds would share a cache key.
  // Safe Search is part of WHICH feed this is: changing it reloads the feed
  // (adult posts in or out — see SAFE SEARCH IN THE FEED in routes/social.js).
  const { settings } = useSettings();
  const safeSearch = settings?.safeSearch || 'safe';
  const key = `${query}\0${[...platforms].sort().join(',')}\0${safeSearch}`;
  const activeKey = useRef(key);

  const fetchPage = useCallback(async (first) => {
    if (!enabled || !platforms.length) return;
    if (inFlight.current) return;
    if (!first && done) return;

    inFlight.current = true;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    abort.current?.abort();
    abort.current = controller;
    const forKey = activeKey.current;
    // A request that never answers used to spin forever — reported from a
    // phone where the page sat on the loader indefinitely. After this long it
    // is a failure, and says so, instead of a loader that never ends.
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, FEED_TIMEOUT_MS);

    try {
      const res = await fetch(`${BACKEND}/api/social/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        signal: controller.signal,
        body: JSON.stringify({
          safeSearch,
          // An empty query is the home feed, not an error — the server sends
          // it to each platform's popular listing instead of its search.
          query,
          platforms,
          limit: PAGE,
          cursor: first ? {} : cursor.current,
        }),
      });
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const data = await res.json();

      // A response for a query the user has already moved on from must not
      // land in the list. The abort usually catches this; the key check
      // catches the race where it resolved just before abort() ran.
      if (forKey !== activeKey.current) return;

      // WHAT THE SERVER SAID WENT WRONG.
      //
      // This field was fetched and dropped on the floor. The route answers 200
      // with `results: []` and `errors: { reddit: '…' }` when an upstream
      // refuses — so a blocked platform was indistinguishable from a platform
      // with nothing to show, and the page rendered an empty list either way.
      // "The feed won't load" is exactly that, and it cannot be diagnosed from
      // the outside because the only symptom is nothing.
      const upstream = Object.entries(data.errors || {})
        .filter(([, v]) => v)
        .map(([platform, reason]) => ({ platform, reason }));
      setPlatformErrors(upstream);

      const next = data.nextCursor || {};
      // Only keep cursors for platforms that still have more. Sending a null
      // back would make the server start that platform from the top again.
      const live = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== null && v !== undefined));
      cursor.current = live;

      // ONE FROM EACH SOURCE IN TURN, when asked for.
      //
      // The server sends BOTH a merged `results` (sorted newest first) and the
      // per-platform arrays it was built from. Date-sorting the union lets the
      // fastest-posting source take every slot at the top — see
      // utils/roundRobin.js — so the aggregated feed rebuilds the page from
      // `platforms` instead. Everything else below is identical either way.
      //
      // FALLING BACK TO `results` IS NOT OPTIONAL. A response carrying posts
      // in `results` but no per-platform arrays interleaves to NOTHING, and
      // the feed renders empty while reporting no error at all — the worst
      // possible failure, because it looks like "there is nothing to show".
      // Caught by feedpage:test the first time this ran. Any response shape
      // that has posts must produce posts.
      const merged = data.results || [];
      const interleaved = interleave ? roundRobin(data.platforms || {}) : [];
      const ordered = interleaved.length ? interleaved : merged;

      const fresh = [];
      const repeats = [];
      for (const row of ordered) {
        const id = `${row.platform}:${row.id}`;
        // In-session dedupe stays absolute: the same post must never appear
        // twice in one list, whatever else happens.
        if (seen.current.has(id)) continue;
        // The persistent ledger, when the caller wants "never twice" to
        // survive a reload rather than just a render. Held aside rather than
        // dropped — see the fallback immediately below.
        if (rememberSeen && hasSeenPost(id)) { repeats.push({ ...row, _key: id, _repeat: true }); continue; }
        seen.current.add(id);
        fresh.push({ ...row, _key: id });
      }

      // ── REPEATING IS THE LAST RESORT, AND IT BEATS AN EMPTY PAGE ───────────
      //
      // Never-repeat is the rule, not a suicide pact. When the ledger has
      // already seen everything this page returned, honouring it strictly
      // renders nothing — and a blank feed is worse than a familiar one: it
      // looks broken, it explains nothing, and it is the exact unreportable
      // failure the upstream-errors panel exists to prevent. So the suppressed
      // rows are served instead, flagged `_repeat` so the UI can say quietly
      // that this is ground already covered.
      //
      // Only ever a fallback: if there is a single genuinely new post, the
      // repeats stay held back and the rule holds.
      const usingRepeats = fresh.length === 0 && repeats.length > 0;
      const pageRows = usingRepeats ? repeats : fresh;
      // Marking repeats as seen-in-session too, so one scroll cannot cycle the
      // same handful forever.
      for (const r of pageRows) seen.current.add(r._key);
      if (rememberSeen && fresh.length) markPostsSeen(fresh.map((r) => r._key));
      setAllSeen(usingRepeats);

      setItems((prev) => (first ? pageRows : [...prev, ...pageRows]));

      // A FAILURE IS NOT AN ENDING.
      //
      // A platform that errored reports a null cursor, exactly like a platform
      // that has run out — so a single blocked upstream emptied `live` and set
      // done=true on the FIRST page. The feed then declared itself finished,
      // permanently, having shown nothing, and the sentinel never asked again.
      // If every platform errored, this is a broken feed, and it says so.
      const allFailed = upstream.length > 0 && upstream.length >= platforms.length;
      if (allFailed) {
        setError(upstream.length === 1
          ? `${upstream[0].platform} is not answering right now.`
          : 'None of your connected feeds are answering right now.');
      }
      // Out of cursors means every platform is exhausted. Also stop if a page
      // came back with nothing new at all — that is the same situation from
      // the reader's side, and it prevents an infinite scroll that loads
      // forever and shows nothing.
      setDone(!allFailed && (!Object.keys(live).length || (!first && pageRows.length === 0)));
    } catch (e) {
      if (e.name === 'AbortError' && !timedOut) return;
      // WHY, in a few words, so a screenshot names the cause: a status code
      // means the server answered and refused (429 = rate limit, 5xx = the
      // backend failed); no status means the request never got an answer —
      // offline, blocked by the browser or an extension, or a network drop.
      const status = /^feed (\d{3})$/.exec(e.message || '')?.[1];
      const why = timedOut ? `no answer after ${FEED_TIMEOUT_MS / 1000}s`
        : status === '429' ? 'too many requests (429)'
        : status ? `server said ${status}`
          : 'no answer from the server — network or browser blocked it';
      setError(`That feed is unreachable right now (${why}).`);
      setDone(true);
    } finally {
      clearTimeout(timer);
      if (forKey === activeKey.current) { setLoading(false); inFlight.current = false; }
    }
  }, [enabled, query, platforms.join(','), done, interleave, rememberSeen, safeSearch]);

  // A new query or a changed provider set is a NEW feed, not more of the old
  // one: reset the cursors and the dedupe ledger before asking.
  useEffect(() => {
    activeKey.current = key;
    cursor.current = emptyCursor();
    seen.current = new Set();
    inFlight.current = false;
    setItems([]);
    setDone(false);
    setPlatformErrors([]);
    if (!enabled || !platforms.length) { setLoading(false); return; }
    fetchPage(true);
  }, [key, enabled]);

  /**
   * Ref callback for the element at the bottom of the list. Attach it and the
   * feed loads more when it scrolls into view — the same IntersectionObserver
   * shape useFeedAutoplay already uses, which is the one known to work with
   * this app's scroll containers.
   */
  const sentinel = useCallback((el) => {
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) fetchPage(false);
    }, { rootMargin: '600px 0px' });   // start early so it feels continuous
    io.observe(el);
    // Disconnect when the node goes away. A ref callback gets null on unmount,
    // which is handled by the early return above; this closure is collected
    // with the element.
    el.__feedObserver?.disconnect();
    el.__feedObserver = io;
  }, [fetchPage]);

  // Forget the ledger and start over. This is the "unless the user returns to
  // their history" half of never-repeat: it has to be reachable, or the rule
  // is just a feed that quietly runs out and stays empty.
  const showSeenAgain = useCallback(() => {
    forgetPostsSeen();
    seen.current = new Set();
    cursor.current = emptyCursor();
    setAllSeen(false);
    setDone(false);
    setItems([]);
    fetchPage(true);
  }, [fetchPage]);

  // Start the list again from the top WITHOUT forgetting the ledger — the
  // difference from showSeenAgain, which deliberately forgets. Wanted after
  // something is added to the feed: the new row should appear, but everything
  // already read should stay read.
  const reload = useCallback(() => {
    cursor.current = emptyCursor();
    seen.current = new Set();
    setAllSeen(false);
    setDone(false);
    setItems([]);
    fetchPage(true);
  }, [fetchPage]);

  return {
    items, loading, error, done, sentinel, platformErrors, loadMore: () => fetchPage(false),
    allSeen, showSeenAgain, reload,
  };
}

export default useSocialFeed;
