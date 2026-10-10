import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, ThumbsUp, ThumbsDown, Share2, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { useWheelNav } from '../../hooks/useWheelNav';
import { PLAYER_SANDBOX } from '../player/playerSandbox';
import { rate, useRating } from '../../utils/taste';
import { buildPlayerLink } from '../../utils/playerLink';
import { copyText } from '../../utils/clipboard';

/* ── The reel, full screen ──────────────────────────────────────────────────
 *
 * "Mini vertical player with no controls (swipe to change, 'back' to feed /
 * thumbs & share / title / creator) no que or playlist for now just endless
 * scroll and keep clock persistent."
 *
 * NO CONTROLS IS THE FEATURE. A reel is thirty seconds long; a scrub bar over
 * it is chrome you would never use covering a picture you are trying to watch.
 * What is left is the four things that are actually about THIS clip — is it
 * good, is it bad, who made it, and can I send it to someone — plus the way
 * out. Everything else was removed rather than shrunk.
 *
 * NO QUEUE, NO PLAYLIST, ON PURPOSE. This surface is a river, not a library.
 * Queueing implies an end to get to, and the whole shape of the thing is that
 * there is not one: swiping up asks for another and always gets one.
 *
 * WHAT COMES NEXT is the caller's deck (ReelsSurface), drawn from
 * utils/reelsDraw.js: vertical shorts only, seeded by the search or by this
 * browser's thumbs, with a share of seeds that ignore taste entirely.
 *
 * THE CLOCK stays because it is app-level and fixed at z-9997; this surface
 * deliberately sits below it. Being able to see the time is the difference
 * between choosing to watch reels and losing an hour to them, and taking it
 * away would be a dark pattern we would have had to write on purpose.
 */

const SWIPE_PX = 60;      // vertical travel that counts as a swipe
const SWIPE_MS = 600;     // …if it happens within this long

