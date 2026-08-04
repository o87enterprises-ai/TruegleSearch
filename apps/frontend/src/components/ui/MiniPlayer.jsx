import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, Maximize2, Move, GripHorizontal } from 'lucide-react';
import { MODE_COLORS, BRAND_GRADIENT } from '../../config/modeTheme';
import { usePageMode, BRAND } from '../../hooks/usePageMode';
import TrueglePlayer from '../player/TrueglePlayer';
import { useFeedbackBarHeight } from './PreProductionBanner';
import { usePlayerQuery } from '../../utils/playerQueryStore';

// The floating FRAME for the one player. Rendered ABOVE <Routes> (in
// AppContent) so the media node it hosts is never unmounted on navigation —
// the source keeps playing while the user browses elsewhere.
//
// This file deliberately owns no player UI. Everything inside the frame is
// <TrueglePlayer presentation="popped" />, the same component that docks into
// the Tube search bar, so the popped-out player is not a lookalike of the
// docked one — it is the same one.
//
// What lives here is only what a floating window needs: drag, resize,
// geometry persistence, the page-mode accent ring, and its own search bar in
// the header. That bar's query is INDEPENDENT of the page's bar — two bars
// that mirrored each other would defeat the point of having two. Media
// Session (lock-screen controls for native audio/video) also stays here,
// since it belongs to the page-level singleton.
//
// MOBILE: every drag surface sets `touch-action: none`. Without it the browser
// claims the touch for page scrolling before pointermove ever fires, which is
// what made the player feel immovable on a phone. Handles are also sized for a
// thumb, and "Adjust" mode turns the whole player into one big drag target
// with oversized grips so you don't have to hit a 16px corner.
const DEFAULT_W = 340;
const MIN_W = 240;
const MAX_W = 900;
const BANNER_CLEARANCE = 80;  // px above the bottom pre-production banner
const GEOM_KEY = 'truegle_player_geom';

const clampW = (w) => Math.max(MIN_W, Math.min(w, MAX_W, window.innerWidth - 16));

const loadGeom = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null');
    return g && typeof g.width === 'number' ? g : null;
  } catch { return null; }
};

