import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS } from '../../config/modeTheme';

// Pill Mode row — lives ABOVE the search bar (spec #2). This is the SEARCH
// mode selector: single-select, one active at a time. Black = Chat (the
// default state, no navigation). Every other color navigates immediately to
// its page when clicked: blue/green/red/purple/ocean -> /search?mode=X,
// orange -> /rewards, yellow -> /extract. Distinct from the Chat Mode row
// below the search bar, which is multi-select and never navigates.
const PILLS = ['black', 'blue', 'green', 'red', 'purple', 'ocean', 'orange', 'yellow'];

export default function PillModeRow({ activeMode, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto px-4"
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pb-1">
        {PILLS.map((id) => {
          const active = activeMode === id;
          const color = MODE_COLORS[id];
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-pressed={active}
              title={id === 'black' ? 'Chat' : MODE_LABELS[id]}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                active ? 'text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
              style={active ? { backgroundColor: `${color}26`, borderColor: `${color}80` } : undefined}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {id === 'black' ? 'Chat' : MODE_LABELS[id]}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
