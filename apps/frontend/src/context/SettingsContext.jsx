import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SettingsContext = createContext();

// Derive the user's preferred language (ISO 639-1) from the browser.
export const detectBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return 'en';
  const raw = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const lang = raw.toLowerCase().slice(0, 2).replace(/[^a-z]/g, '');
  return /^[a-z]{2}$/.test(lang) ? lang : 'en';
};

// Derive the user's region/country (ISO 3166-1 alpha-2) from the browser locale, if present.
export const detectBrowserCountry = () => {
  if (typeof navigator === 'undefined') return '';
  const raw = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  const parts = raw.split('-');
  const country = parts[1] ? parts[1].toUpperCase().replace(/[^A-Z]/g, '') : '';
  return /^[A-Z]{2}$/.test(country) ? country : '';
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  // Disabling Safe Search is gated behind a verified sign-in — used as a
  // lightweight signal to keep the "off" mode out of an anonymous/throwaway
  // session's reach. OAuth is gone; every account now proves control of its
  // email inbox via the passwordless code sign-in, so isAuthenticated alone
  // carries the same "real, verified person" signal googleVerified used to.
  const canDisableSafeSearch = isAuthenticated;

  const [settings, setSettings] = useState({
    safeSearch: 'safe', // 'safe' | 'blur' | 'off'
    adPersonalization: true, // Default to ON as requested
    cookiePreference: 'all', // 'all', 'necessary', 'none'
    dataCollection: false,
    saveHistory: true, // persist recent searches in localStorage (off = no search history stored)
    defaultFilters: 'all',
    resultsPerPage: 10,
    language: detectBrowserLanguage(), // engine language, synced to browser by default
    country: detectBrowserCountry(), // region hint for result localization
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

  // If Safe Search is somehow 'off' (stale localStorage, logout, expired
  // session) without Google verification, snap it back to 'safe'.
  useEffect(() => {
    if (authLoading) return;
    if (settings.safeSearch === 'off' && !canDisableSafeSearch) {
      setSettings((prev) => ({ ...prev, safeSearch: 'safe' }));
    }
  }, [authLoading, canDisableSafeSearch, settings.safeSearch]);

  const updateSetting = (key, value) => {
    if (key === 'safeSearch' && value === 'off' && !canDisableSafeSearch) {
      window.dispatchEvent(new CustomEvent('truegle:safesearch-locked'));
      return;
    }
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const value = {
    settings,
    updateSetting,
    canDisableSafeSearch,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
