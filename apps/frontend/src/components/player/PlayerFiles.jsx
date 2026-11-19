import { useCallback, useEffect, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { listLocalFiles, removeLocalFile, LOCAL_PREFIX } from '../../utils/localMedia';
import { SaveTo } from './PlayerLibrary';
import LocalMediaButton from '../ui/LocalMediaButton';

const toSource = (f) => ({
  kind: f.kind, src: LOCAL_PREFIX + f.id, title: f.name.replace(/\.[^.]+$/, ''), local: true,
});
const size = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

// "Files" tab: everything the person added from their own device. Kept in this browser,
// played from it, never uploaded.
export default function PlayerFiles({ rowH = 'py-1.5', maxH = 'max-h-[min(16rem,32svh)]' }) {
  const { playNow, enqueue } = usePlayer();
  const [files, setFiles] = useState(null);

  const refresh = useCallback(() => { listLocalFiles().then(setFiles).catch(() => setFiles([])); }, []);
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
