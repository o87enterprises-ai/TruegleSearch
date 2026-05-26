import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, AlertTriangle, Crown } from 'lucide-react';
import { useTokens } from '../../context/TokenContext';
import { useAuth } from '../../context/AuthContext';

/**
 * TokenBalance Component
 * Displays user's token balance in the header/nav
 */
const TokenBalance = ({ className = '', showLabel = true }) => {
  const { isAuthenticated } = useAuth();
  const { balance, isPremium, loading } = useTokens();

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-5 h-5 rounded-full bg-gray-700 animate-pulse" />
        <div className="w-8 h-4 rounded bg-gray-700 animate-pulse" />
      </div>
    );
  }

  // Premium users see a special badge
  if (isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full ${className}`}
      >
        <Crown className="w-4 h-4 text-yellow-400" />
        {showLabel && (
          <span className="text-sm font-medium text-yellow-300">Premium</span>
        )}
      </motion.div>
    );
  }

  const isLowBalance = balance < 2;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700 rounded-full hover:border-purple-500/50 transition-colors cursor-pointer ${className}`}
      title={`${balance} tokens available`}
    >
      <Coins className="w-4 h-4 text-yellow-400" />
      <AnimatePresence mode="wait">
        <motion.span
          key={balance}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`text-sm font-bold ${isLowBalance ? 'text-red-400' : 'text-white'}`}
        >
          {balance}
        </motion.span>
      </AnimatePresence>
      {showLabel && (
        <span className="text-sm text-gray-400 hidden sm:inline">tokens</span>
      )}

      {/* Low balance warning */}
      {isLowBalance && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
        </motion.div>
      )}
    </motion.div>
  );
};

/**
 * TokenEarnedNotification Component
 * Shows animation when tokens are earned
 */
export const TokenEarnedNotification = ({ amount = 1, onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
      onAnimationComplete={onComplete}
      className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl shadow-lg"
    >
      <motion.div
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ duration: 0.5, repeat: 2 }}
      >
        <Coins className="w-6 h-6" />
      </motion.div>
      <div>
        <p className="font-bold">+{amount} Token Earned!</p>
        <p className="text-sm text-green-100">Added to your balance</p>
      </div>
    </motion.div>
  );
};

export default TokenBalance;
