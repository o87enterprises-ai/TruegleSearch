import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  ListMusic, PictureInPicture2, Minimize2, PanelBottom,
  Maximize, Minimize, Lock, Volume2, Volume1, VolumeX,
} from 'lucide-react';

// The one transport row. Identical in all three presentations — collapsed
// inside the Tube search bar, expanded under the player screen, and inside the
// popped-out player. Buttons appear or not, but they never move or change
// shape between presentations, which is what makes the three read as one
// player rather than three widgets.
//
// Every control is a >=36px target: this is used one-handed on a phone.
//
// Play mode cycles auto -> repeat one -> shuffle -> loop, defaulting to auto
// (play straight through the queue) — the behaviour people expect without
// touching anything.
export const PLAY_MODES = ['auto', 'repeat-one', 'shuffle', 'loop'];
// Exported: the play-mode control lives on PlayerOverlay now, and its label has
// to say the same thing there that it said here.
export const PLAY_MODE_LABEL = {
  auto: 'Auto — play through the queue',
  'repeat-one': 'Repeat this one',
  shuffle: 'Shuffle the queue',
  loop: 'Loop the whole queue',
};

// The ONE pop-out control. It is a master toggle rather than three separate
// buttons: whatever the player's current home is, this moves it to the next
// one, and its icon/label say where that is. Having a second pop-out on the
// search bar was the thing that made it ambiguous which one was in charge.
//
//   pop    → lift it out into the floating window
//   footer → pin it across the bottom of the page (above the feedback bar)
//   float  → let it float freely again
//   bar    → put it back inside the Tube search bar
// The icon is a COMPONENT, not an element: the row now sizes its controls
// from its own measured width, and a pre-rendered element baked in whatever
// size was in scope at module load — which is nothing.
const POP_OUT = {
  pop: { label: 'Pop out the player', Icon: PictureInPicture2 },
  footer: { label: 'Dock the player at the bottom of the page', Icon: PanelBottom },
  float: { label: 'Float the player', Icon: PictureInPicture2 },
  bar: { label: 'Dock the player back into the search bar', Icon: Minimize2 },
  // Popped out and away from Tube there is nothing to dock back INTO, so this
  // slot offers the other home instead: pin to the bottom of the page, or let
  // it float again. It used to be a move/resize MODE — a button that switched
  // on the ability to drag. The window drags from its bar and resizes from its
  // corner like any other window, so the mode was a second way to do what
  // dragging already did.
};

// ONE VOLUME CONTROL, IN ONE PLACE, whatever is playing.
//
// Every platform puts its own volume somewhere different, and inside a 9:16
// reel or a docked strip half of them are off-screen or too small to hit — so
// "turn it down" meant first working out what was playing. This speaks the
// postMessage channel the player already has open (see useEmbedPlayback), so
// the control is in the same spot for YouTube, Vimeo, SoundCloud and a plain
// <video> alike.
//
// A BUTTON THAT GROWS, not a slider parked in the row. The row already carries
// eleven controls and wraps to two lines when the popped-out frame is dragged
// narrow; a permanent slider would push it there at every size. The button is
// the same 36px square as its neighbours and the slider appears over the row
// when you reach for it.
function VolumeControl({ level, onChange, btn, size, accent }) {
  const [open, setOpen] = useState(false);
  // What to go back to when you un-mute. Muting by dragging to zero and muting
  // by pressing the button are the same state, so the level to restore has to
  // be remembered rather than inferred.
  const lastAudible = useRef(level > 0 ? level : 1);
  if (level > 0) lastAudible.current = level;

  const Icon = level === 0 ? VolumeX : (level < 0.5 ? Volume1 : Volume2);
  const pct = Math.round(level * 100);

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={btn}
        title={level === 0 ? 'Unmute' : `Volume ${pct}%`}
        aria-label={level === 0 ? 'Unmute' : `Volume, ${pct} percent`}
        // Touch has no hover: the press opens the slider AND toggles mute, so
        // the control still does something useful on the first tap either way.
        onClick={() => {
          setOpen((v) => !v);
          onChange(level === 0 ? lastAudible.current : 0);
        }}
      >
        <Icon size={size} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-2 rounded-lg bg-[#0d0d14] border border-white/15 shadow-xl z-50"
          // Vertical, so it never widens the row it is trying not to crowd.
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        >
          <input
            type="range"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            aria-label="Volume"
            className="h-20 w-4 cursor-pointer accent-white"
            style={{ accentColor: accent }}
          />
        </div>
      )}
    </div>
  );
}

