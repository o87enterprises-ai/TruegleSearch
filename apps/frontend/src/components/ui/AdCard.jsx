import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const AdCard = ({ size = 'banner', adData = null, className = '' }) => {
  const sizeStyles = {
    banner: 'w-full h-24',
    leaderboard: 'w-full h-32',
    sidebar: 'w-64 h-80',
    square: 'w-64 h-64',
  };

  const content = adData ? (
    <a
      href={adData.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col h-full w-full"
    >
      {adData.image && (
        <div className="flex-1 overflow-hidden rounded-lg mb-2">
          <img
            src={adData.image}
            alt={adData.title || 'Advertisement'}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {adData.title && (
        <p className="text-sm text-white/80 line-clamp-2">{adData.title}</p>
      )}
    </a>
  ) : (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Advertisement</p>
    </div>
  );

  return (
    <motion.div
      className={cn(
        'relative bg-gray-900/30 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4',
        'hover:border-gray-600/70 transition-colors duration-200',
        sizeStyles[size],
        className
      )}
      whileHover={{ scale: adData ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute top-2 right-2">
        <span className="text-xs text-gray-500">Ad</span>
      </div>
      <div className="h-full w-full">{content}</div>
    </motion.div>
  );
};

export default AdCard;
