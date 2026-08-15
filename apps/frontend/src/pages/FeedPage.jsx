import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import SearchPageShell from '../components/layout/SearchPageShell';
import SearchBar from '../components/ui/SearchBar';
import FeedCard from '../components/feed/FeedCards';
import { PROVIDERS, platformsFor } from '../config/socialProviders';
import { useSocialConnections } from '../hooks/useSocialConnections';
import { useSocialFeed } from '../hooks/useSocialFeed';

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

export default function FeedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connections, ids, disconnect } = useSocialConnections();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [pillMode, setPillMode] = useState('yellow');
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');

  const platforms = useMemo(() => platformsFor(ids), [ids.join(',')]);
  const feed = useSocialFeed({ query: submitted, platforms, enabled: platforms.length > 0 });

  // A handshake that failed hands its reason over on the navigation rather than
  // in the URL — the exchange itself happens in FeedCallback, which owns
  // /feed/callback precisely so this page mounts once, already connected.
  useEffect(() => {
    if (location.state?.feedError) setFailed(location.state.feedError);
  }, [location.state]);

  const start = useCallback((id) => {
    setFailed('');
    setBusy(id);
    // A full-page redirect, not a popup and not an iframe. Every one of these
    // providers serves its login with X-Frame-Options: DENY precisely to stop
    // a third party framing a login box — the login can only happen at the top
    // level, in their own address bar.
    window.location.assign(`${BACKEND}/api/social-auth/${id}/start?return=/feed`);
  }, []);

  // The pill CYCLES, it does not navigate. This is the model every other page
  // uses (UniversalSearch:671, LandingPage, TruegleChat): one click advances the
  // mode, and where a submit goes is decided at submit time. Navigating on the
  // click instead meant a single press launched you off the feed into Chat and
  // there was no way to reach blue, green or red from here at all — the cycle
  // has to be walkable.
  const onPill = useCallback((next) => setPillMode(next), []);

  const submit = useCallback(() => {
    const q = query.trim();
    // Yellow is this page, so a submit searches the feeds in place. Any other
    // mode means the pill was cycled away, and the submit is what carries the
    // query there — matching submitSearch() on the search page.
    if (pillMode === 'yellow') { setSubmitted(q); return; }
    if (pillMode === 'black') { navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat'); return; }
    if (pillMode === 'tube') { navigate(q ? `/tube?q=${encodeURIComponent(q)}` : '/tube'); return; }
    navigate(`/search?mode=${pillMode}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  }, [pillMode, query, navigate]);

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
      placeholder={connections.length ? 'Search your feeds…' : 'Connect an account to search it'}
    />
  );

  return (
    <SearchPageShell mode="yellow" pillMode={pillMode} onPillSelect={onPill} searchBar={searchBar}>
      {failed && (
        <div className="max-w-4xl mx-auto mb-4 px-4 py-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-200 text-sm">
          {failed}
        </div>
      )}

      {/* Which state the page is in, for the browser test to wait on. Timing
          a cold boot with a fixed sleep is how a suite starts failing on a
          slower machine for reasons that have nothing to do with the code. */}
      <div data-feed-state={connections.length ? 'connected' : 'arrival'} hidden />

      {connections.length === 0 ? (
        <ArrivalState onConnect={start} busy={busy} />
      ) : (
        <>
          <ConnectedRow connections={connections} onDisconnect={disconnect} />
          <FeedList feed={feed} query={submitted} />
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
          const ready = p.status === 'demo';
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
        Sign-in happens on the provider&apos;s own site, in your address bar — never in a box
        on this page. Most of these platforms cannot serve a personal feed to anyone at any
        price; the ones that can are the ones you can press.
      </p>
    </motion.div>
  );
}

// ── connected ───────────────────────────────────────────────────────────────

function ConnectedRow({ connections, onDisconnect }) {
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
    </div>
  );
}

function FeedList({ feed, query }) {
  const { items, loading, error, done, sentinel } = feed;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Said plainly rather than implied. Without OAuth there is no personal
          front page on any of these, so calling this "your feed" would be a
          claim the data cannot support. */}
      {!query && (
        <p className="text-white/30 text-[11px] mb-3">
          Popular right now. A personal feed needs a provider to grant one — see the notes on
          each account.
        </p>
      )}

      <div className="space-y-3">
        {items.map((post) => <FeedCard key={post._key} post={post} />)}
      </div>

      {error && <p className="text-red-300/70 text-sm py-6 text-center">{error}</p>}

      {!loading && !items.length && !error && (
        <p className="text-white/40 text-sm py-10 text-center">
          {query ? `Nothing came back for “${query}”.` : 'Nothing to show yet.'}
        </p>
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
