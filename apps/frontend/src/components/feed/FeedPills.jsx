import { Shuffle } from 'lucide-react';
import { MODE_COLORS } from '../../config/modeTheme';
import { TABS, TOP_SERVER_IDS, NETWORK_LABELS } from '../../hooks/useFeedTabs';
import CreatorChips from './CreatorChips';

// The landing frame's pill rows — tabs, Top's server pills + Shuffle, the
// fallback note, and the Creators tab's creator chips — rendered from a
// useFeedTabs() result. Used by LandingFeedFrame AND /feed Home.
export default function FeedPills({ t, dataPrefix = 'feed' }) {
  const accent = MODE_COLORS.yellow;
  return (
    <>
      <div role="tablist" aria-label="Feed category" className="flex gap-1 mb-2 px-1 overflow-x-auto">
        {TABS.map((x) => {
          const active = x.id === t.tab;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-landing-feed-tab={x.id}
              data-feed-tab={x.id}
              onClick={() => t.setTab(x.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${active ? 'text-black' : 'text-white/60 hover:text-white border-white/10'}`}
              style={active ? { background: accent, borderColor: accent } : undefined}
            >
              {x.label}
            </button>
          );
        })}
      </div>
      {t.tab === 'top' && (
        <div aria-label="Server" className="flex gap-1 mb-2 px-1 overflow-x-auto items-center">
          {['all', ...TOP_SERVER_IDS].map((id) => {
            const active = id === t.server;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                data-landing-feed-server={id}
                onClick={() => t.setServer(id)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border transition-colors ${active ? 'text-white border-white/50 bg-white/10' : 'text-white/50 hover:text-white border-white/10'}`}
              >
                {id === 'all' ? 'All' : NETWORK_LABELS[id]}
              </button>
            );
          })}
          <button
            type="button"
            data-landing-feed-shuffle=""
            onClick={t.shuffle}
            title="Pull a fresh set of top posts, newest first"
            className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border border-white/10 text-white/60 hover:text-white flex items-center gap-1"
          >
            <Shuffle size={11} /> Shuffle
          </button>
        </div>
      )}
      {t.tab === 'creators' && <CreatorChips value={t.creator} onChange={t.setCreator} kind={t.kind} onKind={t.setKind} />}
      {t.usingFallback && (
        <p data-landing-feed-fallback="" className="text-[11px] text-white/40 mb-1 px-1">
          Showing top “{t.query}” posts, newest first.
        </p>
      )}
    </>
  );
}
