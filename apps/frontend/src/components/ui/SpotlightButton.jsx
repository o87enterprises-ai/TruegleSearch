import { useState, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

/**
 * SpotlightButton - Button with mouse-tracking spotlight/glow effect
 * Based on reactbits.dev spotlight card pattern
 *
 * Design System:
 * - Green = Search functionality
 * - Purple = Core features (bento cards)
 * - Yellow = Advertisements
 * - Rainbow = Truegle brand
 *
 * STABILITY: Uses React.memo, throttled mouse events, and error boundaries
 */
const SpotlightButton = memo(
  ({
    children,
    onClick,
    variant = 'default', // 'default' | 'search' | 'feature' | 'brand' | 'cta'
    size = 'lg',
    disabled = false,
    className = '',
    glowColor = 'cyan',
    ...props
  }) => {
    const buttonRef = useRef(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);
    const lastMoveTime = useRef(0);

    // Throttled mouse move handler (max 60fps)
    const handleMouseMove = useCallback((e) => {
      const now = Date.now();
      if (now - lastMoveTime.current < 16) return; // ~60fps throttle
      lastMoveTime.current = now;

      if (!buttonRef.current) return;
      try {
        const rect = buttonRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } catch (error) {
        // Silently fail - don't break rendering
        console.warn('SpotlightButton mouse move error:', error);
      }
    }, []);

    // Variant-specific glow colors
    const glowColors = {
      default: 'rgba(0, 229, 255, 0.4)', // cyan
      search: 'rgba(16, 185, 129, 0.5)', // green
      feature: 'rgba(139, 92, 246, 0.5)', // purple
      cta: 'rgba(239, 68, 68, 0.5)', // red
      brand:
        'linear-gradient(90deg, rgba(255,0,0,0.3), rgba(255,165,0,0.3), rgba(255,255,0,0.3), rgba(0,255,0,0.3), rgba(0,229,255,0.3), rgba(139,92,246,0.3))',
    };

    // Variant-specific styles - translucent by default, solidify on hover
    const variantStyles = {
      default: `
      bg-black/40 backdrop-blur-sm
      border border-white/10
      text-white
      hover:border-cyan-500/50
    `,
      search: `
      bg-black/20 backdrop-blur-md
      border border-emerald-400/60
      text-white
    `,
      feature: `
      bg-black/40 backdrop-blur-sm
      border border-purple-500/30
      text-white
      hover:border-purple-400/60
    `,
      cta: `
      bg-black/20 backdrop-blur-md
      border border-red-500/60
      text-white
    `,
      brand: `
      bg-black/60 backdrop-blur-sm
      border border-purple-500/40
      text-white
    `,
    };

    // Size configurations using Material Design 3 typography scale
    const sizes = {
      sm: 'px-4 py-2 text-label-medium',
      md: 'px-6 py-3 text-label-large',
      lg: 'px-8 py-4 text-title-medium',
    };

    // Glossy metallic hover backgrounds for search and cta variants
    const glossyHoverStyles = {
      search: {
        background:
          'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.9) 50%, rgba(16, 185, 129, 0.95) 100%)',
        boxShadow:
          '0 0 25px rgba(16, 185, 129, 0.6), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)',
      },
      cta: {
        background:
          'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(234, 88, 12, 0.9) 50%, rgba(239, 68, 68, 0.95) 100%)',
        boxShadow:
          '0 0 25px rgba(239, 68, 68, 0.6), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)',
      },
    };

    return (
      <motion.button
        ref={buttonRef}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative overflow-hidden rounded-xl font-semibold transition-all duration-300',
          'tracking-wider', // Increased letter spacing per typography guidelines
          variantStyles[variant],
          sizes[size],
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className
        )}
        whileHover={disabled ? {} : { scale: 1.02 }}
        whileTap={disabled ? {} : { scale: 0.98 }}
        {...props}
      >
        {/* Glossy metallic hover overlay for search and cta variants */}
        {(variant === 'search' || variant === 'cta') && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
            style={{
              background: glossyHoverStyles[variant]?.background,
              boxShadow: glossyHoverStyles[variant]?.boxShadow,
              opacity: isHovered ? 1 : 0,
            }}
          />
        )}

        {/* Glossy shine highlight effect on hover */}
        {(variant === 'search' || variant === 'cta') && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
        )}

        {/* Spotlight gradient that follows mouse */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300"
          style={{
            background:
              variant === 'brand'
                ? `radial-gradient(300px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.25), transparent 60%)`
                : `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColors[variant] || glowColors.default}, transparent 50%)`,
            opacity: isHovered ? 1 : 0,
          }}
        />

        {/* Border glow effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(250px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColors[variant] || glowColors.default}, transparent 60%)`,
            opacity: isHovered ? 0.6 : 0,
            filter: 'blur(1px)',
          }}
        />

        {/* Button content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </motion.button>
    );
  }
);

SpotlightButton.displayName = 'SpotlightButton';

export default SpotlightButton;
