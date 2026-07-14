import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS } from '../../config/modeTheme';

// Chat mode selection row — lives directly below the landing search bar
// (spec: docs/UI-REDESIGN-SPEC.md, "Landing page" #4). Black = chat default
// (query + Enter with no other pill selected silently answers via /chat);
// Blue/Green/Red stage a search-page mode for the next Enter press; Purple/
// Ocean/Orange/Yellow jump straight to their page (they aren't "type then
// search" flows the way the first four are).
const PILLS = ['black', 'blue', 'green', 'red', 'purple', 'ocean', 'orange', 'yellow'];

export default function ChatModeRow({ activeMode, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="w-full max-w-2xl mx-auto px-4 mt-3"
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
              title={MODE_LABELS[id]}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                active ? 'text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
              style={active ? { backgroundColor: `${color}26`, borderColor: `${color}80` } : undefined}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {MODE_LABELS[id]}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
