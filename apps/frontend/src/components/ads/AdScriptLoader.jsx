import { useEffect } from 'react';

// Adsterra Smartlink — used as fallback / house-ad destination
export const ADSTERRA_SMARTLINK = 'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';

const SESSION_KEY = 'truegle_pop_fired';

// Adsterra Popunder anti-adblock script. Loaded DIRECTLY client-side from the
// Adsterra delivery domain — the previous /pop proxy fetched it server-side from
// Cloudflare's edge, so Adsterra saw a datacenter IP, returned an empty script,
// and never registered a popunder. The tag must run in the visitor's browser.
const POPUNDER_SCRIPT = 'https://millionairelucidlytransmitted.com/03/50/81/03508109c0353dafe874e4f377262a99.js';

function loadPopunder() {
  // Fire once per browser session only
  if (sessionStorage.getItem(SESSION_KEY)) return;
  sessionStorage.setItem(SESSION_KEY, '1');

  const s = document.createElement('script');
  s.src = POPUNDER_SCRIPT;
  s.async = true;
  document.body.appendChild(s);
}

export default function AdScriptLoader() {
  useEffect(() => {
    // Ads load by default (Truegle is ad-supported). `window.__truegle_ad_consent`
    // is pre-set to true at app init; only an explicit opt-out flips it to false.
    if (window.__truegle_ad_consent !== false) {
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
