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
export default function TrailGame({ onClose, onFound, embedded = false }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  // Only the full-screen presentation owns the page's scroll. Embedded, the
  // game is a card ON a page — locking the document would strand the reader
  // wherever the card happens to sit.
  useEffect(() => {
    if (embedded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [embedded]);

  // onClose through a REF, so the game mounts exactly once.
  //
  // It used to be an effect dependency, which meant every re-render of the
  // parent tore the game down and built a new one — and since a fresh mount
  // starts at the title, a run in progress silently vanished. The parent's
  // own hint timer was enough to trigger it about four seconds in, so a
  // player would tap to start, drive for a moment, and find themselves back
  // at the menu with no idea why.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Same reason, same trick: a callback identity must never reach the effect
  // deps, or arriving at the settlement would remount the game and throw away
  // the run that earned it.
  const foundRef = useRef(onFound);
  foundRef.current = onFound;

  useEffect(() => {
    let unmount = null;
    let live = true;

    import('../games/trail/index.js')
      .then(({ mount }) => {
        if (!live || !canvasRef.current) return;
        unmount = mount(canvasRef.current, {
          onExit: () => closeRef.current?.(),
          onFound: () => foundRef.current?.(),
        });
      })
      .catch(() => setFailed(true));

    return () => { live = false; unmount?.(); };
  }, []);

  const chrome = (
    <>
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
          the engine reads parentElement, so the frame has to be the parent.
          Embedded, the box takes the game's OWN 320x180 shape (see engine.js)
          rather than a guessed height: the renderer letterboxes anything else,
          so a card taller than 16:9 is just dead card. Full screen keeps
          flex-1, where filling the window is the whole point. */}
      <div className={`relative ${embedded ? 'w-full aspect-[16/9]' : 'flex-1 min-h-0'}`}>
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
    </>
  );

  // EMBEDDED: a card on a Truegle page, not a takeover.
  //
  // The game used to be the whole window — black to every edge, a lone
  // "TRAIL" wordmark in the corner, and no way back to the site except the
  // ✕. That is a different product wearing Truegle's URL. Embedded it keeps
  // the page's logo, background and card language, so it reads as something
  // Truegle has rather than somewhere Truegle sent you.
  //
  // No portal here on purpose: the point is to sit INSIDE the page's layout.
  if (embedded) {
    return (
      <div
        data-trail-embedded=""
        // The results card, exactly: same gradient, same radius, same border
        // treatment as every ResultCard on the search page.
        className="flex flex-col rounded-lg overflow-hidden border border-cyan-500/30
                   bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 shadow-2xl"
      >
        {chrome}
      </div>
    );
  }

  // Portalled to <body> and above everything. The site's own fixed chrome —
  // the hamburger at z-9998, the clock, the cookie bar — sits at four-figure
  // z-indexes, so a modestly-stacked overlay renders UNDER it: the first build
  // had a menu button and a live clock floating over the sky. A full-screen
  // game has to be the top of the stack or it is not full screen.
  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black flex flex-col">
      {chrome}
    </div>,
    document.body,
  );
}
