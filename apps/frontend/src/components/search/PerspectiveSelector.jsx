import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';
import { PERSPECTIVES, PERSPECTIVE_CATEGORIES, perspectiveById } from '../../config/perspectives';

// Two accents, because this now serves two homes: the Perspectives page it was
// built for (purple) and the Rabbit Hole fold that took over its job (red).
// Same control, same ids, same behaviour — only the colour follows the page.
const ACCENTS = {
  purple: {
    shell: 'border-purple-500/50 shadow-purple-500/20',
    icon: 'bg-purple-500/20 text-purple-400',
    sub: 'text-purple-300/60',
    chev: 'text-purple-400',
    tabOn: 'bg-purple-500/30 text-purple-300 border border-purple-500/50',
    chipOn: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400',
    chipOff: 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-2 border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-500/50',
    rule: 'border-purple-500/30',
    tag: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  },
  red: {
    shell: 'border-red-500/50 shadow-red-500/20',
    icon: 'bg-red-500/20 text-red-400',
    sub: 'text-red-300/60',
    chev: 'text-red-400',
    tabOn: 'bg-red-500/30 text-red-300 border border-red-500/50',
    chipOn: 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-500/50 border-2 border-red-400',
    chipOff: 'bg-gradient-to-r from-red-600/20 to-orange-600/20 border-2 border-red-500/30 text-red-300 hover:from-red-600/30 hover:to-orange-600/30 hover:border-red-500/50',
    rule: 'border-red-500/30',
    tag: 'bg-red-500/20 text-red-300 border border-red-500/30',
  },
};

const PerspectiveSelector = ({
  selectedPerspectives = [],
  onTogglePerspective,
  show = true,
  activeCategoryIndex = 0,
  onCategoryChange = () => {},
  accent = 'purple',
  // Optional per-perspective match counts from the results currently on
  // screen. When supplied, a chip showing 0 is telling the user something
  // useful before they press it: this angle isn't in these results, so picking
  // it will need a fresh search rather than a reread.
  counts = null,
  heading = 'Perspective Selection',
  subheading = null,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const c = ACCENTS[accent] || ACCENTS.purple;

  const activeCategory = PERSPECTIVE_CATEGORIES[activeCategoryIndex]?.id || 'all';
  const perspectives = PERSPECTIVES.filter((p) => p.categories.includes(activeCategory));

  const handlePerspectiveToggle = (perspectiveId) => {
    if (onTogglePerspective) onTogglePerspective(perspectiveId);
  };

  const selectedCount = selectedPerspectives.filter((id) => id !== 'neutral').length;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            'rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 shadow-lg overflow-hidden',
            c.shell,
          )}
        >
          {/* Header — always visible, click to minimize/expand */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', c.icon)}>
                <Sparkles size={16} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white">{heading}</h3>
                <p className={cn('text-xs', c.sub)}>
                  {selectedCount > 0
                    ? `${selectedCount + (selectedPerspectives.includes('neutral') ? 1 : 0)} selected`
                    : subheading || 'Select perspectives to analyze'}
                </p>
              </div>
            </div>
            <motion.div animate={{ rotate: isMinimized ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} className={c.chev} />
            </motion.div>
          </button>

          {/* Collapsible body */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  {/* Category Tabs */}
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {PERSPECTIVE_CATEGORIES.map((category, index) => (
                      <button
                        key={category.id}
                        onClick={() => onCategoryChange(index)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                          activeCategoryIndex === index ? c.tabOn : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50',
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  {/* Perspective Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {perspectives.map((perspective) => {
                      const n = counts ? counts[perspective.id] ?? 0 : null;
                      const empty = counts && perspective.id !== 'neutral' && n === 0;
                      return (
                        <button
                          key={perspective.id}
                          onClick={() => handlePerspectiveToggle(perspective.id)}
                          title={empty ? 'Not present in these results — picking this will need a fresh search' : undefined}
                          className={cn(
                            'px-3 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 justify-center',
                            selectedPerspectives.includes(perspective.id) ? c.chipOn : c.chipOff,
                            empty && !selectedPerspectives.includes(perspective.id) && 'opacity-45',
                          )}
                        >
                          <span>{perspective.emoji}</span>
                          <span className="truncate">{perspective.label}</span>
                          {n !== null && perspective.id !== 'neutral' && (
                            <span className="shrink-0 tabular-nums opacity-70">{n}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Perspectives Chips */}
                  {selectedPerspectives.length > 0 && (
                    <div className={cn('mt-3 pt-3 border-t', c.rule)}>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPerspectives.map((perspectiveId) => (
                          <span
                            key={perspectiveId}
                            className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', c.tag)}
                          >
                            {perspectiveById(perspectiveId)?.label || perspectiveId}
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePerspectiveToggle(perspectiveId); }}
                              className="ml-0.5 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PerspectiveSelector;
