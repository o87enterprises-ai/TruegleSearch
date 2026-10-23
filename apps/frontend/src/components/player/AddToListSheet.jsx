import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayRoot } from '../../utils/overlayRoot';
import { Check, Plus, X } from 'lucide-react';
import {
  usePlaylists, createPlaylist, addToPlaylist, removeSourceFromPlaylist, playlistHas,
} from '../../utils/playlists';

// THE ONE "ADD TO A LIST" SURFACE (owner, 2026-10-18: "a universal solution that
// allows for adding to preexisting lists as well as new lists, and a way of
// easily editing these lists"). Every save button in the app opens THIS, so the
// answer to "how do I put a song in a playlist" is the same everywhere:
//
//   - every list you have, each with a tick if the song is already in it —
//     tapping toggles it in or out, so the sheet is also how you take it back
//   - a name box at the top to make a new list with the song already in it
//
// A sheet in a portal rather than a dropdown: the old dropdown was absolutely
// positioned inside the player and result cards, and clipped or hid behind
// them whenever the card was near an edge. z-[10000] clears the page clock and
// the menu (see the full-screen overlay notes), under ShareGate.
export default function AddToListSheet({ source, onClose }) {
  const lists = usePlaylists();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  // Mounted where it can be SEEN: inside the full-screen surface when the
  // player is full screen (see utils/overlayRoot.js), <body> otherwise.
  const mountAt = useMemo(() => overlayRoot(), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id) => {
    if (playlistHas(id, source)) { removeSourceFromPlaylist(id, source); setNote('Removed'); }
    else { addToPlaylist(id, source); setNote('Added'); }
  };

  const create = (e) => {
    e.preventDefault();
    const id = createPlaylist(name || `List ${lists.length + 1}`, [source]);
    if (id) { setName(''); setNote('New list created'); }
  };

  return createPortal(
    <div data-add-to-list="" role="dialog" aria-modal="true" aria-label="Add to a list"
      // Above the iPhone full-screen box (z-index 2147483000) as well as the page.
      className="fixed inset-0 z-[2147483001] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      // A portal's events bubble through the REACT tree, and inside the player
      // that tree is the player root — whose wheel and touch handlers mean
      // next / previous in full screen. Scrolling this list must not skip tracks.
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={onClose}>
      <div className="w-full sm:max-w-sm max-h-[80svh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/15 bg-[#0d0d14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Add to a list</p>
            <p className="text-sm text-white/90 truncate">{source.title || source.src}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={create} className="flex items-center gap-2 px-4 pb-2">
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="New list name" maxLength={60} aria-label="New list name"
            className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-[13px] text-white placeholder-white/30 outline-none focus:border-white/40" />
          <button type="submit"
            className="flex items-center gap-1 h-9 px-3 rounded-lg bg-white text-black text-[12px] font-semibold hover:bg-white/90">
            <Plus size={13} /> Create
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-2 pb-2 border-t border-white/10" role="list">
          {lists.length === 0 && (
            <p className="px-2 py-4 text-[12px] text-white/40">No lists yet — name one above and this song goes straight in.</p>
          )}
          {lists.map((p) => {
            const has = playlistHas(p.id, source);
            return (
              <button key={p.id} type="button" role="listitem" data-list-id={p.id} aria-pressed={has}
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left hover:bg-white/5">
                <span className={`flex items-center justify-center w-5 h-5 rounded-md border shrink-0 ${has ? 'bg-emerald-400 border-emerald-400 text-black' : 'border-white/30 text-transparent'}`}>
                  <Check size={13} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{p.name}</span>
                <span className="text-[11px] text-white/30 tabular-nums">{p.items.length}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
          <span className="text-[11px] text-emerald-300 min-h-[1em]" aria-live="polite">{note}</span>
          <button type="button" onClick={onClose}
            className="h-8 px-4 rounded-lg border border-white/20 text-[12px] text-white/80 hover:text-white hover:bg-white/10">
            Done
          </button>
        </div>
      </div>
    </div>,
    mountAt || document.body,
  );
}
