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
 * Get the script tag from Adsterra dashboard → copy the src URL → set
 * VITE_SOCIAL_BAR_SCRIPT_URL in Cloudflare Pages env vars → redeploy.
 * Leave unset to keep the slot disabled.
 */
export const SOCIAL_BAR_SCRIPT_URL =
  import.meta.env.VITE_SOCIAL_BAR_SCRIPT_URL || null;

/** Build the invoke.js URL for an Adsterra placement key via the active domain. */
export const adInvokeUrl = (key) => `https://${AD_DOMAIN}/${key}/invoke.js`;

/**
 * Adsterra placement keys — truegle.info (site ID 5880564).
 *
 * SMALL ZONES DEACTIVATED 2026-07-02:
 * Adsterra permanently locks the adult-content toggle ON once a zone is
 * activated — there is no way to disable it. Keys for small formats have been
 * removed so Adsterra marks those zones inactive after 14 days of zero
 * impressions. Once the user creates new zones (adult OFF) in the dashboard,
 * add the new keys back here.
 *
 * Pending replacement (removed keys, zones going inactive):
 *   banner320x50  — was 5c0cc5f396ae48cbf68f63ec86024c3f
 *   banner300x250 — was 0fca9299f48c601ea125d688c11ff7d2
 *   banner468x60  — was 7e53f17316c72708e8417a8a991171ac
 *   nativeBanner  — was a7a8599f485ec0638131d8f99bc29cb7
 *
 * Active zones (all adult-gated at every call site):
 */
export const ADSTERRA = {
  banner728x90:  { key: 'd5f657ea7d55fc33ea532071957a2857', w: 728, h: 90  },
  banner160x300: { key: 'ffac08ed0f599aa8f389d387aa76001b', w: 160, h: 300 },
  banner160x600: { key: 'c16f5233d71714d3151e160ac5778be2', w: 160, h: 600 },
};

/**
 * Maps a logical slot name to the closest active Adsterra format.
 * Small-format aliases removed pending zone replacement.
 */
export const SLOT_FORMAT = {
  leaderboard728x90: 'banner728x90',
  leaderboard:       'banner728x90',
  videoInline:       'banner728x90',
  sidebar:           'banner160x600',
  skyscraper:        'banner160x600',
};

export const pickFormat = (slot, fallback = 'banner728x90') =>
  SLOT_FORMAT[slot] || fallback;
