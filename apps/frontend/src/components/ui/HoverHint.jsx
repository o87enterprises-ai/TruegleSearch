import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
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
  const close = () => { setPinned(false); setHovering(false); };

  // Tap/click outside or Escape closes an open popover. pointerdown, not
  // mousedown: touch browsers don't reliably synthesize mousedown for a tap.
  useEffect(() => {
    if (!open) return;
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

      {/* Enters with a fade, leaves INSTANTLY. There used to be an exit
          animation, but a pill click re-themes the whole hero, and that frame
          load starved it: the card sat on screen ~2s after a tap outside had
          already closed it, which on a phone reads as "tap-outside is broken". */}
      {/* Centring lives on a plain wrapper: framer-motion writes its own
          `transform` for scale/y, which silently overrode -translate-x-1/2 and
          hung the card off the pill's centre — off-screen on a phone. */}
      {open && (
        <div className="absolute z-20 top-full mt-3 left-1/2 -translate-x-1/2 w-64 max-w-[calc(100vw-2rem)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d0d1a] to-[#111827] p-4 shadow-2xl text-left pr-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close tip"
              className="absolute top-2 right-2 p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
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
        </div>
      )}
    </div>
  );
}