export default function ReelsPlayer({
  reel,
  onGrid,
  onNext,
  onPrev,
  hasPrev = false,
  hasNext = true,
}) {
  const rating = useRating(reel);
  const [shared, setShared] = useState(false);
  const [hint, setHint] = useState(true);
  const start = useRef(null);

  // Owner, 2026-10-10: "no way to select/change videos in reel once playing
  // in full screen" and "the scroll function on desktop ... doesn't work".
  // Reels had only the swipe gesture below — a touch (or a mouse DRAG, via
  // Pointer Events, which answers both) but nothing a desktop person would
  // find: no click target, no wheel. Both now exist alongside it.
  const wheelNav = useWheelNav({ active: true, onNext, onPrev });

  // The swipe hint shows once and gets out of the way. A surface whose only
  // navigation is an invisible gesture has to say so exactly once — leaving it
  // up forever would be chrome on a screen whose whole point is not having any.
  useEffect(() => {
    const id = setTimeout(() => setHint(false), 2600);
    return () => clearTimeout(id);
  }, []);

  const onPointerDown = useCallback((e) => {
    start.current = { y: e.clientY, x: e.clientX, t: Date.now() };
  }, []);

  const onPointerUp = useCallback((e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    // Horizontal travel disqualifies it: that was a drag across the picture,
    // and treating it as a swipe means the feed jumps when someone was only
    // steadying their thumb.
    if (Date.now() - s.t > SWIPE_MS || Math.abs(dy) < SWIPE_PX || Math.abs(dx) > Math.abs(dy)) return;
    setHint(false);
    if (dy < 0) onNext?.();          // swipe UP for the next one, as everywhere
    else if (hasPrev) onPrev?.();
  }, [onNext, onPrev, hasPrev]);

  const share = useCallback(async () => {
    const link = buildPlayerLink({ url: reel?.pageUrl || reel?.url, title: reel?.title });
    if (!link) return;
    // The share sheet where there is one; the clipboard where there is not.
    if (navigator.share) {
      try { await navigator.share({ url: link, title: reel?.title || 'A reel on Truegle' }); return; }
      catch { /* dismissed — fall through to copying */ }
    }
    if (await copyText(link)) {
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    }
  }, [reel]);

  if (!reel) return null;

  const btn = 'flex items-center justify-center w-11 h-11 rounded-full bg-black/45 border border-white/15 backdrop-blur-sm transition-colors';

  return (
    <div
      className="absolute inset-0 z-20 bg-black overflow-hidden"
      data-reel-root=""
      style={{ touchAction: 'pan-y' }}
    >
      {/* The picture. `key` on the src so switching reels REPLACES the frame
          rather than reusing it — a reused iframe keeps the previous clip's
          audio playing for a beat while the new one loads. */}
      <AnimatePresence mode="wait">
        <motion.iframe
          key={reel.src}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          src={`${reel.src}${reel.src.includes('?') ? '&' : '?'}autoplay=1&playsinline=1`}
          title={reel.title || 'Reel'}
          sandbox={PLAYER_SANDBOX}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 w-full h-full"
        />
      </AnimatePresence>

      {/* THE SWIPE SURFACE, and the reason swiping did nothing at all.
          An <iframe> swallows pointer events: they are delivered to the
          embedded player's own document and never cross back into ours, so
          handlers on the container behind it are never called. The picture
          IS the whole screen here, so every swipe landed on the iframe and
          the feed could only be moved by the buttons.
          MiniPlayer already hit this and covers its video with a drag layer
          for the same reason; reels never got one.
          Transparent, above the picture, BELOW the controls (which are z-20)
          so the buttons still take their own taps. */}
      <div
        className="absolute inset-0 z-10"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { start.current = null; }}
        onWheel={wheelNav?.onWheel}
      />

      {/* "Back" is the top bar's (ReelsTopBar) — it leaves Reels for the
          page you came from. The grid is one tap away on the rail below. */}

      {/* CHANGE VIDEOS — A BUTTON, NOT JUST A GESTURE. Owner, 2026-10-10: "no
          way to select/change videos in reel once playing in full screen
          mode." Swiping (now also wheel/scroll, above) was the only way to
          move, and nothing on screen said so unless you caught the 2.6s hint.
          Vertically centred on the right edge, clear of both the rating rail
          below and the top bar above — a scrollbar's worth of travel, not a
          rating action, so it reads as its own thing. */}
      <div
        className="absolute right-3 top-1/2 z-20 flex flex-col items-center gap-2 -translate-y-1/2"
      >
        <button
          type="button"
          data-reels-prev=""
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous reel"
          title="Previous reel"
          className={`${btn} text-white/75 disabled:opacity-30 disabled:cursor-default`}
        >
          <ChevronUp size={20} />
        </button>
        <button
          type="button"
          data-reels-next=""
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next reel"
          title="Next reel"
          className={`${btn} text-white/75 disabled:opacity-30 disabled:cursor-default`}
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {/* The rail: is it good, is it bad, send it on. Right-hand side, thumb
          height — the same place every vertical feed puts them, because that is
          where a thumb already is. */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-3"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        <button
          type="button"
          data-reels-grid=""
          onClick={onGrid}
          aria-label="All reels"
          title="All reels"
          className={`${btn} text-white/75`}
        >
          <LayoutGrid size={18} />
        </button>
        <button
          type="button"
          onClick={() => rate(reel, rating === 1 ? 0 : 1)}
          aria-label="Like"
          aria-pressed={rating === 1}
          title="Like — more like this"
          className={`${btn} ${rating === 1 ? 'text-green-400 border-green-400/50' : 'text-white/75'}`}
        >
          <ThumbsUp size={19} />
        </button>
        <button
          type="button"
          onClick={() => rate(reel, rating === -1 ? 0 : -1)}
          aria-label="Dislike"
          aria-pressed={rating === -1}
          title="Not for me — fewer like this"
          className={`${btn} ${rating === -1 ? 'text-red-400 border-red-400/50' : 'text-white/75'}`}
        >
          <ThumbsDown size={19} />
        </button>
        <button
          type="button"
          onClick={share}
          aria-label="Share"
          title="Share a Truegle link to this"
          className={`${btn} ${shared ? 'text-green-400' : 'text-white/75'}`}
        >
          {shared ? <Check size={19} /> : <Share2 size={18} />}
        </button>
      </div>

      {/* Who made it and what it is. Left-aligned and stopping short of the
          rail so the two never overlap on a narrow phone. */}
      <div
        className="absolute left-3 right-20 z-20 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        {reel.channel && (
          <p className="text-sm font-semibold text-white drop-shadow-lg truncate">{reel.channel}</p>
        )}
        <p data-reel-title="" className="text-[13px] text-white/80 drop-shadow-lg line-clamp-2 leading-snug mt-0.5">
          {reel.title || ''}
        </p>
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-1/2 z-20 flex justify-center pointer-events-none"
          >
            <span className="px-3 py-1.5 rounded-full bg-black/70 text-[11px] text-white/70">
              Swipe up for the next one
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
