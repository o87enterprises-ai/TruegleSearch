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
      'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:opacity-90 hover:shadow-cyan-500/40',
    secondary:
      'bg-white/10 border-2 border-cyan-500/50 text-white hover:border-cyan-400 hover:bg-white/20',
    ghost:
      'bg-transparent border-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
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
          className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0"
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
