import { useEffect, useRef, useState } from 'react';
import { Plus, Check, X, Loader2, ListMusic, Search as SearchIcon } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';

// The list that lives under the player — the same one in all three
// presentations.
//
// It shows the up-next queue by default. The moment the user starts typing it
// becomes search results instead, and it stays on results while they keep
// adding things. Ten seconds after the last add it reverts to up-next, so the
// list settles back to "what's coming" without anyone having to dismiss it.
//
// That timer is deliberately reset by each add rather than each keystroke:
// people add several things in a row, and a keystroke-based timer would snap
// the list away mid-choice.
const REVERT_MS = 10000;

export default function PlayerListSlot({ query = '', accent = '#f43f5e', onRevert, compact = false }) {
  const { current, queue, jump, removeFromQueue, enqueue, clearQueue } = usePlayer();
  const { results, loading, error } = usePlayerSearch(query);
  const [added, setAdded] = useState(null);
  const [showingResults, setShowingResults] = useState(false);
  const revertTimer = useRef(null);

  const typing = query.trim().length >= 2;

  // Typing switches the slot to results.
  useEffect(() => {
    if (typing) {
      clearTimeout(revertTimer.current);
      setShowingResults(true);
    }
  }, [typing]);

  // Ten seconds after the LAST add, fall back to the queue.
  const scheduleRevert = () => {
    clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => {
      setShowingResults(false);
      onRevert?.();
    }, REVERT_MS);
  };

  useEffect(() => () => clearTimeout(revertTimer.current), []);

  const add = (source) => {
    enqueue(source);
    setAdded(source.src);
    setTimeout(() => setAdded(null), 1500);
    scheduleRevert();
  };

  const rowH = compact ? 'min-h-[38px]' : 'min-h-[44px]';

  if (showingResults) {
    return (
      <div className="border-t border-white/10 bg-black/30">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/40">
          <SearchIcon size={11} /> Results
          {loading && <Loader2 size={11} className="animate-spin ml-auto" />}
        </div>
        <div className={`${compact ? 'max-h-44' : 'max-h-64'} overflow-y-auto`}>
          {error && <p className="px-3 py-2 text-[11px] text-amber-300/90">{error}</p>}
          {results && results.length === 0 && !loading && (
            <p className="px-3 py-2 text-[11px] text-white/40">Nothing here can play in the Truegle player.</p>
          )}
          {(results || []).map((r) => (
            <div key={r.pageUrl || r.src} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
              {r.poster
                ? <img src={r.poster} alt="" className="w-10 h-7 rounded object-cover shrink-0"
                    onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                : <span className="w-10 h-7 rounded bg-white/10 shrink-0" />}
              <span className="text-[11px] text-white/75 line-clamp-2 flex-1 min-w-0">{r.title}</span>
              {/* Explicit add — the row is not a click target, so nothing here
                  can be mistaken for "open this result" and navigate away. */}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); add(r); }}
                title="Add to queue"
                aria-label={`Add ${r.title || 'this'} to the queue`}
                className={`shrink-0 flex items-center gap-1 pl-1.5 pr-2 h-8 rounded-lg border text-[11px] transition-colors ${
                  added === r.src
                    ? 'border-green-400/50 bg-green-400/10 text-green-300'
                    : 'border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {added === r.src ? <Check size={13} /> : <Plus size={13} />}
                {added === r.src ? 'Added' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 bg-black/30">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/40">
        <ListMusic size={11} /> Up next
        {queue.length > 0 && (
          <>
            <span className="ml-auto px-1.5 rounded-full text-[9px] font-bold text-black" style={{ background: accent }}>
              {queue.length}
            </span>
            {/* The ONLY thing that empties the queue. Closing the player used
                to do it silently, which is why playlists looked like they
                vanished on their own. */}
            <button type="button" onClick={clearQueue} title="Clear the queue" aria-label="Clear the queue"
              className="text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors">
              Clear
            </button>
          </>
        )}
      </div>
      <div className={`${compact ? 'max-h-44' : 'max-h-64'} overflow-y-auto`}>
        {queue.length === 0 ? (
          <p className="px-3 py-3 text-[11px] text-white/40">
            {current ? 'Nothing queued yet — search above to line something up.' : 'Search above to start watching.'}
          </p>
        ) : (
          queue.map((q, i) => (
            <div key={`${q.src}-${i}`} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
              <span className="text-[10px] text-white/30 w-4 shrink-0">{i + 1}</span>
              <button type="button" onClick={() => jump(i)} title="Play now"
                className="text-[11px] text-white/70 hover:text-white truncate flex-1 text-left">
                {q.title || q.src}
              </button>
              <button type="button" onClick={() => removeFromQueue(i)} title="Remove"
                className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
