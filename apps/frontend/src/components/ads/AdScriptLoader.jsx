import { useEffect } from 'react';

// Adsterra Smartlink — used as fallback / house-ad destination
export const ADSTERRA_SMARTLINK = 'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';

const SESSION_KEY = 'truegle_pop_fired';

function loadPopunder() {
  // Fire once per browser session only
  if (sessionStorage.getItem(SESSION_KEY)) return;
  sessionStorage.setItem(SESSION_KEY, '1');

  const s = document.createElement('script');
  // Load through our first-party proxy (/pop) — Cloudflare Pages Function
  // that fetches from millionairelucidlytransmitted.com server-side, making
  // the script appear first-party and bypassing Tracking Prevention storage blocks.
  s.src = '/pop';
  s.async = true;
  document.body.appendChild(s);
}

export default function AdScriptLoader() {
  useEffect(() => {
    // Gate on cookie consent — listen for truegle:consent CustomEvent
    // fired by CookieConsent.jsx, or check the window flag if already set.
    if (window.__truegle_ad_consent) {
      loadPopunder();
      return;
    }

    const onConsent = (e) => {
      if (e.detail?.ads) loadPopunder();
    };
    window.addEventListener('truegle:consent', onConsent);
    return () => window.removeEventListener('truegle:consent', onConsent);
  }, []);

  return null;
}
