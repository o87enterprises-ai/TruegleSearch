/**
 * Ad network script loaders (Monetag + Adsterra).
 *
 * All loaders are idempotent (inject each script once) and no-op when the
 * relevant zone/key isn't configured, so calling them is always safe.
 */
import {
  MONETAG_ZONE,
  MONETAG_REWARDED_ZONE,
  MONETAG_SDK_SRC,
  ADSTERRA_SOCIALBAR_SRC,
  ADS_ENABLED,
  hasRewardedAds,
} from '../config/ads';

const injected = new Set();

function injectScript(id, attrs) {
  if (injected.has(id) || document.getElementById(id)) return;
  injected.add(id);
  const s = document.createElement('script');
  s.id = id;
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') s.text = v;
    else s.setAttribute(k, v);
  });
  document.head.appendChild(s);
}

/**
 * Site-wide passive monetization — loaded once on app mount.
 * Monetag Multitag (in-page push / vignette) + Adsterra Social Bar.
 * These need zero layout work and are the easiest steady revenue.
 */
export function loadSiteWideAds() {
  if (!ADS_ENABLED) return;

  if (MONETAG_ZONE) {
    injectScript('monetag-multitag', {
      src: MONETAG_SDK_SRC,
      'data-zone': MONETAG_ZONE,
      async: 'true',
    });
  }

  if (ADSTERRA_SOCIALBAR_SRC) {
    injectScript('adsterra-socialbar', {
      src: ADSTERRA_SOCIALBAR_SRC,
      async: 'true',
      'data-cfasync': 'false',
    });
  }
}

let rewardedReady = null;

/**
 * Lazy-load the Monetag rewarded SDK and resolve with the show-function.
 * The SDK exposes a global `show_<zone>()` that returns a promise resolving
 * when the user finishes watching.
 */
function ensureRewardedSdk() {
  if (!hasRewardedAds()) return Promise.reject(new Error('rewarded ads not configured'));
  if (rewardedReady) return rewardedReady;

  const fnName = `show_${MONETAG_REWARDED_ZONE}`;
  rewardedReady = new Promise((resolve, reject) => {
    if (typeof window[fnName] === 'function') {
      resolve(window[fnName]);
      return;
    }
    injectScript('monetag-rewarded', {
      src: MONETAG_SDK_SRC,
      'data-zone': MONETAG_REWARDED_ZONE,
      'data-sdk': fnName,
    });
    // Poll briefly for the SDK to register its global function.
    let tries = 0;
    const timer = setInterval(() => {
      if (typeof window[fnName] === 'function') {
        clearInterval(timer);
        resolve(window[fnName]);
      } else if (++tries > 60) {
        // ~9s
        clearInterval(timer);
        reject(new Error('rewarded SDK failed to load'));
      }
    }, 150);
  });
  return rewardedReady;
}

/**
 * Show a rewarded ad. Resolves true if the user completed it (grant reward),
 * false/throws otherwise. Callers should grant the reward only on true.
 */
export async function showRewardedAd() {
  const show = await ensureRewardedSdk();
  // Monetag's show_<zone>() resolves when the ad is watched to completion.
  await show();
  return true;
}
