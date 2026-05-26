import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useTokens } from './TokenContext';

const SearchModeContext = createContext();

export const SEARCH_MODES = {
  BLUE_PILL: 'blue-pill',
  RED_PILL: 'red-pill',
};

export const useSearchMode = () => {
  const context = useContext(SearchModeContext);
  if (!context) {
    throw new Error('useSearchMode must be used within a SearchModeProvider');
  }
  return context;
};

export const SearchModeProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { checkAccess, isPremium } = useTokens();

  const [mode, setMode] = useState(SEARCH_MODES.BLUE_PILL);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [accessStatus, setAccessStatus] = useState({
    canAccessRedPill: false,
    reason: null,
    freeUsesRemaining: null,
  });

  // Check Red Pill access when auth status changes
  useEffect(() => {
    const checkRedPillAccess = async () => {
      if (!isAuthenticated) {
        setAccessStatus({
          canAccessRedPill: false,
          reason: 'not_authenticated',
          freeUsesRemaining: null,
        });
        // Reset to blue pill if not authenticated
        if (mode === SEARCH_MODES.RED_PILL) {
          setMode(SEARCH_MODES.BLUE_PILL);
        }
        return;
      }

      if (isPremium) {
        setAccessStatus({
          canAccessRedPill: true,
          reason: 'premium',
          freeUsesRemaining: null,
        });
        return;
      }

      const result = await checkAccess('red-pill');
      setAccessStatus({
        canAccessRedPill: result.allowed,
        reason: result.reason,
        freeUsesRemaining: result.freeUsesRemaining,
      });
    };

    checkRedPillAccess();
  }, [isAuthenticated, isPremium, checkAccess, mode]);

  // Toggle between modes
  const toggleMode = useCallback(async () => {
    if (mode === SEARCH_MODES.BLUE_PILL) {
      // Check if can switch to Red Pill
      if (!isAuthenticated) {
        return { success: false, reason: 'not_authenticated' };
      }

      // Check access
      const access = await checkAccess('red-pill');
      if (!access.allowed && access.reason === 'insufficient_tokens') {
        return { success: false, reason: 'insufficient_tokens', requiresGate: true };
      }

      setIsTransitioning(true);
      setTimeout(() => {
        setMode(SEARCH_MODES.RED_PILL);
        setIsTransitioning(false);
      }, 300);

      return { success: true };
    } else {
      // Always allow switching back to Blue Pill
      setIsTransitioning(true);
      setTimeout(() => {
        setMode(SEARCH_MODES.BLUE_PILL);
        setIsTransitioning(false);
      }, 300);

      return { success: true };
    }
  }, [mode, isAuthenticated, checkAccess]);

  // Set mode directly (with validation)
  const setSearchMode = useCallback(async (newMode) => {
    if (newMode === mode) return { success: true };

    if (newMode === SEARCH_MODES.RED_PILL) {
      if (!isAuthenticated) {
        return { success: false, reason: 'not_authenticated' };
      }

      const access = await checkAccess('red-pill');
      if (!access.allowed && access.reason === 'insufficient_tokens') {
        return { success: false, reason: 'insufficient_tokens', requiresGate: true };
      }
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setIsTransitioning(false);
    }, 300);

    return { success: true };
  }, [mode, isAuthenticated, checkAccess]);

  // Get mode-specific styles
  const getModeStyles = useCallback(() => {
    if (mode === SEARCH_MODES.RED_PILL) {
      return {
        primary: 'from-red-500 to-orange-500',
        secondary: 'from-red-600 to-red-800',
        accent: 'text-red-400',
        border: 'border-red-500/30',
        glow: 'shadow-red-500/30',
        background: 'bg-red-900/10',
      };
    }
    return {
      primary: 'from-blue-500 to-purple-500',
      secondary: 'from-blue-600 to-blue-800',
      accent: 'text-blue-400',
      border: 'border-blue-500/30',
      glow: 'shadow-blue-500/30',
      background: 'bg-blue-900/10',
    };
  }, [mode]);

  // Get mode-specific background
  const getBackground = useCallback(() => {
    return mode === SEARCH_MODES.RED_PILL ? 'starfield' : 'particles';
  }, [mode]);

  const value = {
    // State
    mode,
    isRedPill: mode === SEARCH_MODES.RED_PILL,
    isBluePill: mode === SEARCH_MODES.BLUE_PILL,
    isTransitioning,
    accessStatus,

    // Actions
    toggleMode,
    setSearchMode,

    // Helpers
    getModeStyles,
    getBackground,

    // Constants
    MODES: SEARCH_MODES,
  };

  return (
    <SearchModeContext.Provider value={value}>
      {children}
    </SearchModeContext.Provider>
  );
};
