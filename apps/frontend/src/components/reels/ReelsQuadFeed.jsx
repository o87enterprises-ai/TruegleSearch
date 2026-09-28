import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Loader2 } from 'lucide-react';
import { PLAYER_SANDBOX } from '../player/playerSandbox';

/* ── The four-quarter reel feed ─────────────────────────────────────────────
 *
 * "Four quarters feed fill vertical screen … opens to full screen 4 quarters
 * with slow scroll down, top left to bottom right preview."
 *
 * TWO BY TWO, filling the screen. Reels are shot 9:16, so four of them at half
 * width and half height is the arrangement where each cell keeps its own shape
 * with nothing letterboxed and nothing cropped — the grid is square-ish because
 * the clips are tall, not in spite of it.
 *
 * THE SWEEP. One cell at a time previews, walking top-left → top-right →
 * bottom-left → bottom-right, and the grid creeps downward underneath it. ONE
 * at a time is not a compromise, it is the design: four simultaneous embeds on
 * a phone is four video decoders, four sockets and four sets of someone's
 * mobile data, and it janks badly enough that the scroll stops being slow and
 * starts being broken. So the sweep is what makes the grid feel alive, and it
 * costs one iframe.
 *
 * Previews are MUTED. A grid that starts talking the moment it opens is the
 * behaviour people install blockers to escape, and autoplay-with-sound is
 * refused by every mobile browser anyway.
 */

const CELL_MS = 2600;      // how long each cell holds the preview
const SCROLL_PX_PER_S = 9; // the "slow scroll down" — deliberately unhurried
const NEAR_END = 4;        // top up the feed when this many rows remain

export default function ReelsQuadFeed({
  reels = [],
  loading = false,
  onSelect,
  onNeedMore,
  subject = '',
  accent = '#f43f5e',
}) {
  const scrollRef = useRef(null);
  const [sweep, setSweep] = useState(0);       // index of the previewing cell
  const [paused, setPaused] = useState(false); // the user touched it
  const resumeTimer = useRef(null);

  // Only reels we can actually embed get a preview; the rest still show as
  // thumbnails, because a cell that cannot preview is still a cell you can tap.
  const playable = useMemo(
    () => reels.map((r) => (r?.src ? r : null)),
    [reels],
  );

  // ── The sweep ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (paused || reels.length === 0) return undefined;
    const id = setInterval(() => setSweep((i) => (i + 1) % Math.max(1, reels.length)), CELL_MS);
    return () => clearInterval(id);
  }, [paused, reels.length]);

  // ── The slow scroll ───────────────────────────────────────────────────────
  // rAF rather than a CSS animation: the list grows as more reels load, so the
  // distance is not known up front, and a keyframe would have to be restarted
  // every time — which visibly jumps.
  useEffect(() => {
    if (paused) return undefined;
    let raf = null;
    let last = performance.now();
    const step = (now) => {
      const el = scrollRef.current;
      const dt = (now - last) / 1000;
      last = now;
      if (el) {
        const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        if (!atEnd) el.scrollTop += SCROLL_PX_PER_S * dt;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  // Touching the grid stops both, so a person scrolling by hand is not fought
  // by an animation. It resumes once they have finished.
  const interrupt = useCallback(() => {
    setPaused(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }, []);
  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  // Endless: ask for more before the bottom rather than at it, so the scroll
  // never actually reaches an end and stalls.
  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    const rowH = el.clientHeight / 2;
    const rowsLeft = (el.scrollHeight - el.scrollTop - el.clientHeight) / Math.max(1, rowH);
    if (rowsLeft < NEAR_END) onNeedMore?.();
  }, [onNeedMore]);

  return (
    <div className="absolute inset-0 z-10 bg-black" data-reel-root="">
      {/* THE GRID IS FULL BLEED. "Four quarters fill vertical screen" means the
          screen, so the chrome floats over it rather than taking a strip off
          the top and squeezing the fourth cell off the bottom. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={interrupt}
        onWheel={interrupt}
        className="absolute inset-0 overflow-y-auto overscroll-contain"
      >
        {/* Exactly two columns, and each row exactly half the viewport, so four
            cells fill the screen with no arithmetic at any other breakpoint.
            50% of the SCROLLER, not of the viewport, so the header above does
            not push the fourth cell off the bottom. */}
        <div className="grid grid-cols-2 auto-rows-[50%] h-full">
          {reels.map((r, i) => {
            const active = i === sweep && !paused;
            return (
              <button
                key={r.src || r.url || i}
                type="button"
                onClick={() => onSelect?.(r, i)}
                className="relative overflow-hidden border border-white/5 bg-neutral-950 text-left"
              >
                {/* The preview, one at a time. `active` gates the whole iframe
                    rather than just its visibility — an idle hidden embed is
                    still downloading. */}
                {active && playable[i]?.src ? (
                  <iframe
                    src={`${r.src}${r.src.includes('?') ? '&' : '?'}autoplay=1&mute=1&controls=0&playsinline=1`}
                    title={r.title || 'Reel preview'}
                    sandbox={PLAYER_SANDBOX}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    loading="lazy"
                  />
                ) : r.poster || r.image ? (
                  <img
                    src={r.poster || r.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                )}

                {/* The sweep marker. It has to be legible over an arbitrary
                    frame of video, which a border alone is not. */}
                {active && (
                  <motion.span
                    layoutId="reel-sweep"
                    className="absolute inset-0 pointer-events-none border-2 rounded-sm"
                    style={{ borderColor: accent, boxShadow: `inset 0 0 30px ${accent}44` }}
                  />
                )}

                <span className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
                  <span className="block text-[11px] text-white/90 line-clamp-2 leading-snug">
                    {r.title || 'Untitled'}
                  </span>
                  {r.channel && (
                    <span className="block text-[10px] text-white/45 truncate mt-0.5">{r.channel}</span>
                  )}
                </span>

                {!active && (
                  <span className="absolute top-2 right-2 p-1 rounded-full bg-black/50 pointer-events-none">
                    <Play size={11} className="text-white/70" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Empty state — rendered INSTEAD of the grid, not after it. The grid is
          h-full even with nothing in it, so a message underneath sat a whole
          screen below the fold and read as a blank page. */}
      {reels.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 pointer-events-none">
          {loading ? (
            <>
              <Loader2 size={22} className="animate-spin text-white/40" />
              <p className="text-white/40 text-sm">Finding reels…</p>
            </>
          ) : (
            <p className="text-white/40 text-sm text-center leading-relaxed">
              {subject
                ? `No short vertical clips found for “${subject}”. Try another search, or Shuffle.`
                : 'No reels came back just now. Tap Shuffle to try again.'}
            </p>
          )}
        </div>
      )}

      {/* The chrome (back · search · shuffle · Tube/Reels) is ReelsTopBar,
          owned by ReelsSurface so it stays put across grid and player. */}
    </div>
  );
}
