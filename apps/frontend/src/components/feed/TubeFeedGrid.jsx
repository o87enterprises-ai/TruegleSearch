import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { mediaKey } from '../../utils/videoEmbed';
import { sourceColour, sourceProviderLabel } from '../../utils/playerQuery';

// The four-unit video feed: a YouTube-homepage-shaped grid on the Truegle shell.
//
// ── ONE PREVIEW AT A TIME, NEVER FOUR ───────────────────────────────────────
//
// The obvious build is to autoplay every visible cell. ReelsQuadFeed already
// learned why that is wrong and says so in its own header: four video decoders
// running at once janks badly on anything that is not a desktop, and a phone
// simply drops frames until the whole page feels broken. So exactly one cell
// ever holds a live <iframe> — the one the pointer is resting on — and every
// other cell is a poster image. The grid stays at four visible units; the
// DECODER count stays at one.
//
// A preview also has to be EARNED, not triggered by the pointer crossing a
// cell on its way somewhere else. HOVER_MS is that gate: rest on a card and it
// comes alive, sweep across the grid and nothing does.
//
// ── THE CELL IS A BUTTON ────────────────────────────────────────────────────
//
// Not a div with onClick. The grid is the primary way to start something
// playing, so it has to be reachable by keyboard and legible to a screen
// reader — and focus is a perfectly good "the person means this one" signal,
// so it arms the preview exactly like hover does.
//
// ── COLOUR SAYS WHERE IT CAME FROM ──────────────────────────────────────────
//
// Each card carries its provider's own colour, read from the row's `kind` via
// sourceColour() — what the result actually IS, not what was searched for.
// Same function the Tube list and the browse deck use, so a YouTube result is
// the same red in all three places.

// Rest this long before a preview is worth spending a decoder on.
const HOVER_MS = 480;
// Load more once the viewer is within this many rows of the end.
const NEAR_END_PX = 600;

function providerBadge(row) {
  return { colour: sourceColour(row), label: sourceProviderLabel(row) };
}

/** A muted, chromeless preview of one row. Mounted for at most one cell. */
function Preview({ row }) {
  // Params chosen to be inert: muted so it can autoplay at all, no controls
  // because the cell is not the player, playsinline so iOS does not take the
  // video fullscreen out from under the grid.
  const src = useMemo(() => {
    if (!row?.src) return null;
    const join = row.src.includes('?') ? '&' : '?';
    return `${row.src}${join}autoplay=1&mute=1&muted=1&controls=0&playsinline=1&modestbranding=1`;
  }, [row?.src]);
  if (!src) return null;
  return (
    <iframe
      src={src}
      title=""
      aria-hidden="true"
      tabIndex={-1}
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ border: 0 }}
    />
  );
}

export default function TubeFeedGrid({
  rows: rowsProp = [],
  loading = false,
  loadingMore = false,
  more = false,
  onMore = null,
  onSelect,
  activeKey = null,
  emptyLabel = 'Nothing to show yet.',
}) {
  // usePlayerSearch (and any other caller) starts `results` at null before
  // the first response lands, not []. A bare default parameter only covers
  // undefined, so a real null slipped through it and crashed on rows.length —
  // caught by feedtube:test, not by inspection. Normalise once, here.
  const rows = rowsProp || [];
  const [armed, setArmed] = useState(null);       // mediaKey of the previewing cell
  const hoverTimer = useRef(null);
  const scroller = useRef(null);

  // Someone who has asked for less motion gets posters and nothing else. A
  // silent autoplaying video is exactly what that preference is about.
  const [stillOnly, setStillOnly] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const apply = () => setStillOnly(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const disarm = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setArmed(null);
  }, []);

  const arm = useCallback((key) => {
    if (stillOnly) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setArmed(key), HOVER_MS);
  }, [stillOnly]);

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  // Infinite scroll off the scroll position rather than an IntersectionObserver
  // sentinel: the grid is its own scroll container, so the page-level observer
  // the rest of the app uses would never fire here.
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el || !more || loadingMore || !onMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_END_PX) onMore();
  }, [more, loadingMore, onMore]);

  if (loading && !rows.length) {
    return (
      <div className="flex items-center justify-center py-20 text-white/50">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (!rows.length) {
    return <div className="py-20 text-center text-white/40 text-sm">{emptyLabel}</div>;
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      onPointerLeave={disarm}
      data-tube-feed-grid=""
      // The feed scrolls inside itself so the player above stays put. Height is
      // whatever the viewport has left once the shell's header and bar are up.
      className="overflow-y-auto overscroll-contain pr-1"
      style={{ maxHeight: 'calc(100vh - var(--truegle-player-h, 260px) - 320px)', minHeight: '40vh' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pb-6">
        {rows.map((row, i) => {
          const key = mediaKey(row) || `${row.pageUrl || 'row'}:${i}`;
          const { colour, label } = providerBadge(row);
          const isArmed = armed === key;
          const isActive = activeKey && key === activeKey;
          return (
            <button
              key={key}
              type="button"
              data-tube-cell={key}
              onClick={() => onSelect?.(row, i)}
              onPointerEnter={() => arm(key)}
              onFocus={() => arm(key)}
              onBlur={disarm}
              className="group text-left rounded-xl overflow-hidden border bg-white/[0.03] hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                // Two-toned: the provider's colour states where this came from
                // without a logo, and brightens when the cell is live.
                borderColor: isActive || isArmed ? `${colour}aa` : `${colour}33`,
              }}
            >
              <div className="relative aspect-video bg-black/60 overflow-hidden">
                {row.poster && (
                  <img
                    src={row.poster}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {isArmed && <Preview row={row} />}
                {!isArmed && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    <span
                      className="rounded-full p-2.5 backdrop-blur-sm"
                      style={{ background: `${colour}33`, boxShadow: `0 0 0 1px ${colour}66` }}
                    >
                      <Play className="w-5 h-5 text-white" fill="currentColor" />
                    </span>
                  </div>
                )}
                <span
                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide text-white/90"
                  style={{ background: `${colour}cc` }}
                >
                  {label}
                </span>
                {row.duration && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white/90 tabular-nums">
                    {row.duration}
                  </span>
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-sm text-white/90 leading-snug line-clamp-2">{row.title}</p>
                {row.channel && (
                  <p className="text-xs text-white/45 mt-1 truncate">{row.channel}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {loadingMore && (
        <div className="flex items-center justify-center py-4 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading more…
        </div>
      )}
    </div>
  );
}
