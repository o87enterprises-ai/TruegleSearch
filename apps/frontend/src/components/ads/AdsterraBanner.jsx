import { useEffect, useRef, useState } from 'react';
import { isAdultQuery } from '../../utils/adultKeywords';

// Adsterra placement keys — all formats for truegle.info (site ID 5880564)
export const ADSTERRA = {
  banner468x60:  { key: '7e53f17316c72708e8417a8a991171ac',  w: 468, h: 60  },
  banner300x250: { key: '0fca9299f48c601ea125d688c11ff7d2',  w: 300, h: 250 },
  banner728x90:  { key: 'd5f657ea7d55fc33ea532071957a2857',  w: 728, h: 90  },
  banner160x300: { key: 'ffac08ed0f599aa8f389d387aa76001b',  w: 160, h: 300 },
  banner160x600: { key: 'c16f5233d71714d3151e160ac5778be2',  w: 160, h: 600 },
};

/**
 * Renders an Adsterra iframe banner.
 *
 * Props:
 *   format        — key from ADSTERRA object above (e.g. 'banner728x90')
 *   adultGated    — if true, only renders when: authenticated + safeSearch=off + adult query
 *   isAuthenticated, safeSearch, query  — required when adultGated=true
 *   className
 */
export default function AdsterraBanner({
  format = 'banner728x90',
  adultGated = false,
  isAuthenticated,
  safeSearch,
  query,
  className = '',
}) {
  const containerRef = useRef(null);
  const injected = useRef(false);

  const placement = ADSTERRA[format];

  // Consent state — read from window flag (set by CookieConsent component)
  const [adsAllowed, setAdsAllowed] = useState(() => !!window.__truegle_ad_consent);

  useEffect(() => {
    const onConsent = (e) => setAdsAllowed(!!e.detail?.ads);
    window.addEventListener('truegle:consent', onConsent);
    return () => window.removeEventListener('truegle:consent', onConsent);
  }, []);

  if (!placement) return null;

  const adultOk = !adultGated || (
    isAuthenticated &&
    safeSearch === 'off' &&
    isAdultQuery(query)
  );

  const shouldRender = adultOk && adsAllowed;

  useEffect(() => {
    if (!shouldRender || injected.current || !containerRef.current) return;
    injected.current = true;

    const container = containerRef.current;
    container.innerHTML = '';

    // Define atOptions globally on window to avoid inline script CSP violations
    window.atOptions = {
      key: placement.key,
      format: 'iframe',
      height: placement.h,
      width: placement.w,
      params: {},
    };

    const invoke = document.createElement('script');
    invoke.src = `//www.highperformanceformat.com/${placement.key}/invoke.js`;
    invoke.async = true;
    container.appendChild(invoke);
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) {
      injected.current = false;
      if (containerRef.current) containerRef.current.innerHTML = '';
    }
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: placement.w, height: placement.h, margin: '0 auto', overflow: 'hidden' }}
    />
  );
}
