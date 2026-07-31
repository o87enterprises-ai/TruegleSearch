import { createContext, useContext, useEffect, useState } from 'react';
import { ADSTERRA } from '../config/ads';
import api from '../services/api';

// Ad geo-targeting context. Fetches the server-resolved, country-of-origin ad
// config once (GET /api/ads/config) and exposes the native banner zone key for
// the visitor's region, the CPM tier, and whether we're on the global fallback.
//
// (The Social Bar and Popunder script formats were removed from the project —
// scareware creatives — so only the native banner zone is exposed here.)
//
// Defaults to the static global zone from config/ads.js, so ads keep working
// before the fetch resolves (and in prerender/tests, where there is no network).
const STATIC_DEFAULT = {
  country: 'ZZ',
  tier: 'tier3',
  isTier1: false,
  usingFallback: true,
  zones: {
    nativeBanner: ADSTERRA.nativeBanner?.key || null,
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
