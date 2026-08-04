import { useEffect, useState } from 'react';

// The play head, for when the picture isn't on screen.
//
// Two honest cases, because we can only know the position of media we own:
//
//   native <audio>/<video> → a real play head: elapsed, total, and a scrubber
//                            you can drag to seek.
//   a platform embed       → we do NOT know the position. Reading currentTime
//                            out of a YouTube/Vimeo/TikTok iframe means
//                            loading that vendor's SDK into the page, which
//                            this player deliberately doesn't do (four SDKs,
//                            four trackers). So it shows a moving "playing"
//                            bar and the title — a truthful "this is running"
//                            rather than a made-up position.
const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export default function PlayerProgress({ mediaRef, source, playing, accent = '#f43f5e' }) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const native = source && (source.kind === 'audio' || source.kind === 'video');

  useEffect(() => {
    if (!native) return undefined;
    const el = mediaRef?.current;
    if (!el) return undefined;
    const onTime = () => setTime(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    onMeta();
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
    };
  }, [native, mediaRef, source]);

  if (!source) return null;

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="px-3 py-1.5 border-t border-white/10 bg-black/30">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-white/60 truncate flex-1 min-w-0">
          {source.title || 'Now playing'}
        </span>
        {native && duration > 0 && (
          <span className="text-[10px] text-white/40 tabular-nums shrink-0">
            {fmt(time)} / {fmt(duration)}
          </span>
        )}
      </div>

      {native ? (
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="any"
          value={time}
          onChange={(e) => {
            const el = mediaRef?.current;
            if (el) { el.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }
          }}
          aria-label="Seek"
          className="mt-1 w-full h-1.5 appearance-none rounded-full bg-white/15 accent-current cursor-pointer"
          style={{
            color: accent,
            background: `linear-gradient(to right, ${accent} ${pct}%, rgba(255,255,255,0.15) ${pct}%)`,
          }}
        />
      ) : (
        // No position to show — say so by movement, not by a fake number.
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
          <div
            className={playing ? 'h-full w-1/3 rounded-full animate-player-sweep' : 'h-full w-full rounded-full opacity-30'}
            style={{ background: accent }}
          />
        </div>
      )}
    </div>
  );
}
