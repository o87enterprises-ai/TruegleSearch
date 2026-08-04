import {
  Play, Pause, Square, SkipBack, SkipForward,
  ListMusic, Share2, Check, PictureInPicture2, Minimize2, Move,
  ChevronDown, ChevronUp,
} from 'lucide-react';

// The one transport row. Identical in all three presentations — collapsed
// inside the Tube search bar, expanded under the player screen, and inside the
// popped-out player. Buttons appear or not, but they never move or change
// shape between presentations, which is what makes the three read as one
// player rather than three widgets.
//
// Every control is a >=36px target: this is used one-handed on a phone.
export default function PlayerTransport({
  playing,
  canPrev,
  canNext,
  queueCount = 0,
  accent = '#f43f5e',
  showList = false,
  listOpen = false,
  showPopOut = false,
  showDock = false,
  showAdjust = false,
  showCollapse = false,
  collapsed = false,
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
  onToggleCollapse,
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

      <div className="ml-auto flex items-center gap-0.5">
        {showCollapse && (
          <button type="button" onClick={onToggleCollapse} aria-expanded={!collapsed}
            title={collapsed ? 'Show the player' : 'Collapse the player into the bar'}
            aria-label={collapsed ? 'Show the player' : 'Collapse the player'}
            className={btn}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
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
        {showPopOut && (
          <button type="button" onClick={onPopOut} title="Pop out the player"
            aria-label="Pop out the player" className={btn}>
            <PictureInPicture2 size={16} />
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
