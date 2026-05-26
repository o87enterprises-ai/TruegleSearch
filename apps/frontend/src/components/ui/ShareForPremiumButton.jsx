import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  MessageSquare,
  Gift,
  X,
  Check,
} from 'lucide-react';
import NeonButton from './NeonButton';

export default function ShareForPremiumButton({
  onPremiumGranted,
  variant = 'default', // 'default' | 'compact' | 'inline' | 'custom'
  showIcon = true,
  isOpen: controlledIsOpen,
  onOpenChange,
  customTrigger,
}) {
  const [internalShowModal, setInternalShowModal] = useState(false);

  // Support both controlled and uncontrolled modal state
  const isControlled = controlledIsOpen !== undefined;
  const showModal = isControlled ? controlledIsOpen : internalShowModal;
  const setShowModal = isControlled ? onOpenChange : setInternalShowModal;
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const platforms = [
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: Twitter,
      color: 'from-blue-400 to-blue-600',
      shareUrl: (text, url) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'from-blue-500 to-blue-700',
      shareUrl: (text, url) =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'from-blue-600 to-blue-800',
      shareUrl: (text, url) =>
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      id: 'reddit',
      name: 'Reddit',
      icon: MessageSquare,
      color: 'from-orange-500 to-red-600',
      shareUrl: (text, url) =>
        `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    },
  ];

  const handleShare = (platform) => {
    const shareText =
      'Just discovered Truegle - unbiased search without algorithmic bubbles! 🌈🔍 #Truegle #UnbiasedSearch';
    const shareUrl = 'https://truegle.com';

    const url = platform.shareUrl(shareText, shareUrl);

    // Open share popup
    window.open(url, 'share', 'width=550,height=420');

    setSelectedPlatform(platform);

    // Show confirmation after 3 seconds
    setTimeout(() => {
      setShowConfirmation(true);
    }, 3000);
  };

  const handleConfirmShare = async () => {
    setIsLoading(true);

    try {
      // Simulate API call (replace with real backend later)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onPremiumGranted?.();

      setShowModal(false);
      setShowConfirmation(false);
      setSelectedPlatform(null);

      alert('🎉 Success! You now have 24 hours of Premium access!');
    } catch (error) {
      console.error('Failed to grant premium:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setSelectedPlatform(null);
  };

  return (
    <>
      {/* Trigger Button */}
      {variant === 'default' && (
        <NeonButton
          variant="secondary"
          onClick={() => setShowModal(true)}
          className="w-full"
        >
          {showIcon && <Gift className="inline mr-2" size={20} />}
          Share & Get 1 Day Premium Free
        </NeonButton>
      )}

      {variant === 'compact' && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 
                     hover:shadow-lg hover:shadow-orange-500/50 transition-all
                     flex items-center justify-center gap-2 text-white font-medium"
        >
          {showIcon && <Gift size={20} />}
          <span>Share for Premium Day</span>
        </button>
      )}

      {variant === 'inline' && (
        <button
          onClick={() => setShowModal(true)}
          className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm flex items-center gap-1"
        >
          {showIcon && <Share2 size={16} />}
          <span>Share for free premium</span>
        </button>
      )}

      {variant === 'custom' &&
        customTrigger &&
        customTrigger(() => setShowModal(true))}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() =>
              !showConfirmation && !isLoading && setShowModal(false)
            }
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gray-900 border-2 border-cyan-500 rounded-2xl p-8 max-w-md w-full relative shadow-2xl shadow-cyan-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              {!showConfirmation && !isLoading && (
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              )}

              {!showConfirmation ? (
                <>
                  <div className="text-center mb-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500 flex items-center justify-center relative"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 blur-lg opacity-50 animate-pulse" />
                      <Gift size={40} className="text-white relative z-10" />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400 mb-2">
                      Get Premium Free!
                    </h2>
                    <p className="text-gray-400">
                      Share Truegle and unlock 24 hours of premium features
                    </p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 mb-6 border border-cyan-500/20"
                  >
                    <p className="text-sm text-cyan-400 font-semibold mb-3">
                      Premium Features Include:
                    </p>
                    <ul className="space-y-2 text-sm text-gray-300">
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        Unlimited OSINT & SEO tools
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        Ad-free search experience
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        Built-in VPN access
                      </li>
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        Priority support
                      </li>
                    </ul>
                  </motion.div>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 mb-3">
                      Choose a platform to share:
                    </p>
                    {platforms.map((platform, index) => {
                      const Icon = platform.icon;
                      return (
                        <motion.button
                          key={platform.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                          onClick={() => handleShare(platform)}
                          whileHover={{ scale: 1.02, x: 5 }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full h-12 px-4 rounded-xl bg-gradient-to-r ${platform.color} flex items-center justify-center gap-3 text-white font-medium transition-all duration-300 hover:shadow-lg`}
                        >
                          <Icon size={20} />
                          <span>Share on {platform.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-6">
                    Available once per week per platform • Premium access lasts
                    24 hours
                  </p>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                    {selectedPlatform && (
                      <selectedPlatform.icon size={32} className="text-white" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Almost there!
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Did you complete sharing on{' '}
                    <span className="text-cyan-400 font-medium">
                      {selectedPlatform?.name}
                    </span>
                    ?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="flex-1 h-12 px-4 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      No, cancel
                    </button>
                    <button
                      onClick={handleConfirmShare}
                      disabled={isLoading}
                      className="flex-1 h-12 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Activating...</span>
                        </>
                      ) : (
                        <>
                          <Check size={20} />
                          <span>Yes, I shared it!</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
