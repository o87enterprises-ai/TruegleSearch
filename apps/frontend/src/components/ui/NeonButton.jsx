import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const NeonButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) => {
  const baseStyles =
    'rounded-xl font-semibold transition-all duration-200 relative overflow-hidden';

  const variants = {
    primary:
      'bg-gradient-to-r from-neon-red via-neon-orange via-neon-yellow via-neon-green via-neon-cyan to-neon-blue text-white shadow-glow-rainbow hover:shadow-glow-rainbow-lg',
    secondary:
      'bg-bg-tertiary/50 border-2 border-neon-cyan/50 text-white hover:border-neon-cyan hover:shadow-glow-cyan',
    ghost:
      'bg-transparent border-2 border-neon-cyan/30 text-neon-cyan hover:border-neon-cyan hover:bg-neon-cyan/10',
  };

  // Size configurations using Material Design 3 typography scale
  const sizes = {
    sm: 'px-4 py-2 text-label-medium',
    md: 'px-6 py-3 text-label-large',
    lg: 'px-8 py-4 text-title-medium',
  };

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        disabledStyles,
        className
      )}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {variant === 'primary' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-neon-red via-neon-orange via-neon-yellow via-neon-green via-neon-cyan to-neon-blue opacity-0"
          animate={{
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
};

export default NeonButton;
