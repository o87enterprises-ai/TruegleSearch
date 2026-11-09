import { useEffect, useState } from 'react';

// THE FEED/TUBE LANGUAGE SETTING (owner, 2026-11-09).
//
//   'local'  (default) — only posts in this device's language
//   'global'           — everything, this device's language first
//
// "This device's language" is the browser's own language setting (e.g. en-US ->
// en). Nothing is located: no IP lookup, no GPS, nothing sent but the two-letter
// code. The choice is remembered in this browser only. The server does the
// filtering (backend services/ContentLang.js).
const KEY = 'truegle_lang_mode';
const EVENT = 'truegle:langmode';

const primary = (raw) => {
  const l = String(raw || '').toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(l) ? l : '';
};

/**
 * "Your language", e.g. 'en'. The site already has ONE language setting: the
 * engine language (Settings / the globe dropdown on Tube and Search), which
 * starts at the browser's language and can be changed there. Local uses that,
 * so there are never two different answers to "what is my language".
 * Pass the live settings value when you have it (React state is never stale);
 * otherwise the saved settings, then the browser. Falls back to 'en'.
 */
export function deviceLang(settingsLanguage) {
  const fromSettings = primary(settingsLanguage);
  if (fromSettings) return fromSettings;
  try {
    const saved = primary(JSON.parse(localStorage.getItem('truegle_settings') || '{}')?.language);
    if (saved) return saved;
  } catch { /* no storage */ }
  try {
    return primary((navigator.languages && navigator.languages[0]) || navigator.language) || 'en';
  } catch { return 'en'; }
}

export function getLangMode() {
  try { return localStorage.getItem(KEY) === 'global' ? 'global' : 'local'; } catch { return 'local'; }
}

export function setLangMode(mode) {
  const m = mode === 'global' ? 'global' : 'local';
  try { localStorage.setItem(KEY, m); } catch { /* private mode: lasts this page */ }
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: m })); } catch { /* no window */ }
}

/** [mode, setMode] kept in step across every component on the page. */
export function useLangMode() {
  const [mode, setMode] = useState(getLangMode);
  useEffect(() => {
    const on = (e) => setMode(e?.detail === 'global' ? 'global' : 'local');
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [mode, setLangMode];
}

/** What a request carries: { lang, langMode }. */
export const langParams = () => ({ lang: deviceLang(), langMode: getLangMode() });
