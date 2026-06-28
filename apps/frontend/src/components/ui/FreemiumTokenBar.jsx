import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Play, X, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTokens } from '../../context/TokenContext';
import AdsterraBanner from '../ads/AdsterraBanner';

export default function FreemiumTokenBar() {
  const navigate = useNavigate();
  const { freemium, freemiumDailyLimit, refillFreemiumFromAd, refreshFreemium } = useTokens();
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [adTimer, setAdTimer] = useState(0);

  if (!freemium?.active) return null;

  const { tokens, searches } = freemium;
  const pct = Math.round((tokens / freemiumDailyLimit) * 100);
  const exhausted = tokens <= 0;

  const handleWatchAd = () => {
    setShowAd(true);
    setAdWatched(false);
    setAdTimer(5);
    const interval = setInterval(() => {
      setAdTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setAdWatched(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleAdComplete = () => {
    refillFreemiumFromAd(3);
    setShowAd(false);
    refreshFreemium();
  };

  return (
    <>
      {/* Token bar — fixed bottom strip */}
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 border-t border-white/10 backdrop-blur-xl px-4 py-2"
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Token icon + count */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Zap size={14} className={exhausted ? 'text-red-400' : 'text-yellow-400'} />
            <span className={`text-sm font-semibold tabular-nums ${exhausted ? 'text-red-400' : 'text-white'}`}>
              {tokens}<span className="text-white/40 font-normal">/{freemiumDailyLimit}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${exhausted ? 'bg-red-500' : pct > 50 ? 'bg-emerald-400' : pct > 20 ? 'bg-yellow-400' : 'bg-orange-500'}`}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <span className="text-white/40 text-xs flex-shrink-0 hidden sm:block">
            {searches} search{searches !== 1 ? 'es' : ''} today
          </span>

          {/* Watch ad to refill */}
          <button
            onClick={handleWatchAd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs font-medium rounded-lg transition-all flex-shrink-0"
          >
            <Play size={11} />
            +3 tokens
          </button>

          {/* Upgrade */}
          <button
            onClick={() => navigate('/auth/signup')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-xs font-medium rounded-lg transition-all flex-shrink-0"
          >
            <Crown size={11} />
            Upgrade
          </button>
        </div>
      </motion.div>

      {/* Ad overlay */}
      <AnimatePresence>
        {showAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-sm w-full text-center relative">
              <button
                onClick={() => setShowAd(false)}
                className="absolute top-3 right-3 text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={18} />
              </button>

              <Zap size={28} className="text-yellow-400 mx-auto mb-3" />
              <h3 className="text-white font-bold mb-1">Watch to earn +3 tokens</h3>
              <p className="text-white/50 text-sm mb-4">Your ad is loading…</p>

              <div className="mb-4">
                <AdsterraBanner format="banner300x250" />
              </div>

              {adWatched ? (
                <button
                  onClick={handleAdComplete}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Claim +3 tokens
                </button>
              ) : (
                <div className="w-full py-2.5 bg-white/10 text-white/40 font-semibold rounded-xl text-sm">
                  Please wait {adTimer}s…
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
