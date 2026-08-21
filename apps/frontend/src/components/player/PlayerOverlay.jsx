import {
  ThumbsUp, ThumbsDown, Share2, Check, AlertTriangle,
  Repeat, Repeat1, Shuffle, ArrowDownUp,
} from 'lucide-react';

// The controls that belong ON the picture rather than under it.
//
// WHY THEY MOVED. The transport row carried eleven buttons in a fixed line, and
// in a window the user can drag to any width the right-hand group ran off the
// edge — "full screen and some other controls get lost on resize". The row was
// already wrapping to two lines to cope, which is its own kind of lost.
//
// The fix is not a smaller button. It is that these four are a different KIND
// of control from play/pause and skip: they are things you do to the thing you
// are watching (rate it, share it, change how the list repeats), not things you
// do to the playback. Every short-form player puts that kind in a rail on the
// picture, and it is the right place for them here too — it costs no row width
// at all, so the transport underneath stops competing for space.
//
// WHEN THEY ARE VISIBLE is deliberately narrow: see useOverlayReveal. A tap
// never summons them, because a tap already means pause. Only a deliberate hold
// does, or a mouse moving. They leave on their own after five seconds.
export default function PlayerOverlay({
  visible,
  rating = 0,
  onRate,
  onShare,
  shareState = 'idle',
  playMode = 'auto',
  onCyclePlayMode,
  playModeLabel,
  accent = '#f43f5e',
}) {
  // ALWAYS MOUNTED, never conditionally rendered: fading out an element that
  // has been removed from the tree is not possible, and popping in and out is
  // the "intrusive" the brief rules out. `pointer-events-none` while hidden so
  // an invisible rail can never eat a press meant for the picture.
  const shell = `absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2
    transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  // Bigger than the transport's 36px. These sit over moving video with no
  // surface behind them, so they need their own contrast and their own target.
  const btn = `flex items-center justify-center w-11 h-11 rounded-full
    bg-black/45 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/65
    transition-colors disabled:opacity-30`;

  return (
    <div className={shell} aria-hidden={!visible}>
      <button
        type="button"
        onClick={() => onRate?.(1)}
        disabled={!onRate}
        tabIndex={visible ? 0 : -1}
        aria-pressed={rating === 1}
        title={rating === 1 ? 'Liked — press again to undo' : 'More like this'}
        aria-label={rating === 1 ? 'Remove like' : 'Like — more like this'}
        className={`${btn} ${rating === 1 ? 'text-green-400' : ''}`}
        style={rating === 1 ? { boxShadow: `0 0 0 1.5px ${accent}` } : undefined}
      >
        <ThumbsUp size={19} />
      </button>

      <button
        type="button"
        onClick={() => onRate?.(-1)}
        disabled={!onRate}
        tabIndex={visible ? 0 : -1}
        aria-pressed={rating === -1}
        title={rating === -1 ? 'Hidden from your feed — press again to undo' : 'Less like this'}
        aria-label={rating === -1 ? 'Remove dislike' : 'Dislike — less like this'}
        className={`${btn} ${rating === -1 ? 'text-rose-400' : ''}`}
      >
        <ThumbsDown size={19} />
      </button>

      {onCyclePlayMode && (
        <button
          type="button"
          onClick={onCyclePlayMode}
          tabIndex={visible ? 0 : -1}
          title={playModeLabel}
          aria-label={playModeLabel}
          className={`${btn} ${playMode !== 'auto' ? 'text-white' : ''}`}
        >
          {playMode === 'repeat-one' ? <Repeat1 size={19} />
            : playMode === 'shuffle' ? <Shuffle size={19} />
              : playMode === 'loop' ? <Repeat size={19} />
                : <ArrowDownUp size={19} />}
        </button>
      )}

      {onShare && (
        <button
          type="button"
          onClick={onShare}
          tabIndex={visible ? 0 : -1}
          aria-label="Share"
          title={shareState === 'failed'
            ? "Couldn't copy — the browser blocked it. Try again."
            : "Share a Truegle player link — opens inside Truegle's sandboxed player"}
          className={`${btn} ${shareState === 'done' ? 'text-green-400' : ''} ${shareState === 'failed' ? 'text-amber-400' : ''}`}
        >
          {shareState === 'done' ? <Check size={19} />
            : shareState === 'failed' ? <AlertTriangle size={19} />
              : <Share2 size={19} />}
        </button>
      )}
    </div>
  );
}
