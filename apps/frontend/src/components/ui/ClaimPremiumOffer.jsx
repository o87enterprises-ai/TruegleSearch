import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTokens } from '../../context/TokenContext';
import { affiliatePremiumAPI } from '../../services/api';

/**
 * Small claim affordance on eligible affiliate house ads: "sign up via this
 * offer, get 1 month of Premium free." Self-reported — granted immediately
 * on confirm. See AffiliatePremiumService.js for the verification model
 * (hybrid: self-report now, clawed back later if never confirmed).
 */
const ClaimPremiumOffer = ({ offerId, offerTitle }) => {
  const { isAuthenticated } = useAuth();
  const { fetchBalance } = useTokens();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const closeModal = () => {
    setShowModal(false);
    setResult(null);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const response = await affiliatePremiumAPI.claim(offerId);
      setResult({ success: true, premiumUntil: response.data.data.premiumUntil });
      fetchBalance();
    } catch (error) {
      setResult({
        success: false,
        message: error.response?.data?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
          }}
          className="mt-1.5 block text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
        >
          Signed up already? Claim 1 month Premium free &rarr;
        </button>
      ) : (
        <a
          href="/auth/login"
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 inline-block text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
        >
          Sign in to claim 1 month Premium free &rarr;
        </a>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isLoading && closeModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gray-900 border-2 border-cyan-500 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl shadow-cyan-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              {!isLoading && (
                <button
                  onClick={closeModal}
                  className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}

              {!result ? (
                <>
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                    <Gift size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">
                    Did you sign up for {offerTitle}?
                  </h3>
                  <p className="text-gray-400 text-sm text-center mb-5">
                    Confirm and we'll add 1 month of Truegle Premium to your
                    account right away.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      disabled={isLoading}
                      className="flex-1 h-11 px-4 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={isLoading}
                      className="flex-1 h-11 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check size={18} />
                          Yes, I signed up
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : result.success ? (
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                    <Check size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Premium unlocked!
                  </h3>
                  <p className="text-gray-400 text-sm mb-5">
                    You now have Premium until{' '}
                    {result.premiumUntil
                      ? new Date(result.premiumUntil).toLocaleDateString()
                      : 'soon'}
                    .
                  </p>
                  <button
                    onClick={closeModal}
                    className="w-full h-11 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium"
                  >
                    Nice!
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Couldn't claim this offer
                  </h3>
                  <p className="text-gray-400 text-sm mb-5">
                    {result.message}
                  </p>
                  <button
                    onClick={closeModal}
                    className="w-full h-11 px-4 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClaimPremiumOffer;