export default function PlayerTransport({
  playing,
  canPrev,
  canNext,
  queueCount = 0,
  accent = '#f43f5e',
  showList = false,
  listOpen = false,
  showPopOut = false,
  popOutMode = 'pop',
  showDock = false,
  showFullscreen = false,
  fullscreen = false,
  // 👍/👎. `rating` is 1, -1 or 0; pressing the thumb that's already lit
  // clears it, so the pair behaves like every other vote control.
  showRating = false,
  rating = 0,
  onRate,
  showLock = false,
  onLock,
  // 0..1. Absent on a platform we cannot command, where a control that does
  // nothing is worse than no control.
  showVolume = false,
  volume = 1,
  onVolume,
  shareState = 'idle',
  onPlayPause,
  onPrev,
  onNext,
  onToggleList,
  onPopOut,
  onDock,
  onShare,
  onToggleFullscreen,
  className = '',
}) {
  // ELEVEN controls in a fixed row. In the popped-out frame — which the user
  // can drag to any width — the right-hand group ran off the edge and the
  // pop-out and full-screen buttons became unreachable.
  //
  // Measured against the ROW, not the viewport: the frame is resizable, so a
  // viewport breakpoint says nothing about how much room these buttons have.
  // Below the threshold the targets shrink to 32px and the gaps close; below a
  // second one the row is allowed to wrap onto two lines rather than clip,
  // because a control you cannot see is worse than a control on line two.
  const rowRef = useRef(null);
  const [w, setW] = useState(9999);
  useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const tight = w < 340;
  const veryTight = w < 260;

  const size = tight ? 15 : 16;
  const btn = `flex items-center justify-center shrink-0 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors ${
    tight ? 'w-8 h-8' : 'w-9 h-9'
  }`;

  return (
    <div
      ref={rowRef}
      className={`flex items-center ${veryTight ? 'flex-wrap justify-center' : ''} ${tight ? 'gap-0' : 'gap-0.5'} ${className}`}
    >
      {/* BACK, PLAY, FORWARD — in that order, which is the order they are on
          every remote control and every other player anyone has used. Play/pause
          sat at the far left with Stop between it and the skips, so the two
          buttons pressed most often were separated by the one pressed least.

          STOP IS GONE. It cleared what was playing and left the queue, which is
          pause plus an extra thing to explain — and the transport has a pause.
          Closing the player is the control that means "I'm done", and it is
          already in the frame's own header. */}
      <button type="button" onClick={onPrev} disabled={!canPrev} title="Previous"
        aria-label="Previous" className={btn}>
        <SkipBack size={size} />
      </button>
      <button type="button" onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'} className={btn}>
        {playing ? <Pause size={size} /> : <Play size={size} />}
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} title="Next"
        aria-label="Next" className={btn}>
        <SkipForward size={size} />
      </button>

      {showVolume && onVolume && (
        <VolumeControl level={volume} onChange={onVolume} btn={btn} size={size} accent={accent} />
      )}

      {/* Thumbs sit next to the transport rather than off in a menu, because
          they are the only thing steering what plays next — burying the one
          control that trains the feed would leave the feed untrained.
          What they do is split: the taste they build stays in this browser,
          and only an anonymous counter bump leaves it. See utils/taste.js. */}
      {/* Thumbs, share and play-mode are on the PICTURE now (PlayerOverlay).
          They are a different kind of control from play and skip — things you
          do to what you are watching, not to the playback — and moving them off
          this row is what stops it running out of width in a resized window,
          which is what "controls get lost on resize" was. */}
      <div className={`flex items-center shrink-0 ${veryTight ? 'w-full justify-center' : 'ml-auto'} ${tight ? 'gap-0' : 'gap-0.5'}`}>
        {showList && (
          <button type="button" onClick={onToggleList} title="Queue and results"
            aria-label="Queue and results" aria-pressed={listOpen}
            className={`relative ${btn} ${listOpen ? 'text-white bg-white/10' : ''}`}>
            <ListMusic size={size} />
            {queueCount > 0 && (
              <span
                style={{ background: accent }}
                className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-black text-[9px] font-bold leading-[14px] text-center"
              >
                {queueCount}
              </span>
            )}
          </button>
        )}
        {/* NO MOVE BUTTON. The floating player is a window: you drag its bar
            to move it and its corner to resize it, exactly like every other
            window on a desktop. A mode you have to switch on first, with a
            button that only exists in one presentation, was a second way to do
            what dragging already does. */}
        {/* Lock the controls. A single press is enough to lock; UNLOCKING is a
            long-press on the overlay, because a lock a pocket can undo is not
            a lock. */}
        {showLock && (
          <button type="button" onClick={onLock}
            title="Lock the controls — hold the padlock to unlock"
            aria-label="Lock the player controls"
            className={btn}>
            <Lock size={size - 1} />
          </button>
        )}
        {showFullscreen && (
          <button type="button" onClick={onToggleFullscreen} aria-pressed={fullscreen}
            title={fullscreen ? 'Leave full screen' : 'Full screen'}
            aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}
            className={btn}>
            {fullscreen ? <Minimize size={size} /> : <Maximize size={size} />}
          </button>
        )}
        {showPopOut && (
          <button type="button" onClick={onPopOut} title={POP_OUT[popOutMode].label}
            aria-label={POP_OUT[popOutMode].label}
            className={btn}>
            {(() => { const { Icon } = POP_OUT[popOutMode]; return <Icon size={size} />; })()}
          </button>
        )}
        {showDock && (
          <button type="button" onClick={onDock} title="Dock the player back into the search bar"
            aria-label="Dock the player" className={btn}>
            <Minimize2 size={size} />
          </button>
        )}
      </div>
    </div>
  );
}
