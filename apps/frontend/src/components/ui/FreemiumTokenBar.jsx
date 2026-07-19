import { motion } from 'framer-motion';
import { Zap, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTokens } from '../../context/TokenContext';

export default function FreemiumTokenBar() {
  const navigate = useNavigate();
  const { freemium, freemiumDailyLimit } = useTokens();

  if (!freemium?.active) return null;

  const { tokens, searches } = freemium;
  const pct = Math.round((tokens / freemiumDailyLimit) * 100);
  const exhausted = tokens <= 0;

  return (
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
  );
}
