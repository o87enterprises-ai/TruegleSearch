import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const PerspectiveCard = ({
  perspective,
  isActive = false,
  onClick,
  resultCount = 0,
  className = '',
}) => {
  // CORRECT perspectives matching BiasedResults.jsx
  const perspectiveConfig = {
    // Neutral
    neutral: {
      label: 'Neutral',
      emoji: '⚪',
      borderColor: 'border-gray-500',
      shadowColor: 'shadow-gray-500/70',
      shadowColorDim: 'shadow-gray-500/30',
      bgGradient: 'from-gray-600 to-gray-500',
    },

    // Political
    conservative: {
      label: 'Conservative',
      emoji: '🔴',
      borderColor: 'border-red-500',
      shadowColor: 'shadow-red-500/70',
      shadowColorDim: 'shadow-red-500/30',
      bgGradient: 'from-red-600 to-red-500',
    },
    liberal: {
      label: 'Liberal',
      emoji: '🔵',
      borderColor: 'border-blue-500',
      shadowColor: 'shadow-blue-500/70',
      shadowColorDim: 'shadow-blue-500/30',
      bgGradient: 'from-blue-600 to-blue-500',
    },
    bipartisan: {
      label: 'Bipartisan',
      emoji: '🤝',
      borderColor: 'border-purple-500',
      shadowColor: 'shadow-purple-500/70',
      shadowColorDim: 'shadow-purple-500/30',
      bgGradient: 'from-purple-600 to-purple-500',
    },
    libertarian: {
      label: 'Libertarian',
      emoji: '🗽',
      borderColor: 'border-yellow-500',
      shadowColor: 'shadow-yellow-500/70',
      shadowColorDim: 'shadow-yellow-500/30',
      bgGradient: 'from-yellow-600 to-yellow-500',
    },
    progressive: {
      label: 'Progressive',
      emoji: '⚡',
      borderColor: 'border-cyan-500',
      shadowColor: 'shadow-cyan-500/70',
      shadowColorDim: 'shadow-cyan-500/30',
      bgGradient: 'from-cyan-600 to-cyan-500',
    },
    centrist: {
      label: 'Centrist',
      emoji: '⚖️',
      borderColor: 'border-green-500',
      shadowColor: 'shadow-green-500/70',
      shadowColorDim: 'shadow-green-500/30',
      bgGradient: 'from-green-600 to-green-500',
    },

    // Faith
    religious: {
      label: 'Religious',
      emoji: '✝️',
      borderColor: 'border-amber-500',
      shadowColor: 'shadow-amber-500/70',
      shadowColorDim: 'shadow-amber-500/30',
      bgGradient: 'from-amber-600 to-amber-500',
    },
    atheist: {
      label: 'Atheist',
      emoji: '⚛️',
      borderColor: 'border-slate-500',
      shadowColor: 'shadow-slate-500/70',
      shadowColorDim: 'shadow-slate-500/30',
      bgGradient: 'from-slate-600 to-slate-500',
    },
    new_world: {
      label: 'New World / Illumination',
      emoji: '🔺',
      borderColor: 'border-yellow-500',
      shadowColor: 'shadow-yellow-500/70',
      shadowColorDim: 'shadow-yellow-500/30',
      bgGradient: 'from-yellow-600 to-orange-500',
    },
    old_world: {
      label: 'Old World / Pagan',
      emoji: '🌙',
      borderColor: 'border-indigo-500',
      shadowColor: 'shadow-indigo-500/70',
      shadowColorDim: 'shadow-indigo-500/30',
      bgGradient: 'from-indigo-600 to-indigo-500',
    },
    spiritual: {
      label: 'Spiritual',
      emoji: '🕉️',
      borderColor: 'border-violet-500',
      shadowColor: 'shadow-violet-500/70',
      shadowColorDim: 'shadow-violet-500/30',
      bgGradient: 'from-violet-600 to-violet-500',
    },
    secular: {
      label: 'Secular',
      emoji: '🔬',
      borderColor: 'border-teal-500',
      shadowColor: 'shadow-teal-500/70',
      shadowColorDim: 'shadow-teal-500/30',
      bgGradient: 'from-teal-600 to-teal-500',
    },
    universal: {
      label: 'Universal',
      emoji: '🌍',
      borderColor: 'border-emerald-500',
      shadowColor: 'shadow-emerald-500/70',
      shadowColorDim: 'shadow-emerald-500/30',
      bgGradient: 'from-emerald-600 to-emerald-500',
    },

    // Societal
    mainstream: {
      label: 'Mainstream',
      emoji: '📰',
      borderColor: 'border-blue-500',
      shadowColor: 'shadow-blue-500/70',
      shadowColorDim: 'shadow-blue-500/30',
      bgGradient: 'from-blue-600 to-blue-500',
    },
    alternative: {
      label: 'Alternative',
      emoji: '🔍',
      borderColor: 'border-orange-500',
      shadowColor: 'shadow-orange-500/70',
      shadowColorDim: 'shadow-orange-500/30',
      bgGradient: 'from-orange-600 to-orange-500',
    },
    conspiracy: {
      label: 'Conspiracy',
      emoji: '👁️',
      borderColor: 'border-purple-500',
      shadowColor: 'shadow-purple-500/70',
      shadowColorDim: 'shadow-purple-500/30',
      bgGradient: 'from-purple-600 to-fuchsia-500',
    },
    skeptical: {
      label: 'Skeptical',
      emoji: '🤔',
      borderColor: 'border-gray-500',
      shadowColor: 'shadow-gray-500/70',
      shadowColorDim: 'shadow-gray-500/30',
      bgGradient: 'from-gray-600 to-gray-500',
    },
    traditional: {
      label: 'Traditional',
      emoji: '📜',
      borderColor: 'border-amber-500',
      shadowColor: 'shadow-amber-500/70',
      shadowColorDim: 'shadow-amber-500/30',
      bgGradient: 'from-amber-600 to-amber-500',
    },
    scientific: {
      label: 'Scientific / Academic',
      emoji: '🎓',
      borderColor: 'border-cyan-500',
      shadowColor: 'shadow-cyan-500/70',
      shadowColorDim: 'shadow-cyan-500/30',
      bgGradient: 'from-cyan-600 to-cyan-500',
    },
    government: {
      label: 'Government',
      emoji: '🏛️',
      borderColor: 'border-blue-500',
      shadowColor: 'shadow-blue-500/70',
      shadowColorDim: 'shadow-blue-500/30',
      bgGradient: 'from-blue-700 to-blue-600',
    },
    community: {
      label: 'Community',
      emoji: '👥',
      borderColor: 'border-green-500',
      shadowColor: 'shadow-green-500/70',
      shadowColorDim: 'shadow-green-500/30',
      bgGradient: 'from-green-600 to-green-500',
    },

    // Economic
    local_economy: {
      label: 'Local Economy',
      emoji: '💰',
      borderColor: 'border-yellow-500',
      shadowColor: 'shadow-yellow-500/70',
      shadowColorDim: 'shadow-yellow-500/30',
      bgGradient: 'from-yellow-600 to-yellow-500',
    },
    global_economics: {
      label: 'Global Economics',
      emoji: '🌐',
      borderColor: 'border-blue-500',
      shadowColor: 'shadow-blue-500/70',
      shadowColorDim: 'shadow-blue-500/30',
      bgGradient: 'from-blue-600 to-blue-500',
    },
    investors: {
      label: 'Investors',
      emoji: '📈',
      borderColor: 'border-green-500',
      shadowColor: 'shadow-green-500/70',
      shadowColorDim: 'shadow-green-500/30',
      bgGradient: 'from-green-600 to-green-500',
    },
    consumers: {
      label: 'Consumers',
      emoji: '🛒',
      borderColor: 'border-purple-500',
      shadowColor: 'shadow-purple-500/70',
      shadowColorDim: 'shadow-purple-500/30',
      bgGradient: 'from-purple-600 to-purple-500',
    },
    small_business: {
      label: 'Small Business',
      emoji: '🏪',
      borderColor: 'border-orange-500',
      shadowColor: 'shadow-orange-500/70',
      shadowColorDim: 'shadow-orange-500/30',
      bgGradient: 'from-orange-600 to-orange-500',
    },
    corporate: {
      label: 'Corporate',
      emoji: '🏢',
      borderColor: 'border-slate-500',
      shadowColor: 'shadow-slate-500/70',
      shadowColorDim: 'shadow-slate-500/30',
      bgGradient: 'from-slate-600 to-slate-500',
    },
  };

  const config = perspectiveConfig[perspective];

  // Fallback if config not found
  if (!config) {
    console.warn(`Unknown perspective: ${perspective}`);
    return null;
  }

  const borderOpacity = isActive ? 'border-opacity-100' : 'border-opacity-50';

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        'relative w-48 h-32 bg-gray-900/90 backdrop-blur-md rounded-xl p-4 border-2 cursor-pointer',
        config.borderColor,
        borderOpacity,
        isActive
          ? `opacity-100 ${config.shadowColor} shadow-2xl`
          : `opacity-50 ${config.shadowColorDim} shadow-lg`,
        className
      )}
      animate={{
        scale: isActive ? 1.05 : 1,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      {/* Result Count Badge */}
      {resultCount > 0 && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
          <span className="text-xs font-semibold text-cyan-400">
            {resultCount}
          </span>
        </div>
      )}

      {/* Emoji Icon */}
      <div className="flex justify-center mb-2">
        <span className="text-3xl">{config.emoji}</span>
      </div>

      {/* Label */}
      <div className="text-center">
        <span
          className={cn(
            'text-sm font-semibold',
            isActive ? 'text-white' : 'text-white/70'
          )}
        >
          {config.label}
        </span>
      </div>
    </motion.div>
  );
};

export default PerspectiveCard;
