import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// Page-specific theme colors
const pageThemeColors = {
  landing: {
    // Truegle Green
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    glow: 'shadow-[0_0_20px_rgba(52,168,83,0.15)]',
  },
  'search-portal': {
    // Blue Pill
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  },
  'search-results': {
    // Red Pill
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
  },
  biased: {
    // Purple
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
  },
  osint: {
    // Deep Ocean Blue
    bg: 'bg-cyan-600/10',
    border: 'border-cyan-600/30',
    icon: 'text-cyan-500',
    glow: 'shadow-[0_0_20px_rgba(8,145,178,0.15)]',
  },
};

// Error always stays red regardless of page
const errorStyles = {
  bg: 'bg-red-500/10',
  border: 'border-red-500/30',
  icon: 'text-red-400',
  glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
};

// Get variant styles based on type and page theme
const getVariantStyles = (type, pageTheme = 'landing') => {
  // Error always stays red
  if (type === 'error') {
    return errorStyles;
  }

  // For success/warning/info, use page theme color
  return pageThemeColors[pageTheme] || pageThemeColors.landing;
};

const Toast = ({
  id,
  type = 'info',
  title,
  message,
  duration = 5000,
  onDismiss,
  action,
  className,
  pageTheme = 'landing', // Default to landing page theme
}) => {
  const Icon = iconMap[type];
  const styles = getVariantStyles(type, pageTheme);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md',
        'min-w-[320px] max-w-[420px]',
        styles.bg,
        styles.border,
        styles.glow,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', styles.icon)}>
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-medium text-neutral-50 mb-0.5">{title}</p>
        )}
        {message && (
          <p className="text-sm text-neutral-400 leading-relaxed">{message}</p>
        )}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'mt-2 text-sm font-medium transition-colors duration-150',
              styles.icon,
              'hover:opacity-80'
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss?.(id)}
        className="flex-shrink-0 p-1 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors duration-150"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <motion.div
          className={cn('absolute bottom-0 left-0 h-0.5 rounded-full', styles.icon)}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          style={{ opacity: 0.5 }}
        />
      )}
    </motion.div>
  );
};

const ToastContainer = ({ toasts, onDismiss, position = 'top-right' }) => {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-[60] flex flex-col gap-2 pointer-events-none',
        positionClasses[position]
      )}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export { Toast, ToastContainer };
export default Toast;
