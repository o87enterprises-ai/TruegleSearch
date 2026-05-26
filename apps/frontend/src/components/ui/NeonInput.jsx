import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const NeonInput = ({
  value,
  onChange,
  placeholder = '',
  size = 'md',
  className = '',
  type = 'text',
  disabled = false,
  ...props
}) => {
  const baseStyles =
    'bg-bg-secondary/50 border-2 border-neon-cyan/30 rounded-xl text-white placeholder:text-white/50 focus:outline-none transition-all duration-200';

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  const focusStyles =
    'focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 focus:shadow-glow-cyan';

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <motion.input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        baseStyles,
        sizes[size],
        focusStyles,
        disabledStyles,
        className
      )}
      whileFocus={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      {...props}
    />
  );
};

export default NeonInput;
