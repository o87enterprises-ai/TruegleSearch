import React from 'react';
import { Globe } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

// Common languages shown in the selector (ISO 639-1 code -> native label).
// Defaults sync to the browser language; users can override here.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
  { code: 'sv', label: 'Svenska' },
  { code: 'uk', label: 'Українська' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
  { code: 'he', label: 'עברית' },
  { code: 'fa', label: 'فارسی' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

/**
 * Compact language picker. Reads/writes settings.language (synced to the
 * browser language by default). Optionally re-runs the current search via
 * onLanguageChange so results refresh in the new language immediately.
 */
const LanguageSelector = ({ onLanguageChange, className = '' }) => {
  const { settings, updateSetting } = useSettings();
  const current = settings.language || 'en';

  // Ensure the current language always appears as an option, even if not curated.
  const options = LANGUAGES.some((l) => l.code === current)
    ? LANGUAGES
    : [{ code: current, label: current.toUpperCase() }, ...LANGUAGES];

  const handleChange = (e) => {
    const code = e.target.value;
    updateSetting('language', code);
    if (onLanguageChange) onLanguageChange(code);
  };

  return (
    <label
      className={`inline-flex items-center gap-1.5 text-white/70 ${className}`}
      title="Search language"
    >
      <Globe size={15} className="text-white/50 shrink-0" />
      <span className="sr-only">Search language</span>
      <select
        value={current}
        onChange={handleChange}
        aria-label="Search language"
        className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-1 pl-2 pr-6 text-xs text-white/90 outline-none focus:border-cyan-400/50 transition-colors cursor-pointer appearance-none"
      >
        {options.map((l) => (
          <option key={l.code} value={l.code} className="bg-[#1a1a2e] text-white">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSelector;
