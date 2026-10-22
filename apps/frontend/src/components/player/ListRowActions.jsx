import { useState } from 'react';
import { ListPlus, Check, Loader2, Play, Plus } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { playlistById } from '../../utils/playlists';
import { importPlaylist, importMessage } from '../../utils/playlistImport';
import PlayAllButton from './PlayAllButton';

// THE ACTIONS ON A PLAYLIST RESULT (the Tube "Lists" scope), the same wherever
// one turns up — the grid card, the player's list and its viewport deck:
//
//   one of YOUR lists   Play (its tracks, no network) · Add to queue
//   a public playlist   Play All (imports the tracks, then plays) · Save list
//
// "Save list" imports a public playlist into Lists WITHOUT playing it —
// importPlaylist is keyed on the playlist id, so saving twice refreshes one list
// rather than making a copy. Failures say why (importMessage), not a dead tap.
export default function ListRowActions({ row, className = '', btnClass = '', size = 13, onDone }) {
  const { playList, enqueueMany } = usePlayer();
  const [state, setState] = useState('idle');     // idle | busy | saved | queued | failed
  const [message, setMessage] = useState('');
  const btn = btnClass || 'flex items-center gap-1 px-2 h-8 rounded-lg border border-white/20 bg-white/10 text-[11px] text-white hover:bg-white/20 transition-colors disabled:opacity-60';

  if (row?.savedListId) {
    const list = playlistById(row.savedListId);
    const items = list?.items || [];
    return (
      <span data-list-actions="saved" className={`inline-flex items-center gap-1.5 ${className}`}>
        <button type="button" data-list-play="" disabled={!items.length}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); playList(items, 'tube', list.id, 0); onDone?.(); }}
          className={btn}>
          <Play size={size} /> Play
        </button>
        <button type="button" data-list-queue="" disabled={!items.length}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); enqueueMany(items, 'tube'); setState('queued'); setTimeout(() => setState('idle'), 1500); }}
          className={btn}>
          {state === 'queued' ? <Check size={size} /> : <Plus size={size} />}
          {state === 'queued' ? 'Queued' : 'Add to queue'}
        </button>
      </span>
    );
  }

  if (!row?.playlistUrl) return null;
  return (
    <span data-list-actions="public" className={`inline-flex flex-wrap items-start gap-1.5 ${className}`}>
      <PlayAllButton url={row.playlistUrl} size={size} onDone={onDone} className={btn} />
      <button type="button" data-list-save="" disabled={state === 'busy'}
        onClick={async (e) => {
          e.preventDefault(); e.stopPropagation();
          setState('busy'); setMessage('');
          const r = await importPlaylist(row.playlistUrl, { name: row.title });
          setState(r.ok ? 'saved' : 'failed');
          setMessage(importMessage(r));
        }}
        className={btn}>
        {state === 'busy' ? <Loader2 size={size} className="animate-spin" />
          : state === 'saved' ? <Check size={size} /> : <ListPlus size={size} />}
        {state === 'saved' ? 'Saved' : 'Save list'}
      </button>
      {message && <span data-list-message="" className="basis-full text-[11px] text-white/55 leading-snug">{message}</span>}
    </span>
  );
}
