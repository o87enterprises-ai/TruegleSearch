import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import SearchPageShell from '../components/layout/SearchPageShell';
import FeedCard from '../components/feed/FeedCards';
import { PROVIDERS, byId, platformsFor, needsAuth, isConnectable } from '../config/socialProviders';
import FeedServers from '../components/feed/FeedServers';
import FeedModeSelector from '../components/feed/FeedModeSelector';
import FeedBrowse from '../components/feed/FeedBrowse';
import { categoryById, platformsForCategory } from '../config/feedCategories';
import { useSocialConnections, connect as connectSource } from '../hooks/useSocialConnections';
import { useSocialFeed } from '../hooks/useSocialFeed';
import { useFeedFocus } from '../hooks/useFeedFocus';
import { useFeedCursor } from '../hooks/useFeedCursor';
import { usePlayer } from '../context/PlayerContext';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// The Feed page: your social accounts, in one place, on the Truegle layout.
//
// This is the old /extract route rebuilt. Extract was one of only two pages
// categorically off the house layout — it rolled its own starfield, its own
// pill bar and a max-w-3xl column — and docs/UI-REDESIGN-SPEC.md has specified
// "match the finalized /search layout" for it since long before this. The
// ExtractPage component is still in the tree, dormant, pending the Tube fold.
//
// TWO STATES, ONE SHELL:
//
//   nothing connected  → reads as a sign-in. Provider pills, the ones that
//                        cannot work greyed out with the real reason.
//   something connected → the feed fills the results region and scrolls.
//
// The layout does not change between them, which is the point: this is the
// search page with a different thing under the bar, not a second design.
//
// NO SEARCH BAR HERE ANY MORE, on purpose. It searched the feeds by typed
// query — a capability this page has stopped offering, not moved elsewhere.
//
// THE COLOUR PILL STAYS, though — brand continuity across every search-family
// page, and a quick way off Feed that costs nothing. It used to navigate only
// via the search bar's own submit ("cycles, never navigates by itself" — see
// PillModeRow's own header). With no bar to submit through, cycling it now
// navigates immediately instead, same as FeedModeSelector already does.
// EITHER WAY THE PLAYER QUEUE SURVIVES: PlayerContext is mounted once, above
// <Routes> (App.jsx) — a route change is invisible to it. Only an explicit
// stop/close touches what's playing or queued, and clicking a mode pill is
// neither.

