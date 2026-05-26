import { useCallback, useEffect, useState } from 'react';
import { useTutorials } from '../context/TutorialContext';
import { getTutorialsForPage, getTutorialById, getFirstTutorialForPage } from '../config/tutorialContent';

/**
 * Hook for managing tutorials on a specific page
 */
export const useTutorial = (pageId) => {
  const {
    shouldShowTutorial,
    showTutorial,
    dismissTutorial,
    dismissTutorialPermanently,
    activeTutorial,
    tourActive,
    isFirstTimeVisitor,
    markSeen,
  } = useTutorials();

  const [currentTutorial, setCurrentTutorial] = useState(null);

  // Get tutorials for this page
  const pageTutorials = getTutorialsForPage(pageId);

  // Show first tutorial for first-time visitors
  useEffect(() => {
    if (isFirstTimeVisitor() && pageId === 'landing') {
      const firstTutorial = getFirstTutorialForPage(pageId);
      if (firstTutorial && shouldShowTutorial(firstTutorial.id)) {
        setCurrentTutorial(firstTutorial);
        markSeen();
      }
    }
  }, [pageId, isFirstTimeVisitor, shouldShowTutorial, markSeen]);

  // Update current tutorial when activeTutorial changes
  useEffect(() => {
    if (activeTutorial) {
      const tutorial = getTutorialById(activeTutorial);
      setCurrentTutorial(tutorial);
    }
  }, [activeTutorial]);

  /**
   * Show a specific tutorial by key
   */
  const show = useCallback((tutorialKey) => {
    const tutorial = pageTutorials[tutorialKey];
    if (tutorial && shouldShowTutorial(tutorial.id)) {
      setCurrentTutorial(tutorial);
      showTutorial(tutorial.id);
    }
  }, [pageTutorials, shouldShowTutorial, showTutorial]);

  /**
   * Dismiss the current tutorial
   */
  const dismiss = useCallback(() => {
    if (currentTutorial) {
      dismissTutorial(currentTutorial.id);
      setCurrentTutorial(null);
    }
  }, [currentTutorial, dismissTutorial]);

  /**
   * Permanently dismiss the current tutorial
   */
  const dismissPermanently = useCallback(() => {
    if (currentTutorial) {
      dismissTutorialPermanently(currentTutorial.id);
      setCurrentTutorial(null);
    }
  }, [currentTutorial, dismissTutorialPermanently]);

  /**
   * Check if a specific tutorial should be shown
   */
  const shouldShow = useCallback((tutorialKey) => {
    const tutorial = pageTutorials[tutorialKey];
    return tutorial ? shouldShowTutorial(tutorial.id) : false;
  }, [pageTutorials, shouldShowTutorial]);

  return {
    // Current tutorial being shown
    currentTutorial,

    // All tutorials for this page
    pageTutorials,

    // Actions
    show,
    dismiss,
    dismissPermanently,

    // Checks
    shouldShow,

    // State
    tourActive,
  };
};

// Re-export useTutorials from context for convenience
export { useTutorials } from '../context/TutorialContext';
