import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * FallingText - Text animation that "falls" letter by letter
 * Based on reactbits.dev falling-text animation pattern
 *
 * Used for Learn More button hover effect - text falls to reveal cards below
 *
 * STABILITY FIX: Pre-compute random rotations to prevent re-render issues
 */
const FallingText = ({
  text = 'Learn More',
  isTriggered = false,
  onAnimationComplete,
  className = '',
  letterClassName = '',
  fallDistance = 100,
  staggerDelay = 0.05,
  duration = 0.6,
}) => {
  const letters = text.split('');

  // Pre-compute random rotations once on mount to prevent re-render issues
  const rotations = useMemo(
    () => letters.map(() => Math.random() * 30 - 15),
    [text] // Only recompute if text changes
  );

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  // Create letter variants factory to avoid Math.random() in render
  const getLetterVariants = (rotation) => ({
    initial: {
      y: 0,
      opacity: 1,
      rotate: 0,
    },
    animate: {
      y: fallDistance,
      opacity: 0,
      rotate: rotation,
      transition: {
        duration: duration,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  });

  return (
    <motion.span
      className={`inline-flex ${className}`}
      variants={containerVariants}
      initial="initial"
      animate={isTriggered ? 'animate' : 'initial'}
      onAnimationComplete={() => {
        if (isTriggered && onAnimationComplete) {
          onAnimationComplete();
        }
      }}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          variants={getLetterVariants(rotations[index])}
          className={`inline-block ${letterClassName}`}
          style={{
            whiteSpace: letter === ' ' ? 'pre' : 'normal',
          }}
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </motion.span>
  );
};

/**
 * LearnMoreButton - Text-only button with falling text animation
 * Features:
 * - VISIBLE BY DEFAULT with orange-purple gradient (same as "Why Truegle?")
 * - Typography: Headline Medium (28px, 600 weight) - draws attention down the page
 * - On hover: text falls down and turns solid purple
 * - Smooth scroll tracking during fall animation
 *
 * STABILITY:
 * - Wrapped with try-catch and always renders fallback text if animation fails
 * - Proper cleanup of all timeouts to prevent memory leaks
 * - Mounted ref check prevents state updates after unmount
 */
export const LearnMoreButton = ({
  onClick,
  onFallComplete,
  className = '',
}) => {
  const [isFalling, setIsFalling] = useState(false);
  const [showFallText, setShowFallText] = useState(true);
  const [animationError, setAnimationError] = useState(false);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track timeouts for cleanup
  const timeoutsRef = useRef([]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear all pending timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Safe setState that checks if mounted
  const safeSetState = useCallback((setter) => {
    if (isMountedRef.current) {
      setter();
    }
  }, []);

  // Safe setTimeout that tracks and cleans up
  const safeTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      // Remove from tracking array
      timeoutsRef.current = timeoutsRef.current.filter(
        (id) => id !== timeoutId
      );
    }, delay);
    timeoutsRef.current.push(timeoutId);
    return timeoutId;
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Reset after mouse leaves
    safeTimeout(() => {
      safeSetState(() => {
        setIsFalling(false);
        setShowFallText(true);
      });
    }, 300);
  }, [safeTimeout, safeSetState]);

  const handleClick = useCallback(() => {
    try {
      setIsFalling(true);
      // After animation, scroll to features section
      safeTimeout(() => {
        if (onClick) onClick();
        if (onFallComplete) onFallComplete();
      }, 600);
    } catch (error) {
      console.error('LearnMoreButton click error:', error);
      setAnimationError(true);
      // Still execute click handler
      if (onClick) onClick();
    }
  }, [onClick, onFallComplete, safeTimeout]);

  // Fallback render if animation fails
  if (animationError) {
    return (
      <button
        onClick={onClick}
        className={`
          py-4 px-8
          bg-black/60 backdrop-blur-md
          border border-purple-500/50
          rounded-xl
          cursor-pointer
          text-headline-medium
          hover:scale-105 active:scale-98
          hover:bg-black/80 hover:border-purple-400/70
          shadow-lg shadow-purple-500/20
          transition-all duration-200
          ${className}
        `}
        style={{ zIndex: 100 }}
      >
        <span className="text-purple-400 font-semibold drop-shadow-[0_0_10px_rgba(147,51,234,0.5)]">Learn More</span>
      </button>
    );
  }

  return (
    <motion.button
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`
        relative overflow-visible
        py-4 px-8
        bg-black/60 backdrop-blur-md
        border border-purple-500/50
        rounded-xl
        cursor-pointer
        transition-all duration-300
        text-headline-medium
        hover:scale-105 active:scale-98
        hover:bg-black/80 hover:border-purple-400/70
        shadow-lg shadow-purple-500/20
        ${className}
      `}
      style={{ zIndex: 100 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Text with solid purple color and glow */}
      <span className="text-purple-400 font-semibold drop-shadow-[0_0_10px_rgba(147,51,234,0.5)]">
        Learn More
      </span>
    </motion.button>
  );
};

export default FallingText;
