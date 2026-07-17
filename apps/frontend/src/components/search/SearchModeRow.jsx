import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS, solidTextClass } from '../../config/modeTheme';

// Search-page mode-pill row (docs/UI-REDESIGN-SPEC.md, "Search page": Filters /
// pill modes / safe search). Single-select: the currently-active mode shows a
// solid fill in its color; clicking any other pill navigates straight to that
// colored /search page. Replaces the legacy 3-way pill toggle that lived inside
// the search bar and only covered blue/red/green.
const SEARCH_MODES = ['blue', 'green', 'red', 'purple', 'ocean'];

export default function SearchModeRow({ activeMode, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto px-4 mb-3"
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pb-1">
        {SEARCH_MODES.map((id) => {
          const active = activeMode === id;
          const color = MODE_COLORS[id];
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => { if (!active) onSelect(id); }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-pressed={active}
              title={MODE_LABELS[id]}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                active ? solidTextClass(id) : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
              style={active ? { backgroundColor: color, borderColor: color } : undefined}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: active ? 'currentColor' : color }}
              />
              {MODE_LABELS[id]}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
