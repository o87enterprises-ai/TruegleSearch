import React from 'react';
import { cn } from '../../utils/cn';

const ModalHeader = ({
  children,
  className = '',
  showClose = false,
  onClose,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4',
        'p-4 sm:p-5 lg:p-6',
        'border-b border-white/10',
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {typeof children === 'string' ? (
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-50">
            {children}
          </h2>
        ) : (
          children
        )}
      </div>
      {showClose && onClose && (
        <button
          onClick={onClose}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-lg',
            'text-neutral-500 hover:text-neutral-300',
            'hover:bg-white/5',
            'transition-colors duration-150'
          )}
          aria-label="Close modal"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1={18} y1={6} x2={6} y2={18} />
            <line x1={6} y1={6} x2={18} y2={18} />
          </svg>
        </button>
      )}
    </div>
  );
};

const ModalBody = ({
  children,
  className = '',
  scrollable = true,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex-1',
        scrollable && 'overflow-y-auto',
        'p-4 sm:p-5 lg:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const ModalFooter = ({
  children,
  className = '',
  align = 'right',
  ...props
}) => {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        'p-4 sm:p-5 lg:p-6',
        'border-t border-white/10',
        alignStyles[align] || alignStyles.right,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export { ModalHeader, ModalBody, ModalFooter };
