import { useEffect, useRef, useState } from 'react';
import { Plus, Check, X, Loader2, ListMusic, Play, ChevronRight, Search as SearchIcon } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useChannelFeed } from '../../hooks/useChannelFeed';
import { parsePlayerQuery, toHandle } from '../../utils/playerQuery';
import { hasTaste, forgetTaste } from '../../utils/taste';

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

export default function PlayerListSlot({ query = '', scope = 'all', accent = '#f43f5e', onRevert, compact = false }) {
  const { current, queue, jump, removeFromQueue, enqueue, clearQueue, playNow } = usePlayer();
  const { results, loading, error, unsupported } = usePlayerSearch(query, scope);
  // Asking for a channel should be able to give you the CHANNEL, not a
  // scattering of its videos: one row to open its real feed, newest first.
  const intent = parsePlayerQuery(query, scope);
  const feed = useChannelFeed();
  const feedRows = feed.videos;
  const [added, setAdded] = useState(null);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [showingResults, setShowingResults] = useState(false);
  const revertTimer = useRef(null);

  const typing = query.trim().length >= 2;
  // The search is debounced, so between a keystroke and the request there was
  // a stretch where nothing said anything was happening. `pending` covers it:
  // busy from the moment the text changes until results for THAT text land.
  const [ranFor, setRanFor] = useState('');
  useEffect(() => { if (results !== null || error) setRanFor(query); }, [results, error, query]);
  const pending = typing && ranFor !== query;

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
          {(loading || pending) && <Loader2 size={11} className="animate-spin ml-auto" />}
        </div>
        {/* The channel itself, offered before its scattered videos. */}
        {intent.channel && !feedRows && (
          <button
            type="button"
            onClick={() => feed.open(toHandle(intent.channel), intent.channel)}
            disabled={feed.loading}
            className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-left transition-colors disabled:opacity-60"
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 shrink-0 text-[11px] font-bold text-white/70">
              {(intent.channel[0] || '@').toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-white/85 truncate">
                {toHandle(intent.channel)}
              </span>
              <span className="block text-[10px] text-white/40">
                {feed.loading ? 'Opening the channel…' : 'Open this channel — latest uploads first'}
              </span>
            </span>
            {feed.loading
              ? <Loader2 size={13} className="animate-spin text-white/40 shrink-0" />
              : <ChevronRight size={14} className="text-white/40 shrink-0" />}
          </button>
        )}
        {feed.error && !feedRows && (
          <p className="px-3 py-2 text-[11px] text-amber-300/90 border-b border-white/10">{feed.error}</p>
        )}
        {feedRows && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/10 bg-white/[0.04]">
            <span className="text-[10px] uppercase tracking-wider text-white/50 truncate flex-1">
              {`@${feed.handle}`} — newest first
            </span>
            <button type="button" onClick={feed.clear}
              className="text-[10px] uppercase tracking-wider text-white/35 hover:text-white/70 transition-colors">
              Back to results
            </button>
          </div>
        )}

        <div className={`overflow-y-auto ${compact ? 'max-h-[min(11rem,26svh)]' : 'max-h-[min(16rem,32svh)]'}`}>
          {error && !feedRows && <p className="px-3 py-2 text-[11px] text-amber-300/90">{error}</p>}
          {/* Something to look at while the provider answers — it can take a
              couple of seconds and a retry, and a blank panel reads as broken. */}
          {(loading || pending) && !feedRows && (
            <div className="px-2 py-1.5 space-y-1.5" aria-live="polite">
              <span className="sr-only">Searching…</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex items-center gap-2 ${rowH}`}>
                  <span className="w-10 h-7 rounded bg-white/10 shrink-0 animate-pulse" />
                  <span className="h-3 rounded bg-white/10 flex-1 animate-pulse"
                    style={{ maxWidth: `${80 - i * 15}%` }} />
                </div>
              ))}
            </div>
          )}
          {/* A link from somewhere we can't host. Not an error — a limit, and
              worth naming so it doesn't read as "your link is broken". */}
          {unsupported && (
            <p className="px-3 py-2.5 text-[11px] text-white/55 leading-snug">
              Sorry — Truegle can&apos;t play links from{' '}
              <span className="text-white/80 font-semibold">{unsupported}</span> yet.
              That platform doesn&apos;t let its videos play outside its own app.
              <br />
              <span className="text-white/35">
                YouTube, Vimeo, TikTok, SoundCloud, Dailymotion, Rumble, Odysee and direct
                audio/video files all play here.
              </span>
            </p>
          )}
          {!feedRows && !unsupported && results && results.length === 0 && !loading && !pending && (
            <p className="px-3 py-2 text-[11px] text-white/40">Nothing here can play in the Truegle player.</p>
          )}
          {(feedRows || results || []).map((r) => (
            <div key={r.pageUrl || r.src} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
              {r.poster
                ? <img src={r.poster} alt="" className="w-10 h-7 rounded object-cover shrink-0"
                    onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                : <span className="w-10 h-7 rounded bg-white/10 shrink-0" />}
              <span className="text-[11px] text-white/75 line-clamp-2 flex-1 min-w-0">{r.title}</span>
              {/* Play now: jumps the queue and comes back to what was on. */}
              <button
                type="button"
                // Choosing something to play is a selection, exactly like an
                // add — so it starts the same countdown back to the queue.
                // Without this the panel sat on results forever once you had
                // picked, and the up-next list (and everything under it) was
                // unreachable until you cleared the search.
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); playNow(r); scheduleRevert(); }}
                title="Play now — comes back to what you were on afterwards"
                aria-label={`Play ${r.title || 'this'} now`}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-white/15 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Play size={13} />
              </button>
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
        {hasTaste() && (
          <button
            type="button"
            onClick={() => setForgetOpen((v) => !v)}
            aria-pressed={forgetOpen}
            title="What the player has learned from your thumbs — and how to erase it"
            className={`${queue.length > 0 ? '' : 'ml-auto '}text-[10px] uppercase tracking-wider transition-colors ${
              forgetOpen ? 'text-white/70' : 'text-white/25 hover:text-white/60'
            }`}
          >
            Your taste
          </button>
        )}
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
      <div className={`overflow-y-auto ${compact ? 'max-h-[min(11rem,26svh)]' : 'max-h-[min(16rem,32svh)]'}`}>
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
      {/* A taste profile you can't delete is a dossier. This wipes the 👍/👎
          the player has learned from — all of which lives in this browser and
          nowhere else. The anonymous platform counters have nothing in them
          tying back to anyone, so there is nothing there to withdraw. */}
      {forgetOpen && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/10">
          <span className="text-[10px] text-white/35 flex-1 leading-snug">
            What the player has learned from your 👍/👎 — kept in this browser only.
          </span>
          <button
            type="button"
            onClick={() => { forgetTaste(); setForgetOpen(false); }}
            className="shrink-0 px-2 h-6 rounded-md border border-white/15 text-[10px] uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            Forget it
          </button>
        </div>
      )}
    </div>
  );
}
