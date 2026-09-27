import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// The shared shape behind CategoryModeRow: a collapsible, horizontally
// scrollable, single-select chip row that sits under the landing/chat search
// bar. Three more pill modes needed the exact same picker — Tube's search
// scope, Intel's OSINT tool, Feed's browse category — so it moved here rather
// than being copied three more times. CategoryModeRow itself is untouched
// (it has its own icon-required shape from SearchBar's category list); this
// is what the newer three are built on.
export default function PickerModeRow({ items, activeId = '', onSelect, open, onToggleOpen, accentColor, prefixLabel }) {
  const active = items.find((it) => it.id === activeId);
  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-3">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        title={active ? `${prefixLabel}: ${active.label}` : prefixLabel}
        className="mx-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
      >
        {prefixLabel}
        {active && <span className="text-white/60">· {active.label}</span>}
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
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 pb-1">
              {items.map((it) => {
                const Icon = it.icon;
                const isActive = activeId === it.id;
                return (
                  <motion.button
                    key={it.id}
                    type="button"
                    onClick={() => onSelect(it.id)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={isActive}
                    title={it.label}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                      isActive
                        ? 'text-white border-transparent'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                    }`}
                    style={isActive ? { backgroundColor: accentColor || '#3b82f6', borderColor: accentColor || '#3b82f6' } : undefined}
                  >
                    {Icon && <Icon size={12} />}
                    {it.label}
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
