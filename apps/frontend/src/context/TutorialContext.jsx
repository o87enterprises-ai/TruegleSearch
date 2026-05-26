import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const TutorialContext = createContext();

const STORAGE_KEY = 'truegle_tutorials';

export const useTutorials = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorials must be used within a TutorialProvider');
  }
  return context;
};

export const TutorialProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {
        dismissed: {},
        neverShowAgain: false,
        lastSeen: null,
      };
    } catch {
      return {
        dismissed: {},
        neverShowAgain: false,
        lastSeen: null,
      };
    }
  });

  const [activeTutorial, setActiveTutorial] = useState(null);
  const [tourActive, setTourActive] = useState(false);

  // Persist preferences to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  /**
   * Check if a specific tutorial should be shown
   */
  const shouldShowTutorial = useCallback((tutorialId) => {
    if (preferences.neverShowAgain) return false;
    if (preferences.dismissed[tutorialId]) return false;
    return true;
  }, [preferences]);

  /**
   * Dismiss a tutorial temporarily (will show again next session)
   */
  const dismissTutorial = useCallback((tutorialId) => {
    setActiveTutorial(null);
  }, []);

  /**
   * Permanently dismiss a tutorial
   */
  const dismissTutorialPermanently = useCallback((tutorialId) => {
    setPreferences(prev => ({
      ...prev,
      dismissed: {
        ...prev.dismissed,
        [tutorialId]: true,
      },
    }));
    setActiveTutorial(null);
  }, []);

  /**
   * Show a specific tutorial
   */
  const showTutorial = useCallback((tutorialId) => {
    if (shouldShowTutorial(tutorialId)) {
      setActiveTutorial(tutorialId);
    }
  }, [shouldShowTutorial]);

  /**
   * Start a guided tour
   */
  const startTour = useCallback((pageId) => {
    setTourActive(true);
    // The page component will handle showing tutorials in sequence
  }, []);

  /**
   * End the guided tour
   */
  const endTour = useCallback(() => {
    setTourActive(false);
    setActiveTutorial(null);
  }, []);

  /**
   * Reset all tutorial preferences
   */
  const resetTutorials = useCallback(() => {
    setPreferences({
      dismissed: {},
      neverShowAgain: false,
      lastSeen: null,
    });
  }, []);

  /**
   * Set global "never show tutorials" preference
   */
  const setNeverShowAgain = useCallback((value) => {
    setPreferences(prev => ({
      ...prev,
      neverShowAgain: value,
    }));
  }, []);

  /**
   * Check if this is a first-time visitor (no tutorials seen)
   */
  const isFirstTimeVisitor = useCallback(() => {
    return Object.keys(preferences.dismissed).length === 0 && !preferences.lastSeen;
  }, [preferences]);

  /**
   * Mark that tutorials have been seen
   */
  const markSeen = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      lastSeen: new Date().toISOString(),
    }));
  }, []);

  const value = {
    // State
    preferences,
    activeTutorial,
    tourActive,

    // Checks
    shouldShowTutorial,
    isFirstTimeVisitor,

    // Actions
    showTutorial,
    dismissTutorial,
    dismissTutorialPermanently,
    startTour,
    endTour,
    resetTutorials,
    setNeverShowAgain,
    markSeen,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};
