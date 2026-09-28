import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Plus, Check, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { SaveTo } from './PlayerLibrary';
import { mediaKey } from '../../utils/videoEmbed';
import { sourceColour, sourceProviderLabel } from '../../utils/playerQuery';
import { publishedLabel } from '../../utils/published';
import { PLAYER_SANDBOX } from './playerSandbox';

// The viewport, while nothing is playing and a search has run.
//
// An empty black rectangle under a list of results reads as a player that
// doesn't work. This fills it with the results themselves — one full-size card
// at a time, scrolled with a swipe, each one previewable by holding it. It is
// the browse half of the player: you flick through what you asked for, watch a
// second of anything that looks right, and press it.
//
// SCROLLING IS THE BROWSER'S. A vertical scroll-snap column gives swipe up /
// swipe down for free, with the platform's own momentum, rubber-banding and
// accessibility — and, unlike a custom gesture handler, it cannot fight the
// page or the full-screen swipe nav. The chevrons are the same thing for a
// mouse.
//
// PREVIEW IS TWO-STAGE, because the cheap stage is instant and the real one
// isn't:
//   1. Immediately — cycle YouTube's three free storyboard frames (hq1/2/3),
//      which are already on their CDN and cost one image each. Motion under
//      your thumb the moment you press.
//   2. After a beat of sustained hold — mount the actual embed, muted, no
//      controls. One at a time, unmounted the instant you let go, so browsing
//      never leaves a pile of iframes running.
const HOLD_MS = 420;        // press-and-hold before a preview arms
const EMBED_MS = 900;       // …and before it becomes the real thing
const FRAME_MS = 700;       // storyboard frame cadence
const MOVE_SLOP = 10;       // px of drift that turns a hold into a scroll

const youtubeId = (source) => {
  const k = mediaKey(source);
  return k.startsWith('youtube:') ? k.slice(8) : null;
};

// Muted, chromeless, and inert: a preview is a look at the thing, not a
// viewing of it. `mute=1` is also the only way a browser will let it start.
function previewSrc(source) {
  if (!source?.src) return null;
  if (source.kind !== 'youtube' && source.kind !== 'vimeo') return null;
  const sep = source.src.includes('?') ? '&' : '?';
  return source.kind === 'vimeo'
    ? `${source.src}${sep}autoplay=1&muted=1&controls=0&title=0&byline=0&portrait=0`
    : `${source.src}${sep}autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=0`;
}

