import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Plus, X } from 'lucide-react';
import SearchPageShell from '../components/layout/SearchPageShell';
import SearchBar from '../components/ui/SearchBar';
import FeedLinkSubmit from '../components/feed/FeedLinkSubmit';
import FeedCard from '../components/feed/FeedCards';
import { PROVIDERS, platformsFor, needsAuth, isConnectable } from '../config/socialProviders';
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
// THE SEARCH BAR SEARCHES THE FEEDS, AND ONLY THE FEEDS. It is not a web
// search box that happens to live here: submitting sends the query to
// /api/social/feed across the servers switched on in the dropdown, and the
// results replace the timeline in place. It never leaves the page and never
// reaches the web index — going to the web is what the pill is for.
//
// THE COLOUR PILL navigates on the click now, rather than waiting for a
// submit to carry it ("cycles, never navigates by itself" was the old rule —
// see PillModeRow's own header). That split is deliberate: the bar means
// "search what I am looking at", the pill means "take me somewhere else",
// and neither can be mistaken for the other.
//
// EITHER WAY THE PLAYER QUEUE SURVIVES: PlayerContext is mounted once, above
// <Routes> (App.jsx) — a route change is invisible to it. Only an explicit
// stop/close touches what's playing or queued, and clicking a mode pill is
// neither.

export default function FeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connections, ids, disconnect } = useSocialConnections();
  const { setPoppedOut } = usePlayer();
  // ?q= arrives from the pill countdown on another page carrying what was
  // typed there; the feed searches it straight away.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [submitted, setSubmitted] = useState(() => (searchParams.get('q') || '').trim());
  const [pillMode, setPillMode] = useState('yellow');
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
    // An opened category with a topic seeds the query, unless the visitor has
    // typed something — what they typed always wins over the category's seed.
    query: submitted || openCategory?.topic || '',
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

  // The pill no longer navigates on the click: SmartPill (in the shell) runs
  // a 5-second countdown and carries the typed text to the chosen page.

  // SEARCHES THE FEEDS IN PLACE — never the web. `submitted` feeds straight
  // back into useSocialFeed's query above, which asks /api/social/feed across
  // the switched-on servers only.
  const submit = useCallback(() => setSubmitted(query.trim()), [query]);

  // Which sources answered with a failure this time round. Handed to
  // FeedServers so those rows grey out and say "service coming soon" rather
  // than the page shouting an HTTP status at somebody who cannot act on it.
  const downProviders = useMemo(
    () => (feed.platformErrors || []).map((e) => e.platform).filter(Boolean),
    [feed.platformErrors],
  );

  const searchBar = (
    <SearchBar
      value={query}
      showSearchButton={false}
      showBiasedButton={false}
      showUnbiasedButton={false}
      showCategories={false}
      onChange={setQuery}
      onSubmit={submit}
      onSearch={submit}
      onClear={() => { setQuery(''); setSubmitted(''); }}
      placeholder="Search these feeds, or paste a link to post…"
    />
  );

  return (
    <SearchPageShell mode="yellow" pillMode={pillMode} onPillSelect={setPillMode} pageMode="yellow" query={query} searchBar={searchBar}>
      {/* Directly under the bar, because it is about what is IN the bar. It
          renders nothing at all unless what was typed is a link the player can
          host, so the search box stays a search box the rest of the time. */}
      <div className="max-w-4xl mx-auto mb-4">
        <FeedLinkSubmit url={query} onPosted={() => { setQuery(''); feed.reload?.(); }} />
      </div>

      {failed && (
        <div className="max-w-4xl mx-auto mb-4 px-4 py-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-200 text-sm">
          {failed}
        </div>
      )}

      {/* A FAILING UPSTREAM IS SHOWN WHERE THE SOURCES ARE, NOT AS A BANNER.
          This used to be an amber panel quoting each upstream's own words
          ("HTTP 403 — GitHub refused this request") above the feed. That is
          the right information in the wrong place and the wrong voice: a
          visitor cannot act on a status code, and it made a working page
          read as broken. The same fact now greys the source out inside the
          Servers dropdown with "service coming soon" on it, which is where
          somebody would go to do the only thing they can do about it —
          switch it off. See `downProviders` above and FeedServers. */}

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
                  // Feed-only control, so its active state matches Feed's own
                  // pill colour rather than the generic white every other
                  // page's toggle uses.
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    on ? 'bg-yellow-500/15 text-yellow-300' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <FeedServers selected={servers} onChange={setServers} down={downProviders} />
        </div>
      </div>

      {/* THE LENS ANCHOR. Not a slot and not a box — it reserves no space and
          renders nothing. All MiniPlayer reads from it is where this page's
          content column sits horizontally; everything vertical is the
          viewport's, which is what keeps the lens still while the feed
          scrolls behind it. See the lens note in MiniPlayer.jsx.

          Its presence is also the opt-in: the feed player is a lens HERE, and
          the bottom-right corner window anywhere else it follows you to. */}
      <div data-player-lens aria-hidden="true" className="max-w-4xl mx-auto h-0" />

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

  // SCROLLING PAST THE PLAYING CARD NO LONGER STOPS IT — it holds.
  //
  // This used to stop playback the moment the playing card left the centre
  // band ("it stops and the next centered card then begins thumbnail preview",
  // the original ask). Superseded: what is on plays through, and anything
  // queued behind it plays after, whatever the feed does underneath. Only when
  // there is nothing left does the player get out of the way, by minimizing
  // out of the lens to the corner — see advance() in TrueglePlayer.jsx.
  //
  // The two rules answer the same question and cannot both be live: stopping
  // on scroll meant a queue could never be heard, since queueing something and
  // then scrolling to find the next thing is the same gesture. There is no
  // effect here now on purpose. Focus still only enlarges a card, which is all
  // useFeedFocus was ever for.

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
