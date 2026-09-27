import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_GRADIENT, searchModeLabel, solidTextClass } from '../../config/modeTheme';

// Pill Mode — lives ABOVE the search bar (spec #2). This is the SEARCH mode
// selector: a single pill, not a row. Clicking it cycles to the next mode
// (never navigates by itself — navigation happens when the query is actually
// submitted, via the search bar's Enter/play button). Black = Chat, the
// default state. A small non-clickable "Chat"/"Search" label sits directly
// above it as a passive status indicator.
// 'orange' (Rewards) removed 2026-07-24 — ad-pay/rewards program paused.
// 'purple' (Perspectives) removed 2026-08-08 — folded into the Rabbit Hole as
// the re-ask fold, so it is a control on Red rather than a mode of its own.
// ?mode=purple still resolves (see FOLDED_MODES in UniversalSearch).
const CYCLE = ['black', 'tube', 'blue', 'green', 'red', 'ocean', 'yellow'];

// The passive status word above the pill — what KIND of thing this mode does,
// not which mode it is (the pill itself already says that in its own label).
// blue/green/red are all "Search" because they are three takes on the same
// verb; ocean and yellow are different verbs entirely.
const ACTIVITY_LABEL = {
  black: 'Chat',
  tube: 'Play',
  blue: 'Search',
  green: 'Search',
  red: 'Search',
  ocean: 'Investigate',
  yellow: 'Social',
};
const HOLD_MS = 2200; // press-and-hold this long (mobile long-press or desktop click-hold) to jump straight back to Chat

export default function PillModeRow({ activeMode, onSelect, onHold }) {
  const [holding, setHolding] = useState(false);
  const holdTimerRef = useRef(null);
  const firedRef = useRef(false); // true once the hold completes, so the trailing click doesn't also cycle

  const cycle = () => {
    if (firedRef.current) { firedRef.current = false; return; } // long-press already handled the switch
    const idx = CYCLE.indexOf(activeMode);
    onSelect(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const startHold = () => {
    if (activeMode === 'black') return; // already on Chat, nothing to reset
    setHolding(true);
    holdTimerRef.current = setTimeout(() => {
      firedRef.current = true;
      setHolding(false);
      // quick jump straight back to Chat, skipping the full cycle. `onHold`
      // lets a page treat it as "go now" rather than a staged pick.
      if (onHold) onHold(); else onSelect('black');
    }, HOLD_MS);
  };
  const cancelHold = () => {
    clearTimeout(holdTimerRef.current);
    setHolding(false);
  };

  const color = MODE_COLORS[activeMode];
  // A mode may ask for a metallic finish instead of a flat fill (steel).
  const gradient = MODE_GRADIENT[activeMode];
  // searchModeLabel, not MODE_LABELS: this pill drives SEARCH, where green
  // generates nothing, so the shared chat label "Summarize" is wrong here.
  const label = activeMode === 'black' ? 'Chat' : searchModeLabel(activeMode);
  const activity = ACTIVITY_LABEL[activeMode] || 'Search';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold select-none">
        {activity}
      </span>
      <motion.button
        type="button"
        onClick={cycle}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => activeMode !== 'black' && e.preventDefault()} // long-press shouldn't open a context menu
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        title={activeMode === 'black' ? 'Click to switch mode' : 'Click to switch mode — hold to jump back to Chat'}
        className={`relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 select-none ${solidTextClass(activeMode)}`}
        style={{
          // touch-action:none is what makes the 2.2s hold actually reachable on
          // a phone. Without it the platform claims the gesture first — Android
          // begins a text selection at ~500ms and iOS pops the callout, both far
          // under HOLD_MS — so the hold was being cancelled by the browser
          // before it could fire, and the user got a highlighted label instead
          // of a jump to Chat. Panning from a pill this small is not a gesture
          // anyone wants, so there is nothing to trade away here.
          touchAction: 'none',
          background: gradient || color,
          borderColor: gradient ? 'rgba(255,255,255,0.45)' : color,
          boxShadow: gradient ? 'inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -1px 0 rgba(0,0,0,0.25)' : undefined,
        }}
      >
        {/* Specular highlight across the top half — what turns a grey fill
            into something that reads as polished metal. */}
        {gradient && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-full"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
        )}
        {/* Hold-progress fill — sweeps left→right over HOLD_MS; resets instantly if released early */}
        {holding && (
          <motion.span
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
            className="absolute inset-y-0 left-0 bg-black/25 pointer-events-none"
          />
        )}
        <span className="relative w-2 h-2 rounded-full flex-shrink-0 bg-current" />
        <span className="relative">{label}</span>
      </motion.button>
    </div>
  );
}
