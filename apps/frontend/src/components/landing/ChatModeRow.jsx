import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { MODE_COLORS, MODE_LABELS, solidTextClass } from '../../config/modeTheme';

// Chat Mode row — lives directly below the landing search bar (spec #4).
// This is the CHAT lens selector: multi-select — tap to toggle each one
// on/off, exactly like TruegleChat.jsx's own mode pills. Never navigates;
// it only stages what /chat opens with. No orange/yellow here — Rewards and
// Transcripts have no "chat about it" equivalent (Pill Mode row handles
// those as page jumps instead).
//
// Collapsible (default collapsed, like the AI-summary card): keeps the
// landing hero from showing every option at once. The caller drives `open`
// (e.g. auto-expand it the moment the user starts typing without having
// picked a lens yet) — this component just renders the toggle + the row.
const PILLS = ['blue', 'green', 'red', 'purple', 'ocean'];

export default function ChatModeRow({ activeModes, onToggle, open, onToggleOpen }) {
  const summary = activeModes.length === 1 ? MODE_LABELS[activeModes[0]] : `${activeModes.length} lenses`;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-3">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="mx-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
      >
        Chat modes <span className="text-white/25">·</span> {summary}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-flex">
          <ChevronDown size={12} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pt-2 pb-1">
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
        )}
      </AnimatePresence>
    </div>
  );
}
