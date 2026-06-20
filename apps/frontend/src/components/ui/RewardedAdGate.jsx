import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Coins, X } from 'lucide-react';
import { useTokens } from '../../context/TokenContext';
import AdPlayer from './AdPlayer';

/**
 * Blocking ad-watch gate for users who've exceeded their token limit for a
 * feature and aren't enrolled in the Rewards Program. Enrolled users are
 * never routed here — they already earn cash from ads via RewardAdSlot, so
 * the caller should skip this gate entirely when `optedIn` is true.
 */
export default function RewardedAdGate({ open, onClose, onUnlocked, featureName = 'ai-chat' }) {
  const { startAdSession, earnFromAd, spendToken } = useTokens();
  const [sessionId, setSessionId] = useState(null);
  const [starting, setStarting] = useState(false);

  const handleStart = useCallback(async () => {
    setStarting(true);
    const result = await startAdSession();
    setStarting(false);
    if (result.success) setSessionId(result.sessionId);
  }, [startAdSession]);

  const handleComplete = useCallback(async (id) => {
    const earnResult = await earnFromAd(id);
    setSessionId(null);
    if (!earnResult.success) {
      onClose?.();
      return;
    }
    const spendResult = await spendToken(featureName);
    if (spendResult.success) {
      onUnlocked?.();
    } else {
      onClose?.();
    }
  }, [earnFromAd, spendToken, featureName, onUnlocked, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {sessionId ? (
        <AdPlayer sessionId={sessionId} onComplete={handleComplete} onClose={() => setSessionId(null)} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <Coins className="w-5 h-5" />
                <h3 className="text-white font-bold text-lg">Out of free tokens</h3>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-5">
              You've used up your tokens for this feature. Watch a short ad to earn another token and
              continue — or join the Rewards Program to get paid for the ads you watch instead.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                {starting ? 'Starting...' : 'Watch Ad to Continue'}
              </button>
              <a
                href="/rewards"
                className="block w-full py-2.5 px-4 text-center text-sm text-white/60 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition-all"
              >
                Join Rewards Program instead
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
