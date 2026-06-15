/**
 * Ad network configuration.
 *
 * Revenue while AdSense is in review: instant-approval networks (Monetag /
 * Adsterra) run today and stack alongside AdSense later. Everything here is
 * env-driven so you just paste your zone IDs into the deploy env and revenue
 * turns on — no code change. Until IDs are set, all ad components render
 * nothing (no broken/empty slots).
 *
 * To activate, set these in the Cloudflare Pages build env (then redeploy):
 *   VITE_MONETAG_ZONE            -> Monetag "Multitag" zone (site-wide passive: in-page push / vignette)
 *   VITE_MONETAG_REWARDED_ZONE   -> Monetag zone configured as "Rewarded Interstitial"
 *   VITE_ADSTERRA_SOCIALBAR_SRC  -> full src URL of an Adsterra Social Bar invoke script
 *   VITE_ADSTERRA_BANNER_KEY     -> Adsterra 300x250 banner key (optional, for in-SERP display)
 */

const env = import.meta.env;

export const MONETAG_ZONE = env.VITE_MONETAG_ZONE || '';
export const MONETAG_REWARDED_ZONE = env.VITE_MONETAG_REWARDED_ZONE || '';
export const ADSTERRA_SOCIALBAR_SRC = env.VITE_ADSTERRA_SOCIALBAR_SRC || '';
export const ADSTERRA_BANNER_KEY = env.VITE_ADSTERRA_BANNER_KEY || '';

// Master kill-switch. Defaults on, but ads only actually render where an ID is
// present, so leaving this on is safe even before you have IDs.
export const ADS_ENABLED = env.VITE_ADS_ENABLED !== 'false';

// Monetag serves its SDK from this host (used for both rewarded + multitag).
export const MONETAG_SDK_SRC = '//libtl.com/sdk.js';

export const hasRewardedAds = () => ADS_ENABLED && !!MONETAG_REWARDED_ZONE;
export const hasDisplayAds = () => ADS_ENABLED && !!ADSTERRA_BANNER_KEY;
export const hasSiteWideAds = () =>
  ADS_ENABLED && (!!MONETAG_ZONE || !!ADSTERRA_SOCIALBAR_SRC);
