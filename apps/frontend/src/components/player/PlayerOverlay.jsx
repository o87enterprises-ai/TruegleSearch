import {
  ThumbsUp, ThumbsDown, Share2, Check, AlertTriangle,
  Repeat, Repeat1, Shuffle, ArrowDownUp, MousePointerClick,
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
  onInteract,         // a press on the rail keeps it on screen (it hides after a few seconds)
  compact = false,    // a very small picture: use its whole height
  // CLICK-THROUGH TO THE EMBED ITSELF. Owner, 2026-10-10: "add a way to
  // interact with any on screen (in viewport) clicks or functions ... if
  // there is something on the screen when viewing a social feed that there
  // is no way to interact." On a platform we command (YouTube, Vimeo…) our
  // own transparent layer covers the whole picture so taps reach US, not the
  // embed — which also hides anything the PLATFORM put on screen: a YouTube
  // end-card, a clickable link inside a Reddit or X embed, a suggested-video
  // tile. This lets that layer stand down so a press goes straight through.
  // Not `onInteract` above — that keeps the RAIL on screen; this is a
  // different thing, deliberately named apart from it.
  clickThrough = false,
  onToggleClickThrough,
}) {
  // ALWAYS MOUNTED, never conditionally rendered: fading out an element that
  // has been removed from the tree is not possible, and popping in and out is
  // the "intrusive" the brief rules out. `pointer-events-none` while hidden so
  // an invisible rail can never eat a press meant for the picture. The same goes
  // for the rail's EMPTY BOX while shown: only its buttons take presses, or the
  // box (which can span two columns) covers the centre transport beside it.
  //
  // z-30, ABOVE the heads-up display (z-20, later in the page, so it won): on
  // the Feed's phone-sized picture (~210px) the four buttons fill the whole
  // height, the last one — Share — landed under the progress strip, and a
  // press there hit the strip. Owner, 2026-10-01: "the on-screen share /
  // controls aren't working".
  //
  // The rail lives in the band BETWEEN the title strip and the progress strip
  // (inset-y-12) and WRAPS into a second column when that band is too short
  // for one, so it never has to sit on top of either.
  const shell = `absolute right-2 ${compact ? 'inset-y-2' : 'inset-y-12'} z-30 flex flex-col flex-wrap-reverse content-start justify-center items-center gap-2
    transition-opacity duration-200 pointer-events-none ${visible ? 'opacity-100 [&>button]:pointer-events-auto' : 'opacity-0'}`;

  // Bigger than the transport's 36px. These sit over moving video with no
  // surface behind them, so they need their own contrast and their own target.
  const btn = `flex items-center justify-center w-10 h-10 rounded-full
    bg-black/45 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/65
    transition-colors disabled:opacity-30`;

  return (
    <div className={shell} aria-hidden={!visible} onPointerDown={() => onInteract?.()}>
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

      {onToggleClickThrough && (
        <button
          type="button"
          data-clickthrough-toggle=""
          onClick={onToggleClickThrough}
          tabIndex={visible ? 0 : -1}
          aria-pressed={clickThrough}
          title={clickThrough ? 'Back to Truegle\'s controls' : 'Interact with what\'s on screen'}
          aria-label={clickThrough ? 'Stop interacting with the video, restore Truegle\'s controls' : "Interact with the video's own on-screen content"}
          className={`${btn} ${clickThrough ? 'text-amber-300' : ''}`}
        >
          <MousePointerClick size={19} />
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
