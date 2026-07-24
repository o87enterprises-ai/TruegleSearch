import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS, solidTextClass } from '../../config/modeTheme';

// Pill Mode — lives ABOVE the search bar (spec #2). This is the SEARCH mode
// selector: a single pill, not a row. Clicking it cycles to the next mode
// (never navigates by itself — navigation happens when the query is actually
// submitted, via the search bar's Enter/play button). Black = Chat, the
// default state. A small non-clickable "Chat"/"Search" label sits directly
// above it as a passive status indicator.
// 'orange' (Rewards) removed 2026-07-24 — ad-pay/rewards program paused.
const CYCLE = ['black', 'blue', 'green', 'red', 'purple', 'ocean', 'yellow'];
const HOLD_MS = 2200; // press-and-hold this long (mobile long-press or desktop click-hold) to jump straight back to Chat

export default function PillModeRow({ activeMode, onSelect }) {
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
      onSelect('black'); // quick jump straight back to Chat, skipping the full cycle
    }, HOLD_MS);
  };
  const cancelHold = () => {
    clearTimeout(holdTimerRef.current);
    setHolding(false);
  };

  const color = MODE_COLORS[activeMode];
  const label = activeMode === 'black' ? 'Chat' : MODE_LABELS[activeMode];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold select-none">
        {activeMode === 'black' ? 'Chat' : 'Search'}
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
        className={`relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${solidTextClass(activeMode)}`}
        style={{ backgroundColor: color, borderColor: color }}
      >
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
