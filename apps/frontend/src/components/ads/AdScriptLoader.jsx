import { useEffect } from 'react';
import { POP_SCRIPT_URL, SOCIAL_BAR_SCRIPT_URL } from '../../config/ads';

// Adsterra Smartlink — used as fallback / house-ad destination
export const ADSTERRA_SMARTLINK = 'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';

const POP_SESSION_KEY = 'truegle_pop_fired';
const SOCIAL_SESSION_KEY = 'truegle_social_fired';

function loadScript(url) {
  const s = document.createElement('script');
  s.src = url;
  s.async = true;
  document.body.appendChild(s);
}

function loadPopunder() {
  // Fire once per browser session only
  if (sessionStorage.getItem(POP_SESSION_KEY)) return;
  sessionStorage.setItem(POP_SESSION_KEY, '1');
  loadScript(POP_SCRIPT_URL);
}

function loadSocialBar() {
  if (!SOCIAL_BAR_SCRIPT_URL) return;
  if (sessionStorage.getItem(SOCIAL_SESSION_KEY)) return;
  sessionStorage.setItem(SOCIAL_SESSION_KEY, '1');
  loadScript(SOCIAL_BAR_SCRIPT_URL);
}

export default function AdScriptLoader() {
  useEffect(() => {
    // Ads load by default (Truegle is ad-supported). `window.__truegle_ad_consent`
    // is pre-set to true at app init; only an explicit opt-out flips it to false.
    if (window.__truegle_ad_consent !== false) {
      loadPopunder();
      loadSocialBar();
      return;
    }

    const onConsent = (e) => {
      if (e.detail?.ads) {
        loadPopunder();
        loadSocialBar();
      }
    };
    window.addEventListener('truegle:consent', onConsent);
    return () => window.removeEventListener('truegle:consent', onConsent);
  }, []);

  return null;
}
