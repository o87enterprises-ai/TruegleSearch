import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, Lock, Sparkles } from 'lucide-react';
import { useSearchMode, SEARCH_MODES } from '../../context/SearchModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import TokenGate from './TokenGate';
import { FREE_ACCESS_MODE } from '../../config/access';

/**
 * ModeToggle Component
 * Toggle switch for Blue Pill / Red Pill search modes
 */
const ModeToggle = ({ className = '', size = 'md', showLabels = true }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    mode,
    isRedPill,
    isTransitioning,
    accessStatus,
    toggleMode,
  } = useSearchMode();

  const [showTokenGate, setShowTokenGate] = useState(false);

  const handleToggle = async () => {
    if (!FREE_ACCESS_MODE && !isAuthenticated && mode === SEARCH_MODES.BLUE_PILL) {
      // Redirect to login
      navigate('/auth/login', { state: { redirectTo: window.location.pathname } });
      return;
    }

    const result = await toggleMode();

    if (!result.success) {
      if (result.requiresGate) {
        setShowTokenGate(true);
      }
    }
  };

  const handleTokenGateAccess = () => {
    setShowTokenGate(false);
    toggleMode();
  };

  const sizeClasses = {
    sm: 'h-8 w-16',
    md: 'h-10 w-20',
    lg: 'h-12 w-24',
  };

  const pillSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <>
      {/* Token Gate Modal */}
      <AnimatePresence>
        {showTokenGate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md w-full mx-4"
            >
              <TokenGate
                featureName="red-pill"
                onAccessGranted={handleTokenGateAccess}
              >
                <div className="p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Pill className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Red Pill Mode
                  </h3>
                  <p className="text-gray-400">
                    Access advanced search with alternative perspectives
                  </p>
                </div>
              </TokenGate>
              <button
                onClick={() => setShowTokenGate(false)}
                className="mt-4 w-full py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toggle Switch */}
      <div className={`flex items-center gap-3 ${className}`}>
        {showLabels && (
          <span
            className={`text-sm font-medium transition-colors ${
              !isRedPill ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            Blue Pill
          </span>
        )}

        <motion.button
          onClick={handleToggle}
          disabled={isTransitioning}
          className={`relative ${sizeClasses[size]} rounded-full p-1 transition-all duration-300 focus-visible:outline-none ${
            isRedPill
              ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700 shadow-lg shadow-red-500/40 hover:shadow-xl hover:shadow-red-500/50 focus-visible:ring-2 focus-visible:ring-red-400/60'
              : 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-400/60'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Track background */}
          <div className="absolute inset-1 rounded-full bg-black/30" />

          {/* Sliding pill */}
          <motion.div
            className={`absolute top-1 ${pillSizes[size]} rounded-full flex items-center justify-center ${
              isRedPill
                ? 'bg-gradient-to-br from-red-300 via-red-400 to-red-600 shadow-md shadow-red-400/50'
                : 'bg-gradient-to-br from-blue-300 via-blue-400 to-blue-600 shadow-md shadow-blue-400/50'
            }`}
            animate={{
              left: isRedPill ? 'calc(100% - 2.25rem)' : '0.25rem',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <Pill
              className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} text-white drop-shadow-lg`}
            />
          </motion.div>

          {/* Lock icon for unauthenticated */}
          {!isAuthenticated && !isRedPill && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center border border-gray-600">
              <Lock className="w-2.5 h-2.5 text-gray-400" />
            </div>
          )}

          {/* Free uses indicator */}
          {accessStatus.freeUsesRemaining !== null && accessStatus.freeUsesRemaining > 0 && !isRedPill && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {accessStatus.freeUsesRemaining}
            </div>
          )}
        </motion.button>

        {showLabels && (
          <span
            className={`text-sm font-medium transition-colors flex items-center gap-1 ${
              isRedPill ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            Red Pill
            {accessStatus.reason === 'premium' && (
              <Sparkles className="w-3 h-3 text-yellow-400" />
            )}
          </span>
        )}
      </div>
    </>
  );
};

/**
 * ModeIndicator Component
 * Shows current mode as a badge
 */
export const ModeIndicator = ({ className = '' }) => {
  const { isRedPill } = useSearchMode();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${
        isRedPill
          ? 'bg-red-500/20 border border-red-500/40 shadow-md shadow-red-500/20'
          : 'bg-blue-500/20 border border-blue-500/40 shadow-md shadow-blue-500/20'
      } ${className}`}
    >
      <Pill
        className={`w-4 h-4 ${isRedPill ? 'text-red-400' : 'text-blue-400'} drop-shadow-lg`}
      />
      <span
        className={`text-sm font-medium ${
          isRedPill ? 'text-red-300' : 'text-blue-300'
        }`}
      >
        {isRedPill ? 'Red Pill' : 'Blue Pill'}
      </span>
    </motion.div>
  );
};

export default ModeToggle;
