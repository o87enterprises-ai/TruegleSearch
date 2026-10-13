import { memo, useCallback, useState } from 'react';
import { Play, Plus, Check, Loader2, ChevronDown } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useSettings } from '../../context/SettingsContext';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { usePlayerResults } from '../../utils/playerResultsStore';
import { useSortedRows, useTubeSort, setTubeSort } from '../../utils/tubeSort';
import { SORTS, datedCount } from '../../utils/resultSort';
import { mediaKey } from '../../utils/videoEmbed';
import { sourceColour, sourceProviderLabel } from '../../utils/playerQuery';
import { publishedLabel } from '../../utils/published';
import { useMediaMeta, formatDuration } from '../../utils/mediaMeta';
import { withoutBroken, useBrokenVersion } from '../../utils/broken';
import SafeSearchToggle from '../ui/SafeSearchToggle';

// TUBE'S RESULTS: PLAYABLE ONLY, LAID OUT LIKE YOUTUBE.
//
// Tube used to list the whole web under the player — the same cards as the
// search page — so scrolling past the player turned a video site back into a
// search engine. Everything here has already passed getPlayable(): every card
// plays in the Truegle player, and nothing else is shown.
//
// Two cards a row on a phone, three on a wide screen: a full 16:9 thumbnail,
// the title, channel · date, and the description, the way the player's own
// browse deck shows them.
//
// THE ROWS ARE THE PLAYER'S. Docked, the player is already searching what is
// typed in the bar (playerResultsStore) — asking again would double every
// search. Popped out, the player is searching its own bar, so the page asks
// for itself, for the last SUBMITTED query (not per keystroke).
//
// memo: the page re-renders on every keystroke in its bar; this grid's props
// don't change while typing, so it doesn't.
function TubeResultsGrid({ docked, query }) {
  const shared = usePlayerResults();
  const own = usePlayerSearch(docked ? '' : (query || ''));
  const src = docked ? shared : own;
  useBrokenVersion();
  const rows = useSortedRows(src.results);
  const visible = withoutBroken(rows || []);
  const sort = useTubeSort();
  const { settings } = useSettings();
  const blur = settings.safeSearch === 'blur';
  const metaFor = useMediaMeta();
  const { startFeed, enqueue } = usePlayer();
  const [added, setAdded] = useState(null);

  // Play this, then the rest of the results in order — the same "play from
  // here" as the browse deck. Back to the top, where the player is, so the
  // tap visibly did something on a phone.
  const playFrom = useCallback((i) => {
    startFeed(visible.slice(i), 'tube');
    if (docked) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [startFeed, visible, docked]);

  const queue = useCallback((r) => {
    enqueue(r, { deck: 'tube' });
    setAdded(mediaKey(r) || r.src);
    setTimeout(() => setAdded(null), 1500);
  }, [enqueue]);

  const datedOk = datedCount(src.results) >= 2;

  return (
    <section aria-label="Videos" data-tube-grid="">
      {/* THE FILTER ROW — YouTube's chips, plus Safe Search, in one place. */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {SORTS.map((o) => {
          const dead = (o.id === 'newest' || o.id === 'oldest') && src.results?.length > 0 && !datedOk;
          return (
            <button
              key={o.id}
              type="button"
              data-tube-sort={o.id}
              disabled={dead}
              onClick={() => setTubeSort(o.id)}
              aria-pressed={sort === o.id}
              title={o.id === 'popular'
                ? "Most played and best rated ON TRUEGLE — our own anonymous counts, not the platform's view count"
                : (dead ? 'These results carry no publish dates' : `Sort by ${o.label.toLowerCase()}`)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                dead ? 'bg-white/[0.03] text-white/20 cursor-not-allowed'
                  : sort === o.id ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <SafeSearchToggle className="ml-auto" />
      </div>

      {src.loading && !visible.length && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-5" aria-live="polite">
          <span className="sr-only">Finding something to watch…</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <div className="aspect-video rounded-xl bg-white/10 animate-pulse" />
              <div className="h-3 mt-2 rounded bg-white/10 animate-pulse w-11/12" />
              <div className="h-3 mt-1.5 rounded bg-white/10 animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!src.loading && query && src.results && visible.length === 0 && (
        <p className="py-6 text-center text-sm text-white/50">
          Nothing playable for &ldquo;{query}&rdquo;. Try other words
          {settings.safeSearch !== 'off' ? ', or loosen Safe Search' : ''}.
        </p>
      )}
      {src.error && !visible.length && (
        <p className="py-4 text-center text-xs text-amber-300/90">{src.error}</p>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-5">
          {visible.map((r, i) => {
            const key = mediaKey(r) || r.src;
            const m = metaFor(r) || {};
            const channel = r.channel || m.c;
            const length = formatDuration(r.duration || m.d);
            const when = publishedLabel(r.published);
            return (
              <article key={key} data-tube-card="" className="group min-w-0">
                <button
                  type="button"
                  onClick={() => playFrom(i)}
                  aria-label={`Play ${r.title || 'this'}`}
                  className="relative block w-full aspect-video rounded-xl overflow-hidden bg-white/[0.04]"
                >
                  {r.poster && (
                    <img
                      src={r.poster}
                      alt=""
                      loading="lazy"
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${blur ? 'blur-md group-hover:blur-none' : ''}`}
                      onError={(e) => { e.target.style.visibility = 'hidden'; }}
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-11 h-11 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                      <Play size={18} className="text-white ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                  <span
                    className="absolute top-1.5 left-1.5 px-1.5 h-4 rounded text-[8px] font-semibold uppercase tracking-wider leading-4 text-black/85"
                    style={{ background: sourceColour(r) }}
                  >
                    {sourceProviderLabel(r)}
                  </span>
                  {length && (
                    <span className="absolute bottom-1.5 right-1.5 px-1 rounded bg-black/80 text-[10px] font-semibold text-white tabular-nums">
                      {length}
                    </span>
                  )}
                </button>
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => playFrom(i)} className="flex-1 min-w-0 text-left">
                    <h3 className="text-[13px] sm:text-sm font-semibold text-white leading-snug line-clamp-2">{r.title}</h3>
                    {(channel || when) && (
                      <p className="mt-0.5 text-[11px] sm:text-xs text-white/50 truncate">
                        {channel}
                        {channel && when && <span className="text-white/30"> · </span>}
                        {when}
                      </p>
                    )}
                    {r.description && (
                      <p className="mt-1 text-[11px] sm:text-xs text-white/40 leading-snug line-clamp-2">{r.description}</p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => queue(r)}
                    title="Add to queue"
                    aria-label={`Add ${r.title || 'this'} to the queue`}
                    className={`shrink-0 self-start flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                      added === key ? 'bg-green-400/20 text-green-300' : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {added === key ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {src.more && src.loadMore && visible.length > 0 && (
        <button
          type="button"
          onClick={src.loadMore}
          disabled={src.loadingMore}
          className="mt-5 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-60"
        >
          {src.loadingMore
            ? <><Loader2 size={14} className="animate-spin" /> Finding more…</>
            : <>More videos <ChevronDown size={14} /></>}
        </button>
      )}
    </section>
  );
}

export default memo(TubeResultsGrid);