export default function MiniPlayer() {
  const {
    current, queue, history, minimized, poppedOut, dock,
    next, prev, close, toggleMinimize, setPoppedOut,
  } = usePlayer();
  // 'footer' = pinned across the bottom of the page, above the feedback bar.
  // The frame stops being a window in that state: no dragging, no resizing,
  // no stored geometry — it belongs to the page now.
  const footerDock = dock === 'footer';
  const feedbackOffset = useFeedbackBarHeight();
  // The player floats over whatever page you're on, so it takes that page's
  // colour — otherwise it reads as a foreign dark box sitting on top of the
  // design (which is exactly how it looked on a phone).
  const pageMode = usePageMode();
  const accent = pageMode === BRAND ? null : (MODE_COLORS[pageMode] || MODE_COLORS.blue);
  const ring = accent ? `${accent}8c` : BRAND_GRADIENT;   // 8c ≈ 55% alpha
  const tint = accent ? `${accent}1f` : 'rgba(255,255,255,0.06)'; // 1f ≈ 12%

  const mediaRef = useRef(null);
  const drag = useRef(null);
  const saved = useRef(loadGeom());

  const [pos, setPos] = useState(saved.current?.pos || null); // {left, top}; null = docked
  const [width, setWidth] = useState(saved.current?.width || DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [adjust, setAdjust] = useState(false);   // move mode: drag from anywhere
  const [playerQuery, setPlayerQuery] = useState('');
  const frameRef = useRef(null);
  const pageQuery = usePlayerQuery();

  // ── docking into a page's slot ───────────────────────────────────────────
  // A page that wants the player inside its layout renders an empty
  // [data-player-slot] and this frame positions itself over it. It does NOT
  // render the player itself: React cannot move a DOM node between parents
  // without recreating it, so a page-rendered player meant a brand-new
  // <iframe> — and a track that started over — every time it popped out.
  // One node, mounted once, above <Routes>; only its geometry changes.
  const [slot, setSlot] = useState(null);
  const wantSlot = !poppedOut;
  useEffect(() => {
    if (!wantSlot) { setSlot(null); return undefined; }
    const measure = () => {
      const el = document.querySelector('[data-player-slot]');
      if (!el) { setSlot(null); return; }
      const r = el.getBoundingClientRect();
      // How much room is actually left below the page's header. A 9:16 reel
      // capped only against the viewport still ran past the bottom once the
      // logo, pill row and search bar had taken their share — the transport
      // ended up just off screen, which is exactly when you need it.
      document.documentElement.style.setProperty(
        '--truegle-player-cap',
        `${Math.max(180, Math.round(window.innerHeight - r.top - 120))}px`,
      );
      setSlot((prev) => (prev
        && Math.abs(prev.left - r.left) < 0.5
        && Math.abs(prev.top - r.top) < 0.5
        && Math.abs(prev.width - r.width) < 0.5
        ? prev
        : { left: r.left, top: r.top, width: r.width }));
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    // Catches the layout changes nothing tells us about — the slot appearing
    // on a later render, ads loading above it, the bar growing a row.
    const poll = setInterval(measure, 250);
    return () => {
      clearInterval(poll);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
      document.documentElement.style.removeProperty('--truegle-player-cap');
    };
  }, [wantSlot]);
  const docked = !!slot && wantSlot;

  // ── drag + resize ────────────────────────────────────────────────────────
  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    if (d.mode === 'move') {
      const left = Math.max(4, Math.min(e.clientX - d.dx, window.innerWidth - 80));
      const top = Math.max(4, Math.min(e.clientY - d.dy, window.innerHeight - 40));
      setPos({ left, top });
    } else {
      setWidth(clampW(d.startW + (e.clientX - d.startX)));
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove]);

  const begin = useCallback((e, spec) => {
    e.preventDefault();
    drag.current = spec;
    setDragging(true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  const startMove = useCallback((e) => {
    if (e.target.closest('button, input, a')) return; // let controls work
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  }, [begin]);

  const startResize = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'resize', startX: e.clientX, startW: rect.width });
  }, [begin]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  // Remember where the user put it — re-dragging the player on every visit was
  // half of what made it feel fiddly.
  useEffect(() => {
    try { localStorage.setItem(GEOM_KEY, JSON.stringify({ pos, width })); } catch { /* private mode */ }
  }, [pos, width]);

  // A rotate or a smaller window must not strand the player off-screen.
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => clampW(w));
      setPos((p) => (p ? {
        left: Math.max(4, Math.min(p.left, window.innerWidth - 80)),
        top: Math.max(4, Math.min(p.top, window.innerHeight - 40)),
      } : p));
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Footer dock covers the bottom of the page, so the page gets that height
  // back as extra scroll — otherwise the last few lines of every page sit
  // permanently underneath the player and can never be read.
  useEffect(() => {
    const el = frameRef.current;
    if (!footerDock || !el) { document.body.style.paddingBottom = ''; return; }
    const apply = () => {
      document.body.style.paddingBottom = `${el.getBoundingClientRect().height + feedbackOffset + 24}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.body.style.paddingBottom = ''; };
  }, [footerDock, feedbackOffset, minimized, current]);

  // A slot can't know how tall the player is, and the player can't be in the
  // page's layout, so the height crosses as a CSS variable — the slot reserves
  // exactly the room the frame occupies and the page never jumps.
  useEffect(() => {
    const el = frameRef.current;
    if (!docked || !el) return undefined;
    const apply = () => document.documentElement.style.setProperty(
      '--truegle-player-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.documentElement.style.removeProperty('--truegle-player-h');
    };
  }, [docked]);

  // ── Media Session: lock-screen controls + background audio (native only) ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const isNative = current && (current.kind === 'audio' || current.kind === 'video');
    if (!isNative) { try { navigator.mediaSession.metadata = null; } catch { /* noop */ } return; }
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title || 'Truegle',
        artist: 'Truegle',
        artwork: current.poster ? [{ src: current.poster }] : [],
      });
    } catch { /* MediaMetadata unsupported */ }
    const set = (act, fn) => { try { navigator.mediaSession.setActionHandler(act, fn); } catch { /* unsupported action */ } };
    set('play', () => mediaRef.current?.play());
    set('pause', () => mediaRef.current?.pause());
    set('previoustrack', history.length ? prev : null);
    set('nexttrack', queue.length ? next : null);
    return () => ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((act) => set(act, null));
  }, [current, history.length, queue.length, next, prev]);

  // Nothing playing, not popped out, and no page slot asking for it → nothing
  // to show. Once popped out the frame stays even with an empty screen: the
  // user asked for the player, and its search bar is how they fill it.
  if (!current && !poppedOut && !docked) return null;

  const title = current?.title;
  const clipWhenMin = minimized;

  const style = docked
    ? {
      left: slot.left,
      top: slot.top,
      width: slot.width,
      // The frame is FIXED, so anything of its own that runs past the bottom
      // of the screen can never be scrolled to — the page scrolls, the frame
      // doesn't. Cap it at what's actually visible and let it scroll itself,
      // so an opened panel (add-a-link, a long queue) stays reachable.
      maxHeight: `calc(100svh - ${Math.max(0, Math.round(slot.top))}px - 8px)`,
      overflowY: 'auto',
    }
    : footerDock
    ? {
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: feedbackOffset,
      width: 'min(calc(100vw - 1rem), 48rem)',
    }
    : pos
      ? { left: pos.left, top: pos.top, width }
      : { left: 16, bottom: BANNER_CLEARANCE, width };

  // Every control is a ≥36px square. The old 13px icons packed edge to edge
  // were the other half of the "hard to maneuver" problem.
  const ctrl = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';

  return (
    <>
      {/* Gesture overlay — captures pointer events over the iframe while
          dragging/resizing so the move doesn't get eaten by the embed. */}
      {dragging && (
        <div
          className="fixed inset-0 z-[9997]"
          style={{ touchAction: 'none', cursor: drag.current?.mode === 'resize' ? 'nwse-resize' : 'move' }}
        />
      )}

      {/* The 1.5px "ring" is a background, not a border, so the same code path
          renders a flat mode colour and the brand gradient. Inner surface stays
          translucent over it. */}
      <div
        data-mini
        ref={frameRef}
        style={{
          ...style,
          background: adjust ? MODE_COLORS.ocean : ring,
          // Docked, the bar above supplies the top edge — a ring all the way
          // round would draw a line through the middle of one surface.
          padding: docked ? '0 1.5px 1.5px' : (adjust ? 2.5 : 1.5),
        }}
        className={`fixed shadow-2xl transition-shadow ${dragging ? 'select-none' : ''} ${
          docked
            // Below the page's own dropdowns (suggestions drop over this
            // space), above the results underneath it.
            ? 'z-[30] rounded-b-2xl'
            : 'z-[9996] max-w-[calc(100vw-1rem)] rounded-xl'
        }`}
      >
      <div className={`relative overflow-hidden bg-[#0d0d14]/95 backdrop-blur-xl ${docked ? 'rounded-b-[14px]' : 'rounded-[10px]'}`}>
        {/* Move mode: the WHOLE player becomes the drag handle, including the
            video area — an iframe swallows pointer events, so without this
            overlay "move" could only ever be started from the grab bar, which
            is why the button felt like it did nothing but resize. Resizing
            still lives on the corner grip; it never needed a mode. */}
        {adjust && !docked && !footerDock && (
          <div
            onPointerDown={startMove}
            style={{ touchAction: 'none' }}
            className="absolute inset-0 z-20 cursor-move"
            aria-hidden="true"
          />
        )}
        {/* ── Grab bar. Thick on purpose: 44px tall, full width, with a visible
            grip so it reads as "hold here to move me".
            Docked, it's gone entirely: the page's search bar is directly above
            and a second search input under it is exactly the duplication we
            took out. ── */}
        {!docked && (
        <div
          onPointerDown={footerDock ? undefined : startMove}
          style={{ touchAction: footerDock ? 'auto' : 'none', background: adjust ? 'rgba(34,211,238,0.15)' : tint }}
          className={`flex items-center gap-1.5 px-2 min-h-[44px] border-b ${footerDock ? '' : 'cursor-move'} ${
            adjust ? 'border-cyan-400/30' : 'border-white/10'
          }`}
        >
          {!footerDock && (
            <GripHorizontal size={18} className={adjust ? 'text-cyan-300 shrink-0' : 'text-white/40 shrink-0'} />
          )}
          {/* The player's OWN search bar, in the header where it can't be
              mistaken for the page's. Deliberately never auto-hides: the old
              below-player bar collapsed on a 3s idle timer that focus merely
              restarted, so it vanished mid-word. Its query is independent of
              the page's bar — that separation is the point of having two. */}
          <input
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={title || 'Search something to play…'}
            aria-label="Search the player"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-white/30"
          />
          <button type="button" onClick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'} className={ctrl}>
            {minimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </button>
          {/* Close puts the player away; it does NOT empty the queue. Clearing
              is explicit, in the list. */}
          <button type="button" onClick={close} title="Close player (keeps your queue)" className={ctrl}>
            <X size={16} />
          </button>
        </div>
        )}

        {/* The player itself is the SHARED component — the same stack that
            docks inside the Tube search bar. This file now owns only the
            floating FRAME (drag, resize, geometry, accent ring); everything
            inside it is TrueglePlayer, so "one player" is structural rather
            than a resemblance that drifts. */}
        <div className={clipWhenMin ? 'max-h-0 overflow-hidden' : ''}>
          <TrueglePlayer
            presentation={docked ? 'expanded' : 'popped'}
            accent={accent || undefined}
            query={docked ? pageQuery : playerQuery}
          />
        </div>

        {/* Move — the one thing only the floating window can offer. Docking is
            NOT here: the transport's pop-out control is the single master for
            where the player lives, and a second dock button next to it was
            exactly the ambiguity we took out.
            z-30 keeps it above the move overlay, so the same button that turns
            move mode on is the one that turns it off. */}
        {!minimized && !footerDock && !docked && (
          <div className="relative z-30 flex items-center gap-0.5 px-1.5 py-1 border-t border-white/10 bg-black/20">
            <button type="button" onClick={() => setAdjust((v) => !v)} aria-pressed={adjust}
              title={adjust ? 'Done moving' : 'Move the player'}
              aria-label={adjust ? 'Done moving' : 'Move the player'}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                adjust ? 'text-black bg-cyan-400 hover:bg-cyan-300' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}>
              <Move size={16} />
            </button>
            {adjust && (
              <span className="text-[10px] uppercase tracking-wider text-cyan-200/70">
                Drag anywhere to move
              </span>
            )}
          </div>
        )}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls, and needs no mode of its own. Bigger while moving so a
            thumb can find it without leaving the mode. */}
        {!minimized && !footerDock && !docked && (
          <div className={`relative z-30 flex justify-end border-t ${adjust ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-white/10 bg-black/20'}`}>
            <div
              onPointerDown={startResize}
              title="Drag to resize"
              style={{ touchAction: 'none' }}
              className={`cursor-nwse-resize flex items-end justify-end p-1.5 ${adjust ? 'w-11 h-11' : 'w-8 h-6'}`}
            >
              <span className={`block border-r-2 border-b-2 ${adjust ? 'w-4 h-4 border-cyan-300' : 'w-2.5 h-2.5 border-white/40'}`} />
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
