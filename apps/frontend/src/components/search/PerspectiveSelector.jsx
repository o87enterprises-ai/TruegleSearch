import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '../../utils/cn';

const PerspectiveSelector = ({
  selectedPerspectives = [],
  onTogglePerspective,
  show = true,
  onClose = () => {},
  activeCategoryIndex = 0,
  onCategoryChange = () => {}
}) => {
  // Define perspectives with their categories - MATCHES BiasedResults.jsx
  const allPerspectives = [
    // Neutral
    { id: 'neutral', label: 'Neutral', emoji: '⚪', categories: ['all', 'neutral'] },

    // Political perspectives
    { id: 'conservative', label: 'Conservative', emoji: '🔴', categories: ['all', 'political'] },
    { id: 'liberal', label: 'Liberal', emoji: '🔵', categories: ['all', 'political'] },
    { id: 'bipartisan', label: 'Bipartisan', emoji: '🤝', categories: ['all', 'political'] },
    { id: 'libertarian', label: 'Libertarian', emoji: '🗽', categories: ['all', 'political'] },
    { id: 'progressive', label: 'Progressive', emoji: '⚡', categories: ['all', 'political'] },
    { id: 'centrist', label: 'Centrist', emoji: '⚖️', categories: ['all', 'political'] },

    // Faith perspectives
    { id: 'religious', label: 'Religious', emoji: '✝️', categories: ['all', 'faith'] },
    { id: 'atheist', label: 'Atheist', emoji: '⚛️', categories: ['all', 'faith'] },
    { id: 'new_world', label: 'New World / Illumination', emoji: '🔺', categories: ['all', 'faith'] },
    { id: 'old_world', label: 'Old World / Pagan', emoji: '🌙', categories: ['all', 'faith'] },
    { id: 'spiritual', label: 'Spiritual', emoji: '🕉️', categories: ['all', 'faith'] },
    { id: 'secular', label: 'Secular', emoji: '🔬', categories: ['all', 'faith'] },
    { id: 'universal', label: 'Universal', emoji: '🌍', categories: ['all', 'faith'] },

    // Societal perspectives
    { id: 'mainstream', label: 'Mainstream', emoji: '📰', categories: ['all', 'societal'] },
    { id: 'alternative', label: 'Alternative', emoji: '🔍', categories: ['all', 'societal'] },
    { id: 'conspiracy', label: 'Conspiracy', emoji: '👁️', categories: ['all', 'societal'] },
    { id: 'skeptical', label: 'Skeptical', emoji: '🤔', categories: ['all', 'societal'] },
    { id: 'traditional', label: 'Traditional', emoji: '📜', categories: ['all', 'societal'] },
    { id: 'scientific', label: 'Scientific / Academic', emoji: '🎓', categories: ['all', 'societal'] },
    { id: 'government', label: 'Government', emoji: '🏛️', categories: ['all', 'societal'] },
    { id: 'community', label: 'Community', emoji: '👥', categories: ['all', 'societal'] },

    // Economic perspectives
    { id: 'local_economy', label: 'Local Economy', emoji: '💰', categories: ['all', 'economic'] },
    { id: 'global_economics', label: 'Global Economics', emoji: '🌐', categories: ['all', 'economic'] },
    { id: 'investors', label: 'Investors', emoji: '📈', categories: ['all', 'economic'] },
    { id: 'consumers', label: 'Consumers', emoji: '🛒', categories: ['all', 'economic'] },
    { id: 'small_business', label: 'Small Business', emoji: '🏪', categories: ['all', 'economic'] },
    { id: 'corporate', label: 'Corporate', emoji: '🏢', categories: ['all', 'economic'] },
  ];

  const categories = [
    { id: 'all', label: 'All Perspectives' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'political', label: 'Political' },
    { id: 'faith', label: 'Faith' },
    { id: 'societal', label: 'Societal' },
    { id: 'economic', label: 'Economic' },
  ];

  const [isMinimized, setIsMinimized] = useState(false);

  // Filter perspectives based on active category
  const activeCategory = categories[activeCategoryIndex]?.id || 'all';
  const perspectives = allPerspectives.filter(p =>
    p.categories.includes(activeCategory)
  );

  const handlePerspectiveToggle = (perspectiveId) => {
    if (onTogglePerspective) {
      onTogglePerspective(perspectiveId);
    }
  };

  const selectedCount = selectedPerspectives.filter(id => id !== 'neutral').length;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-purple-500/50 shadow-lg shadow-purple-500/20 overflow-hidden"
        >
          {/* Header — always visible, click to minimize/expand */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Sparkles size={16} className="text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white">Perspective Selection</h3>
                <p className="text-xs text-purple-300/60">
                  {selectedCount > 0
                    ? `${selectedCount + (selectedPerspectives.includes('neutral') ? 1 : 0)} selected`
                    : 'Select perspectives to analyze'}
                </p>
              </div>
            </div>
            <motion.div animate={{ rotate: isMinimized ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} className="text-purple-400" />
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
                    {categories.map((category, index) => (
                      <button
                        key={category.id}
                        onClick={() => onCategoryChange(index)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                          activeCategoryIndex === index
                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  {/* Perspective Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {perspectives.map((perspective) => (
                      <button
                        key={perspective.id}
                        onClick={() => handlePerspectiveToggle(perspective.id)}
                        className={cn(
                          'px-3 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 justify-center',
                          selectedPerspectives.includes(perspective.id)
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 border-2 border-purple-400'
                            : 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-2 border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-500/50'
                        )}
                      >
                        <span>{perspective.emoji}</span>
                        <span className="truncate">{perspective.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Selected Perspectives Chips */}
                  {selectedPerspectives.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-500/30">
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPerspectives.map((perspectiveId) => {
                          const perspective = allPerspectives.find(p => p.id === perspectiveId);
                          return (
                            <span
                              key={perspectiveId}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            >
                              {perspective?.label}
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePerspectiveToggle(perspectiveId); }}
                                className="ml-0.5 hover:text-white"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
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