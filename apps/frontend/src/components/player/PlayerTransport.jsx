import {
  Play, Pause, Square, SkipBack, SkipForward,
  ListMusic, Share2, Check, PictureInPicture2, Minimize2, Move, PanelBottom,
  Repeat, Repeat1, Shuffle, ArrowDownUp, Maximize, Minimize, ThumbsUp, ThumbsDown,
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
const PLAY_MODE_LABEL = {
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
const POP_OUT = {
  pop: { label: 'Pop out the player', icon: <PictureInPicture2 size={16} /> },
  footer: { label: 'Dock the player at the bottom of the page', icon: <PanelBottom size={16} /> },
  float: { label: 'Float the player', icon: <PictureInPicture2 size={16} /> },
  bar: { label: 'Dock the player back into the search bar', icon: <Minimize2 size={16} /> },
  // Popped out and away from Tube: there is nothing to dock back into, so this
  // slot is move/resize instead — the thing that was previously two presses
  // and a mode away.
  move: { label: 'Move and resize the player', icon: <Move size={16} /> },
};

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
  showAdjust = false,
  showFullscreen = false,
  fullscreen = false,
  playMode = 'auto',
  showPlayMode = false,
  // 👍/👎. `rating` is 1, -1 or 0; pressing the thumb that's already lit
  // clears it, so the pair behaves like every other vote control.
  showRating = false,
  rating = 0,
  onRate,
  adjustOn = false,
  shareState = 'idle',
  onPlayPause,
  onStop,
  onPrev,
  onNext,
  onToggleList,
  onPopOut,
  onDock,
  onShare,
  onToggleAdjust,
  onToggleFullscreen,
  onCyclePlayMode,
  className = '',
}) {
  const btn = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <button type="button" onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'} className={btn}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button type="button" onClick={onStop} title="Stop" aria-label="Stop" className={btn}>
        <Square size={15} />
      </button>
      <button type="button" onClick={onPrev} disabled={!canPrev} title="Previous"
        aria-label="Previous" className={btn}>
        <SkipBack size={16} />
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} title="Next"
        aria-label="Next" className={btn}>
        <SkipForward size={16} />
      </button>

      {/* Thumbs sit next to the transport rather than off in a menu, because
          they are the only thing steering what plays next — burying the one
          control that trains the feed would leave the feed untrained.
          What they do is split: the taste they build stays in this browser,
          and only an anonymous counter bump leaves it. See utils/taste.js. */}
      {showRating && (
        <>
          <button
            type="button"
            onClick={() => onRate?.(1)}
            disabled={!onRate}
            aria-pressed={rating === 1}
            title={rating === 1 ? 'Liked — press again to undo' : 'More like this'}
            aria-label={rating === 1 ? 'Remove like' : 'Like — more like this'}
            className={`${btn} ${rating === 1 ? 'text-green-400 bg-green-400/10' : ''}`}
          >
            <ThumbsUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => onRate?.(-1)}
            disabled={!onRate}
            aria-pressed={rating === -1}
            title={rating === -1 ? 'Hidden from your feed — press again to undo' : 'Less like this'}
            aria-label={rating === -1 ? 'Remove dislike' : 'Dislike — less like this'}
            className={`${btn} ${rating === -1 ? 'text-rose-400 bg-rose-400/10' : ''}`}
          >
            <ThumbsDown size={15} />
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        {showPlayMode && (
          <button type="button" onClick={onCyclePlayMode}
            title={PLAY_MODE_LABEL[playMode]} aria-label={PLAY_MODE_LABEL[playMode]}
            className={`${btn} ${playMode !== 'auto' ? 'text-white bg-white/10' : ''}`}>
            {playMode === 'repeat-one' ? <Repeat1 size={16} />
              : playMode === 'shuffle' ? <Shuffle size={16} />
                : playMode === 'loop' ? <Repeat size={16} />
                  : <ArrowDownUp size={16} />}
          </button>
        )}
        {showList && (
          <button type="button" onClick={onToggleList} title="Queue and results"
            aria-label="Queue and results" aria-pressed={listOpen}
            className={`relative ${btn} ${listOpen ? 'text-white bg-white/10' : ''}`}>
            <ListMusic size={16} />
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
        {onShare && (
          <button type="button" onClick={onShare} aria-label="Share"
            title="Share a Truegle player link — opens inside Truegle's sandboxed player"
            className={`${btn} ${shareState === 'done' ? 'text-green-400' : ''}`}>
            {shareState === 'done' ? <Check size={16} /> : <Share2 size={16} />}
          </button>
        )}
        {showAdjust && (
          <button type="button" onClick={onToggleAdjust} aria-pressed={adjustOn}
            title={adjustOn ? 'Finish moving/resizing' : 'Move and resize the player'}
            aria-label="Move and resize"
            className={`${btn} ${adjustOn ? 'text-black bg-cyan-400 hover:bg-cyan-300 hover:text-black' : ''}`}>
            <Move size={16} />
          </button>
        )}
        {showFullscreen && (
          <button type="button" onClick={onToggleFullscreen} aria-pressed={fullscreen}
            title={fullscreen ? 'Leave full screen' : 'Full screen'}
            aria-label={fullscreen ? 'Leave full screen' : 'Full screen'}
            className={btn}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        )}
        {showPopOut && (
          <button type="button" onClick={onPopOut} title={POP_OUT[popOutMode].label}
            aria-label={POP_OUT[popOutMode].label}
            aria-pressed={popOutMode === 'move' ? adjustOn : undefined}
            className={`${btn} ${popOutMode === 'move' && adjustOn ? 'text-black bg-cyan-400 hover:bg-cyan-300 hover:text-black' : ''}`}>
            {POP_OUT[popOutMode].icon}
          </button>
        )}
        {showDock && (
          <button type="button" onClick={onDock} title="Dock the player back into the search bar"
            aria-label="Dock the player" className={btn}>
            <Minimize2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
