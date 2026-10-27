import { useEffect, useRef, useState } from 'react';
import { useDeliberateTap } from '../../hooks/useDeliberateTap';
import {
  Play, Pause, SkipBack, SkipForward,
  ListMusic, PictureInPicture2, Minimize2, PanelBottom,
  Maximize, Minimize, Lock, Volume2, Volume1, VolumeX, RotateCcw, Radio,
} from 'lucide-react';
import { useRadio, useRadioStatus } from '../../utils/radio';

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
  const wrapRef = useRef(null);
  // A drag that wanders off the popup is still a drag. Without this the slider
  // closed the instant the pointer left its box mid-adjustment.
  const dragging = useRef(false);
  // What to go back to when you un-mute. Muting by dragging to zero and muting
  // by pressing the button are the same state, so the level to restore has to
  // be remembered rather than inferred.
  const lastAudible = useRef(level > 0 ? level : 1);
  if (level > 0) lastAudible.current = level;

  const Icon = level === 0 ? VolumeX : (level < 0.5 ? Volume1 : Volume2);
  const pct = Math.round(level * 100);

  // Touch has no "pointer left": a slider opened by a tap closes on a press
  // anywhere else, and a drag that ends outside the control closes it too.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onUp = (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      if (e.pointerType === 'mouse' && !wrapRef.current?.matches(':hover')) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      // A MOUSE ONLY. iOS fires mouseenter on a tap, and when that handler
      // shows something new Safari spends the tap on it as a "hover" and
      // never sends the click — the first press opened the slider, did not
      // mute, and the second press closed it again (owner, 2026-10-14).
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse' && !dragging.current) setOpen(false); }}
    >
      <button
        type="button"
        className={btn}
        title={level === 0 ? 'Unmute' : `Volume ${pct}%`}
        aria-label={level === 0 ? 'Unmute' : `Volume, ${pct} percent`}
        // The press mutes/unmutes and makes sure the slider is out. It never
        // CLOSES it: with a mouse the slider is already open from the hover,
        // and the old toggle shut it on the click that was meant to mute.
        onClick={() => {
          setOpen(true);
          onChange(level === 0 ? lastAudible.current : 0);
        }}
      >
        <Icon size={size} />
      </button>

      {open && (
        // The outer box is flush with the button and carries the gap as its own
        // padding, so there is NO dead strip between the two for the pointer to
        // fall through — the 4px margin that used to be here sat outside both
        // and ended the hover on the way up. Horizontal, because that is the
        // way people reach for a volume bar, and because a vertical range
        // input (writing-mode) is not honoured by every mobile browser.
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-1.5 z-50">
          <div className="px-3 py-2.5 rounded-lg bg-[#0d0d14] border border-white/15 shadow-xl">
            <input
              type="range"
              min="0"
              max="100"
              value={pct}
              onChange={(e) => onChange(Number(e.target.value) / 100)}
              onPointerDown={() => { dragging.current = true; }}
              aria-label="Volume"
              className="block w-28 h-4 cursor-pointer"
              // Horizontal drags are the slider's; stop the page or the frame
              // reading them as a scroll or a window move.
              style={{ accentColor: accent, touchAction: 'none' }}
            />
          </div>
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
  // The now-playing song's "add to a list" button, supplied by the player.
  saveSlot = null,
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
  // Start the clip over. Previous used to be the only way back to the top, and
  // it goes to the previous CLIP unless the history is empty — so restarting
  // what you were watching meant re-finding it in the list.
  showReplay = false,
  onReplay,
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

  const [radio, setRadio] = useRadio();
  const radioStatus = useRadioStatus();
  const radioFellBack = radio && radioStatus?.state === 'fallback';
  const radioTitle = !radio
    ? 'Radio OFF — tap to keep playing this artist and similar music'
    : radioStatus?.state === 'following'
      ? `Radio ON — following ${radioStatus.artist}${radioStatus.carried ? ' (this song named no artist, so Radio kept going with them)' : ''}`
      : radioFellBack
        ? `Radio ON, but ${radioStatus.reason} — playing Up Next instead`
        : 'Radio ON — next song will follow this artist';
  // Phones have no hover, so the tooltip above never shows there: say it out
  // loud for 3s whenever Radio is switched or changes what it is doing.
  const [radioFlash, setRadioFlash] = useState('');
  const radioSeen = useRef(null);
  const radioSig = `${radio}|${radioStatus?.state || ''}|${radioStatus?.artist || ''}`;
  useEffect(() => {
    if (radioSeen.current === null) { radioSeen.current = radioSig; return undefined; }
    if (radioSeen.current === radioSig) return undefined;
    radioSeen.current = radioSig;
    setRadioFlash(radioTitle);
    const t = setTimeout(() => setRadioFlash(''), 3000);
    return () => clearTimeout(t);
  }, [radioSig]);
  // Play/pause answers a deliberate tap only — see useDeliberateTap.
  const playTap = useDeliberateTap(onPlayPause);
  const size = tight ? 15 : 16;
  const btn = `flex items-center justify-center shrink-0 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors ${
    tight ? 'w-8 h-8' : 'w-9 h-9'
  }`;

  return (
    <div
      ref={rowRef}
      className={`relative flex items-center ${veryTight ? 'flex-wrap justify-center' : ''} ${tight ? 'gap-0' : 'gap-0.5'} ${className}`}
    >
      {radioFlash && (
        <span role="status" data-radio-flash=""
          className="absolute bottom-full right-1 mb-1.5 max-w-[90%] px-2.5 py-1 rounded-full bg-black/85 border border-white/15 text-white text-[11px] font-semibold pointer-events-none truncate">
          {radioFlash}
        </span>
      )}
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
      <button type="button" {...playTap} title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'} className={btn}>
        {playing ? <Pause size={size} /> : <Play size={size} />}
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} title="Next"
        aria-label="Next" className={btn}>
        <SkipForward size={size} />
      </button>
      {showReplay && onReplay && (
        <button type="button" onClick={onReplay} title="Replay from the start"
          aria-label="Replay from the start" data-player-replay-btn="" className={btn}>
          <RotateCcw size={size - 1} />
        </button>
      )}

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
        {/* RADIO. Self-contained (utils/radio.js) so every presentation gets
            it without threading a prop: when the queue runs out and what's
            playing is a song, next is the artist and similar artists. */}
        {/* ON IS UNMISTAKABLE: a filled accent pill with the word "Radio"
            (and ON/OFF for screen readers and the long-press tooltip). OFF is
            a plain dim icon with a strike. An amber dot means Radio is on but
            could not steer the last pick (not a song / nothing found), so Up
            Next played instead — it used to fall back silently. */}
        <button type="button" onClick={() => setRadio(!radio)}
          title={radioTitle}
          aria-label={radioTitle} aria-pressed={radio}
          data-player-radio={radio ? (radioFellBack ? 'fallback' : 'on') : 'off'}
          style={radio ? { background: accent, color: '#000' } : undefined}
          className={radio
            ? `relative flex items-center justify-center gap-1 shrink-0 rounded-full font-bold ${tight ? 'h-7 px-2 text-[10px]' : 'h-8 px-2.5 text-[11px]'}`
            : `relative ${btn} text-white/35`}>
          <Radio size={radio ? size - 2 : size} />
          {radio
            ? <span>{veryTight ? 'ON' : 'Radio'}</span>
            : <span aria-hidden="true" className="absolute w-[18px] h-[1.5px] bg-current rotate-45 rounded" />}
          {radioFellBack && (
            <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border border-black" />
          )}
        </button>
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
        {saveSlot}
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
        {/* LAST, so it is the far-right control on touch devices (owner request, 2026-10-27: "no
            lock button, replace the far right corner button"). Lock the controls. A single press is enough to lock; UNLOCKING is a
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
      </div>
    </div>
  );
}
