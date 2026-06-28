import { useEffect } from 'react';

const SCRIPTS = [
  // Adsterra Popunder
  'https://pl30106879.effectivecpmnetwork.com/03/50/81/03508109c0353dafe874e4f377262a99.js',
  // Adsterra Social Bar
  'https://pl30106881.effectivecpmnetwork.com/f3/a9/76/f3a976b8789fcc63ba068a860561783b.js',
];

/**
 * Injects Adsterra page-level scripts (popunder + social bar) once per page
 * load. Adsterra impressions count at the script/HTTP level — no cookies are
 * required to earn CPM revenue. The cookies Adsterra sets are their own
 * third-party cookies (effectivecpmnetwork.com), not Truegle-set cookies.
 * Truegle itself sets zero cookies; all user preferences live in localStorage.
 */
let injected = false;

export default function AdScriptLoader() {
  useEffect(() => {
    if (injected) return;
    injected = true;
    SCRIPTS.forEach((src) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.body.appendChild(s);
    });
  }, []);

  return null;
}
