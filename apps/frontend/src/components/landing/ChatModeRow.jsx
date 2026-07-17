import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_LABELS, solidTextClass } from '../../config/modeTheme';

// Chat Mode row — lives directly below the landing search bar (spec #4).
// This is the CHAT lens selector: multi-select — tap to toggle each one
// on/off, exactly like TruegleChat.jsx's own mode pills. Never navigates;
// it only stages what /chat opens with. No orange/yellow here — Rewards and
// Transcripts have no "chat about it" equivalent (Pill Mode row handles
// those as page jumps instead).
const PILLS = ['blue', 'green', 'red', 'purple', 'ocean'];

export default function ChatModeRow({ activeModes, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="w-full max-w-2xl mx-auto px-4 mt-3"
    >
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pb-1">
        {PILLS.map((id) => {
          const active = activeModes.includes(id);
          const color = MODE_COLORS[id];
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              aria-pressed={active}
              title={active ? `${MODE_LABELS[id]} active — tap to remove` : `Add ${MODE_LABELS[id]} lens`}
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
