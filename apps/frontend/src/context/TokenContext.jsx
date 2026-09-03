import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tokensAPI } from '../services/api';
import { useAuth } from './AuthContext';

const TokenContext = createContext();

export const useTokens = () => {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error('useTokens must be used within a TokenProvider');
  }
  return context;
};

export const TokenProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [featureUsage, setFeatureUsage] = useState({});
  const [gameTokensEarned, setGameTokensEarned] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [featureConfig, setFeatureConfig] = useState({});

  // Fetch balance when user authenticates
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchBalance();
      fetchConfig();
    } else {
      // Reset state when logged out
      setBalance(0);
      setFeatureUsage({});
      setGameTokensEarned(0);
      setIsPremium(false);
    }
  }, [isAuthenticated, user]);

  const fetchBalance = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const response = await tokensAPI.getBalance();
      const data = response.data.data;
      setBalance(data.balance);
      setFeatureUsage(data.featureUsage || {});
      setGameTokensEarned(data.gameTokensEarned || 0);
      setIsPremium(data.isPremium || false);
    } catch (error) {
      console.error('Failed to fetch token balance:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await tokensAPI.getConfig();
      setFeatureConfig(response.data.data || {});
    } catch (error) {
      console.error('Failed to fetch token config:', error);
    }
  }, []);

  /**
   * Check if user can access a feature
   * Returns: { allowed, reason, freeUsesRemaining?, cost? }
   */
  const checkAccess = useCallback(async (featureName) => {
    if (!isAuthenticated) {
      return { allowed: false, reason: 'not_authenticated' };
    }

    if (isPremium) {
      return { allowed: true, reason: 'premium' };
    }

    try {
      const response = await tokensAPI.checkAccess(featureName);
      return response.data.data;
    } catch (error) {
      console.error('Failed to check feature access:', error);
      return { allowed: false, reason: 'error' };
    }
  }, [isAuthenticated, isPremium]);

  /**
   * Spend token for feature access
   */
  const spendToken = useCallback(async (featureName) => {
    if (!isAuthenticated) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await tokensAPI.spend(featureName);
      const result = response.data.data;

      if (result.success) {
        // Update local state
        if (result.newBalance !== undefined) {
          setBalance(result.newBalance);
        }
        if (result.freeUsesRemaining !== undefined) {
          setFeatureUsage(prev => ({
            ...prev,
            [featureName]: (prev[featureName] || 0) + 1
          }));
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to spend token:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to spend token' };
    }
  }, [isAuthenticated]);

  /**
   * Earn token from game level completion
   */
  const earnFromGame = useCallback(async (levelCompleted) => {
    if (!isAuthenticated) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await tokensAPI.earnFromGame(levelCompleted);
      const result = response.data.data;

      if (result.success) {
        setBalance(result.newBalance);
        setGameTokensEarned(result.gameTokensEarned);
      }

      return result;
    } catch (error) {
      console.error('Failed to earn from game:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to process game reward',
        gameTokensEarned: error.response?.data?.data?.gameTokensEarned
      };
    }
  }, [isAuthenticated]);

  /**
   * Get remaining free uses for a feature
   */
  const getFreeUsesRemaining = useCallback((featureName) => {
    const config = featureConfig[featureName];
    if (!config) return null;

    const used = featureUsage[featureName] || 0;
    return Math.max(0, config.freeUses - used);
  }, [featureConfig, featureUsage]);

  /**
   * Check if feature requires token (past free uses)
   */
  const requiresToken = useCallback((featureName) => {
    const config = featureConfig[featureName];
    if (!config) return false;

    const used = featureUsage[featureName] || 0;
    return used >= config.freeUses;
  }, [featureConfig, featureUsage]);

  const value = {
    // State
    balance,
    featureUsage,
    gameTokensEarned,
    isPremium,
    loading,
    featureConfig,
    maxGameTokens: 10,

    // Actions
    fetchBalance,
    checkAccess,
    spendToken,
    earnFromGame,

    // Helpers
    getFreeUsesRemaining,
    requiresToken,
  };

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
};
