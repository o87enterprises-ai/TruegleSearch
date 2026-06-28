import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tokensAPI } from '../services/api';
import { useAuth } from './AuthContext';

// ── Freemium constants (localStorage-based, no auth required) ────────────────
const FREEMIUM_DAILY_LIMIT = 10;
const FREEMIUM_KEY_FLAG = 'truegle_freemium';
const FREEMIUM_KEY_SEARCHES = 'truegle_freemium_searches';
const FREEMIUM_KEY_TOKENS = 'truegle_freemium_tokens';
const FREEMIUM_KEY_DATE = 'truegle_freemium_date';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* quota / SecurityError — ignore */ }
}

function getFreemiumState() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const storedDate = lsGet(FREEMIUM_KEY_DATE);
    if (storedDate !== today) {
      lsSet(FREEMIUM_KEY_DATE, today);
      lsSet(FREEMIUM_KEY_SEARCHES, '0');
      lsSet(FREEMIUM_KEY_TOKENS, String(FREEMIUM_DAILY_LIMIT));
    }
    return {
      active: lsGet(FREEMIUM_KEY_FLAG) === 'true',
      tokens: parseInt(lsGet(FREEMIUM_KEY_TOKENS) || '10', 10),
      searches: parseInt(lsGet(FREEMIUM_KEY_SEARCHES) || '0', 10),
    };
  } catch {
    return { active: false, tokens: FREEMIUM_DAILY_LIMIT, searches: 0 };
  }
}

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

  // Freemium state (zero-auth, localStorage-backed)
  const [freemiumState, setFreemiumState] = useState(() => getFreemiumState());

  const refreshFreemium = useCallback(() => {
    setFreemiumState(getFreemiumState());
  }, []);

  const consumeFreemiumSearch = useCallback(() => {
    const state = getFreemiumState();
    if (!state.active) return { allowed: false, reason: 'not_freemium' };
    if (state.tokens <= 0) return { allowed: false, reason: 'quota_exhausted' };
    const newTokens = state.tokens - 1;
    const newSearches = state.searches + 1;
    lsSet(FREEMIUM_KEY_TOKENS, String(newTokens));
    lsSet(FREEMIUM_KEY_SEARCHES, String(newSearches));
    setFreemiumState({ ...state, tokens: newTokens, searches: newSearches });
    return { allowed: true, tokensRemaining: newTokens };
  }, []);

  const refillFreemiumFromAd = useCallback((amount = 3) => {
    const state = getFreemiumState();
    const newTokens = Math.min(state.tokens + amount, FREEMIUM_DAILY_LIMIT);
    lsSet(FREEMIUM_KEY_TOKENS, String(newTokens));
    setFreemiumState({ ...state, tokens: newTokens });
    return newTokens;
  }, []);

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
   * Returns: { allowed, reason, freeUsesRemaining?, cost?, requiresAd? }
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
   * Start a server-side ad session (call before showing the ad)
   * Returns { success, sessionId }
   */
  const startAdSession = useCallback(async () => {
    if (!isAuthenticated) {
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const response = await tokensAPI.startAdSession();
      return { success: true, sessionId: response.data.sessionId };
    } catch (error) {
      console.error('Failed to start ad session:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to start ad session' };
    }
  }, [isAuthenticated]);

  /**
   * Earn token from watching ad — requires sessionId from startAdSession()
   */
  const earnFromAd = useCallback(async (sessionId) => {
    if (!isAuthenticated) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await tokensAPI.earnFromAd(sessionId);
      const result = response.data.data;

      if (result.success) {
        setBalance(result.newBalance);
      }

      return result;
    } catch (error) {
      console.error('Failed to earn from ad:', error);
      return { success: false, message: error.response?.data?.message || 'Failed to process ad reward' };
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

    // Freemium state (zero-auth)
    freemium: freemiumState,
    freemiumDailyLimit: FREEMIUM_DAILY_LIMIT,

    // Actions
    fetchBalance,
    checkAccess,
    spendToken,
    startAdSession,
    earnFromAd,
    earnFromGame,

    // Freemium actions
    consumeFreemiumSearch,
    refillFreemiumFromAd,
    refreshFreemium,

    // Helpers
    getFreeUsesRemaining,
    requiresToken,
  };

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
};
