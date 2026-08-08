import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';

// Locked controls — for a phone in a pocket.
//
// The whole player is covered by a sheet that swallows every pointer event, so
// a stray press cannot skip the track, pause it, dislike it or close it. The
// media keeps playing underneath: the sheet is a sibling, not a wrapper, and
// nothing is unmounted.
//
// UNLOCKING IS A LONG PRESS. A lock a pocket can undo is not a lock, and one
// tap is exactly what a pocket produces. Holding for 700ms is a thing a leg
// does not do by accident, and the ring fills so it never feels unresponsive —
// the failure mode of a hidden hold is "the button is broken".
const HOLD_MS = 700;

export default function PlayerLockOverlay({ onUnlock }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);
  const raf = useRef(null);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    cancelAnimationFrame(raf.current);
    timer.current = null;
    setProgress(0);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback((e) => {
    // Never let the press through to the media or the transport beneath.
    e.preventDefault();
    e.stopPropagation();
    if (timer.current) return;
    const began = Date.now();
    const tick = () => {
      setProgress(Math.min(1, (Date.now() - began) / HOLD_MS));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    timer.current = setTimeout(() => { stop(); onUnlock?.(); }, HOLD_MS);
  }, [onUnlock, stop]);

  const swallow = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);

  return (
    <div
      // Above the move overlay (z-20) and the transport (z-30) — this has to be
      // the top of the stack or the very controls it is disabling stay live.
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]"
      style={{ touchAction: 'none' }}
      onPointerDown={swallow}
      onPointerUp={swallow}
      onClick={swallow}
      onContextMenu={swallow}
      role="button"
      tabIndex={-1}
      aria-label="Controls locked — hold the padlock to unlock"
    >
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={swallow}
        title="Hold to unlock"
        aria-label="Hold to unlock the player controls"
        className="relative flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white transition-colors"
        style={{ touchAction: 'none' }}
      >
        {/* The ring is the whole reason a hold is discoverable. */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <circle
            cx="28" cy="28" r="25" fill="none" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 25}
            strokeDashoffset={2 * Math.PI * 25 * (1 - progress)}
            className={progress > 0 ? 'text-cyan-300' : 'text-transparent'}
          />
        </svg>
        {progress > 0 ? <LockOpen size={20} /> : <Lock size={20} />}
      </button>

      <span className="absolute bottom-2 text-[10px] uppercase tracking-wider text-white/50 pointer-events-none">
        {progress > 0 ? 'Keep holding…' : 'Controls locked — hold to unlock'}
      </span>
    </div>
  );
}
