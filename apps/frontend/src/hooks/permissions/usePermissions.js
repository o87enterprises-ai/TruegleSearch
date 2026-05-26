import { useState, useEffect } from 'react';
import BROWSER_API from '../api/browserSettings';

const PERMISSIONS_KEY = 'truegle_permissions';
const PERMISSIONS_DISMISSED_KEY = 'truegle_permissions_dismissed';

const defaultPermissions = {
  searchEngine: false,
  homepage: false,
  aiAssistant: false
};

export const usePermissions = () => {
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [hasSeenModal, setHasSeenModal] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(null);
  const [isFirstSearch, setIsFirstSearch] = useState(false);

  useEffect(() => {
    const savedPermissions = localStorage.getItem(PERMISSIONS_KEY);
    const savedDismissed = localStorage.getItem(PERMISSIONS_DISMISSED_KEY);
    const firstSearch = localStorage.getItem('truegle_first_search');

    if (savedPermissions) {
      setPermissions(JSON.parse(savedPermissions));
    }

    if (savedDismissed) {
      setDismissedAt(parseInt(savedDismissed));
      const daysSinceDismissed = (Date.now() - parseInt(savedDismissed)) / (1000 * 60 * 60 * 24);
      setHasSeenModal(daysSinceDismissed < 30);
    }

    setIsFirstSearch(!firstSearch);
  }, []);

  const savePermissions = (newPermissions) => {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(newPermissions));
    setPermissions(newPermissions);
  };

  const togglePermission = (permission) => {
    const newPermissions = {
      ...permissions,
      [permission]: !permissions[permission]
    };
    savePermissions(newPermissions);
  };

  const acceptPermissions = async (enabledPermissions) => {
    const settings = {};
    if (enabledPermissions.searchEngine) settings.searchEngine = true;
    if (enabledPermissions.homepage) settings.homepage = true;
    if (enabledPermissions.aiAssistant) settings.aiAssistant = true;

    const result = await BROWSER_API.setAll(settings);

    if (result.success) {
      savePermissions(enabledPermissions);
      markModalSeen();
    }

    return result;
  };

  const dismissModal = () => {
    const now = Date.now();
    localStorage.setItem(PERMISSIONS_DISMISSED_KEY, now.toString());
    setDismissedAt(now);
    setHasSeenModal(true);
  };

  const markModalSeen = () => {
    localStorage.setItem(PERMISSIONS_DISMISSED_KEY, Date.now().toString());
    setHasSeenModal(true);
  };

  const shouldShowModal = () => {
    if (hasSeenModal) return false;
    if (!isFirstSearch) return false;

    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed >= 30;
    }

    return true;
  };

  const recordFirstSearch = () => {
    localStorage.setItem('truegle_first_search', Date.now().toString());
    setIsFirstSearch(false);
  };

  return {
    permissions,
    togglePermission,
    acceptPermissions,
    dismissModal,
    shouldShowModal,
    recordFirstSearch,
    hasSeenModal,
    browserInfo: BROWSER_API.getBrowserInfo()
  };
};

export default usePermissions;