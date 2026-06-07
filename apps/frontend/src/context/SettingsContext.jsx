import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    safeSearch: 'safe', // 'safe' | 'blur' | 'off'
    adPersonalization: true, // Default to ON as requested
    cookiePreference: 'all', // 'all', 'necessary', 'none'
    dataCollection: false,
    vpnAutoConnect: false,
    defaultFilters: 'all',
    resultsPerPage: 10,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('truegle_settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        // Migrate legacy boolean safeSearch -> tri-state string
        let migratedSafeSearch = parsedSettings.safeSearch;
        if (typeof migratedSafeSearch === 'boolean') {
          migratedSafeSearch = migratedSafeSearch ? 'safe' : 'off';
        }
        if (!['safe', 'blur', 'off'].includes(migratedSafeSearch)) {
          migratedSafeSearch = 'safe';
        }
        setSettings((prev) => ({
          ...prev,
          ...parsedSettings,
          safeSearch: migratedSafeSearch,
          // Ensure adPersonalization is true by default if not set
          adPersonalization:
            parsedSettings.adPersonalization !== undefined
              ? parsedSettings.adPersonalization
              : true,
        }));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('truegle_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const value = {
    settings,
    updateSetting,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
