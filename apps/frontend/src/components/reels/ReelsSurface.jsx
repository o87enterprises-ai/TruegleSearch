import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReelsQuadFeed from './ReelsQuadFeed';
import ReelsPlayer from './ReelsPlayer';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useUpNext } from '../../hooks/useUpNext';
import { usePlayer } from '../../context/PlayerContext';

/* ── Reels ──────────────────────────────────────────────────────────────────
 *
 * The whole surface: a four-quarter grid you arrive at, and a full-screen
 * vertical player you drop into. Two components because they are two states,
 * one file because the state machine between them is four lines and splitting
 * it would put those four lines somewhere neither of them can see.
 *
 * FULL SCREEN WITHOUT THE FULLSCREEN API, for the same reason the player does
 * it that way: entering real fullscreen on Android hides the system bars, and
 * the clock at the top of the page is app-level chrome that stops existing the
 * moment a single element goes fullscreen. "Keep clock persistent" and
 * document.requestFullscreen() are mutually exclusive, so this is a fixed box
 * instead.
 *
 * THE STACK IT SITS IN, which is the whole reason for the specific number:
 * above the early-access banner (z-60/70), which otherwise lies across the
 * bottom of a full-screen reel and covers the creator's name; below PageClock
 * (z-9997) and the nav button (z-9998), which stay on top on purpose. The
 * clock especially — being able to see the time is the difference between
 * choosing to watch reels and losing an hour to them.
 *
 * WHAT COMES NEXT. The grid is a SEARCH (the shorts scope, which also folds in
 * the community reel pool); the player's next is a DRAW (useUpNext), which
 * mixes taste-scored candidates with a fixed fraction that ignores taste
 * entirely. That is the "unrelated + related" split, and it is why swiping does
 * not walk you in a circle around whatever you opened with.
 */
export default function ReelsSurface({ query = '', onClose, accent = '#f43f5e' }) {
  const [open, setOpen] = useState(null);        // the reel being watched
  const [drawn, setDrawn] = useState([]);        // clips drawn since opening
  const [seenBack, setSeenBack] = useState([]);  // where "swipe down" goes
  const nextRef = useRef(null);                  // the pre-drawn next clip

  const search = usePlayerSearch(query, 'shorts');
  const upNext = useUpNext();
  const { current, stop } = usePlayer();

  // ONE THING PLAYS AT A TIME. Opening reels over a playing Tube track would
  // leave two audio sources running with only one visible pause button, which
  // reads as the app being broken rather than as two players.
  const stoppedOnce = useRef(false);
  useEffect(() => {
    if (stoppedOnce.current) return;
    stoppedOnce.current = true;
    if (current) stop();
  }, [current, stop]);

  // Escape / back closes the reel first, then the surface — the same order the
  // user built the stack in.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (open) setOpen(null);
      else onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const reels = useMemo(() => {
    const rows = search.results || [];
    // Drawn clips join the grid so the feed keeps growing as you watch, and
    // dedupe by src because a drawn clip may already be in the search rows.
    const seen = new Set();
    return [...rows, ...drawn].filter((r) => {
      if (!r?.src || seen.has(r.src)) return false;
      seen.add(r.src);
      return true;
    });
  }, [search.results, drawn]);

  /** Draw one clip ahead so a swipe never waits on the network. */
  const preload = useCallback(async () => {
    if (nextRef.current) return;
    const pick = await upNext.pick(open || null);
    if (pick) nextRef.current = pick;
  }, [upNext, open]);

  const goNext = useCallback(async () => {
    const ready = nextRef.current;
    nextRef.current = null;
    const pick = ready || await upNext.pick(open || null);
    if (!pick) return;
    setSeenBack((prev) => (open ? [...prev, open].slice(-30) : prev));
    setDrawn((prev) => (prev.some((d) => d.src === pick.src) ? prev : [...prev, pick]));
    setOpen(pick);
    // Draw the one after immediately, so the NEXT swipe is instant too.
    nextRef.current = null;
    upNext.pick(pick).then((p) => { if (p) nextRef.current = p; }).catch(() => {});
  }, [upNext, open]);

  const goPrev = useCallback(() => {
    setSeenBack((prev) => {
      if (prev.length === 0) return prev;
      const back = prev[prev.length - 1];
      setOpen(back);
      return prev.slice(0, -1);
    });
  }, []);

  // "Endless scroll": the grid tops itself up from the same draw the player
  // uses, so scrolling past the search results does not hit a wall.
  const needMore = useRef(false);
  const fillMore = useCallback(async () => {
    if (needMore.current) return;
    needMore.current = true;
    try {
      const batch = await upNext.fill(open || null, 6);
      if (batch?.length) {
        setDrawn((prev) => {
          const seen = new Set(prev.map((d) => d.src));
          return [...prev, ...batch.filter((b) => b?.src && !seen.has(b.src))];
        });
      }
    } finally {
      needMore.current = false;
    }
  }, [upNext, open]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black"
      style={{
        // dvh so the box follows the viewport as the browser's own bar comes
        // and goes, rather than sitting partly underneath it.
        height: '100dvh',
        // The status-bar inset is left clear — that is what "keep the phone's
        // notification bar visible" means in practice.
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {open ? (
        <ReelsPlayer
          reel={open}
          hasPrev={seenBack.length > 0}
          onBack={() => setOpen(null)}
          onNext={goNext}
          onPrev={goPrev}
          onNeedNext={preload}
        />
      ) : (
        <ReelsQuadFeed
          reels={reels}
          loading={search.loading}
          accent={accent}
          onSelect={(r) => setOpen(r)}
          onClose={onClose}
          onNeedMore={fillMore}
        />
      )}
    </div>
  );
}
