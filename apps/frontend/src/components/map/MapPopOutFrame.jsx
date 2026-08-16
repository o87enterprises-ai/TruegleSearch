import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Minimize2, X } from 'lucide-react';

// The floating window the map lives in when it is popped out.
//
// WHY IT EXISTS. The map opened inline in the results column and, on a phone,
// went native-fullscreen. Either way it took over: you were in map mode and
// there was nothing else you could do until you closed it — the exact
// complaint the player's pop-out already answers ("keep it up while I browse
// elsewhere"). This is that same affordance for the map.
//
// SAME PATTERN AS THE PLAYER, deliberately. Pointer events rather than mouse
// events, `touch-action: none` on every drag surface (without it the browser
// claims the touch for page scrolling and the window feels immovable on a
// phone), geometry remembered in localStorage, and a clamp on resize so a
// rotate can never strand the window off-screen. Those are the four things
// MiniPlayer learned the hard way; there is no reason for the map to learn
// them again.
//
// WHY A PORTAL. This is mounted from inside the results grid, which sits under
// ancestors that animate — and a transformed ancestor makes `position: fixed`
// resolve against THAT element instead of the viewport, so the window would be
// clipped by the column it was trying to escape. Rendering into document.body
// is what makes "float above the page" actually mean the page.
const GEOM_KEY = 'truegle_map_geom';
const MIN_W = 280;
const MIN_H = 220;
const DEFAULT_W = 420;
const DEFAULT_H = 340;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

const loadGeom = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null');
    return g && typeof g.width === 'number' ? g : null;
  } catch { return null; }
};

export default function MapPopOutFrame({ children, onDock, onClose, title = 'Map' }) {
  const saved = useRef(loadGeom());
  const [size, setSize] = useState(() => ({
    width: saved.current?.width || DEFAULT_W,
    height: saved.current?.height || DEFAULT_H,
  }));
  const [pos, setPos] = useState(() => saved.current?.pos || null);
  const drag = useRef(null);

  // No stored position yet: bottom-right, clear of the player's usual corner
  // and of the pre-production bar at the very bottom.
  useEffect(() => {
    if (pos) return;
    setPos({
      left: Math.max(8, window.innerWidth - size.width - 16),
      top: Math.max(8, window.innerHeight - size.height - 96),
    });
  }, [pos, size.width, size.height]);

  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    if (d.mode === 'move') {
      setPos({
        left: clamp(e.clientX - d.dx, 4, window.innerWidth - 80),
        top: clamp(e.clientY - d.dy, 4, window.innerHeight - 40),
      });
    } else {
      setSize({
        width: clamp(d.startW + (e.clientX - d.startX), MIN_W, window.innerWidth - 16),
        height: clamp(d.startH + (e.clientY - d.startY), MIN_H, window.innerHeight - 16),
      });
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove]);

  const begin = useCallback((e, spec) => {
    e.preventDefault();
    drag.current = spec;
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  const startMove = useCallback((e) => {
    // The header carries buttons; a press on one of them is a press, not a drag.
    if (e.target.closest('button, input, a')) return;
    const rect = e.currentTarget.closest('[data-map-popout]').getBoundingClientRect();
    begin(e, { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  }, [begin]);

  const startResize = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.closest('[data-map-popout]').getBoundingClientRect();
    begin(e, {
      mode: 'resize', startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
    });
  }, [begin]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  useEffect(() => {
    try { localStorage.setItem(GEOM_KEY, JSON.stringify({ pos, ...size })); } catch { /* private mode */ }
  }, [pos, size]);

  // A rotate or a smaller window must not strand the frame off-screen.
  useEffect(() => {
    const onResize = () => {
      setSize((s) => ({
        width: clamp(s.width, MIN_W, Math.max(MIN_W, window.innerWidth - 16)),
        height: clamp(s.height, MIN_H, Math.max(MIN_H, window.innerHeight - 16)),
      }));
      setPos((p) => (p ? {
        left: clamp(p.left, 4, Math.max(4, window.innerWidth - 80)),
        top: clamp(p.top, 4, Math.max(4, window.innerHeight - 40)),
      } : p));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      data-map-popout=""
      role="dialog"
      aria-label="Truegle map"
      // Below the player's own frame (9996): if both are out, the thing making
      // noise is the one you need to reach.
      className="fixed z-[9990] flex flex-col rounded-xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl bg-neutral-900"
      style={{ left: pos.left, top: pos.top, width: size.width, height: size.height }}
    >
      <div
        onPointerDown={startMove}
        style={{ touchAction: 'none' }}
        className="flex items-center gap-2 px-2 py-1.5 cursor-move bg-gradient-to-r from-neutral-900 to-neutral-800 border-b border-neutral-700/50 shrink-0"
      >
        <GripHorizontal size={14} className="text-white/30 shrink-0" />
        <span className="text-xs font-medium text-white/70 truncate flex-1">{title}</span>
        <button
          type="button" onClick={onDock}
          title="Put the map back in the page" aria-label="Dock the map back into the page"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minimize2 size={15} />
        </button>
        <button
          type="button" onClick={onClose}
          title="Close the map" aria-label="Close the map"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-red-600 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0">{children}</div>

      <button
        type="button"
        onPointerDown={startResize}
        style={{ touchAction: 'none' }}
        title="Drag to resize"
        aria-label="Resize the map window"
        className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize flex items-end justify-end p-1.5 text-white/40 hover:text-white/80"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          <path d="M10 0v10H0z" opacity="0.5" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
