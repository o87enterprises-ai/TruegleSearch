import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const variantStyles = {
  default: {
    base: 'bg-neutral-900/80 border-white/10',
    hover: {
      borderColor: 'rgba(0, 229, 255, 0.4)',
      boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)',
    },
  },
  elevated: {
    base: 'bg-neutral-800/90 border-white/15 shadow-xl shadow-black/20',
    hover: {
      borderColor: 'rgba(0, 229, 255, 0.5)',
      boxShadow: '0 8px 32px rgba(0, 229, 255, 0.15), 0 0 20px rgba(0, 229, 255, 0.1)',
    },
  },
  outlined: {
    base: 'bg-transparent border-white/20',
    hover: {
      borderColor: 'rgba(0, 229, 255, 0.6)',
      boxShadow: '0 0 15px rgba(0, 229, 255, 0.15)',
    },
  },
  filled: {
    base: 'bg-neutral-800 border-neutral-700',
    hover: {
      borderColor: 'rgba(0, 229, 255, 0.4)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    },
  },
  glass: {
    base: 'card-glass',
    hover: {
      scale: 1.02,
      borderColor: 'rgba(0, 229, 255, 0.4)',
      boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
    },
  },
};

const sizeStyles = {
  sm: 'p-3 rounded-lg',
  md: 'p-4 rounded-xl',
  lg: 'p-6 rounded-xl',
  xl: 'p-8 rounded-2xl',
};

const GlassCard = ({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  hover = false,
  animate = true,
  loading = false,
  as: Component = motion.div,
  ...props
}) => {
  const variantStyle = variantStyles[variant] || variantStyles.default;
  const sizeStyle = sizeStyles[size] || sizeStyles.md;

  const baseClasses = cn(
    'relative border backdrop-blur-md overflow-hidden',
    variantStyle.base,
    sizeStyle,
    loading && 'pointer-events-none'
  );

  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3, ease: 'easeOut' },
      }
    : {};

  const hoverProps = hover
    ? {
        whileHover: {
          scale: variantStyle.hover.scale || 1.01,
          ...variantStyle.hover,
        },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <Component
      className={cn(baseClasses, className)}
      {...motionProps}
      {...hoverProps}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      )}
      {children}
    </Component>
  );
};

export default GlassCard;
