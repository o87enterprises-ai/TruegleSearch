import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastContainer } from './Toast';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children, position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ type = 'info', title, message, duration = 5000, action, pageTheme = 'landing' }) => {
      const id = ++toastIdRef.current;

      const newToast = {
        id,
        type,
        title,
        message,
        duration,
        action,
        pageTheme,
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        return updated.slice(0, maxToasts);
      });

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss, maxToasts]
  );

  const success = useCallback(
    (title, message, options = {}) =>
      toast({ type: 'success', title, message, ...options }),
    [toast]
  );

  const error = useCallback(
    (title, message, options = {}) =>
      toast({ type: 'error', title, message, ...options }),
    [toast]
  );

  const warning = useCallback(
    (title, message, options = {}) =>
      toast({ type: 'warning', title, message, ...options }),
    [toast]
  );

  const info = useCallback(
    (title, message, options = {}) =>
      toast({ type: 'info', title, message, ...options }),
    [toast]
  );

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} position={position} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
