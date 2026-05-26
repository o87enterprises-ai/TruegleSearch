import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ModalHeader, ModalBody, ModalFooter } from './ModalParts';

const Modal = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  position = 'center',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  style = {},
  ...props
}) => {
  const dialogRef = useRef(null);

  const sizeStyles = {
    xs: {
      maxWidth: '400px',
      maxHeight: '80vh',
    },
    sm: {
      maxWidth: '480px',
      maxHeight: '85vh',
    },
    md: {
      maxWidth: '640px',
      maxHeight: '90vh',
    },
    lg: {
      maxWidth: '768px',
      maxHeight: '90vh',
    },
    xl: {
      maxWidth: '1024px',
      maxHeight: '95vh',
    },
    full: {
      maxWidth: '100%',
      height: '100%',
      maxHeight: '100vh',
    },
  };

  const positionStyles = {
    center: 'items-center',
    top: 'items-start pt-4',
    bottom: 'items-end pb-4',
    left: 'justify-start pl-4',
    right: 'justify-end pr-4',
  };

  const responsiveSizeStyles = {
    xs: 'max-w-xs sm:max-w-sm md:max-w-xs lg:max-w-sm',
    sm: 'max-w-sm sm:max-w-md md:max-w-sm lg:max-w-md',
    md: 'max-w-md sm:max-w-lg md:max-w-md lg:max-w-lg',
    lg: 'max-w-lg sm:max-w-xl md:max-w-lg lg:max-w-xl',
    xl: 'max-w-xl sm:max-w-2xl md:max-w-2xl lg:max-w-3xl',
    full: 'max-w-full h-full m-0 rounded-none',
  };

  const sizeConfig = sizeStyles[size] || sizeStyles.md;
  const positionClass = positionStyles[position] || positionStyles.center;

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
      if (e.key === 'Tab') {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
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
    [closeOnEscape, onClose]
  );

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      const firstFocusable = dialogRef.current?.querySelector(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex p-4 sm:p-6 lg:p-8"
          style={{ ...style }}
          role="dialog"
          aria-modal="true"
          {...props}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />

          {/* Modal Content */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? 20 : position === 'top' ? -20 : 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'bottom' ? 20 : position === 'top' ? -20 : 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full',
              'rounded-2xl',
              'bg-neutral-900/95 backdrop-blur-xl',
              'border border-white/10',
              'shadow-2xl shadow-black/40',
              'overflow-hidden',
              positionClass,
              responsiveSizeStyles[size],
              className
            )}
            style={{
              maxHeight: size === 'full' ? '100vh' : '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'absolute top-4 right-4 z-10',
                  'p-1.5 rounded-lg',
                  'text-neutral-500 hover:text-neutral-300',
                  'hover:bg-white/5',
                  'transition-colors duration-150',
                  'lg:top-6 lg:right-6'
                )}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
export { ModalHeader, ModalBody, ModalFooter };
