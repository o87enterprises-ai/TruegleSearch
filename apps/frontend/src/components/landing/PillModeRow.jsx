import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS, solidTextClass } from '../../config/modeTheme';

// Pill Mode — lives ABOVE the search bar (spec #2). This is the SEARCH mode
// selector: a single pill, not a row. Clicking it cycles to the next mode
// (never navigates by itself — navigation happens when the query is actually
// submitted, via the search bar's Enter/play button). Black = Chat, the
// default state. A small non-clickable "Chat"/"Search" label sits directly
// above it as a passive status indicator.
const CYCLE = ['black', 'blue', 'green', 'red', 'purple', 'ocean', 'orange', 'yellow'];

export default function PillModeRow({ activeMode, onSelect }) {
  const cycle = () => {
    const idx = CYCLE.indexOf(activeMode);
    onSelect(CYCLE[(idx + 1) % CYCLE.length]);
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
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        title="Click to switch mode"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${solidTextClass(activeMode)}`}
        style={{ backgroundColor: color, borderColor: color }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-current" />
        {label}
      </motion.button>
    </div>
  );
}