export default function PlayerBrowse({
  rows, loading = false, compact = false, fill = false,
  // Reaching the end of the deck asks for the next page. A swipe deck has no
  // bottom to put a button at — you are always looking at exactly one card —
  // so the gesture that means "keep going" has to be the trigger.
  more = false, onMore = null, loadingMore = false,
}) {
  const { enqueue, startFeed } = usePlayer();
  // The scroll hint stays loud until the deck has been scrolled once.
  const [scrolled, setScrolled] = useState(false);
  const scroller = useRef(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(null);      // mediaKey being previewed
  const [embedded, setEmbedded] = useState(false);
  const [frame, setFrame] = useState(0);
  const [added, setAdded] = useState(null);
  const hold = useRef(null);

  // Which card is in view — drives the counter and the chevrons.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const onScroll = () => {
      const h = el.clientHeight || 1;
      setActive(Math.round(el.scrollTop / h));
      if (el.scrollTop > 8) setScrolled(true);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [rows]);

  // A NEW set of results starts at the top rather than wherever the last one
  // was scrolled to — but a GROWN one does not. Appending a page makes a new
  // array, so keying this on `rows` alone threw the deck back to card one
  // every time it loaded more, which reads as the swipe having failed. The
  // deck is the same deck while its first card is the same card.
  const firstKey = rows && rows.length ? (mediaKey(rows[0]) || rows[0].src) : null;
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); setActive(0); }, [firstKey]);

  // REACHING THE END IS THE ASK. A swipe deck shows exactly one card, so there
  // is no bottom of a list to put a "more" button at — the gesture that means
  // "keep going" has to be the trigger. Fires two cards early so the next page
  // is usually already there by the time it is swiped to.
  useEffect(() => {
    if (!more || !onMore || loadingMore) return;
    if (!rows || rows.length === 0) return;
    if (active >= rows.length - 2) onMore();
  }, [active, rows, more, onMore, loadingMore]);

  // Storyboard frames, while a card is held and before the embed takes over.
  useEffect(() => {
    if (!held || embedded) return undefined;
    const id = setInterval(() => setFrame((n) => n + 1), FRAME_MS);
    return () => clearInterval(id);
  }, [held, embedded]);

  const release = useCallback(() => {
    clearTimeout(hold.current?.arm);
    clearTimeout(hold.current?.embed);
    hold.current = null;
    setHeld(null);
    setEmbedded(false);
    setFrame(0);
  }, []);

  useEffect(() => release, [release]);

  const grab = useCallback((e, source) => {
    // A mouse previews on hover; a finger has to hold, or every scroll would
    // fire up an embed on the way past.
    const key = mediaKey(source);
    const at = { x: e.clientX, y: e.clientY };
    clearTimeout(hold.current?.arm);
    clearTimeout(hold.current?.embed);
    hold.current = {
      key,
      at,
      moved: false,
      arm: setTimeout(() => { setFrame(0); setHeld(key); }, e.pointerType === 'mouse' ? 250 : HOLD_MS),
      embed: setTimeout(() => setEmbedded(true), e.pointerType === 'mouse' ? EMBED_MS - 150 : EMBED_MS),
    };
  }, []);

  const drift = useCallback((e) => {
    const h = hold.current;
    if (!h || h.moved) return;
    if (Math.abs(e.clientY - h.at.y) > MOVE_SLOP || Math.abs(e.clientX - h.at.x) > MOVE_SLOP) {
      // They're scrolling, not holding.
      h.moved = true;
      release();
    }
  }, [release]);

  // PLAY FROM HERE: this card, then the rest of the results in order. It runs
  // as a feed, so your queue (and any saved list) is parked, not wiped — it
  // used to clearQueue() on every tap.
  const playFrom = useCallback((source, rest) => {
    startFeed([source, ...rest]);
  }, [startFeed]);

  // A tap that never became a hold is a "play this".
  const drop = useCallback((source, rest) => {
    const wasHeld = !!hold.current && !hold.current.moved && held;
    release();
    if (wasHeld) return;                     // holding is looking, not choosing
    playFrom(source, rest);
  }, [held, release, playFrom]);

  const add = useCallback((source) => {
    enqueue(source, { deck: 'tube' });
    setAdded(mediaKey(source));
    setTimeout(() => setAdded(null), 1500);
  }, [enqueue]);

  const actionBtn = 'flex items-center gap-1 px-2 h-8 rounded-lg border text-[11px] backdrop-blur transition-colors';

  const step = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: (active + dir) * el.clientHeight, behavior: 'smooth' });
  };

  const height = compact
    ? 'min(34svh, var(--truegle-player-cap, 100svh))'
    : 'min(52svh, var(--truegle-player-cap, 100svh))';

  if (loading && !rows?.length) {
    return (
      <div className={`w-full bg-black/60 ${fill ? 'flex-1 min-h-0' : ''}`}
        style={fill ? undefined : { height }} aria-live="polite">
        <span className="sr-only">Finding something to watch…</span>
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  if (!rows?.length) return null;

  return (
    <div className={`relative w-full bg-black ${fill ? 'flex-1 min-h-0' : ''}`}
      style={fill ? undefined : { height }}>
      <div
        ref={scroller}
        className="w-full h-full overflow-y-auto snap-y snap-mandatory scrollbar-none"
        // Vertical panning is the whole interaction; the browser owns it.
        style={{ scrollbarWidth: 'none' }}
      >
        {rows.map((r, i) => {
          const key = mediaKey(r) || r.src;
          const isHeld = held === key;
          const ytId = youtubeId(r);
          // hq1/hq2/hq3 are the three storyboard stills YouTube publishes for
          // every video, free and keyless. Cycling them IS the cheap preview.
          const still = isHeld && ytId
            ? `https://i.ytimg.com/vi/${ytId}/hq${(frame % 3) + 1}.jpg`
            : r.poster;
          const embedUrl = isHeld && embedded ? previewSrc(r) : null;
          const rest = rows.slice(i + 1);

          return (
            <div key={key} className="relative w-full h-full snap-start shrink-0 bg-black">
              {/* The card is one big press target: tap to play, hold to peek. */}
              <button
                type="button"
                onPointerDown={(e) => grab(e, r)}
                onPointerMove={drift}
                onPointerUp={() => drop(r, rest)}
                onPointerLeave={release}
                onPointerCancel={release}
                onContextMenu={(e) => e.preventDefault()}   // long-press menu would eat the hold
                title={`${r.title || 'Play this'} — hold to preview`}
                aria-label={`Play ${r.title || 'this'}`}
                className="absolute inset-0 w-full h-full text-left"
                style={{ touchAction: 'pan-y' }}
              >
                {still ? (
                  <img
                    src={still}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.target.style.visibility = 'hidden'; }}
                  />
                ) : (
                  <span className="absolute inset-0 bg-white/[0.04]" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

                {!isHeld && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur flex items-center justify-center">
                      <Play size={20} className="text-white ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                )}
              </button>

              {/* The real preview, once the hold has been sustained. It sits
                  ABOVE the press target, so letting go still lands on
                  onPointerUp — the button keeps pointer capture. */}
              {embedUrl && (
                <iframe
                  src={embedUrl}
                  title=""
                  aria-hidden="true"
                  tabIndex={-1}
                  sandbox={PLAYER_SANDBOX}
                  allow="autoplay; encrypted-media"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              )}

              {/* Which platform this card is from. The Where chips are gone
                  and a search fans out across all of them, so the deck mixes
                  providers freely — the badge is what stops that being a
                  guessing game, and it is read off the row's own `kind`. */}
              <span
                className="absolute top-2 right-2 px-1.5 h-5 rounded-md text-[9px] font-semibold uppercase tracking-wider leading-5 text-black/85 pointer-events-none"
                style={{ background: sourceColour(r) }}
              >
                {sourceProviderLabel(r)}
              </span>

              <div className="absolute inset-x-0 bottom-0 p-2.5 pb-5 pointer-events-none">
                <p className="text-[12px] font-semibold text-white line-clamp-2 leading-snug drop-shadow">
                  {r.title}
                </p>
                {(r.channel || publishedLabel(r.published)) && (
                  <p className="text-[10px] text-white/60 truncate mt-0.5">
                    {r.channel}
                    {r.channel && publishedLabel(r.published) && <span className="text-white/30"> · </span>}
                    {publishedLabel(r.published)}
                  </p>
                )}
                {/* PLAY NOW · ADD TO QUEUE · ADD TO LIST, on every card. Add to
                    list opens your saved lists, with New list at the bottom. */}
                <div data-browse-actions="" className="flex items-center gap-1.5 mt-2 pointer-events-auto">
                  <button
                    type="button"
                    data-browse-action="play"
                    onClick={(e) => { e.stopPropagation(); playFrom(r, rest); }}
                    aria-label={`Play ${r.title || 'this'} now`}
                    className={`${actionBtn} border-white/25 bg-white/15 text-white hover:bg-white/25`}
                  >
                    <Play size={12} fill="currentColor" /> Play now
                  </button>
                  <button
                    type="button"
                    data-browse-action="queue"
                    onClick={(e) => { e.stopPropagation(); add(r); }}
                    aria-label={`Add ${r.title || 'this'} to the queue`}
                    className={`${actionBtn} ${added === key
                      ? 'border-green-400/50 bg-green-400/20 text-green-200'
                      : 'border-white/20 bg-black/50 text-white/80 hover:text-white hover:bg-black/70'}`}
                  >
                    {added === key ? <Check size={12} /> : <Plus size={12} />}
                    {added === key ? 'Queued' : 'Queue'}
                  </button>
                  <SaveTo
                    source={r}
                    label="List"
                    className={`${actionBtn} border-white/20 bg-black/50 text-white/80 hover:text-white hover:bg-black/70`}
                  />
                </div>
              </div>

              {isHeld && (
                <span className="absolute top-2 left-2 px-1.5 h-5 rounded-md bg-black/60 backdrop-blur text-[9px] uppercase tracking-wider text-white/70 leading-5">
                  Preview
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Where you are, and the mouse equivalent of the swipe. */}
      <div className="absolute top-1/2 -translate-y-1/2 right-1 flex flex-col items-center gap-1 pointer-events-none">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={active === 0}
          aria-label="Previous result"
          className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur text-white/60 hover:text-white disabled:opacity-0 transition-all"
        >
          <ChevronUp size={15} />
        </button>
        <span className="px-1 rounded bg-black/50 backdrop-blur text-[9px] text-white/50 tabular-nums">
          {Math.min(active + 1, rows.length)}/{rows.length}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={active >= rows.length - 1}
          aria-label="Next result"
          className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur text-white/60 hover:text-white disabled:opacity-0 transition-all"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {/* THE HINT. Loud (and bobbing) until the deck has been scrolled once,
          so it's obvious there is more than the one card on screen. */}
      <p
        data-browse-hint={scrolled ? 'quiet' : 'loud'}
        className={`absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider pb-0.5 pointer-events-none ${
          scrolled ? 'text-white/25' : 'text-white/70'}`}
      >
        {loadingMore ? 'Finding more…' : (
          <>
            {!scrolled && rows.length > 1 && <ChevronDown size={11} className="animate-bounce" />}
            {rows.length > 1 ? `Scroll for ${rows.length - 1} more · hold to preview` : 'Hold to preview'}
          </>
        )}
      </p>
    </div>
  );
}
