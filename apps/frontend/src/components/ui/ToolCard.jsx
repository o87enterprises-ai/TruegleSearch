import { motion } from 'framer-motion';

export default function ToolCard({
  title,
  description,
  icon,
  onClick,
  usesRemaining,
  isPremium,
}) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 10px 40px rgba(0, 229, 255, 0.3)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-gray-900/80 backdrop-blur-md border border-cyan-500/30 rounded-xl p-6 cursor-pointer transition-all min-h-64"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center mb-4">
        {icon}
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>

      {usesRemaining !== null && (
        <p className="text-sm text-yellow-400 mb-2">
          {usesRemaining}/3 uses remaining
        </p>
      )}

      {isPremium && (
        <span className="inline-block px-3 py-1 bg-purple-500/20 border border-purple-500 rounded-full text-purple-400 text-xs font-semibold mb-2">
          Premium
        </span>
      )}

      <button
        className={`w-full py-2 rounded-lg font-semibold transition-all ${
          usesRemaining === 0 && !isPremium
            ? 'bg-purple-500 hover:bg-purple-600 text-white'
            : 'bg-cyan-500 hover:bg-cyan-600 text-white'
        }`}
      >
        {usesRemaining === 0 && !isPremium ? 'Upgrade' : 'Use Tool'}
      </button>
    </motion.div>
  );
}
