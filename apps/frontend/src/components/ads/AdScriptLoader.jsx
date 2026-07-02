import { useEffect } from 'react';
import { SOCIAL_BAR_SCRIPT_URL } from '../../config/ads';

// Adsterra Smartlink — used as fallback / house-ad destination
export const ADSTERRA_SMARTLINK = 'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';

const SOCIAL_SESSION_KEY = 'truegle_social_fired';

// NOTE: The Adsterra popunder (millionairelucidlytransmitted.com script) is
// intentionally NOT loaded here. Popunders fire on the first user click
// anywhere on the page and open a new tab — Adsterra fills them with
// whatever bids highest, including adult content, with no way to gate by
// user consent or age. Removed to prevent adult content appearing on
// unauthenticated / underage sessions. Revenue from popunders is traded
// for safety. Revisit if Adsterra offers a content-category filter API.

export default function AdScriptLoader() {
  useEffect(() => {
    if (!SOCIAL_BAR_SCRIPT_URL) return;
    if (sessionStorage.getItem(SOCIAL_SESSION_KEY)) return;
    if (window.__truegle_ad_consent === false) return;

    sessionStorage.setItem(SOCIAL_SESSION_KEY, '1');
    const s = document.createElement('script');
    s.src = SOCIAL_BAR_SCRIPT_URL;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return null;
}
