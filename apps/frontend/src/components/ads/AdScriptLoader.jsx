import { useEffect } from 'react';
import { SMARTLINK_URL } from '../../config/ads';
import { useAdGeo } from '../../context/AdGeoContext';

// Adsterra Smartlink — used as fallback / house-ad destination.
export const ADSTERRA_SMARTLINK = SMARTLINK_URL;

const SOCIAL_SESSION_KEY = 'truegle_social_fired';
const POP_SESSION_KEY = 'truegle_pop_fired';

// BOTH the Social Bar (in-page push) and the Popunder are DISABLED by default.
//
// These two aggressive script formats were serving scareware / "your device has
// a virus" scam creatives (fake McAfee scan, TotalAV new-tab redirect, a
// full-screen glitch overlay) that read as a malware takeover — a complete
// brand-safety failure on the landing and chat pages. They only load if the
// owner *explicitly* opts in via env, after confirming the per-GEO zones serve
// clean creative:
//   VITE_ENABLE_SOCIAL_BAR=true   — in-page push / social bar
//   VITE_ENABLE_POPUNDER=true     — popunder (untargeted new tab; also risky)
// With both unset (the default) this component injects nothing and the site
// serves only the controlled, clearly-labeled in-content "Sponsored" banners.
const SOCIAL_BAR_ENABLED = import.meta.env.VITE_ENABLE_SOCIAL_BAR === 'true';
const POPUNDER_ENABLED = import.meta.env.VITE_ENABLE_POPUNDER === 'true';

function injectScript(url) {
  if (!url) return;
  const s = document.createElement('script');
  s.src = url;
  s.async = true;
  document.body.appendChild(s);
}

export default function AdScriptLoader() {
  const { zones } = useAdGeo();

  useEffect(() => {
    if (window.__truegle_ad_consent === false) return;

    if (SOCIAL_BAR_ENABLED && zones?.socialBar && !sessionStorage.getItem(SOCIAL_SESSION_KEY)) {
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
