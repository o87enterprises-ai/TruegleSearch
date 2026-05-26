import { motion, AnimatePresence } from 'framer-motion';
import { Check, HelpCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function Checkbox({
  label,
  checked,
  onChange,
  tooltip = null,
  disabled = false,
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showTooltip]);

  return (
    <div className="flex items-center gap-3 group">
      {/* Custom Checkbox */}
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative w-5 h-5 rounded border-2 transition-all flex-shrink-0
          ${
            checked
              ? 'bg-cyan-500 border-cyan-500'
              : 'bg-transparent border-gray-600 hover:border-cyan-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-cyan-500/50
        `}
      >
        {checked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Check size={14} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </button>

      {/* Label */}
      <label
        onClick={() => !disabled && onChange(!checked)}
        className={`
          text-sm text-gray-300 select-none flex items-center gap-2 flex-1 min-w-0
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="flex-1">{label}</span>

        {/* Tooltip */}
        {tooltip && (
          <div className="relative inline-block" ref={tooltipRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTooltip(!showTooltip);
              }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-500 hover:text-cyan-400 transition-colors flex-shrink-0"
            >
              <HelpCircle size={14} />
            </button>

            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full right-0 mb-2 
                             w-56 p-3 
                             bg-gray-800 border border-cyan-500/30 rounded-lg shadow-2xl z-50"
                  style={{ transform: 'translateX(0)' }}
                >
                  <div className="text-xs text-gray-300 leading-relaxed">
                    {tooltip}
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full right-4 -mt-px">
                    <div className="border-4 border-transparent border-t-gray-800" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </label>
    </div>
  );
}
