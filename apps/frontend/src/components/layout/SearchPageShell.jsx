import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TruegleLogo from '../ui/TruegleLogo';
import SmartPill from '../landing/SmartPill';
import ErrorBoundary from '../ui/ErrorBoundary';
import { LITE_BG, MODE_COLORS } from '../../config/modeTheme';

// '#eab308' -> '234, 179, 8', for the glow below. Every mode's own accent,
// not a fixed purple — the glow was hardcoded to violet regardless of which
// page it was on, so Feed (yellow) and every other non-purple mode got a
// cursor trail in a colour that wasn't theirs.
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '139, 92, 246';
};
import useDeviceTier from '../../hooks/useDeviceTier';
// Named export, and a .tsx file — same import UniversalSearch uses.
import { DeepSpaceBackground } from '../backgrounds/DeepSpaceBackground';

// The Truegle page shell: background, logo, pill row, search bar, content.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// This layout was copy-pasted into six files. Five of them are now dead —
// SearchResults, BiasedResults, SearchPortal and two debug forks all sit
// behind <Navigate> and nothing renders them — and they are dead precisely
// BECAUSE they were copies: each drifted from the live page until it was
// easier to redirect than to reconcile. UniversalSearch is the only survivor.
//
// So the Feed page does not get a seventh copy. It gets this, and a geometry
// test that fails if /feed and /search ever stop producing the same boxes.
//
// UniversalSearch is deliberately NOT refactored onto this yet: it is 2300
// lines and the live search page is not the place to prove a new abstraction.
// The parity test pins the contract in the meantime, which makes that refactor
// a safe follow-up rather than a leap.
//
// ── THE CONTRACT ────────────────────────────────────────────────────────────
//
//   relative min-h-screen w-full bg-black overflow-y-auto
//     fixed inset-0 z-0                       background
//     pointer-events-none fixed inset-0 z-30  cursor glow
//     relative z-10 min-h-screen p-4 md:p-8
//       max-w-7xl mx-auto
//         vp-header-gap flex justify-center mb-12   logo, scaled 1.5–1.8×
//         relative z-20 mb-2                        pill row
//         max-w-4xl mx-auto mb-6                    search bar
//         children                                  everything else
//
// The scaled logo visually overflows its box, which is why the pill row is
// `relative z-20` — without it the overflow eats the clicks.

export default function SearchPageShell({
  mode = 'blue',
  pillMode,
  onPillSelect,
  // What this page already is, and what is typed — for SmartPill's
  // countdown and typing detection.
  pageMode = 'yellow',
  query = '',
  searchBar,
  children,
  logoVariant,
}) {
  const navigate = useNavigate();
  const cursorGlowRef = useRef(null);
  // The same gate the search page uses: a low-end device or reduced-motion
  // preference gets a flat gradient instead of a WebGL particle field.
  const { allowHeavyAnimations } = useDeviceTier();
  const glowRgb = hexToRgb(MODE_COLORS[mode] || MODE_COLORS.blue);

  // Driven imperatively so a mouse move never triggers a React re-render, and
  // with no CSS transition — a transition fights the per-frame writes and
  // trails visibly behind the pointer.
  useEffect(() => {
    if (!allowHeavyAnimations) return undefined;
    let rafId = null;
    let pending = null;
    const apply = () => {
      rafId = null;
      if (cursorGlowRef.current && pending) {
        cursorGlowRef.current.style.background = `radial-gradient(600px circle at ${pending.x}px ${pending.y}px, rgba(${glowRgb}, 0.15), transparent 40%)`;
      }
    };
    const onMove = (e) => {
      pending = { x: e.clientX, y: e.clientY };
      if (rafId == null) rafId = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [allowHeavyAnimations, glowRgb]);

  return (
    <div className="relative min-h-screen w-full bg-black overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full"
          >
            {/* Reduced motion, or a device that cannot afford WebGL, gets a
                flat gradient rather than a particle field. */}
            {!allowHeavyAnimations ? (
              <div className={`fixed inset-0 ${LITE_BG[mode] || LITE_BG.blue}`} />
            ) : (
              <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
                <DeepSpaceBackground />
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div ref={cursorGlowRef} className="pointer-events-none fixed inset-0 z-30" />

      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="vp-header-gap flex justify-center mb-12"
          >
            <TruegleLogo
              variant={logoVariant || 'default'}
              className="vp-logo scale-[1.5] sm:scale-[1.8]"
              onClick={() => navigate('/')}
            />
          </motion.div>

          {onPillSelect && (
            <div className="relative z-20 mb-2">
              <SmartPill activeMode={pillMode} onSelect={onPillSelect} pageMode={pageMode} query={query} />
            </div>
          )}

          {searchBar && <div className="max-w-4xl mx-auto mb-6">{searchBar}</div>}

          {children}
        </div>
      </div>
    </div>
  );
}
