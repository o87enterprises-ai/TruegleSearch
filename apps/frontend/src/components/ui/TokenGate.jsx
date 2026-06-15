import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Play, Crown, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { useTokens } from '../../context/TokenContext';
import { useAuth } from '../../context/AuthContext';
import AdPlayer from './AdPlayer';
import { FREE_ACCESS_MODE } from '../../config/access';

/**
 * TokenGate Component
 * Wraps premium features with token-based access control
 */
const TokenGate = ({
  children,
  featureName,
  onAccessGranted,
  showAlways = false, // Always show gate UI even if access is granted
  className = '',
}) => {
  // Pre-production: paywalls removed — the gate never blocks. Returned before
  // any hooks so hook order stays consistent (FREE_ACCESS_MODE is a constant).
  if (FREE_ACCESS_MODE) return <>{children}</>;

  const { isAuthenticated } = useAuth();
  const {
    balance,
    isPremium,
    checkAccess,
    spendToken,
    startAdSession,
    earnFromAd,
    getFreeUsesRemaining,
  } = useTokens();

  const [accessState, setAccessState] = useState({
    loading: true,
    allowed: false,
    reason: null,
    freeUsesRemaining: null,
    cost: 1,
    requiresAd: false,
  });
  const [showAdPlayer, setShowAdPlayer] = useState(false);
  const [adSessionId, setAdSessionId] = useState(null);
  const [showGate, setShowGate] = useState(true);

  // Check access on mount and when dependencies change
  useEffect(() => {
    const checkFeatureAccess = async () => {
      if (!isAuthenticated) {
        setAccessState({
          loading: false,
          allowed: false,
          reason: 'not_authenticated',
          freeUsesRemaining: null,
          cost: 1,
          requiresAd: false,
        });
        return;
      }

      const result = await checkAccess(featureName);
      setAccessState({
        loading: false,
        ...result,
      });

      // If access is granted and not showing always, hide gate
      if (result.allowed && !showAlways) {
        setShowGate(false);
        onAccessGranted?.();
      }
    };

    checkFeatureAccess();
  }, [isAuthenticated, featureName, checkAccess, showAlways, onAccessGranted]);

  // Handle spending token
  const handleSpendToken = useCallback(async () => {
    const result = await spendToken(featureName);
    if (result.success) {
      setShowGate(false);
      onAccessGranted?.();
    }
  }, [spendToken, featureName, onAccessGranted]);

  // Open ad player: start server session first, then show player
  const handleOpenAdPlayer = useCallback(async () => {
    const sessionResult = await startAdSession();
    if (sessionResult.success) {
      setAdSessionId(sessionResult.sessionId);
      setShowAdPlayer(true);
    }
  }, [startAdSession]);

  // Handle ad completion — sessionId was set when ad started
  const handleAdComplete = useCallback(async (sessionId) => {
    setShowAdPlayer(false);
    const result = await earnFromAd(sessionId);

    if (result.success) {
      // After earning, spend the token for access
      await handleSpendToken();
    }
  }, [earnFromAd, handleSpendToken]);

  // Handle use free access
  const handleUseFreeAccess = useCallback(async () => {
    const result = await spendToken(featureName);
    if (result.success) {
      setShowGate(false);
      onAccessGranted?.();
    }
  }, [spendToken, featureName, onAccessGranted]);

  // If not showing gate, render children
  if (!showGate && accessState.allowed) {
    return <>{children}</>;
  }

  // Loading state
  if (accessState.loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <>
      {/* Ad Player Modal */}
      <AnimatePresence>
        {showAdPlayer && (
          <AdPlayer
            onComplete={handleAdComplete}
            onClose={() => setShowAdPlayer(false)}
            sessionId={adSessionId}
          />
        )}
      </AnimatePresence>

      {/* Gate UI */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative ${className}`}
      >
        {/* Blurred preview of content */}
        <div className="relative">
          <div className="filter blur-sm opacity-50 pointer-events-none">
            {children}
          </div>

          {/* Gate overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
            <div className="max-w-md w-full mx-4 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Lock className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Premium Feature
                  </h3>
                  <p className="text-sm text-gray-400">
                    {getFeatureLabel(featureName)}
                  </p>
                </div>
              </div>

              {/* Not authenticated */}
              {accessState.reason === 'not_authenticated' && (
                <div className="space-y-4">
                  <p className="text-gray-300">
                    Sign in to access this feature and start with 3 free tokens.
                  </p>
                  <a
                    href="/auth/login"
                    className="block w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg text-center hover:shadow-lg hover:shadow-purple-500/30 transition-shadow"
                  >
                    Sign In to Continue
                  </a>
                </div>
              )}

              {/* Has free uses remaining */}
              {accessState.reason === 'free_use' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <Sparkles className="w-5 h-5" />
                    <span>
                      {accessState.freeUsesRemaining} free uses remaining
                    </span>
                  </div>
                  <button
                    onClick={handleUseFreeAccess}
                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-shadow"
                  >
                    Use Free Access
                  </button>
                </div>
              )}

              {/* Has tokens */}
              {accessState.reason === 'has_tokens' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <span className="text-gray-300">Your balance</span>
                    </div>
                    <span className="text-xl font-bold text-white">
                      {balance} tokens
                    </span>
                  </div>

                  {accessState.requiresAd ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400">
                        This feature requires watching an ad + 1 token
                      </p>
                      <button
                        onClick={handleOpenAdPlayer}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow"
                      >
                        <Play className="w-5 h-5" />
                        Watch Ad & Use 1 Token
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleSpendToken}
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow"
                    >
                      <Coins className="w-5 h-5" />
                      Use 1 Token
                    </button>
                  )}
                </div>
              )}

              {/* Insufficient tokens */}
              {accessState.reason === 'insufficient_tokens' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-300">
                      Not enough tokens (need {accessState.required}, have {accessState.current})
                    </span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      Earn tokens to access this feature:
                    </p>

                    <button
                      onClick={handleOpenAdPlayer}
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow"
                    >
                      <Play className="w-5 h-5" />
                      Watch Ad to Earn Token
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-900 text-gray-500">or</span>
                      </div>
                    </div>

                    <a
                      href="/pricing"
                      className="w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-yellow-500/30 transition-shadow"
                    >
                      <Crown className="w-5 h-5" />
                      Subscribe for Unlimited Access
                    </a>
                  </div>
                </div>
              )}

              {/* Premium user badge */}
              {isPremium && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <span className="text-yellow-300 font-medium">
                    Unlimited Access
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// Helper to get human-readable feature labels
function getFeatureLabel(featureName) {
  const labels = {
    'osint-tools': 'OSINT Investigation Tools',
    'seo-tools': 'SEO Analysis Tools',
    'red-pill': 'Red Pill Search Mode',
    'ai-chat': 'AI Assistant',
    'biased-results': 'Biased Results Analysis',
  };
  return labels[featureName] || featureName;
}

export default TokenGate;
