import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiX, FiInfo, FiArrowRight } = FiIcons;

const AdBanner = ({
  variant = 'yellow',
  size = 'medium',
  title,
  description,
  ctaText = 'Learn More',
  ctaAction,
  onDismiss,
  dismissible = true,
  sponsored = true,
  duration,
  onImpression,
  onClick,
  className = '',
  style = {},
  ...props
}) => {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleClick = useCallback(() => {
    onClick?.();
    if (ctaAction) {
      ctaAction();
    }
  }, [onClick, ctaAction]);

  React.useEffect(() => {
    if (duration && visible) {
      onImpression?.();
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            handleDismiss();
            return 0;
          }
          return prev - (100 / (duration / 100));
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [duration, visible, onImpression, handleDismiss]);

  if (!visible) return null;

  const variantStyles = {
    yellow: {
      bg: 'bg-yellow-400',
      text: 'text-gray-900',
      border: 'border-yellow-400',
      icon: FiInfo,
      shadow: 'shadow-yellow-500/30',
      button: 'from-purple-500 to-pink-500',
    },
    blue: {
      bg: 'bg-blue-400',
      text: 'text-white',
      border: 'border-blue-400',
      icon: FiArrowRight,
      shadow: 'shadow-blue-500/30',
      button: 'from-cyan-500 to-blue-500',
    },
    red: {
      bg: 'bg-red-500',
      text: 'text-white',
      border: 'border-red-500',
      icon: FiInfo,
      shadow: 'shadow-red-500/30',
      button: 'from-orange-500 to-red-500',
    },
    emerald: {
      bg: 'bg-emerald-400',
      text: 'text-gray-900',
      border: 'border-emerald-400',
      icon: FiArrowRight,
      shadow: 'shadow-emerald-500/30',
      button: 'from-green-600 to-emerald-600',
    },
    glass: {
      bg: 'bg-neutral-800/90',
      text: 'text-white',
      border: 'border-white/20',
      icon: FiInfo,
      shadow: 'shadow-white/10',
      button: 'from-purple-500 to-pink-500',
    },
  };

  const sizeStyles = {
    small: {
      padding: 'p-2',
      fontSize: 'text-xs',
      iconSize: 12,
      buttonPadding: 'px-2 py-1',
    },
    medium: {
      padding: 'p-4',
      fontSize: 'text-sm',
      iconSize: 16,
      buttonPadding: 'px-4 py-2',
    },
    large: {
      padding: 'p-6',
      fontSize: 'text-base',
      iconSize: 20,
      buttonPadding: 'px-6 py-3',
    },
  };

  const styles = variantStyles[variant] || variantStyles.yellow;
  const sizeConfig = sizeStyles[size] || sizeStyles.medium;
  const Icon = styles.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`relative ${styles.bg} border-2 ${styles.border} rounded-2xl ${sizeConfig.padding} ${className}`}
          style={{
            boxShadow: `0 4px 15px ${styles.shadow}`,
            ...style,
          }}
          {...props}
        >
          {duration && (
            <motion.div
              className="absolute top-0 left-0 right-0 h-1 bg-black/20"
              initial={{ width: '100%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              {sponsored && (
                <div className={`${sizeConfig.fontSize} font-semibold mb-1 opacity-70`}>
                  Sponsored
                </div>
              )}
              {title && (
                <div className={`${sizeConfig.fontSize} font-bold ${styles.text}`}>
                  {title}
                </div>
              )}
              {description && (
                <div className={`${sizeConfig.fontSize} ${styles.text} opacity-90`}>
                  {description}
                </div>
              )}
            </div>

            {ctaText && (
              <button
                onClick={handleClick}
                className={`whitespace-nowrap rounded-xl bg-gradient-to-r ${styles.button} ${sizeConfig.fontSize} font-semibold text-white ${sizeConfig.buttonPadding} transition-all hover:opacity-90 active:scale-95 shadow-lg`}
              >
                {ctaText}
              </button>
            )}

            {dismissible && (
              <button
                onClick={handleDismiss}
                className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity p-1`}
                aria-label="Dismiss"
              >
                <SafeIcon icon={FiX} size={sizeConfig.iconSize} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdBanner;

export { AdBanner };
