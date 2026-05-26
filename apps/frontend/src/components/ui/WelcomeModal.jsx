import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import ShareForPremiumButton from './ShareForPremiumButton';
import NeonButton from './NeonButton';
import TruegleLogo from './TruegleLogo';

export default function WelcomeModal({ isOpen, onClose, userName }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gray-900 border-2 border-cyan-500 rounded-2xl p-8 max-w-lg w-full relative
                       shadow-2xl shadow-cyan-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            {/* Content */}
            <div className="text-center">
              {/* Logo */}
              <TruegleLogo size="large" animated={true} className="mb-6" />

              {/* Welcome Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Sparkles className="text-cyan-400" size={24} />
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                    Welcome to Truegle{userName ? `, ${userName}` : ''}!
                  </h2>
                  <Sparkles className="text-purple-400" size={24} />
                </div>

                <p className="text-gray-400 mb-6">
                  Thanks for joining the search revolution! Ready to discover
                  truth without bias?
                </p>
              </motion.div>

              {/* Special Offer */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-orange-500/10 
                           border border-cyan-500/30 rounded-xl p-6 mb-6"
              >
                <h3 className="text-xl font-bold text-white mb-2">
                  🎁 Special Welcome Offer!
                </h3>
                <p className="text-gray-300 mb-4 text-sm">
                  Share Truegle with your network and unlock{' '}
                  <span className="text-cyan-400 font-semibold">
                    24 hours of Premium
                  </span>{' '}
                  absolutely free!
                </p>

                <ShareForPremiumButton
                  variant="compact"
                  onPremiumGranted={() => {
                    onClose();
                    // Optionally redirect to /osint to try premium features
                  }}
                />
              </motion.div>

              {/* Skip Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <NeonButton
                  variant="ghost"
                  onClick={onClose}
                  className="w-full"
                >
                  Skip for now
                </NeonButton>

                <p className="text-xs text-gray-500 mt-3">
                  You can access this offer anytime from your account settings
                </p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
