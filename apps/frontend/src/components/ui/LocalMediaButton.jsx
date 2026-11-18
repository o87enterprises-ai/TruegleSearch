import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { saveLocalFile, localKind } from '../../utils/localMedia';
import { usePlaylists, createPlaylist, addToPlaylist } from '../../utils/playlists';

// The paperclip in the Tube bar: pick audio or video from this device, then say what to
// do with it — play, add to the queue, or add to a list. The files are stored in this
// browser (utils/localMedia.js), so they are in the player from then on and never need
// to be picked again. Nothing is uploaded.

export default function LocalMediaButton({ size = 16, className = '' }) {
  const { play, enqueue } = usePlayer();
  const lists = usePlaylists();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState(null);   // saved, awaiting a choice
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);  // choosing a list
  const [name, setName] = useState('');

  const onPick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const media = files.filter((f) => localKind(f));
    if (!media.length) { setError('Pick an audio or video file (mp3, m4a, wav, mp4, webm…).'); setSources([]); return; }
    setBusy(true); setError('');
    try {
      const saved = [];
      for (const f of media) saved.push(await saveLocalFile(f));
      setSources(saved);
      window.dispatchEvent(new Event('truegle-local-media'));
      if (media.length < files.length) setError(`${files.length - media.length} file(s) skipped — not audio or video.`);
    } catch {
      setError('Could not save that file on this device. The browser may be out of storage or blocking it.');
      setSources([]);
    } finally { setBusy(false); }
  };

  const close = () => { setSources(null); setError(''); setPicking(false); setName(''); };
  const playNow = () => { play(sources[0], 'tube'); sources.slice(1).forEach((s) => enqueue(s, { byUser: true, deck: 'tube' })); close(); };
  const queueAll = () => { sources.forEach((s) => enqueue(s, { byUser: true, deck: 'tube' })); close(); };
  const toList = (id) => { sources.forEach((s) => addToPlaylist(id, s)); close(); };
  const newList = (e) => {
    e.preventDefault();
    const id = createPlaylist(name || `List ${lists.length + 1}`, sources);
    if (id) close();
  };

  const btn = 'w-full rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10';

  return (
    <>
      <input ref={inputRef} type="file" multiple hidden onChange={onPick}
        accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.mp4,.m4v,.webm,.mov,.mkv" />
      <button type="button" data-local-media="" disabled={busy}
        onClick={() => inputRef.current?.click()}
        title="Add audio or video from this device" aria-label="Add audio or video from this device"
        className={className || 'flex items-center justify-center p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40'}>
        <Paperclip size={size} />
      </button>

      {sources && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Add from this device"
          className="fixed inset-0 z-[2147483001] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/15 bg-[#0d0d14] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-white/40">From this device</p>
                <p className="text-sm text-white/90 truncate">
                  {sources.length === 0 ? 'Nothing added' : sources.length === 1 ? sources[0].title : `${sources.length} files added`}
                </p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center"><X size={16} /></button>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-amber-300">{error}</p>}
            {sources.length > 0 && !picking && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-white/50">Saved in your player — you won’t need to pick it again. What now?</p>
                <button type="button" className={btn} onClick={playNow}>Play now</button>
                <button type="button" className={btn} onClick={queueAll}>Add to queue</button>
                <button type="button" className={btn} onClick={() => setPicking(true)}>Add to a list</button>
              </div>
            )}
            {sources.length > 0 && picking && (
              <div className="mt-3">
                <form onSubmit={newList} className="flex gap-2 mb-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list name" maxLength={60}
                    className="min-w-0 flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/15 text-[13px] text-white placeholder-white/30 outline-none" />
                  <button type="submit" className="h-9 px-3 rounded-lg bg-white text-black text-[12px] font-semibold">Create</button>
                </form>
                <div className="max-h-48 overflow-y-auto">
                  {lists.length === 0 && <p className="text-xs text-white/40 py-2">No lists yet — name one above.</p>}
                  {lists.map((p) => (
                    <button key={p.id} type="button" onClick={() => toList(p.id)}
                      className="w-full flex justify-between px-2 py-2.5 rounded-lg text-left text-[13px] text-white/85 hover:bg-white/5">
                      <span className="truncate">{p.name}</span><span className="text-white/30">{p.items.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
