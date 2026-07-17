import { motion } from 'framer-motion';

// vs. TrueGLE (Null-Prime dual-audit / "Grand Logic Equation") toggle. Uses the
// same localStorage key as TruegleChat.jsx ('truegle_nephesh_mode') so a
// preference set here carries silently into the first /chat visit — no query
// params needed. (The old "Feeling chat-e?" verbosity toggle was removed:
// chat answers are now verbose by default, and the "Summarize" mode makes them
// concise, so a separate verbosity switch is no longer needed.)
export default function VsToggleRow({ nepheshMode, onToggleNephesh }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex items-center justify-center gap-2 mt-3 flex-wrap"
    >
      <button
        type="button"
        onClick={onToggleNephesh}
        title="vs. TrueGLE: layer the Null-Prime dual-audit / Grand Logic Equation onto contested claims"
        aria-pressed={nepheshMode}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          nepheshMode ? 'bg-white border-white text-neutral-900' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${nepheshMode ? 'bg-neutral-900' : 'bg-white/20'}`} />
        vs. TrueGLE
      </button>
    </motion.div>
  );
}
