/**
 * Central Adsterra ad configuration — single source of truth for every ad slot.
 *
 * ANTI-ADBLOCK: Adsterra's tags load from third-party domains
 * (highperformanceformat.com / millionairelucidlytransmitted.com) that are on
 * the public ad/tracker blocklists used by Firefox ETP, Brave, and uBlock — so
 * a large share of traffic blocks them and we earn nothing on those views.
 *
 * The fix is first-party serving: request Adsterra's "Anti-AdBlock" feature in
 * the dashboard, then CNAME a NEUTRALLY-NAMED subdomain (NOT containing
 * ads/track/analytics — those get blocked too; e.g. `cdn.truegle.info`) to the
 * domain they give you. Then set the build env vars below to that domain and
 * every slot is served first-party = unblockable.
 *
 *   VITE_AD_DOMAIN       host that serves Adsterra invoke.js
 *                        (default: millionairelucidlytransmitted.com)
 *   VITE_POP_SCRIPT_URL  full URL of the popunder script
 *
 * Until the custom domain is live, these default to Adsterra's direct domains,
 * which work for users without blockers and register real impressions.
 */

export const AD_DOMAIN =
  import.meta.env.VITE_AD_DOMAIN || 'millionairelucidlytransmitted.com';

export const POP_SCRIPT_URL =
  import.meta.env.VITE_POP_SCRIPT_URL ||
  'https://millionairelucidlytransmitted.com/03/50/81/03508109c0353dafe874e4f377262a99.js';

/**
 * Adsterra Smartlink — performance link that auto-matches offers to the visitor.
 * Unlike banner scripts, this is a plain href so Firefox ETP cannot block it.
 * Override with VITE_SMARTLINK_URL if the key changes.
 */
export const SMARTLINK_URL =
  import.meta.env.VITE_SMARTLINK_URL ||
  'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';

/**
 * Adsterra Social Bar (In-Page Push) — zone 30006382.
 * Override with VITE_SOCIAL_BAR_SCRIPT_URL if the key changes.
 */
export const SOCIAL_BAR_SCRIPT_URL =
  import.meta.env.VITE_SOCIAL_BAR_SCRIPT_URL ||
  'https://millionairelucidlytransmitted.com/f3/a9/76/f3a976b8789fcc63ba068a860561783b.js';

/** Build the invoke.js URL for an Adsterra placement key via the active domain. */
export const adInvokeUrl = (key) => `https://${AD_DOMAIN}/${key}/invoke.js`;

/**
 * Adsterra placement keys — truegle.info (site ID 5880564).
 *
 * REACTIVATED 2026-07-21 (per explicit owner decision, informed of the risk):
 * the four non-adult zones below were re-issued fresh by Adsterra and are wired
 * back in ungated. The owner has requested Adsterra disable the account-level
 * adult toggle; at time of reactivation that switch-off was still pending a
 * human agent (an AI agent had only escalated it). Both prior leaks (2026-07-05,
 * 2026-07-20) were account-level, so until Adsterra confirms the toggle is OFF
 * in writing there is a real, accepted risk any zone could serve adult creative.
 * FASTEST ROLLBACK if it recurs: delete the offending line here and redeploy.
 *
 *   banner468x60  — NEW key (was pulled 2026-07-20)
 *   banner320x50  — NEW key (was pulled 2026-07-20)
 *   banner300x250 — NEW key (was pulled 2026-07-20)
 *   nativeBanner  — NEW key (was pulled 2026-07-20)
 *
 * NOTE — Adsterra has no delete function for ad units, ever (confirmed via
 * their own support chat): a zone that goes adult can't be fixed, only
 * abandoned. If a zone starts serving adult creative again, pull its key here
 * and request a fresh zone to replace it.
 *
 * banner728x90/160x300/160x600 are the OLD adult-locked zones — they stay
 * behind the full 5-step adult gate (AdsterraBanner adultGated +
 * AdultConsentGate) on the search page. Never render them ungated — a mobile
 * user was served adult creative from an ungated 728x90 slot on 2026-07-05.
 */
export const ADSTERRA = {
  banner728x90:  { key: 'd5f657ea7d55fc33ea532071957a2857', w: 728, h: 90  },
  banner468x60:  { key: '7e53f17316c72708e8417a8a991171ac', w: 468, h: 60  },
  banner320x50:  { key: '5c0cc5f396ae48cbf68f63ec86024c3f', w: 320, h: 50  },
  banner300x250: { key: '0fca9299f48c601ea125d688c11ff7d2', w: 300, h: 250 },
  banner160x300: { key: 'ffac08ed0f599aa8f389d387aa76001b', w: 160, h: 300 },
  banner160x600: { key: 'c16f5233d71714d3151e160ac5778be2', w: 160, h: 600 },
  nativeBanner:  { key: 'a7a8599f485ec0638131d8f99bc29cb7', native: true, h: 250 },
};

/** Maps a logical slot name to an Adsterra format. */
export const SLOT_FORMAT = {
  leaderboard728x90: 'banner728x90',
  leaderboard:       'banner728x90',
  videoInline:       'banner728x90',
  sidebar:           'banner160x600',
  skyscraper:        'banner160x600',
  mobileBanner:      'banner320x50',
  rectangle:         'banner300x250',
  native:            'nativeBanner',
};

export const pickFormat = (slot, fallback = 'banner728x90') =>
  SLOT_FORMAT[slot] || fallback;
