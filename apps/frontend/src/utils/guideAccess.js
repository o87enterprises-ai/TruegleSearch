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
export const GUIDE_URL = `${TRAIL_PATH}?guide=1`;
/** Same key the install popup used, so every script that silences it silences this. */
export const OFFER_DISMISS_KEY = 'truegle_install_dismissed_at';
export const OFFER_REMIND_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

/** A signed-in person, not a guest session. */
export function isRealAccount(user, token) {
  if (!user || typeof user !== 'object') return false;
  if (user.isGuest || user.role === 'guest') return false;
  if (String(user.id || '').startsWith('guest_')) return false;
  if (String(token || '').startsWith('guest_')) return false;
  return true;
}

/** What the 404 page was asked to open: ?play=1 starts Trail, ?guide=1 opens the guide. */
export function trailIntent(search) {
  const p = new URLSearchParams(String(search || ''));
  return { play: p.get('play') === '1', guide: p.get('guide') === '1' };
}
