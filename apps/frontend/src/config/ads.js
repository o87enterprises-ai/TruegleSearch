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
 * PULLED 2026-07-20: banner468x60/banner320x50/banner300x250/nativeBanner were
 * restored 2026-07-19 as "confirmed non-adult" — but a user was served an
 * explicit adult creative from one of them ungated, on a completely benign
 * neutral-mode search, within 24 hours of restoring them. Per the standing
 * policy below, they're pulled again immediately rather than guessing which
 * one specifically went bad — do NOT restore any of the four without a fresh
 * zone request from Adsterra AND a period of monitored, verified-clean serving.
 *
 * NOTE — Adsterra has no delete function for ad units, ever (confirmed via
 * their own support chat): a zone that goes adult can't be fixed, only
 * abandoned. If a restored zone starts serving adult creative again, pull
 * the key here (don't bother hunting for a dashboard toggle — there isn't
 * one) and request a fresh zone to replace it.
 *
 * banner728x90/160x300/160x600 remain the OLD adult-locked zones — keep them
 * behind the full 5-step adult gate (AdsterraBanner adultGated +
 * AdultConsentGate). Never render them ungated — a mobile user was served an
 * adult creative from an ungated 728x90 slot on 2026-07-05.
 */
export const ADSTERRA = {
  banner728x90:  { key: 'd5f657ea7d55fc33ea532071957a2857', w: 728, h: 90  },
  banner160x300: { key: 'ffac08ed0f599aa8f389d387aa76001b', w: 160, h: 300 },
  banner160x600: { key: 'c16f5233d71714d3151e160ac5778be2', w: 160, h: 600 },
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
