import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The React side of TRAIL, and deliberately almost nothing.
 *
 * The game is ~700 lines of canvas that React must never re-render, so this
 * component owns exactly two things: a <canvas> and the lazy import. Every
 * frame, every keypress and all the state live inside mount().
 *
 * LAZY BY DESIGN. Someone who mistypes a URL, reads "404" and leaves must not
 * download a game. The import only fires once the player opens it, which is
 * also why the chunk can afford to be as big as it needs to be.
 */
export default function TrailGame({ onClose }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let unmount = null;
    let live = true;

    import('../games/trail/index.js')
      .then(({ mount }) => {
        if (!live || !canvasRef.current) return;
        unmount = mount(canvasRef.current, { onExit: onClose });
      })
      .catch(() => setFailed(true));

    return () => { live = false; unmount?.(); };
  }, [onClose]);

  // Portalled to <body> and above everything. The site's own fixed chrome —
  // the hamburger at z-9998, the clock, the cookie bar — sits at four-figure
  // z-indexes, so a modestly-stacked overlay renders UNDER it: the first build
  // had a menu button and a live clock floating over the sky. A full-screen
  // game has to be the top of the stack or it is not full screen.
  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-[11px] tracking-[0.2em] text-white/35 font-mono">TRAIL</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the game"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* The canvas fills what's left and measures itself against this box —
          the engine reads parentElement, so the frame has to be the parent. */}
      <div className="flex-1 min-h-0 relative">
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center text-white/40 text-sm px-6 text-center">
            The game didn&apos;t load. You&apos;re still on a 404 either way.
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            style={{ imageRendering: 'pixelated', touchAction: 'none' }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
