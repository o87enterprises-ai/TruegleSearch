import { useState } from 'react';
import { Play, X, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp, ListPlus } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import {
  useWatchHistory, removeFromHistory, clearWatchHistory,
} from '../../utils/watchHistory';
import {
  usePlaylists, createPlaylist, deletePlaylist, renamePlaylist,
  addToPlaylist, removeFromPlaylist, movePlaylistItem, playlistable,
} from '../../utils/playlists';

// The two lists the queue could never be: what you WATCHED, and what you SAVED.
//
// The queue is scratch space — next() consumes what it plays and Clear empties
// it — so anything you wanted to keep had to live somewhere else or be lost the
// moment it played. That is what this is.
//
// Both are device-local (see utils/watchHistory.js and utils/playlists.js).
// Playing from either COPIES into the queue, so a list is never consumed by
// being played.

// "3m", "5h", "2d" — enough to place something without a full timestamp eating
// the row. Anything older than a week is the date.
function ago(ts) {
  const s = Math.max(0, Math.floor((Date.now() - (ts || 0)) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A stored entry carries only what's needed to play it again, which is already
// the shape of a player source minus the fields the reducer adds.
const toSource = (e) => ({
  kind: e.kind, src: e.src, title: e.title, pageUrl: e.pageUrl,
  poster: e.poster, channel: e.channel,
});

/** The "save this somewhere" control, shared by both tabs. */
function SaveTo({ source, accent }) {
  const lists = usePlaylists();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState('');

  if (!playlistable(source)) return null;

  const save = (id) => {
    const ok = addToPlaylist(id, source);
    setSaved(ok ? 'Saved' : 'Already in it');
    setOpen(false);
    setTimeout(() => setSaved(''), 1600);
  };

  const create = () => {
    const id = createPlaylist(`List ${lists.length + 1}`, [source]);
    if (id) { setSaved('Saved'); setOpen(false); setTimeout(() => setSaved(''), 1600); }
  };

  return (
    <span className="relative shrink-0">
      {saved ? (
        <span className="text-[9px] uppercase tracking-wider px-1" style={{ color: accent }}>{saved}</span>
      ) : (
        <button type="button" onClick={() => setOpen((v) => !v)} title="Save to a list" aria-label="Save to a list"
          className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
          <ListPlus size={13} />
        </button>
      )}
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-10 min-w-[9rem] rounded-lg border border-white/15 bg-[#0d0d14] shadow-xl py-1">
          {lists.map((p) => (
            <button key={p.id} type="button" onClick={() => save(p.id)}
              className="block w-full text-left px-2.5 py-1.5 text-[11px] text-white/70 hover:text-white hover:bg-white/10 truncate">
              {p.name}
            </button>
          ))}
          <button type="button" onClick={create}
            className="flex items-center gap-1 w-full px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white hover:bg-white/10 border-t border-white/10">
            <Plus size={11} /> New list
          </button>
        </div>
      )}
    </span>
  );
}

function HistoryTab({ accent, rowH, maxH }) {
  const { playNow } = usePlayer();
  const entries = useWatchHistory();

  if (!entries.length) {
    return <p className="px-3 py-3 text-[11px] text-white/40">Nothing watched yet. What you play shows up here so you can put it back on.</p>;
  }

  return (
    <div className={`overflow-y-auto ${maxH}`}>
      {entries.map((e) => (
        <div key={e.key} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
          <button type="button" onClick={() => playNow(toSource(e), 'tube')} title="Play again"
            className="flex items-center justify-center w-6 shrink-0 text-white/30 hover:text-white transition-colors">
            <Play size={12} />
          </button>
          <button type="button" onClick={() => playNow(toSource(e), 'tube')}
            className="min-w-0 flex-1 text-left">
            <span className="block text-[11px] text-white/70 hover:text-white truncate">{e.title || e.src}</span>
            {e.channel && <span className="block text-[9px] text-white/30 truncate">{e.channel}</span>}
          </button>
          <span className="text-[9px] text-white/25 tabular-nums shrink-0">{ago(e.at)}</span>
          <SaveTo source={toSource(e)} accent={accent} />
          <button type="button" onClick={() => removeFromHistory(e.key)} title="Remove from history"
            className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PlaylistsTab({ accent, rowH, maxH }) {
  const { queue, current, playList } = usePlayer();
  const lists = usePlaylists();
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null); // { id, name }

  // The single most useful way to make a playlist: keep the run you already
  // built. Without it, saving a queue means re-adding every track by hand.
  const saveQueue = () => {
    const items = [current, ...queue].filter(Boolean).filter(playlistable);
    if (!items.length) return;
    createPlaylist(`List ${lists.length + 1}`, items);
  };

  return (
    <div className={`overflow-y-auto ${maxH}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/10">
        <button type="button" onClick={() => createPlaylist(`List ${lists.length + 1}`)}
          className="flex items-center gap-1 px-2 h-6 rounded-md border border-white/15 text-[10px] uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <Plus size={11} /> New
        </button>
        {(current || queue.length > 0) && (
          <button type="button" onClick={saveQueue}
            className="px-2 h-6 rounded-md border border-white/15 text-[10px] uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            Save queue
          </button>
        )}
      </div>

      {lists.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-white/40">
          No lists yet. A list is yours to keep — playing one copies it into the queue instead of using it up.
        </p>
      ) : lists.map((p) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="border-b border-white/5 last:border-b-0">
            <div className={`flex items-center gap-1 px-2 ${rowH} hover:bg-white/5`}>
              <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open}
                className="flex items-center justify-center w-5 shrink-0 text-white/30 hover:text-white transition-colors">
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              {editing?.id === p.id ? (
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(ev) => setEditing({ id: p.id, name: ev.target.value })}
                  onBlur={() => { renamePlaylist(p.id, editing.name); setEditing(null); }}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') { renamePlaylist(p.id, editing.name); setEditing(null); }
                    if (ev.key === 'Escape') setEditing(null);
                  }}
                  className="flex-1 min-w-0 bg-transparent border-b border-white/20 text-[11px] text-white outline-none"
                />
              ) : (
                <button type="button" onDoubleClick={() => setEditing({ id: p.id, name: p.name })}
                  onClick={() => setOpenId(open ? null : p.id)}
                  title="Double-click to rename"
                  className="flex-1 min-w-0 text-left text-[11px] text-white/70 hover:text-white truncate">
                  {p.name}
                </button>
              )}
              <span className="text-[9px] text-white/25 tabular-nums shrink-0">{p.items.length}</span>
              {/* PLAY, not append. enqueueMany mixes the list into whatever is
                  already queued and — correctly for its other callers — never
                  arms the queue, so autoplay walked off into discovery after
                  the first track instead of playing the list. */}
              <button type="button" onClick={() => playList(p.items.map(toSource), 'tube', p.id)}
                disabled={!p.items.length} title="Play this list"
                className="flex items-center justify-center w-8 h-8 rounded text-white/30 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors">
                <Play size={13} />
              </button>
              <button type="button" onClick={() => deletePlaylist(p.id)} title="Delete this list"
                className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>

            {open && (p.items.length === 0 ? (
              <p className="px-3 pb-2 text-[10px] text-white/30">Empty — add something from the history or the queue.</p>
            ) : p.items.map((it, i) => (
              <div key={`${it.key}-${i}`} className="flex items-center gap-1 pl-7 pr-2 py-1 hover:bg-white/5">
                {/* A row plays THE LIST FROM HERE. It used to playNow the one
                    track, which left the list behind: Next and swipe then
                    walked the unrelated queue or discovery — "the selected
                    list drops state and reverts to other clips". */}
                <button type="button" onClick={() => playList(p.items.map(toSource), 'tube', p.id, i)}
                  title="Play this"
                  className="min-w-0 flex-1 text-left text-[10px] text-white/55 hover:text-white truncate">
                  {it.title || it.src}
                </button>
                <button type="button" onClick={() => movePlaylistItem(p.id, i, -1)} disabled={i === 0} title="Move up"
                  className="flex items-center justify-center w-7 h-7 rounded text-white/25 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-20 transition-colors">
                  <ChevronUp size={12} />
                </button>
                <button type="button" onClick={() => movePlaylistItem(p.id, i, 1)} disabled={i === p.items.length - 1} title="Move down"
                  className="flex items-center justify-center w-7 h-7 rounded text-white/25 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-20 transition-colors">
                  <ChevronDown size={12} />
                </button>
                <button type="button" onClick={() => removeFromPlaylist(p.id, i)} title="Remove"
                  className="flex items-center justify-center w-7 h-7 rounded text-white/25 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )))}
          </div>
        );
      })}
      <div style={{ borderColor: accent }} className="hidden" />
    </div>
  );
}

export default function PlayerLibrary({ tab, accent = '#f43f5e', compact = false }) {
  const rowH = compact ? 'py-1' : 'py-1.5';
  const maxH = compact ? 'max-h-[min(11rem,26svh)]' : 'max-h-[min(16rem,32svh)]';
  return tab === 'history'
    ? <HistoryTab accent={accent} rowH={rowH} maxH={maxH} />
    : <PlaylistsTab accent={accent} rowH={rowH} maxH={maxH} />;
}

export { clearWatchHistory };
