/**
 * Cloudflare Web Analytics — the only measurement Truegle carries.
 *
 * WHY THIS AND NOTHING ELSE
 * Truegle had no first-party analytics at all, which left a ~100x unexplained
 * gap between Cloudflare's edge request counts and the number of real page
 * views, with no way to tell humans from the AI crawlers we deliberately invite
 * (see public/robots.txt and public/llms.txt). That gap made it impossible to
 * know whether anything we build actually reaches anyone.
 *
 * Cloudflare Web Analytics is the only option that closes it without betraying
 * the point of the project: it is free, sets NO cookies, does no
 * fingerprinting, builds no cross-site profile, and reports only aggregate page
 * views and performance timings. There is no user identifier to leak because
 * none is created.
 *
 * WHAT IT IS NOT
 * It is not ad tech and it is not session replay. It cannot see search queries,
 * because queries never appear in a Truegle URL path we report.
 *
 * INERT BY DEFAULT
 * With no VITE_CF_BEACON_TOKEN set, this function returns immediately and no
 * script is ever requested — dev builds and forks stay completely dark. The
 * beacon also honours Do Not Track and Global Privacy Control, which is
 * stricter than Cloudflare requires: a visitor who has asked not to be measured
 * is not measured, even though the beacon collects nothing personal.
 */

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** True when the visitor has asked, by any standard signal, not to be tracked. */
function optedOut() {
  try {
    return (
      navigator.doNotTrack === '1' ||
      window.doNotTrack === '1' ||
      navigator.msDoNotTrack === '1' ||
      navigator.globalPrivacyControl === true
    );
  } catch {
    return false;
  }
}

export function initAnalytics() {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) return false;          // not configured — stay dark
  if (optedOut()) return false;      // DNT / GPC — respect it
  if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return false;

  try {
    const s = document.createElement('script');
    s.src = BEACON_SRC;
    s.defer = true;
    s.dataset.cfBeacon = JSON.stringify({ token });
    document.head.appendChild(s);
    return true;
  } catch {
    // Analytics must never be able to break the app.
    return false;
  }
}
