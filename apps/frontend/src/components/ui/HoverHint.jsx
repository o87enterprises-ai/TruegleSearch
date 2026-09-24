import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTutorials } from '../../context/TutorialContext';

/**
 * Wraps a UI element with a hover/tap popover that explains it. Site-wide
 * opt-in is gated through TutorialContext:
 *
 *  - hintsOptIn === false → renders children only, nothing else, ever.
 *  - hintsOptIn === true  → hover/tap shows `elementExplain` then `modeExplain`.
 *  - hintsOptIn === null (undecided) → only the designated `isEntryPoint`
 *    hotspot (one per site, the landing pill) reacts at all; hovering/tapping
 *    it shows the opt-in invite instead of the real content. Every other
 *    hotspot stays fully inert until the visitor opts in.
 *
 * `elementExplain` / `modeExplain` may be strings or functions of nothing
 * (call site closes over current mode) — kept as plain strings/nodes here,
 * the caller re-renders this component when its own state (e.g. active mode)
 * changes.
 */
export default function HoverHint({
  children,
  elementExplain,
  modeExplain,
  isEntryPoint = false,
  color = '#22D3EE',
}) {
  const { hintsOptIn, setHintsOptIn } = useTutorials();
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef(null);

  const open = hovering || pinned;

  // Tap/click outside or Escape closes an open popover. pointerdown, not
  // mousedown: touch browsers don't reliably synthesize mousedown for a tap.
  useEffect(() => {
    if (!open) return;
    const close = () => { setPinned(false); setHovering(false); };
    const onPointer = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (hintsOptIn === false) return children;
  // Not the entry point and the visitor hasn't opted in yet — stay fully inert.
  if (hintsOptIn !== true && !isEntryPoint) return children;

  const showingInvite = hintsOptIn !== true; // undecided + this IS the entry point

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => setPinned((p) => !p)}
    >
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 top-full mt-3 left-1/2 -translate-x-1/2 w-64 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0d1a] to-[#111827] p-4 shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {showingInvite ? (
              <>
                <p className="text-sm text-white font-semibold mb-1">Want quick tips like this?</p>
                <p className="text-xs text-white/50 mb-3 leading-relaxed">
                  Hover (or tap) anything highlighted, site-wide, for a quick explanation. You can turn this off any time.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setHintsOptIn(true); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: color }}
                  >
                    Yes, show me
                  </button>
                  <button
                    onClick={() => { setHintsOptIn(false); setPinned(false); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </>
            ) : (
              <>
                {elementExplain && (
                  <p className="text-xs text-white/70 leading-relaxed">{elementExplain}</p>
                )}
                {modeExplain && (
                  <p className="text-xs mt-2 pt-2 border-t border-white/10 leading-relaxed" style={{ color }}>
                    {modeExplain}
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
