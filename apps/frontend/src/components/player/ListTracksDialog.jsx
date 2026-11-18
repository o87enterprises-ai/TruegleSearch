import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Play } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { playlistById, usePlaylists } from '../../utils/playlists';
import { mediaKey } from '../../utils/videoEmbed';

// THE TRACKS OF ONE OF YOUR LISTS (owner, 2026-11-17) — what the "List" button on
// a saved list opens in the Tube "Lists" scope.
//
// It shows every track in the list's saved order; pressing one plays THE LIST
// FROM THAT TRACK (playList with a start index), exactly as the player's own
// Lists tab does, so Next and swipe stay inside the list rather than wandering
// off into the queue or discovery. The track that is playing now is marked.
//
// A dialog in a portal, not a panel inside the card: the same button lives on the
// grid cards, the player's list and its viewport deck, and a panel would have to
// fit three different layouts. It reads the list live (usePlaylists), so a track
// removed elsewhere disappears here, and a deleted list closes it.
export default function ListTracksDialog({ listId, onClose, onPicked }) {
  const { playList, current } = usePlayer();
  usePlaylists();
  const list = playlistById(listId);
  const items = list?.items || [];
  const closeRef = useRef(null);

  useEffect(() => { if (!list) onClose(); }, [list, onClose]);
  useEffect(() => {
    closeRef.current?.focus();
    // Capture phase, so Escape closes THIS and does not also close whatever sits behind it.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!list) return null;
  const playingKey = current ? mediaKey(current) : null;
  const pick = (i) => { playList(items, 'tube', list.id, i); onClose(); onPicked?.(); };

  return createPortal(
    <div
      role="presentation"
      data-list-tracks-backdrop=""
      // React events bubble through a portal to the card that owns it; keep them there.
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tracks in ${list.name}`}
        data-list-tracks=""
        className="w-full sm:max-w-xl max-h-[85svh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-neutral-950 border border-white/15 shadow-2xl"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <h2 data-list-tracks-title="" className="text-sm font-semibold text-white truncate">{list.name}</h2>
            <p className="text-[11px] text-white/45">
              {items.length} saved video{items.length === 1 ? '' : 's'} · tap one to play from there
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            data-list-tracks-close=""
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-white/50">This list is empty.</p>
        ) : (
          <ol className="overflow-y-auto overscroll-contain py-1">
            {items.map((it, i) => {
              const playing = !!playingKey && (it.key || mediaKey(it)) === playingKey;
              return (
                <li key={`${it.key || it.src}-${i}`}>
                  <button
                    type="button"
                    data-list-track={i}
                    aria-current={playing ? 'true' : undefined}
                    onClick={() => pick(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/10 ${playing ? 'bg-white/10' : ''}`}
                  >
                    <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-white/40">
                      {playing ? <Play size={12} className="text-white" fill="currentColor" aria-label="Playing now" /> : i + 1}
                    </span>
                    <span className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-white/[0.06]">
                      {it.poster && (
                        <img
                          src={it.poster}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { e.target.style.visibility = 'hidden'; }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] sm:text-sm font-medium text-white leading-snug line-clamp-2">{it.title || it.src}</span>
                      {it.channel && <span className="block mt-0.5 text-[11px] text-white/45 truncate">{it.channel}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>,
    document.body,
  );
}
