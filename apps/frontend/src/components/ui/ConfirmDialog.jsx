import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  error: AlertCircle,
  success: CheckCircle,
};

const variantStyles = {
  warning: {
    icon: 'text-yellow-400 bg-yellow-500/10',
    confirm: 'bg-yellow-500 hover:bg-yellow-600 text-neutral-900',
  },
  info: {
    icon: 'text-cyan-400 bg-cyan-500/10',
    confirm: 'bg-cyan-500 hover:bg-cyan-600 text-neutral-900',
  },
  error: {
    icon: 'text-red-400 bg-red-500/10',
    confirm: 'bg-red-500 hover:bg-red-600 text-white',
  },
  success: {
    icon: 'text-emerald-400 bg-emerald-500/10',
    confirm: 'bg-emerald-500 hover:bg-emerald-600 text-neutral-900',
  },
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  loading = false,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);

  const Icon = iconMap[variant];
  const styles = variantStyles[variant];

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && closeOnEscape && !loading) {
        onClose();
      }
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [closeOnEscape, loading, onClose]
  );

  // Auto-focus confirm button on open
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick && !loading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleOverlayClick}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full max-w-md rounded-2xl border border-white/10',
              'bg-neutral-900/95 backdrop-blur-xl p-6',
              'shadow-2xl shadow-black/40'
            )}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={loading}
              className={cn(
                'absolute top-4 right-4 p-1.5 rounded-lg',
                'text-neutral-500 hover:text-neutral-300 hover:bg-white/5',
                'transition-colors duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mb-4',
                styles.icon
              )}
            >
              <Icon size={24} />
            </div>

            {/* Title */}
            <h2
              id="dialog-title"
              className="text-lg font-semibold text-neutral-50 mb-2"
            >
              {title}
            </h2>

            {/* Message */}
            <p
              id="dialog-description"
              className="text-sm text-neutral-400 mb-6 leading-relaxed"
            >
              {message}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'text-neutral-300 hover:text-neutral-100',
                  'bg-neutral-800 hover:bg-neutral-700',
                  'border border-white/10',
                  'transition-colors duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium',
                  'transition-colors duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center gap-2',
                  styles.confirm
                )}
              >
                {loading && (
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
