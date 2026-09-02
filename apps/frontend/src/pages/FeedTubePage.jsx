import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchPageShell from '../components/layout/SearchPageShell';
import SearchBar from '../components/ui/SearchBar';
import TrueglePlayer from '../components/player/TrueglePlayer';
import TubeFeedGrid from '../components/feed/TubeFeedGrid';
import { usePlayerSearch } from '../hooks/usePlayerSearch';
import { usePlayer } from '../context/PlayerContext';
import { SEARCH_SCOPES } from '../utils/playerQuery';
import { mediaKey } from '../utils/videoEmbed';
import { MODE_COLORS } from '../config/modeTheme';

// /feed/tube — Tube's content on the new feed layout.
//
// ── WHY A NEW PAGE AND NOT A FLAG ON UniversalSearch ────────────────────────
//
// /tube is `<UniversalSearch lockedTube />`, and that component is 2600 lines
// carrying every search mode the site has. The layout this page needs — a
// player over a four-unit grid — is not a variant of a results list, and
// bolting a third locked mode onto that file would mean every future change to
// either page reading all of it. /tube keeps working exactly as it does; this
// is the new shape, next to it, and the two can be reconciled once this one
// has proven itself.
//
// ── THE PLAYER IS NOT RENDERED HERE ─────────────────────────────────────────
//
// There is exactly one player in the app, mounted above <Routes> in App.jsx
// (see MiniPlayer). A page that wants it docked renders an empty
// [data-player-slot] and the player positions itself over that box. Rendering
// <TrueglePlayer> inline in expanded form would unmount its <iframe> the
// moment somebody popped it out, and the track would start over from zero.
// The collapsed transport strip below IS rendered here, because it is chrome
// rather than a video surface — that is the same split /tube uses.
//
// ── TYPING COLLAPSES THE PLAYER ─────────────────────────────────────────────
//
// Deliberately the opposite of /tube, which expands on type. Here the grid is
// the point: once somebody is searching, the results deserve the room, and a
// 260px player sitting above four rows of nothing is wasted screen. The player
// does not stop — it collapses to its transport, so whatever is playing keeps
// playing while the grid fills underneath.

const SOURCES = [
  { id: 'tube', label: 'Tube', to: '/feed/tube' },
  { id: 'feed', label: 'Feed', to: '/feed' },
];

export default function FeedTubePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') || '');
  const [scope, setScope] = useState(params.get('scope') || 'all');
  const [pillMode, setPillMode] = useState('tube');
  const [typing, setTyping] = useState(false);

  const { current, playNow } = usePlayer();
  const search = usePlayerSearch(query, scope);

  // The player keeps the room unless somebody is actively searching. `current`
  // is not part of this on purpose: collapsing while a track plays is the
  // whole point, and the transport strip keeps it reachable.
  const expanded = !typing && !query.trim();

  const activeKey = useMemo(() => (current ? mediaKey(current) : null), [current]);

  const onChange = useCallback((v) => {
    setQuery(v);
    setTyping(true);
  }, []);

  const submit = useCallback(() => {
    const q = query.trim();
    // The pill cycles rather than navigating (the model every page uses); where
    // a submit LANDS is decided here, at submit time.
    if (pillMode === 'tube') {
      setTyping(false);
      // Keep the query in the URL so a /feed/tube search is shareable and
      // survives a reload — the grid is driven off `query`, not off this.
      const next = new URLSearchParams(params);
      if (q) next.set('q', q); else next.delete('q');
      if (scope !== 'all') next.set('scope', scope); else next.delete('scope');
      setParams(next, { replace: true });
      return;
    }
    if (pillMode === 'black') { navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat'); return; }
    if (pillMode === 'yellow') { navigate('/feed'); return; }
    navigate(`/search?mode=${pillMode}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  }, [pillMode, query, scope, params, setParams, navigate]);

  const onSelect = useCallback((row) => {
    playNow(row);
    // Selecting something is the end of searching, so the player takes the
    // room back — matching what a person just asked for by pressing play.
    setTyping(false);
  }, [playNow]);

  const searchBar = (
    <SearchBar
      value={query}
      showSearchButton={false}
      showBiasedButton={false}
      showUnbiasedButton={false}
      showCategories={false}
      onChange={onChange}
      onSubmit={submit}
      onSearch={submit}
      placeholder="Search Tube…"
    />
  );

  return (
    <SearchPageShell
      mode="tube"
      logoVariant="tube"
      pillMode={pillMode}
      onPillSelect={setPillMode}
      searchBar={searchBar}
    >
      <div className="max-w-4xl mx-auto mb-3 flex flex-wrap items-center gap-2">
        {/* SOURCE — which feed you are looking at. Two routes, not two tabs on
            one route: /feed and /feed/tube are genuinely different pages and a
            shareable URL should say which one you meant. */}
        <div
          className="inline-flex rounded-full p-0.5 border"
          style={{ borderColor: `${MODE_COLORS.tube}44` }}
          role="group"
          aria-label="Source"
        >
          {SOURCES.map((s) => {
            const on = s.id === 'tube';
            return (
              <button
                key={s.id}
                type="button"
                data-feed-source={s.id}
                aria-current={on ? 'page' : undefined}
                onClick={() => !on && navigate(s.to)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  on ? 'text-black' : 'text-white/60 hover:text-white/90'
                }`}
                style={on ? { background: MODE_COLORS.tube } : undefined}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* FILTERS — the same scope vocabulary the Tube search already speaks
            (playerQuery.js SEARCH_SCOPES), so a filter here means exactly what
            it means on /tube rather than being a second, parallel idea. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filters">
          {SEARCH_SCOPES.map((s) => {
            const on = s.id === scope;
            return (
              <button
                key={s.id}
                type="button"
                data-tube-scope={s.id}
                aria-pressed={on}
                onClick={() => setScope(s.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  on ? 'text-white' : 'text-white/50 hover:text-white/80'
                }`}
                style={{
                  borderColor: on ? `${MODE_COLORS.tube}aa` : 'rgba(255,255,255,0.12)',
                  background: on ? `${MODE_COLORS.tube}22` : 'transparent',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* THE PLAYER'S BOX. Empty on purpose — see the header note. Its height
          comes from the player itself via --truegle-player-h so the page
          reserves exactly the room the player occupies and nothing jumps when
          it mounts. */}
      <div className="max-w-4xl mx-auto mb-4">
        {expanded ? (
          <div
            data-player-slot
            aria-hidden="true"
            style={{ height: 'var(--truegle-player-h, 260px)' }}
          />
        ) : (
          <div
            className="rounded-xl border bg-black/30 px-1.5 py-1"
            style={{ borderColor: `${MODE_COLORS.tube}33` }}
          >
            <TrueglePlayer presentation="collapsed" accent={MODE_COLORS.tube} />
          </div>
        )}
      </div>

      {search.error && (
        <div className="max-w-4xl mx-auto mb-3 px-4 py-3 rounded-xl bg-amber-950/25 border border-amber-500/30 text-amber-100/90 text-sm">
          {search.error}
        </div>
      )}

      <TubeFeedGrid
        rows={search.results}
        loading={search.loading}
        loadingMore={search.loadingMore}
        more={search.more}
        onMore={search.loadMore}
        onSelect={onSelect}
        activeKey={activeKey}
        emptyLabel={query.trim() ? 'Nothing matched that.' : 'Search to fill the feed.'}
      />
    </SearchPageShell>
  );
}
