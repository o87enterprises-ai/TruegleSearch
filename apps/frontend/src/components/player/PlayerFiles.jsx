import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Plus, Trash2, FolderDown, Link2, RotateCw, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { listLocalFiles, removeLocalFile, storageStatus, exportLocalFiles, listPartials, discardPartial, saveRemoteMedia, LOCAL_PREFIX } from '../../utils/localMedia';
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

  const [partials, setPartials] = useState([]);
  const [link, setLink] = useState('');
  const [job, setJob] = useState(null); // { label, pct } — the one download in flight
  const abortRef = useRef(null);
  const say = (t) => { setNote(t); setTimeout(() => setNote(''), 5000); };

  // Starts a download, or CONTINUES one that was paused or interrupted — same call either way.
  const download = async (src, title) => {
    if (abortRef.current) return;
    const ac = new AbortController(); abortRef.current = ac;
    setJob({ label: title, pct: null });
    try {
      const r = await saveRemoteMedia(src, title, {
        signal: ac.signal,
        onProgress: (got, total) => setJob({ label: title, pct: total ? Math.min(99, Math.round((got / total) * 100)) : null }),
      });
      say(r.already ? 'Already on this device.' : 'Saved — it plays with no connection.');
      setLink('');
    } catch (e) { say(e?.name === 'AbortError' ? 'Paused. Press resume to continue where it stopped.' : (e?.message || 'Could not save that.')); }
    finally { abortRef.current = null; setJob(null); }
  };

  const refresh = useCallback(() => {
    listPartials().then(setPartials).catch(() => {});
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
      <form className="flex items-center gap-1 px-3 pb-1.5"
        onSubmit={(ev) => { ev.preventDefault(); const u = link.trim(); if (u) download(u, u.split('?')[0].split('/').pop() || 'Saved media'); }}>
        <Link2 size={13} className="shrink-0 text-white/40" />
        <input value={link} onChange={(ev) => setLink(ev.target.value)} type="url" inputMode="url" placeholder="Paste a direct .mp3 / .mp4 link"
          aria-label="Direct audio or video link" className="min-w-0 flex-1 h-6 px-2 rounded-md bg-white/5 border border-white/15 text-[11px] text-white outline-none" />
        <button type="submit" disabled={!link.trim() || !!job}
          className="px-2 h-6 rounded-md border border-white/20 text-[10px] uppercase tracking-wider text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-30">Save</button>
      </form>
      {job && (
        <div className="px-3 pb-1.5" role="status">
          <div className="flex items-center gap-2 text-[10px] text-white/60">
            <span className="min-w-0 flex-1 truncate">{job.label}</span>
            <span className="tabular-nums shrink-0">{job.pct == null ? '…' : `${job.pct}%`}</span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="px-2 h-5 rounded border border-white/20 text-[9px] uppercase tracking-wider text-white/60 hover:text-white">Pause</button>
          </div>
          <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-cyan-300/80 transition-[width]" style={{ width: `${job.pct ?? 8}%` }} /></div>
        </div>
      )}
      {partials.length > 0 && (
        <div className="px-3 pb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-white/35 pb-1">Unfinished</p>
          {partials.map((p) => (
            <div key={p.origin} className="flex items-center gap-2 py-0.5">
              <span className="min-w-0 flex-1 text-[11px] text-white/65 truncate">{p.title}</span>
              <span className="text-[10px] text-white/30 shrink-0">{p.total ? `${Math.round((p.got / p.total) * 100)}%` : size(p.got)}</span>
              <button type="button" disabled={!!job} onClick={() => download(p.origin, p.title)} title="Continue where it stopped" aria-label={`Resume ${p.title}`}
                className="flex items-center justify-center w-7 h-7 rounded text-white/40 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25"><RotateCw size={12} /></button>
              <button type="button" onClick={() => discardPartial(p.origin)} title="Throw this away and free the space" aria-label={`Discard ${p.title}`}
                className="flex items-center justify-center w-7 h-7 rounded text-white/30 hover:text-red-300 hover:bg-white/10"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
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
