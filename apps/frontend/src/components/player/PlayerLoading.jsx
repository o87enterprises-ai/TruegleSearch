import { useEffect, useState } from 'react';
import { RotateCcw, SkipForward } from 'lucide-react';

// What the picture shows between "you picked it" and "it is playing".
//
// Until now that gap was a black rectangle, and a black rectangle is
// indistinguishable from a player that has died — which on a phone connection
// is a fifteen-second stretch people spent pressing things. This says, in the
// brand's own face, that something is happening, and — if it goes on too long —
// offers the two things that actually help: try it again, or move on.
//
// It sits OVER the media node, never instead of it. The iframe keeps loading
// underneath (unmounting it would restart the very load being waited on), and
// the overlay is pointer-transparent except for its own two buttons, so a tap
// on the picture still reaches the layers beneath.

// How long a load is allowed before the loader admits it is slow and offers a
// way out. Longer than a healthy phone start (~8-12s on a throttled profile,
// see useEmbedPlayback), shorter than the 25s silence watchdog.
export const SLOW_LOAD_MS = 9000;

export function PlayerLoading({ compact = false, onRetry, onSkip, title }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // The parent keys this component on the clip, so every new clip gets a
    // fresh clock and the "taking a while" message never carries over.
    const t = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(t);
  }, []);

  const logo = compact ? 'w-20' : 'w-28';
  const ring = compact ? 'w-24 h-24' : 'w-36 h-36';

  return (
    <div
      data-player-loading=""
      data-slow={slow ? 'yes' : undefined}
      role="status"
      aria-live="polite"
      aria-label={title ? `Loading ${title}` : 'Loading'}
      className="absolute inset-0 z-[22] flex flex-col items-center justify-center gap-2 bg-black/70 pointer-events-none"
    >
      <div className={`relative flex items-center justify-center ${ring}`}>
        {/* The ring: a brand-coloured arc that turns, over a faint full circle,
            so there is a visible track even on the frame the arc is hidden. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="truegle-load-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4285f4" />
              <stop offset="35%" stopColor="#ea4335" />
              <stop offset="70%" stopColor="#fbbc05" />
              <stop offset="100%" stopColor="#34a853" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
          <g className="origin-center animate-spin motion-reduce:animate-none" style={{ transformOrigin: '50px 50px', animationDuration: '1.1s' }}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="url(#truegle-load-arc)" strokeWidth="4"
              strokeLinecap="round" strokeDasharray="70 207" />
          </g>
        </svg>
        <img src="/truegle.png" alt="" draggable="false"
          className={`${logo} h-auto object-contain animate-pulse motion-reduce:animate-none select-none`} />
      </div>

      {slow ? (
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          <span className="text-white/85 text-xs">Taking longer than usual…</span>
          <span className="flex items-center gap-2">
            <button type="button" data-player-loading-retry="" onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold">
              <RotateCcw size={13} /> Retry
            </button>
            {onSkip && (
              <button type="button" data-embed-silent-skip="" onClick={onSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold">
                <SkipForward size={13} /> Skip
              </button>
            )}
          </span>
        </div>
      ) : (
        <span className="text-white/60 text-[11px] tracking-wide">Loading…</span>
      )}
    </div>
  );
}

// The clip finished and nothing took over (an empty queue, or the Feed page,
// which never invents a next clip). Without this the picture sat on the
// platform's own end card, and starting it over meant finding the one button
// that restarted it.
export function PlayerEnded({ onReplay }) {
  return (
    <div data-player-ended="" className="absolute inset-0 z-[22] flex items-center justify-center bg-black/55 pointer-events-none">
      <button type="button" data-player-replay="" onClick={onReplay} aria-label="Replay"
        className="pointer-events-auto flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white transition-colors">
        <RotateCcw size={28} />
        <span className="text-xs font-semibold">Replay</span>
      </button>
    </div>
  );
}

export default PlayerLoading;
