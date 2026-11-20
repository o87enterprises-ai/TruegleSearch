import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, Trash2, FolderDown } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { listLocalFiles, removeLocalFile, storageStatus, exportLocalFiles, LOCAL_PREFIX } from '../../utils/localMedia';
import { SaveTo } from './PlayerLibrary';
import LocalMediaButton from '../ui/LocalMediaButton';

const toSource = (f) => ({
  kind: f.kind, src: LOCAL_PREFIX + f.id, title: f.name.replace(/\.[^.]+$/, ''), local: true,
});
const size = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

// How full this browser's storage is. Hidden where the browser can't report it.
function Meter({ st }) {
  if (!st || st.quota == null) return null;
  const pct = Math.min(100, Math.round((st.usage / st.quota) * 100));
  return (
    <div className="px-3 pb-1.5" role="status" aria-label="Storage used">
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: pct > 90 ? '#f87171' : '#67e8f9' }} />
      </div>
      <p className="mt-1 text-[10px] text-white/35">
        {size(st.usage)} used · {size(st.free)} free{st.persisted === false ? ' · the browser may clear this if the device runs low' : ''}
      </p>
    </div>
  );
}

// "Files" tab: everything the person added from their own device. Kept in this browser,
// played from it, never uploaded.
export default function PlayerFiles({ rowH = 'py-1.5', maxH = 'max-h-[min(16rem,32svh)]' }) {
  const { playNow, enqueue } = usePlayer();
  const [files, setFiles] = useState(null);
  const [st, setSt] = useState(null);
  const [note, setNote] = useState('');

  const refresh = useCallback(() => {
    listLocalFiles().then(setFiles).catch(() => setFiles([]));
    storageStatus().then(setSt).catch(() => {});
  }, []);
  const backup = async () => {
    try {
      const r = await exportLocalFiles((i, n) => setNote(`Copying ${i} of ${n}…`));
      setNote(r.method === 'folder' ? `Copied ${r.count} to your folder.` : `Started ${r.count} downloads — check your Downloads.`);
    } catch (e) { setNote(e?.name === 'AbortError' ? '' : 'Could not copy the files.'); }
    setTimeout(() => setNote(''), 5000);
  };
  useEffect(() => {
    refresh();
    window.addEventListener('truegle-local-media', refresh);
    return () => window.removeEventListener('truegle-local-media', refresh);
  }, [refresh]);

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/50">
        <LocalMediaButton size={14} />
        <span>Add audio or video from this device — it stays in your player.</span>
      </div>
      <Meter st={st} />
      {files && files.length > 0 && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          <button type="button" onClick={backup} title="Copy everything to a folder, in case this browser's storage is cleared"
            className="flex items-center gap-1 px-2 h-6 rounded-md border border-white/15 text-[10px] uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <FolderDown size={11} /> Back up
          </button>
          {note && <span className="text-[10px] text-cyan-200/80" role="status">{note}</span>}
        </div>
      )}
      {files && files.length === 0 && (
        <p className="px-3 pb-3 text-[11px] text-white/40">No files yet. Use the paperclip to add some.</p>
      )}
      <div className={`overflow-y-auto ${maxH}`}>
        {(files || []).map((f) => (
          <div key={f.id} className={`flex items-center gap-2 px-2 ${rowH} hover:bg-white/5`}>
            <button type="button" onClick={() => playNow(toSource(f), 'tube')} title="Play"
              className="flex items-center justify-center w-6 shrink-0 text-white/40 hover:text-white"><Play size={12} /></button>
            <span className="min-w-0 flex-1 text-[11px] text-white/75 truncate">{f.name}</span>
            <span className="text-[10px] text-white/30 shrink-0">{size(f.size)}</span>
            <button type="button" onClick={() => enqueue(toSource(f), { byUser: true, deck: 'tube' })} title="Add to queue"
              className="flex items-center justify-center w-7 h-7 rounded text-white/30 hover:text-white hover:bg-white/10"><Plus size={13} /></button>
            <SaveTo source={toSource(f)} />
            <button type="button" title="Remove from this device"
              onClick={async () => { await removeLocalFile(LOCAL_PREFIX + f.id); refresh(); }}
              className="flex items-center justify-center w-7 h-7 rounded text-white/30 hover:text-red-300 hover:bg-white/10"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
