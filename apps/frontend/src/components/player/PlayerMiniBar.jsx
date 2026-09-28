import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Lock, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useTouchDevice } from '../../hooks/useTouchDevice';

// THE minimized player. One footprint, everywhere.
//
// There used to be three different small states — `minimized` in the floating
// window, `footerView: 'hidden'` in the footer dock, and the retract-while-
// typing peek — each with its own row of controls. So the same idea gave you a
// different set of buttons depending on where the player happened to be, and
// pressing "hide" twice in two places did two different things. They are now
// all this component: same controls, same height, same order, only the
// position on screen differs.
//
// What it deliberately contains: the three transport controls people actually
// reach for while doing something else, a way back to the full player, the
// lock, and close. Nothing else. Everything richer lives one press away in the
// expanded player — simple when you need it, complex when you want it.
//
// The media is NEVER unmounted to get here. This bar renders INSTEAD of the
// player's chrome while the media node keeps playing behind it, because
// unmounting an iframe restarts the track.
export default function PlayerMiniBar({ onExpand, onClose, accent = '#f43f5e', className = '' }) {
  const touchDevice = useTouchDevice();
  const {
    current, paused, history, queue,
    togglePause, prev, requestNext, setLocked,
  } = usePlayer();

  // Marquee only when it actually overflows. A title that fits and scrolls
  // anyway is just movement for its own sake, and it is harder to read.
  const trackRef = useRef(null);
  const boxRef = useRef(null);
  const [overflows, setOverflows] = useState(false);
  const label = [current?.title, current?.channel].filter(Boolean).join(' — ') || 'Nothing playing';

  useEffect(() => {
    const box = boxRef.current;
    const track = trackRef.current;
    if (!box || !track) return undefined;
    const measure = () => setOverflows(track.scrollWidth > box.clientWidth + 4);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    return () => ro?.disconnect();
  }, [label]);

  const btn = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/70 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors shrink-0';

  return (
    <div data-mini-bar className={`flex items-center gap-0.5 px-1.5 h-11 ${className}`}>
      <button type="button" onClick={prev} disabled={!history.length}
        title="Previous" aria-label="Previous" className={btn}>
        <SkipBack size={16} />
      </button>
      <button type="button" onClick={() => (current ? togglePause() : null)}
        title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'} className={btn}>
        {paused ? <Play size={17} /> : <Pause size={17} />}
      </button>
      <button type="button" onClick={requestNext} disabled={!current && !queue.length}
        title="Next" aria-label="Next" className={btn}>
        <SkipForward size={16} />
      </button>

      {/* Title and channel. The only thing here that isn't a control, and the
          only way to know what you're listening to without expanding. */}
      <div ref={boxRef} className="flex-1 min-w-0 overflow-hidden mx-1.5">
        <span
          ref={trackRef}
          className={`block whitespace-nowrap text-[11px] text-white/70 ${overflows ? 'truegle-marquee' : 'truncate'}`}
        >
          {label}
        </span>
      </div>

      <button type="button" onClick={onExpand} title="Expand the player"
        aria-label="Expand the player" className={btn} style={{ color: accent }}>
        <Maximize2 size={16} />
      </button>
      {/* Touch only — see useTouchDevice. On a desktop this button's whole
          effect is to take the controls away and ask for a 700ms hold to give
          them back, which is a trap rather than a feature. */}
      {touchDevice && (
        <button type="button" onClick={() => setLocked(true)}
          title="Lock the controls — hold the padlock to unlock"
          aria-label="Lock the player controls" className={btn}>
          <Lock size={15} />
        </button>
      )}
      {onClose && (
        <button type="button" onClick={onClose} title="Close player (keeps your queue)"
          aria-label="Close player" className={btn}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
