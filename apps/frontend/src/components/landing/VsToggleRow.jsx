import { motion } from 'framer-motion';

// vs.TrueGLE (Null-Prime dual-audit / "Grand Logic Equation") + Verbose toggles.
// Same localStorage keys as TruegleChat.jsx ('truegle_nephesh_mode' /
// 'truegle_verbose_mode') so a preference set here carries silently into the
// first /chat visit — no query params needed, just shared storage.
export default function VsToggleRow({ nepheshMode, onToggleNephesh, verboseMode, onToggleVerbose }) {
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
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          nepheshMode ? 'bg-white/20 border-white/40 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${nepheshMode ? 'bg-white' : 'bg-white/20'}`} />
        vs. TrueGLE
      </button>
      <button
        type="button"
        onClick={onToggleVerbose}
        title="Feeling chat-e? In-depth responses instead of the default succinct answers"
        aria-pressed={verboseMode}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          verboseMode ? 'bg-neutral-100 border-neutral-200 text-neutral-900' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${verboseMode ? 'bg-neutral-900' : 'bg-white/20'}`} />
        Feeling chat-e?
      </button>
    </motion.div>
  );
}
