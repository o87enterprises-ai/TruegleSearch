import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';

const SCRIPTS = [
  // Adsterra Popunder
  'https://pl30106879.effectivecpmnetwork.com/03/50/81/03508109c0353dafe874e4f377262a99.js',
  // Adsterra Social Bar
  'https://pl30106881.effectivecpmnetwork.com/f3/a9/76/f3a976b8789fcc63ba068a860561783b.js',
];

/**
 * Injects Adsterra page-level scripts (popunder + social bar) only when the
 * user's cookie preference allows third-party scripts. Preference 'none'
 * skips all script injection so no third-party cookies are set.
 *
 * Mount once at the app root (App.jsx). Scripts are injected once per
 * page load; re-renders are no-ops after the first injection.
 */
let injected = false;

export default function AdScriptLoader() {
  const { settings } = useSettings();

  useEffect(() => {
    if (injected) return;
    if (settings.cookiePreference === 'none') return;

    injected = true;
    SCRIPTS.forEach((src) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.body.appendChild(s);
    });
  }, [settings.cookiePreference]);

  return null;
}
