import { createContext, useContext, useEffect, useState } from 'react';
import { ADSTERRA, SOCIAL_BAR_SCRIPT_URL, POP_SCRIPT_URL } from '../config/ads';
import api from '../services/api';

// Ad geo-targeting context. Fetches the server-resolved, country-of-origin ad
// config once (GET /api/ads/config) and exposes the highest-CPM Adsterra zones
// for the visitor's region: native banner key, social bar + popunder script
// URLs, the CPM tier, and whether we're on the global fallback zone.
//
// Everything defaults to the static global zones from config/ads.js, so ads
// keep working before the fetch resolves (and in prerender/tests, where there
// is no provider or network).
const STATIC_DEFAULT = {
  country: 'ZZ',
  tier: 'tier3',
  isTier1: false,
  usingFallback: true,
  zones: {
    nativeBanner: ADSTERRA.nativeBanner?.key || null,
    socialBar: SOCIAL_BAR_SCRIPT_URL,
    popunder: POP_SCRIPT_URL,
  },
};

const AdGeoContext = createContext(STATIC_DEFAULT);

export const useAdGeo = () => useContext(AdGeoContext);

export const AdGeoProvider = ({ children }) => {
  const [geo, setGeo] = useState(STATIC_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    api.get('/ads/config')
      .then((res) => {
        const d = res?.data?.data;
        if (cancelled || !d) return;
        // Merge: keep static keys for anything the server left null.
        setGeo({
          ...STATIC_DEFAULT,
          ...d,
          zones: { ...STATIC_DEFAULT.zones, ...(d.zones || {}) },
        });
        // Expose for non-React consumers (adframe key selection, diagnostics).
        window.__truegle_ad_geo = { country: d.country, tier: d.tier };
      })
      .catch(() => { /* keep static default — ads must never break */ });
    return () => { cancelled = true; };
  }, []);

  return <AdGeoContext.Provider value={geo}>{children}</AdGeoContext.Provider>;
};
