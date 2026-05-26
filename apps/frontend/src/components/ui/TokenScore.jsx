import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';

/**
 * TokenScore - Fixed position token counter component
 * Displays remaining tokens in a small, non-obtrusive box
 * Color-coded based on the current page theme
 */
export default function TokenScore({
  tokens = 1000,
  maxTokens = 10000,
  themeColor = 'blue' // blue, red, purple, cyan, green
}) {
  // Calculate percentage for color intensity
  const percentage = (tokens / maxTokens) * 100;

  // Determine color classes based on theme
  const getColorClasses = () => {
    switch (themeColor) {
      case 'blue':
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/50',
          text: 'text-blue-400',
          glow: 'shadow-blue-500/20',
          ring: 'ring-blue-500/30'
        };
      case 'red':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500/50',
          text: 'text-red-400',
          glow: 'shadow-red-500/20',
          ring: 'ring-red-500/30'
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/20',
          border: 'border-purple-500/50',
          text: 'text-purple-400',
          glow: 'shadow-purple-500/20',
          ring: 'ring-purple-500/30'
        };
      case 'cyan':
        return {
          bg: 'bg-cyan-500/20',
          border: 'border-cyan-500/50',
          text: 'text-cyan-400',
          glow: 'shadow-cyan-500/20',
          ring: 'ring-cyan-500/30'
        };
      case 'green':
        return {
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/50',
          text: 'text-emerald-400',
          glow: 'shadow-emerald-500/20',
          ring: 'ring-emerald-500/30'
        };
      default:
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/50',
          text: 'text-blue-400',
          glow: 'shadow-blue-500/20',
          ring: 'ring-blue-500/30'
        };
    }
  };

  const colors = getColorClasses();

  // Warning color if tokens are running low
  const isLow = percentage < 20;
  const isMedium = percentage >= 20 && percentage < 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        fixed top-4 right-4 z-50
        px-3 py-2 rounded-lg
        backdrop-blur-xl
        border ${colors.border}
        ${colors.bg}
        shadow-lg ${colors.glow}
        transition-all duration-300
        ${isLow ? 'ring-2 ring-red-500/50 animate-pulse' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <Coins
          size={14}
          className={`
            ${isLow ? 'text-red-400' : isMedium ? 'text-yellow-400' : colors.text}
          `}
        />
        <div className="flex flex-col">
          <span
            className={`
              text-[10px] font-mono font-bold
              ${isLow ? 'text-red-400' : isMedium ? 'text-yellow-400' : colors.text}
            `}
          >
            {tokens.toLocaleString()}
          </span>
          <span className="text-[8px] font-mono text-white/40">
            / {maxTokens.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-black/30 rounded-full mt-1.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`
            h-full rounded-full
            ${isLow ? 'bg-red-500' : isMedium ? 'bg-yellow-500' : ''}
            ${!isLow && !isMedium ? (
              themeColor === 'blue' ? 'bg-blue-500' :
              themeColor === 'red' ? 'bg-red-500' :
              themeColor === 'purple' ? 'bg-purple-500' :
              themeColor === 'cyan' ? 'bg-cyan-500' :
              themeColor === 'green' ? 'bg-emerald-500' : 'bg-blue-500'
            ) : ''}
          `}
        />
      </div>
    </motion.div>
  );
}
