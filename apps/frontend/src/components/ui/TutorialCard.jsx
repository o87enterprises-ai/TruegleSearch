import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, BookOpen } from 'lucide-react';

/**
 * TutorialCard Component
 * Displays contextual tutorial content with glassmorphism design
 */
const TutorialCard = ({
  id,
  title,
  description,
  image,
  position = 'bottom', // top, bottom, left, right
  onDismiss,
  onDontShowAgain,
  className = '',
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const cardRef = useRef(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dontShowAgain]);

  // Focus card on mount for accessibility
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const handleDismiss = () => {
    if (dontShowAgain) {
      onDontShowAgain?.(id);
    }
    onDismiss?.(id);
  };

  // Position-based animation variants
  const positionVariants = {
    top: { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 } },
  };

  const variants = positionVariants[position] || positionVariants.bottom;

  return (
    <motion.div
      ref={cardRef}
      tabIndex={0}
      role="dialog"
      aria-labelledby={`tutorial-title-${id}`}
      aria-describedby={`tutorial-desc-${id}`}
      initial={variants.initial}
      animate={variants.animate}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`relative max-w-sm bg-gray-900/80 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/10 overflow-hidden ${className}`}
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none" />

      {/* Content */}
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-500/20 rounded-lg">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <h3
              id={`tutorial-title-${id}`}
              className="font-semibold text-white"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-gray-700/50 rounded-lg transition-colors"
            aria-label="Close tutorial"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Image (optional) */}
        {image && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img
              src={image}
              alt=""
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        {/* Description */}
        <p
          id={`tutorial-desc-${id}`}
          className="text-sm text-gray-300 leading-relaxed mb-4"
        >
          {description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                dontShowAgain
                  ? 'bg-purple-500 border-purple-500'
                  : 'border-gray-600 group-hover:border-purple-400'
              }`}
              onClick={() => setDontShowAgain(!dontShowAgain)}
            >
              {dontShowAgain && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs text-gray-400 group-hover:text-gray-300">
              Don't show again
            </span>
          </label>

          {/* Got it button */}
          <motion.button
            onClick={handleDismiss}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-purple-500/25 transition-shadow"
          >
            Got it
          </motion.button>
        </div>
      </div>

      {/* Arrow indicator based on position */}
      <TutorialArrow position={position} />
    </motion.div>
  );
};

/**
 * Arrow indicator component
 */
const TutorialArrow = ({ position }) => {
  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-gray-900/80 border-x-transparent border-b-transparent',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-gray-900/80 border-x-transparent border-t-transparent',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-gray-900/80 border-y-transparent border-r-transparent',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-gray-900/80 border-y-transparent border-l-transparent',
  };

  return (
    <div
      className={`absolute w-0 h-0 border-8 ${arrowClasses[position] || arrowClasses.bottom}`}
    />
  );
};

/**
 * TutorialButton Component
 * Prominent button to start tutorials
 */
export const TutorialButton = ({
  onClick,
  label = 'Take a Tour',
  className = '',
}) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168, 85, 247, 0.4)' }}
      whileTap={{ scale: 0.95 }}
      className={`group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-xl border border-purple-400/30 shadow-lg shadow-purple-500/20 transition-all ${className}`}
    >
      <BookOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      <span>{label}</span>
    </motion.button>
  );
};

export default TutorialCard;
