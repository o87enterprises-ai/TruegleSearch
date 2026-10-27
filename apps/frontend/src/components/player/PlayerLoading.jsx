import { useEffect, useState } from 'react';
import { RotateCcw, SkipForward, Mail, X } from 'lucide-react';

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

export function PlayerLoading({ compact = false, onRetry, onSkip, reportHref, title }) {
  const [slow, setSlow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    // The parent keys this component on the clip, so every new clip gets a
    // fresh clock and the "taking a while" message never carries over.
    const t = setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  const ring = compact ? 'w-9 h-9' : 'w-12 h-12';

  // Just a spinner: no dimmed screen, no dismiss button to hunt for. The
  // picture stays visible underneath; Retry/Skip appear only once it is slow.
  return (
    <div
      data-player-loading=""
      data-slow={slow ? 'yes' : undefined}
      role="status"
      aria-live="polite"
      aria-label={title ? `Loading ${title}` : 'Loading'}
      className="absolute inset-0 z-[22] flex flex-col items-center justify-center gap-3 pointer-events-none"
    >
      {/* Escape hatch sits right above the spinner, where the eye already is. */}
      <button
        type="button"
        data-player-loading-dismiss=""
        aria-label="Dismiss loading overlay"
        onClick={() => setDismissed(true)}
        className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 text-white transition-colors"
      >
        <X size={14} />
      </button>
      <svg viewBox="0 0 100 100" className={`${ring} drop-shadow`} aria-hidden="true">
        <defs>
          <linearGradient id="truegle-load-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4285f4" />
            <stop offset="35%" stopColor="#ea4335" />
            <stop offset="70%" stopColor="#fbbc05" />
            <stop offset="100%" stopColor="#34a853" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
        <g className="animate-spin motion-reduce:animate-none" style={{ transformOrigin: '50px 50px', animationDuration: '0.9s' }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="url(#truegle-load-arc)" strokeWidth="8"
            strokeLinecap="round" strokeDasharray="70 207" />
        </g>
      </svg>

      {slow ? (
        <div className="flex flex-col items-center gap-2 pointer-events-auto px-3 py-2 rounded-xl bg-black/60">
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
          {/* Only once the clip is genuinely quiet (onSkip's own gate), not
              at the first "taking a while" mark — before that there is
              nothing wrong to report yet. Nothing is sent unless the
              recipient presses send (utils/playerDiagnostics.js). */}
          {onSkip && reportHref && (
            <a data-player-loading-report="" href={reportHref}
              className="flex items-center gap-1.5 text-white/60 hover:text-white/80 text-[11px] underline underline-offset-2">
              <Mail size={12} /> Report this
            </a>
          )}
        </div>
      ) : null}
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
