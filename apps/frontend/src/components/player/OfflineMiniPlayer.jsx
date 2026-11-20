import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Radio } from 'lucide-react';
import { listLocalFiles, resolveLocal, LOCAL_PREFIX } from '../../utils/localMedia';

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

// Offline music: a tiny player for everything kept on this device (files you added and media
// saved from lists). No search, no video — pick a track from the list, or switch Radio on to
// shuffle through them continuously. Plays from this phone with no connection.
export default function OfflineMiniPlayer() {
  const audio = useRef(null);
  const [files, setFiles] = useState(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [radio, setRadio] = useState(false);
  const [t, setT] = useState({ pos: 0, dur: 0 });
  const [err, setErr] = useState('');

  const refresh = useCallback(() => { listLocalFiles().then(setFiles).catch(() => setFiles([])); }, []);
  useEffect(() => {
    refresh();
    window.addEventListener('truegle-local-media', refresh);
    return () => window.removeEventListener('truegle-local-media', refresh);
  }, [refresh]);

  const list = files || [];
  const cur = list[idx];

  const load = useCallback(async (i, autoplay) => {
    const f = list[i];
    const el = audio.current;
    if (!f || !el) return;
    setErr('');
    const url = await resolveLocal(LOCAL_PREFIX + f.id);
    if (!url) { setErr('That file is no longer on this device.'); return; }
    el.src = url;
    if (autoplay) el.play().catch(() => setPlaying(false));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: f.name.replace(/\.[^.]+$/, ''), artist: 'Truegle — offline' });
    }
  }, [list]);

  const go = useCallback((i, autoplay = true) => {
    if (list.length === 0) return;
    const n = ((i % list.length) + list.length) % list.length;
    setIdx(n);
    load(n, autoplay);
  }, [list, load]);

  const next = useCallback(() => {
    if (list.length === 0) return;
    if (radio && list.length > 1) {
      let n = idx;
      while (n === idx) n = Math.floor(Math.random() * list.length);
      go(n);
    } else go(idx + 1);
  }, [list, idx, radio, go]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('nexttrack', next);
    navigator.mediaSession.setActionHandler('previoustrack', () => go(idx - 1));
    navigator.mediaSession.setActionHandler('play', () => audio.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.current?.pause());
  }, [next, go, idx]);

  const toggle = () => {
    const el = audio.current;
    if (!el || list.length === 0) return;
    if (!el.src) { load(idx, true); return; }
    if (el.paused) el.play().catch(() => {}); else el.pause();
  };

  if (files && files.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs text-white/50">
        No music on this device yet. Add audio or video files below, or press the download icon on a direct audio/video
        link in your saved lists while you’re online (YouTube and other embedded videos can’t be saved).
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-400/30 bg-orange-500/[0.06] p-4 space-y-3">
      <audio ref={audio}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={next}
        onTimeUpdate={(e) => setT({ pos: e.target.currentTime, dur: e.target.duration })}
        onLoadedMetadata={(e) => setT({ pos: 0, dur: e.target.duration })}
        onError={() => setErr('This file could not be played.')} />
      <label className="block text-[11px] text-white/50">Now playing
        <select value={idx} onChange={(e) => go(Number(e.target.value))}
          className="mt-1 w-full rounded-md bg-black/60 border border-white/15 px-3 py-2 text-sm text-white">
          {list.map((f, i) => <option key={f.id} value={i}>{f.name.replace(/\.[^.]+$/, '')}</option>)}
        </select>
      </label>
      <input type="range" min="0" max={t.dur || 0} step="1" value={t.pos || 0} aria-label="Seek"
        onChange={(e) => { if (audio.current) audio.current.currentTime = Number(e.target.value); }}
        className="w-full accent-orange-400" />
      <div className="flex items-center justify-between text-[11px] text-white/45"><span>{fmt(t.pos)}</span><span>{fmt(t.dur)}</span></div>
      <div className="flex items-center justify-center gap-4">
        <button type="button" onClick={() => go(idx - 1)} aria-label="Previous" className="rounded-full p-2 text-white/70 hover:bg-white/10"><SkipBack size={20} /></button>
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} className="rounded-full bg-orange-500 p-3 text-black hover:bg-orange-400">
          {playing ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button type="button" onClick={next} aria-label="Next" className="rounded-full p-2 text-white/70 hover:bg-white/10"><SkipForward size={20} /></button>
        <button type="button" onClick={() => setRadio((r) => !r)} aria-pressed={radio} title="Radio: keep playing your saved music in shuffled order"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${radio ? 'border-orange-300 bg-orange-400/20 text-orange-200' : 'border-white/20 text-white/60 hover:bg-white/10'}`}>
          <Radio size={14} /> Radio
        </button>
      </div>
      {err && <p className="text-center text-xs text-red-300" role="alert">{err}</p>}
      {cur && !err && <p className="text-center text-[10px] text-white/30">Plays from this phone — no connection needed.</p>}
    </div>
  );
}
