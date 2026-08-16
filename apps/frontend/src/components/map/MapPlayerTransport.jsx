import { Play, Pause, Square, SkipBack, SkipForward, Lock } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// The player, from inside the map.
//
// Opening the map used to mean losing sight of the player: the transport lives
// at the bottom of the PAGE, and the map — especially in fullscreen, which is
// forced on phones — covers the page. So what's playing kept playing and there
// was no way to touch it without leaving the map first.
//
// Five things, and deliberately only five (the brief was "title, ff, rw,
// pl/ps, stop — that's it"): what is playing, skip back, play/pause, skip
// forward, stop. Everything else the player can do — queue, share, ratings,
// play mode, pop-out — stays where it already lives. A second full transport
// on the map would be a second player to keep in sync, which is the drift this
// codebase keeps paying for elsewhere.
//
// WHY SKIP AND NOT SEEK. "FF/RW" on a tape deck scrub within the track; here
// they step through the queue. Almost everything the player hosts is a
// cross-origin embed (YouTube, Vimeo, SoundCloud, Reddit), and seeking inside
// one means loading that platform's SDK — four vendor SDKs for a scrub bar.
// The icons are the same SkipBack/SkipForward the main transport uses, so the
// two rows read as one player rather than two.
//
// It lives INSIDE #truegle-map-container so it survives native fullscreen,
// which targets that element — the same reason the destination search bar
// moved in here.
export default function MapPlayerTransport({ className = '' }) {
  const {
    current, paused, queue, history, locked,
    togglePause, stop, prev, skipNext,
  } = usePlayer();

  // Nothing playing, nothing to show. This is the whole visibility rule: the
  // bar appears when the player has something loaded and vanishes when it
  // doesn't, so it never sits on the map as dead furniture.
  if (!current) return null;

  const playing = !paused;
  const btn = 'flex items-center justify-center shrink-0 w-9 h-9 rounded-lg text-white/70 '
    + 'enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';

  return (
    <div
      data-map-player-transport=""
      // Stacked off the floor rather than pinned at a guessed offset. The
      // function bar wraps onto a second row when the map is narrow, and a
      // fixed `bottom-20` put this straight through it; the container
      // publishes how much room the bar is taking (see TruegleMap) and the
      // scale bar and attribution already sit at that mark, so this clears
      // both. The fallback covers a single-row bar.
      style={{ bottom: 'calc(var(--truegle-map-bottom-clearance, 62px) + 30px)' }}
      className={`absolute left-4 z-40 max-w-[calc(100%-32px)] ${className}`}
    >
      <div className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-xl border border-neutral-700/50 shadow-2xl backdrop-blur-xl bg-gradient-to-r from-neutral-900/95 to-neutral-800/95">
        <span
          title={current.title || 'Now playing'}
          className="text-xs text-white/80 font-medium truncate max-w-[9rem] sm:max-w-[14rem]"
        >
          {current.title || 'Now playing'}
        </span>

        {locked ? (
          // A locked player is locked everywhere. Unlocking is a long-press on
          // the player's own overlay — offering a second way out from over here
          // would defeat the point of the lock.
          <span className="flex items-center justify-center w-9 h-9 text-white/40" title="Controls locked — unlock from the player">
            <Lock size={15} />
          </span>
        ) : (
          <>
            <button
              type="button" onClick={prev} disabled={!history.length}
              title="Rewind — previous in the queue" aria-label="Previous" className={btn}
            >
              <SkipBack size={16} />
            </button>
            <button
              type="button" onClick={togglePause}
              title={playing ? 'Pause' : 'Play'} aria-label={playing ? 'Pause' : 'Play'} className={btn}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button" onClick={skipNext} disabled={!queue.length}
              title="Fast forward — next in the queue" aria-label="Next" className={btn}
            >
              <SkipForward size={16} />
            </button>
            <button type="button" onClick={stop} title="Stop" aria-label="Stop" className={btn}>
              <Square size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
