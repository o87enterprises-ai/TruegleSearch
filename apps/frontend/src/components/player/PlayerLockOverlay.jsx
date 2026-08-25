import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import LockedVoicePanel from './LockedVoicePanel';

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

export default function PlayerLockOverlay({ onUnlock, gestures, voice }) {
  const [progress, setProgress] = useState(0);
  // THE CONTROLS ARE REVEALED, NOT PERSISTENT. A touch shows the padlock and
  // the microphone; they fade again a few seconds later. Same reasoning as the
  // lock itself — a live button sitting under a locked sheet is a button a
  // pocket can find, and the microphone is the one control where that would be
  // genuinely unpleasant.
  const [revealed, setRevealed] = useState(true);
  const revealTimer = useRef(null);
  const timer = useRef(null);
  const raf = useRef(null);

  const reveal = useCallback(() => {
    setRevealed(true);
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setRevealed(false), 4000);
  }, []);
  useEffect(() => {
    reveal();
    return () => clearTimeout(revealTimer.current);
  }, [reveal]);

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

  // The sheet SWALLOWS presses, and now also reads them. Those are different
  // jobs: nothing gets through to the media or the transport underneath, and
  // the deliberate gestures (see useLockedGestures) are interpreted here
  // instead. A lock that means "no controls" and a lock that means "different
  // controls" are the same sheet; the difference is whether anybody bothered to
  // listen.
  const gate = useCallback((fn) => (e) => { swallow(e); reveal(); fn?.(e); }, [swallow, reveal]);
  const g = gestures?.handlers || {};
  const dim = gestures?.dim || 0;

  return (
    <div
      // Above the transport (z-30) — this has to be the top of the stack or the
      // very controls it is disabling stay live.
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]"
      style={{ touchAction: 'none' }}
      onPointerDown={gate(g.onPointerDown)}
      onPointerMove={g.onPointerMove}
      onPointerUp={gate(g.onPointerUp)}
      onPointerCancel={gate(g.onPointerCancel)}
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
        className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white transition-opacity duration-500 ${
          revealed || progress > 0 ? 'opacity-100' : 'opacity-0'
        }`}
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

      <span
        className={`absolute bottom-2 text-[10px] uppercase tracking-wider text-white/50 pointer-events-none transition-opacity duration-500 ${
          revealed || progress > 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {progress > 0 ? 'Keep holding…' : 'Controls locked — hold to unlock'}
      </span>

      {/* ── Voice, above the sheet ──────────────────────────────────────────
          The one region that takes input while locked. The lock is about the
          TRANSPORT — it exists so a pocket cannot skip the track — and choosing
          what to play next was never the danger, so opening this up costs the
          lock nothing. See LockedVoicePanel. */}
      {voice && (
        <LockedVoicePanel
          visible={revealed}
          dim={dim}
          volume={voice.volume}
          onVolume={voice.setVolume}
          onSearch={voice.onSearch}
          onDismiss={voice.onDismiss}
          results={voice.results}
          loading={voice.loading}
          onSelect={voice.onSelect}
          onOpenPlaylist={voice.onOpenPlaylist}
        />
      )}

      {/* THE DIMMER, and it is drawn LAST so it covers the padlock too.
          "As if the screen was off" means the padlock is not glowing in the
          middle of it either. Unlocking still works at full dark — the hold is
          on the button underneath and does not need to be seen to be pressed,
          which is the entire point of the mode. */}
      {dim > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{ opacity: dim }}
          aria-hidden="true"
        />
      )}

      {/* The level, while the finger is still down. It sits ABOVE the dimmer so
          it stays readable as the screen goes dark — otherwise the only feedback
          for the gesture would be the thing the gesture is hiding. */}
      {gestures?.sliding && (
        <div className="absolute inset-x-0 bottom-10 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-black/80 border border-white/20 text-[11px] text-white/80 tabular-nums">
            Screen {Math.round((1 - dim) * 100)}%
          </div>
        </div>
      )}
    </div>
  );
}
