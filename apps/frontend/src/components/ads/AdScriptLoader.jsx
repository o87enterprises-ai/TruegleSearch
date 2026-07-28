import { useEffect } from 'react';
import { SMARTLINK_URL } from '../../config/ads';
import { useAdGeo } from '../../context/AdGeoContext';

// Adsterra Smartlink — used as fallback / house-ad destination.
export const ADSTERRA_SMARTLINK = SMARTLINK_URL;

const SOCIAL_SESSION_KEY = 'truegle_social_fired';
const POP_SESSION_KEY = 'truegle_pop_fired';

// Popunder is the highest-CPM Adsterra format but fires an untargeted new tab
// on first click and historically served adult creative when the account-level
// adult toggle was on (two documented leaks). It stays OFF unless explicitly
// enabled via env, so the owner turns it on deliberately once per-GEO zones are
// confirmed clean — flip VITE_ENABLE_POPUNDER=true to serve it.
const POPUNDER_ENABLED = import.meta.env.VITE_ENABLE_POPUNDER === 'true';

function injectScript(url) {
  if (!url) return;
  const s = document.createElement('script');
  s.src = url;
  s.async = true;
  document.body.appendChild(s);
}

// Loads the geo-targeted, highest-CPM script formats (Social Bar / in-page
// push, and optionally popunder) for the visitor's country of origin. Zones
// come from GeoAdService via AdGeoContext; both are gated on ad consent and
// fire at most once per session.
export default function AdScriptLoader() {
  const { zones } = useAdGeo();

  useEffect(() => {
    if (window.__truegle_ad_consent === false) return;

    if (zones?.socialBar && !sessionStorage.getItem(SOCIAL_SESSION_KEY)) {
      sessionStorage.setItem(SOCIAL_SESSION_KEY, '1');
      injectScript(zones.socialBar);
    }

    if (POPUNDER_ENABLED && zones?.popunder && !sessionStorage.getItem(POP_SESSION_KEY)) {
      sessionStorage.setItem(POP_SESSION_KEY, '1');
      injectScript(zones.popunder);
    }
  }, [zones]);

  return null;
}
