/**
 * Multi-network ad registry — scaffolding to A/B test additional ad networks
 * alongside Adsterra.
 *
 * ⚠️ NOT WIRED INTO RENDERING. Per the plan this only *prepares* the configs —
 * nothing here is imported by a rendering path yet, so no new ads reach
 * production. Wiring a network in is a deliberate, separate step once its codes
 * are live and it has been enabled below.
 *
 * ⚠️ STATUS: every added network is `pending-signup`. Publisher accounts CANNOT
 * be created automatically — each requires the site owner's identity, email
 * confirmation, and (for most) KYC + accepting the network's terms, and the
 * real ad codes are only issued after a human approves the account. So each
 * network's keys read from env vars that are EMPTY until you paste in the codes
 * the network gives you. See docs/AD-NETWORK-SIGNUP.md for the per-network
 * steps and the exact env vars to fill.
 *
 * A network only goes live when BOTH are true:
 *   1. its VITE_<NET>_ENABLED env var is 'true', and
 *   2. the specific zone key/URL for the format is non-empty.
 * Until then `isNetworkReady()` / `readyNetworks()` return it as not ready, so a
 * half-configured network can never render a blank or broken slot.
 */

import { ADSTERRA } from './ads';

const env = import.meta.env;
const on = (v) => v === 'true';

export const AD_NETWORKS = {
  // Adsterra is the live control every other network is A/B tested against.
  // Its real keys live in config/ads.js (single source of truth) — mirrored
  // here only so an A/B harness can treat all networks uniformly.
  adsterra: {
    label: 'Adsterra',
    status: 'live',
    enabled: true,
    // 'key' zones are an Adsterra placement key rendered via /adframe.html (see
    // AdsterraBanner). The Social Bar + Popunder script formats were removed from
    // the project (scareware creatives), so only the native banner remains.
    zones: {
      native: { type: 'key', value: ADSTERRA.nativeBanner?.key || '' },
    },
  },

  // 1 — HilltopAds: approves edge content, ~500 daily visitors, good CPM.
  hilltopads: {
    label: 'HilltopAds',
    status: 'pending-signup',
    enabled: on(env.VITE_HILLTOPADS_ENABLED),
    zones: {
      popunder: { type: 'script', value: env.VITE_HILLTOPADS_POPUNDER_URL || '' },
      native: { type: 'script', value: env.VITE_HILLTOPADS_NATIVE_URL || '' },
      push: { type: 'script', value: env.VITE_HILLTOPADS_PUSH_URL || '' },
      banner: { type: 'script', value: env.VITE_HILLTOPADS_BANNER_URL || '' },
    },
  },

  // 2 — Ghost: privacy-first, single <2KB script tag, 75% rev share.
  ghost: {
    label: 'Ghost',
    status: 'pending-signup',
    enabled: on(env.VITE_GHOST_ENABLED),
    zones: {
      // Ghost serves everything from one script tag + a publisher id.
      script: { type: 'script', value: env.VITE_GHOST_SCRIPT_URL || '' },
      publisherId: { type: 'id', value: env.VITE_GHOST_PUBLISHER_ID || '' },
    },
  },

  // 3 — PropellerAds: generalist, wide formats, KYC before first payout.
  propellerads: {
    label: 'PropellerAds',
    status: 'pending-signup',
    enabled: on(env.VITE_PROPELLERADS_ENABLED),
    zones: {
      popunder: { type: 'script', value: env.VITE_PROPELLERADS_POPUNDER_URL || '' },
      push: { type: 'id', value: env.VITE_PROPELLERADS_PUSH_ZONE || '' },
      native: { type: 'script', value: env.VITE_PROPELLERADS_NATIVE_URL || '' },
      interstitial: { type: 'id', value: env.VITE_PROPELLERADS_INTERSTITIAL_ZONE || '' },
    },
  },

  // 4 — Media.net: contextual (Yahoo/Bing), best for US/UK/CA English traffic.
  medianet: {
    label: 'Media.net',
    status: 'pending-signup',
    enabled: on(env.VITE_MEDIANET_ENABLED),
    zones: {
      // Media.net uses a customer id (cid) + per-slot crid.
      customerId: { type: 'id', value: env.VITE_MEDIANET_CID || '' },
      display: { type: 'id', value: env.VITE_MEDIANET_DISPLAY_CRID || '' },
    },
  },

  // 6 — EthicalAds: contextual, no tracking, developer audience, 50k+ pv goal.
  ethicalads: {
    label: 'EthicalAds',
    status: 'pending-signup',
    enabled: on(env.VITE_ETHICALADS_ENABLED),
    zones: {
      publisherId: { type: 'id', value: env.VITE_ETHICALADS_PUBLISHER_ID || '' },
    },
  },
};

/** A single zone is usable only if it has a non-empty value. */
export const isZoneReady = (network, zoneName) => {
  const z = AD_NETWORKS[network]?.zones?.[zoneName];
  return !!(z && z.value);
};

/** A network is ready to serve `zoneName` only if enabled AND that zone is set. */
export const isNetworkReady = (network, zoneName) =>
  !!AD_NETWORKS[network]?.enabled && isZoneReady(network, zoneName);

/** Networks that are enabled and have at least one configured zone. */
export const readyNetworks = () =>
  Object.entries(AD_NETWORKS)
    .filter(([, n]) => n.enabled && Object.values(n.zones).some((z) => z.value))
    .map(([id]) => id);

/**
 * Deterministic A/B bucket for a visitor across the given networks. Stable per
 * `seed` (e.g. a session id) so the same visitor keeps the same network within a
 * test. Returns a network id or null if none are ready. Purely a selection
 * helper — no ads are rendered until a rendering path actually consumes this.
 */
export const pickNetworkForSlot = (zoneName, seed = '') => {
  const candidates = Object.keys(AD_NETWORKS).filter((id) => isNetworkReady(id, zoneName));
  if (candidates.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return candidates[h % candidates.length];
};
