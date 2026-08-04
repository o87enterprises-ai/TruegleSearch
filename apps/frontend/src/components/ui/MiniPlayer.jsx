import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, Maximize2, Move, Plus, GripHorizontal, Minimize2 } from 'lucide-react';
import { MODE_COLORS, BRAND_GRADIENT } from '../../config/modeTheme';
import { usePageMode, BRAND } from '../../hooks/usePageMode';
import { useIdleReveal } from '../../hooks/useIdleReveal';
import TrueglePlayer from '../player/TrueglePlayer';

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
// geometry persistence, the page-mode accent ring, and its own auto-hiding
// search bar. Media Session (lock-screen controls for native audio/video) also
// stays here, since it belongs to the page-level singleton.
//
// MOBILE: every drag surface sets `touch-action: none`. Without it the browser
// claims the touch for page scrolling before pointermove ever fires, which is
// what made the player feel immovable on a phone. Handles are also sized for a
// thumb, and "Adjust" mode turns the whole player into one big drag target
// with oversized grips so you don't have to hit a 16px corner.
const DEFAULT_W = 340;
const MIN_W = 240;
const MAX_W = 900;
const STEP = 60;              // px per tap of the −/+ size buttons
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
    current, queue, history, minimized, poppedOut,
    next, prev, close, toggleMinimize, setPoppedOut,
  } = usePlayer();
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
  const [adjust, setAdjust] = useState(false);   // mobile stretch/shrink/drag mode
  const [playerQuery, setPlayerQuery] = useState('');
  const frameRef = useRef(null);
  const { visible: barVisible, wake } = useIdleReveal(frameRef);

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

  if (!current) return null;
  // On Tube the player lives docked inside the search bar until it is popped
  // out; everywhere else the floating frame IS the player. One component,
  // two homes — never both at once.
  if (pageMode === 'tube' && !poppedOut) return null;

  const title = current.title;
  const clipWhenMin = minimized;

  const style = pos
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
          padding: adjust ? 2.5 : 1.5,
        }}
        className={`fixed z-[9996] max-w-[calc(100vw-1rem)] rounded-xl shadow-2xl transition-shadow ${dragging ? 'select-none' : ''}`}
      >
      <div className="rounded-[10px] overflow-hidden bg-[#0d0d14]/95 backdrop-blur-xl">
        {/* ── Grab bar. Thick on purpose: 44px tall, full width, with a visible
            grip so it reads as "hold here to move me". ── */}
        <div
          onPointerDown={startMove}
          style={{ touchAction: 'none', background: adjust ? 'rgba(34,211,238,0.15)' : tint }}
          className={`flex items-center gap-1.5 px-2 min-h-[44px] border-b cursor-move ${
            adjust ? 'border-cyan-400/30' : 'border-white/10'
          }`}
        >
          <GripHorizontal size={18} className={adjust ? 'text-cyan-300 shrink-0' : 'text-white/40 shrink-0'} />
          <span className="text-xs text-white/70 truncate flex-1 min-w-0" title={title}>
            {title || 'Now playing'}
          </span>
          <button type="button" onClick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'} className={ctrl}>
            {minimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </button>
          <button type="button" onClick={close} title="Close player" className={ctrl}>
            <X size={16} />
          </button>
        </div>

        {/* The player itself is the SHARED component — the same stack that
            docks inside the Tube search bar. This file now owns only the
            floating FRAME (drag, resize, geometry, accent ring); everything
            inside it is TrueglePlayer, so "one player" is structural rather
            than a resemblance that drifts. */}
        <div className={clipWhenMin ? 'max-h-0 overflow-hidden' : ''}>
          <TrueglePlayer presentation="popped" accent={accent || undefined} query={playerQuery} />
        </div>

        {/* Its own search bar — playable results only, so you can line up the
            next thing without leaving whatever you're watching. It hides when
            idle and wakes on movement near the player (useIdleReveal), which
            is what lets the player sit over a page you're still reading. */}
        {!minimized && (
          <div
            className={`overflow-hidden border-t border-white/10 transition-all duration-200 ${
              barVisible ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <input
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              onFocus={wake}
              placeholder="Search something to play…"
              aria-label="Search for something to play"
              className="w-full bg-black/40 px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none"
            />
          </div>
        )}

        {/* ── Adjust bar: stretch / shrink without needing a precise grip ── */}
        {adjust && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-cyan-400/20 bg-cyan-400/10">
            <span className="text-[10px] text-cyan-200/70 uppercase tracking-wider mr-auto">Size</span>
            <button type="button" onClick={() => setWidth((w) => clampW(w - STEP))} title="Shrink"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Minus size={16} />
            </button>
            <button type="button" onClick={() => setWidth((w) => clampW(w + STEP))} title="Stretch"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => { setPos(null); setWidth(DEFAULT_W); }} title="Snap back to the corner"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Minimize2 size={15} />
            </button>
            <button type="button" onClick={() => setAdjust(false)}
              className="px-3 h-9 rounded-lg bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 transition-colors">
              Done
            </button>
          </div>
        )}

        {/* Dock + move, the two things only the floating frame can offer. */}
        {!minimized && (
          <div className="flex items-center gap-0.5 px-1.5 py-1 border-t border-white/10 bg-black/20">
            <button type="button" onClick={() => setAdjust((v) => !v)} aria-pressed={adjust}
              title={adjust ? 'Finish moving/resizing' : 'Move and resize the player'}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                adjust ? 'text-black bg-cyan-400 hover:bg-cyan-300' : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}>
              <Move size={16} />
            </button>
            {pageMode === 'tube' && (
              <button type="button" onClick={() => setPoppedOut(false)}
                title="Dock the player back into the search bar"
                className="ml-auto flex items-center gap-1.5 px-3 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-xs transition-colors">
                <Minimize2 size={15} /> Dock
              </button>
            )}
          </div>
        )}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls. Doubles in size in Adjust mode so a thumb can find it. */}
        {!minimized && (
          <div className={`flex justify-end border-t ${adjust ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-white/10 bg-black/20'}`}>
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
