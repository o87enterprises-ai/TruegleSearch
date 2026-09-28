import { useCallback, useEffect, useRef, useState } from 'react';
import ReelsQuadFeed from './ReelsQuadFeed';
import ReelsPlayer from './ReelsPlayer';
import ReelsTopBar from './ReelsTopBar';
import { usePlayer } from '../../context/PlayerContext';
import { drawReels, reelSeed } from '../../utils/reelsDraw';
import { mediaKey } from '../../utils/videoEmbed';

/* ── Reels ──────────────────────────────────────────────────────────────────
 *
 * The whole surface: a four-quarter grid you arrive at, and a full-screen
 * vertical player you drop into, under one top bar (back · search · shuffle ·
 * Tube/Reels) that stays put across both — the YouTube Shorts shape.
 *
 * ITS OWN FEED. Everything here comes from utils/reelsDraw.js: vertical
 * YouTube Shorts and TikToks, 2:00 or less, nothing else. It used to borrow
 * the Tube pool (useUpNext) for swipe-next and top-ups, which is how landscape
 * uploads ended up in a reel player. Tube and Reels are now two distinct feeds.
 *
 * ONE DECK, ONE INDEX. The grid and the player walk the same list, so swiping
 * down in the player goes back to exactly what was above it, and returning to
 * the grid shows what you just watched.
 *
 * FULL SCREEN WITHOUT THE FULLSCREEN API, for the same reason the player does
 * it that way: entering real fullscreen on Android hides the system bars, and
 * the clock at the top of the page stops existing the moment a single element
 * goes fullscreen. So this is a fixed box above the early-access banner
 * (z-60/70) and below PageClock (z-9997) and the nav button (z-9998).
 */
const NEAR_END = 3; // top up when this few reels remain past the one playing

export default function ReelsSurface({ query = '', onClose, onTube, accent = '#f43f5e' }) {
  const [input, setInput] = useState(query);
  const [subject, setSubject] = useState(query.trim()); // '' = your taste
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openIdx, setOpenIdx] = useState(null);
  const page = useRef(1);
  const busy = useRef(false);
  const gen = useRef(0);          // bumps on every reset; stale batches drop
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const { current, stop } = usePlayer();

  // ONE THING PLAYS AT A TIME. Opening reels over a playing Tube track would
  // leave two audio sources running with only one visible pause button.
  const stoppedOnce = useRef(false);
  useEffect(() => {
    if (stoppedOnce.current) return;
    stoppedOnce.current = true;
    if (current) stop();
  }, [current, stop]);

  /** Append one batch. With a subject, walk its pages; without, a new taste seed. */
  const more = useCallback(async () => {
    if (busy.current) return 0;
    busy.current = true;
    const myGen = gen.current;
    setLoading(true);
    try {
      const exclude = new Set(deckRef.current.map((s) => mediaKey(s)));
      const seed = subject || reelSeed();
      const batch = await drawReels(seed, { page: subject ? page.current : 1, exclude });
      if (myGen !== gen.current) return 0;
      if (subject) page.current += 1;
      if (batch.length) setDeck((d) => [...d, ...batch]);
      return batch.length;
    } finally {
      busy.current = false;
      if (myGen === gen.current) setLoading(false);
    }
  }, [subject]);

  // A new subject (search, or Shuffle's '') starts a fresh deck. A subject
  // that finds no shorts at all tops up from taste rather than stopping dead.
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    gen.current += 1;
    busy.current = false;
    page.current = 1;
    setDeck([]);
    let alive = true;
    (async () => {
      let got = await more();
      if (alive && !got && !subject) got = await more();
      if (alive && got && openIdx !== null) setOpenIdx(0);
    })();
    return () => { alive = false; };
    // openIdx is read once, on purpose: a reset while watching keeps watching.
  }, [subject, resetKey]);

  const search = (text) => {
    const t = String(text ?? input).trim();
    setOpenIdx(null); // results land in the grid, where they can be picked from
    setSubject(t);
    setResetKey((k) => k + 1);
  };
  const shuffle = () => {
    setInput('');
    setSubject('');
    setResetKey((k) => k + 1);
    setOpenIdx((i) => (i === null ? null : 0));
  };

  const goNext = useCallback(async () => {
    if (openIdx === null) return;
    const left = deckRef.current.length - 1 - openIdx;
    if (left <= NEAR_END) more();
    if (left > 0) { setOpenIdx(openIdx + 1); return; }
    const got = await more();
    if (got) setOpenIdx(openIdx + 1);
  }, [openIdx, more]);
  const goPrev = useCallback(() => {
    setOpenIdx((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Escape closes the reel first, then the surface.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.target?.tagName === 'INPUT') return;
      if (openIdx !== null) setOpenIdx(null);
      else onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openIdx, onClose]);

  const open = openIdx !== null ? deck[openIdx] : null;

  return (
    <div
      data-reels-surface={open ? 'player' : 'grid'}
      className="fixed inset-0 z-[80] bg-black"
      style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {open ? (
        <ReelsPlayer
          reel={open}
          hasPrev={openIdx > 0}
          onGrid={() => setOpenIdx(null)}
          onNext={goNext}
          onPrev={goPrev}
        />
      ) : (
        <ReelsQuadFeed
          reels={deck}
          loading={loading}
          subject={subject}
          accent={accent}
          onSelect={(r, i) => setOpenIdx(i)}
          onNeedMore={more}
        />
      )}
      <ReelsTopBar
        value={input}
        onChange={setInput}
        onSubmit={search}
        onShuffle={shuffle}
        onBack={onClose}
        onTube={onTube || onClose}
        loading={loading}
        accent={accent}
      />
    </div>
  );
}
