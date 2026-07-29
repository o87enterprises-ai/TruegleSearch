import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { searchCategories } from '../ui/SearchBar';

// Search-category row — the counterpart to ChatModeRow. It takes ChatModeRow's
// exact place below the landing/chat search bar the moment the Pill Mode
// switches from Chat (black) to a search color: the chat lenses are replaced by
// the search result categories (All / Pics / Vids / News / …). Single-select,
// horizontally scrollable, and collapsible in the same minimized-by-default way
// as the chat modes. Never navigates — it only stages which category the next
// /search opens with (the caller puts it on the URL as &category=).
export default function CategoryModeRow({ activeCategory = 'all', onSelect, open, onToggleOpen, accentColor }) {
  const activeLabel = searchCategories.find((c) => c.id === activeCategory)?.label || 'All';
  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-3">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        title={`Category: ${activeLabel}`}
        className="mx-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
      >
        Search categories
        {activeCategory !== 'all' && (
          <span className="text-white/60">· {activeLabel}</span>
        )}
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
              {searchCategories.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelect(cat.id)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={active}
                    title={cat.label}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                      active
                        ? 'text-white border-transparent'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
                    }`}
                    style={active ? { backgroundColor: accentColor || '#3b82f6', borderColor: accentColor || '#3b82f6' } : undefined}
                  >
                    <Icon size={12} />
                    {cat.label}
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