export default function FeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connections, ids, disconnect } = useSocialConnections();
  const { setPoppedOut } = usePlayer();
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');

  // DEFAULT THE PLAYER TO POPPED OUT, ONCE, EVER, IN THIS BROWSER. Feed no
  // longer has a permanent in-page dock (see Stage 3's per-card slot and the
  // search bar removal below) — the floating 9:16 corner is the intended
  // default experience here now, not something you have to discover the
  // pop-out button to reach. The marker is what makes this a DEFAULT rather
  // than a standing override: fires once, so a visitor who later docks back
  // in on purpose stays docked on their next visit — PlayerContext already
  // persists poppedOut/dock across reloads (see loadState() there).
  useEffect(() => {
    try {
      const KEY = 'truegle_feed_defaulted_pop_v1';
      if (localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, '1');
      setPoppedOut(true);
    } catch { /* private mode / quota — the default just won't stick */ }
  }, [setPoppedOut]);

  // SERVERS — default all, per spec. Everything keyless is on for a brand-new
  // visitor, so the feed has something in it the moment the page opens rather
  // than opening empty behind a "connect something first" gate. Sources that
  // need an account are not in this default (see FeedServers): switching one
  // on for somebody who has not connected it would fetch nothing and surface
  // an error they did not cause.
  const [servers, setServers] = useState(() => PROVIDERS.filter((p) => isConnectable(p.id)).map((p) => p.id));

  // WHICH OF THE THREE VIEWS IS ON SCREEN.
  //   'home'      the randomized timeline across every switched-on source
  //   'browse'    the category rows, each a horizontal preview
  //   <id>        one category, opened as a vertical feed
  // Back from a category goes to 'browse', not 'home' — you came from the rows
  // and that is where you expect to land.
  const [view, setView] = useState('home');
  const openCategory = view !== 'home' && view !== 'browse' ? categoryById(view) : null;

  // What actually gets asked for: the servers switched on here, plus anything
  // connected through an account. A connected source the visitor has since
  // switched off in the dropdown stays off — the dropdown is the control.
  const activeIds = useMemo(
    () => [...new Set([...servers, ...ids])].filter((id) => servers.includes(id)),
    [servers.join(','), ids.join(',')],
  );
  // An opened category narrows the timeline to its own sources; home uses all
  // of them. Intersected with what Servers has switched on either way, so a
  // source turned off is off everywhere.
  const platforms = useMemo(() => {
    const all = platformsFor(activeIds);
    if (!openCategory) return all;
    return platformsForCategory(openCategory, all);
  }, [activeIds.join(','), openCategory?.id]);
  const feed = useSocialFeed({
    // The category's own seed topic, when one is open. There is no typed
    // override any more — see the search bar removal below.
    query: openCategory?.topic || '',
    platforms,
    enabled: platforms.length > 0,
    // The aggregated timeline: one post from every source in turn rather than
    // the server's date-sorted merge, and never the same post twice even
    // across a reload. See utils/roundRobin.js and utils/feedSeen.js.
    interleave: true,
    rememberSeen: true,
  });

  // A handshake that failed hands its reason over on the navigation rather than
  // in the URL — the exchange itself happens in FeedCallback, which owns
  // /feed/callback precisely so this page mounts once, already connected.
  useEffect(() => {
    if (location.state?.feedError) setFailed(location.state.feedError);
  }, [location.state]);

  const start = useCallback((id) => {
    setFailed('');
    // A PUBLIC SOURCE HAS NOTHING TO AUTHORISE. Hacker News and GitHub are
    // keyless and accountless, so switching one on is a local toggle — sending
    // it round an OAuth handshake would be theatre, and the kind that teaches
    // people to expect Truegle to ask for logins it does not need.
    if (!needsAuth(id)) { connectSource({ provider: id }); return; }
    setBusy(id);
    // A full-page redirect, not a popup and not an iframe. Every one of these
    // providers serves its login with X-Frame-Options: DENY precisely to stop
    // a third party framing a login box — the login can only happen at the top
    // level, in their own address bar.
    window.location.assign(`${BACKEND}/api/social-auth/${id}/start?return=/feed`);
  }, []);

  // The pill cycles and navigates in the same click — there is no submit
  // step to defer to any more. 'yellow' is Feed, i.e. here already, so that
  // one leg is a no-op; every other leg matches FeedModeSelector's own
  // routes exactly.
  const onPill = useCallback((next) => {
    if (next === 'yellow') return;
    if (next === 'black') { navigate('/chat'); return; }
    if (next === 'tube') { navigate('/feed/tube'); return; }
    navigate(`/search?mode=${next}`);
  }, [navigate]);

  return (
    <SearchPageShell mode="yellow" pillMode="yellow" onPillSelect={onPill}>
      {failed && (
        <div className="max-w-4xl mx-auto mb-4 px-4 py-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-200 text-sm">
          {failed}
        </div>
      )}

      {/* WHY THE FEED IS EMPTY, when it is.
          The server reports per-platform failures and this page used to
          discard them, so "Reddit refused this request" and "Reddit had
          nothing to show" both rendered as a blank page. An empty feed with
          no explanation is unreportable — there is nothing for anyone to
          describe except the absence. */}
      {(feed.platformErrors || []).length > 0 && (
        <div
          data-feed-upstream-errors=""
          className="max-w-4xl mx-auto mb-4 px-4 py-3 rounded-xl bg-amber-950/25 border border-amber-500/30 text-amber-100/90 text-sm"
        >
          {feed.platformErrors.map(({ platform, reason }) => (
            <p key={platform} className="leading-snug">
              {/* The provider's own name, not `capitalize` on the id — that
                  rendered "Github" and "Hackernews", which is how a page
                  starts looking machine-generated. */}
              <span className="font-semibold">{byId(platform)?.label || platform}</span> didn&apos;t answer —{' '}
              <span className="text-amber-200/70">{reason}</span>
            </p>
          ))}
        </div>
      )}

      {/* Which state the page is in, for the browser test to wait on. Timing
          a cold boot with a fixed sleep is how a suite starts failing on a
          slower machine for reasons that have nothing to do with the code. */}
      <div data-feed-state={platforms.length ? 'connected' : 'arrival'} hidden />

      {/* THE CHROME: which view is open, and which servers feed the
          timeline. Sits directly under the pill now — no search bar row
          between them any more, see the header note. */}
      <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-2">
        <FeedModeSelector active="feed" />
        <div className="flex items-center gap-2">
          {/* HOME / BROWSE. Home is the randomized timeline; Browse is the
              category rows. An opened category counts as Browse, because that
              is where its Back button returns to. */}
          <div className="inline-flex rounded-full p-0.5 border border-white/15" role="group" aria-label="View">
            {[['home', 'Home'], ['browse', 'Browse']].map(([id, label]) => {
              const on = id === 'home' ? view === 'home' : view !== 'home';
              return (
                <button
                  key={id}
                  type="button"
                  data-feed-view={id}
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setView(id)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    on ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <FeedServers selected={servers} onChange={setServers} />
        </div>
      </div>

      {/* NO FIXED PLAYER BOX HERE ANYMORE. The slot moved onto whichever card
          is actually playing — see FeedCard's `isLive` branch in
          FeedCards.jsx and useFeedCursor.js. A centered card XOR a popped-out
          corner window, never a third empty box sitting idle between them. */}

      {/* Which category is open, and the way back. Back goes to the rows rather
          than to Home: you arrived from Browse, so that is where returning
          means. */}
      {openCategory && (
        <div className="max-w-4xl mx-auto mb-3 flex items-center gap-2">
          <button
            type="button"
            data-browse-back=""
            onClick={() => setView('browse')}
            className="px-2.5 py-1 text-xs rounded-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors"
          >
            ← Browse
          </button>
          <span className="text-white/80 text-sm font-semibold">{openCategory.label}</span>
          <span className="text-white/35 text-xs">{openCategory.blurb}</span>
        </div>
      )}

      {/* NO LONGER A GATE.
          This page used to render a full-screen "connect an account first"
          arrival state and ask for no feed at all until somebody did. That
          made the first run an empty page with homework on it, and it is not
          what the aggregated feed is for — the keyless sources need no
          account and are on by default now, so there is always something to
          show. Connecting an account is still offered, as an affordance in the
          row below rather than a wall in front. The only way to reach a truly
          empty state now is to switch every server off, which FeedServers
          refuses to let happen. */}
      {view === 'browse' ? (
        <FeedBrowse enabledIds={platformsFor(activeIds)} onOpen={setView} />
      ) : platforms.length === 0 ? (
        <ArrivalState onConnect={start} busy={busy} />
      ) : (
        <>
          <ConnectedRow connections={connections} onDisconnect={disconnect} onConnect={start} busy={busy} />
          <FeedList feed={feed} />
        </>
      )}
    </SearchPageShell>
  );
}

// ── arrival ─────────────────────────────────────────────────────────────────

function ArrivalState({ onConnect, busy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-white text-xl font-bold mb-2">Your feeds, in one place</h1>
        <p className="text-white/50 text-sm max-w-lg mx-auto">
          Connect the accounts you already use. Truegle reads them — it never posts, never
          votes, and never asks for a password. Nothing about who you are is stored on our side.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const ready = p.status === 'demo' || p.status === 'open';
          return (
            <button
              key={p.id}
              type="button"
              data-provider={p.id}
              data-ready={ready ? 'yes' : 'no'}
              disabled={!ready || !!busy}
              aria-disabled={!ready}
              onClick={() => ready && onConnect(p.id)}
              title={p.note}
              className={`relative px-4 py-4 rounded-2xl border text-left transition-all ${
                ready
                  ? 'bg-white/[0.06] border-white/20 hover:border-white/40 hover:bg-white/[0.1] cursor-pointer'
                  : 'bg-white/[0.02] border-white/10 cursor-not-allowed opacity-50'
              }`}
            >
              <span className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.colour }} />
                <span className={`font-semibold text-sm ${ready ? 'text-white' : 'text-white/50'}`}>{p.label}</span>
                {busy === p.id && <Loader2 size={13} className="animate-spin text-white/60 ml-auto" />}
              </span>
              {/* The real reason, not a placeholder. Somebody who wants to know
                  why X is grey deserves "it costs $200/mo", not "soon". */}
              <span className={`block text-[11px] leading-tight ${ready ? 'text-emerald-300/70' : 'text-white/35'}`}>
                {ready ? p.note : `Coming soon — ${p.note}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-white/30 text-[11px] text-center mt-5 max-w-lg mx-auto">
        Where a sign-in is needed it happens on the provider&apos;s own site, in your address
        bar — never in a box on this page. Hacker News and GitHub need none at all: they are
        public, so switching them on is just a switch. Most of the rest cannot serve a
        personal feed to anyone at any price; the ones that can are the ones you can press.
      </p>
    </motion.div>
  );
}

// ── connected ───────────────────────────────────────────────────────────────

// Connected sources, and the ones you could still add.
//
// The arrival pills disappear the moment anything is connected, so with only
// Reddit on offer there was nowhere to add a second source — and now that
// Hacker News and GitHub are their own pills rather than being smuggled in
// under Reddit, "nowhere to add a second source" would mean nobody could ever
// reach them without disconnecting first. The unconnected ready ones sit here,
// faint, next to what is already on.
function ConnectedRow({ connections, onDisconnect, onConnect, busy }) {
  const connected = new Set(connections.map((c) => c.provider));
  const addable = PROVIDERS.filter((p) => !connected.has(p.id) && (p.status === 'demo' || p.status === 'open'));
  return (
    <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center gap-2">
      <span className="text-white/30 text-[10px] uppercase tracking-wider">Connected</span>
      {connections.map((c) => {
        const meta = PROVIDERS.find((p) => p.id === c.provider);
        return (
          <span
            key={c.provider}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-white/[0.06] border border-white/15 text-xs text-white/80"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: meta?.colour || '#888' }} />
            {meta?.label || c.provider}
            <button
              type="button"
              onClick={() => onDisconnect(c.provider)}
              aria-label={`Disconnect ${meta?.label || c.provider}`}
              className="p-0.5 rounded-full text-white/40 hover:text-white hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </span>
        );
      })}

      {addable.map((p) => (
        <button
          key={p.id}
          type="button"
          data-provider={p.id}
          data-ready="yes"
          disabled={busy === p.id}
          onClick={() => onConnect(p.id)}
          title={p.note}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.02] border border-dashed border-white/15 text-xs text-white/45 hover:text-white/80 hover:border-white/30 transition-colors"
        >
          {busy === p.id
            ? <Loader2 size={11} className="animate-spin" />
            : <Plus size={11} />}
          {p.label}
        </button>
      ))}
    </div>
  );
}

function FeedList({ feed }) {
  const { items, loading, error, done, sentinel, allSeen } = feed;
  // Which card is nearest the vertical center of the viewport, purely for the
  // enlarge/play-button treatment — nothing here ever autoplays. See
  // useFeedFocus's own header for why it's a sibling of useFeedAutoplay
  // rather than a reuse of it.
  const { activeIndex, register } = useFeedFocus();
  // This page's own feed-follow cursor — see useFeedCursor.js. Starting
  // playback on a card also arms this, so a later fullscreen swipe has
  // this feed's own rows to walk rather than falling through to Tube's
  // unrelated discovery.
  const { beginFrom } = useFeedCursor(items);
  const { current, poppedOut, feedActive, stop } = usePlayer();

  // SCROLLING THE PLAYING CARD OUT OF FOCUS STOPS IT. "It stops and the next
  // centered card then begins thumbnail preview and can be clicked to play"
  // — the owner's own words for this. Popped-out is exempt on purpose: once
  // the player is in its floating corner it is no longer "in" any card, so
  // scrolling the feed underneath it must not touch it.
  useEffect(() => {
    if (poppedOut || !feedActive || !current) return;
    const focusedPost = activeIndex != null ? items[activeIndex] : null;
    const focusedLink = focusedPost?.permalink || focusedPost?.url;
    if (focusedLink && current.pageUrl === focusedLink) return; // still on it
    stop();
  }, [activeIndex, poppedOut, feedActive, current, items, stop]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Said plainly rather than implied. Without OAuth there is no personal
          front page on any of these, so calling this "your feed" would be a
          claim the data cannot support. Unconditional now — there is no more
          typed query to distinguish "popular" from "searched", see the
          search bar removal above. */}
      <p className="text-white/30 text-[11px] mb-3">
        Popular right now. A personal feed needs a provider to grant one — see the notes on
        each account.
      </p>

      <div className="space-y-3">
        {items.map((post, idx) => (
          <div key={post._key} ref={(el) => register(idx, el)}>
            <FeedCard post={post} focused={idx === activeIndex} onPlay={() => beginFrom(post)} />
          </div>
        ))}
      </div>

      {error && <p className="text-red-300/70 text-sm py-6 text-center">{error}</p>}

      {/* GROUND ALREADY COVERED — said quietly, above the posts.
          The never-repeat ledger holds back what has been shown before, but
          when that would leave the page with nothing at all the held-back rows
          are served anyway (see useSocialFeed): a familiar feed beats a blank
          one, which looks broken and explains nothing. This is the note that
          keeps that honest, rather than silently re-serving old posts as if
          they were new. */}
      {allSeen && !!items.length && (
        <p data-feed-all-seen="" className="text-white/35 text-[11px] mb-3">
          You&apos;re caught up — showing posts you&apos;ve already seen until these sources
          have something new.
        </p>
      )}

      {!loading && !items.length && !error && !allSeen && (
        <p className="text-white/40 text-sm py-10 text-center">Nothing to show yet.</p>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-white/40" />
        </div>
      )}

      {/* The load-more trigger. Rendered only while there is more to get, so a
          finished feed cannot sit here re-triggering against exhausted
          endpoints. */}
      {!done && !loading && items.length > 0 && <div ref={sentinel} className="h-px" aria-hidden />}

      {done && items.length > 0 && (
        <p className="text-white/25 text-xs py-8 text-center">That is everything these accounts will give.</p>
      )}
    </div>
  );
}
