// THE POST-APOCALYPTIC / PIONEER GUIDE — how somebody gets it, in one place.
//
// The guide is "The Survivor's Encyclopedia" (components/Encyclopedia.jsx). It is free
// two ways, and neither costs anything else (owner, 2026-11-11):
//   1. PLAY Trail, the 404 easter-egg game, with no sign-in. Finishing any run unlocks
//      it (utils/vault.js).
//   2. SIGN IN with a real account. That unlocks it on this device straight away.
//
// Unlocking is local on purpose (localStorage, see vault.js): nothing about who opened
// a survival guide is sent anywhere. A GUEST session ("Search anonymously") is not an
// account and does not unlock it — it is the no-sign-in path with extra steps.

export const GUIDE_NAME = 'The Survivor’s Encyclopedia';
/** Any address no page owns lands on the 404 page, which is where Trail lives. */
export const TRAIL_PATH = '/this-does-not-exist';
export const PLAY_URL = `${TRAIL_PATH}?play=1`;
/** The guide's own address — a real page, shareable, and readable offline once unlocked. */
export const GUIDE_PATH = '/guide';
export const GUIDE_URL = GUIDE_PATH;
/** Same key the install popup used, so every script that silences it silences this. */
export const OFFER_DISMISS_KEY = 'truegle_install_dismissed_at';
export const OFFER_REMIND_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

/** Running as an installed app: the Android app, or a PWA added to the home screen. */
export function isInstalledApp() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch { return false; }
}

/** A signed-in person, not a guest session. */
export function isRealAccount(user, token) {
  if (!user || typeof user !== 'object') return false;
  if (user.isGuest || user.role === 'guest') return false;
  if (String(user.id || '').startsWith('guest_')) return false;
  if (String(token || '').startsWith('guest_')) return false;
  return true;
}

/**
 * Does this browser hold the guide? A real account unlocks it (and that is stored, so it
 * stays unlocked offline and after sign-out); an earlier unlock never expires.
 */
export function guideUnlocked(user, token, vaultFound, findVault) {
  if (vaultFound()) return true;
  // Truegle installed on the device (the Android app, or added to the home screen): it is already
  // on their device, so nobody is made to sign in for the guide (owner, 2026-11-19).
  if (isInstalledApp()) { findVault('guide'); return true; }
  if (isRealAccount(user, token)) { findVault('guide'); return true; }
  return false;
}

/** What the 404 page was asked to open: ?play=1 starts Trail, ?guide=1 opens the guide. */
export function trailIntent(search) {
  const p = new URLSearchParams(String(search || ''));
  return { play: p.get('play') === '1', guide: p.get('guide') === '1' };
}
