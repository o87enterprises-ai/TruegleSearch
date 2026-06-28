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
 * Maps Truegle search context to Adsterra campaign keyword categories.
 *
 * When you create campaigns in Adsterra's dashboard, target these keyword
 * strings to serve ads matched to the user's active perspective/mode.
 * Each key corresponds to the `searchContext` prop or URL ?mode= value.
 *
 * Example Adsterra campaign targeting setup:
 *   Campaign A (conservative media) → keywords: conservative, right-wing, traditional
 *   Campaign B (progressive brands) → keywords: progressive, liberal, social-justice
 *   Campaign C (tech/security tools) → keywords: osint, privacy, cybersecurity
 */
const CONTEXT_KEYWORDS = {
  // UI search modes — matches actual meanings of each mode
  'blue':     ['mainstream', 'traditional', 'liberal', 'establishment', 'legacy-media'],
  'red':      ['alternative', 'conspiracy', 'independent', 'free-thinker', 'counter-narrative'],
  'purple':   ['conservative', 'skeptical', 'right-wing', 'traditional-values', 'anti-establishment'],
  'ocean':    ['privacy', 'cybersecurity', 'osint', 'developer', 'tech', 'infosec'],
  'green':    ['research', 'academic', 'science', 'factual'],
  // Perspective filter values
  'neutral':  ['non-partisan', 'centrist', 'balanced', 'independent'],
  'left':     ['progressive', 'liberal', 'social-justice', 'democrat'],
  'right':    ['conservative', 'republican', 'traditional', 'right-wing'],
  // Legacy pill names
  'red-pill': ['alternative', 'free-thinker', 'counter-narrative', 'independent'],
  'blue-pill':['mainstream', 'traditional', 'establishment', 'liberal'],
  // Demographic signals (set explicitly at placement level for targeted campaigns)
  'gen-z':    ['gen-z', 'youth', 'social-media', 'trending'],
  'lgbtq':    ['lgbtq', 'pride', 'inclusion', 'diversity'],
  'business': ['business', 'finance', 'investing', 'entrepreneur'],
};

/**
 * Renders an Adsterra iframe banner via first-party proxy (/ad/:key).
 *
 * Props:
 *   format         — key from ADSTERRA object above (e.g. 'banner728x90')
 *   searchContext  — active search mode / perspective for campaign targeting
 *                    (e.g. 'red-pill', 'neutral', 'ocean'). Optional.
 *   adultGated     — if true, only renders when: authenticated + safeSearch=off + adult query
 *   isAuthenticated, safeSearch, query — required when adultGated=true
 *   className
 */
export default function AdsterraBanner({
  format = 'banner728x90',
  searchContext = null,
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

    // Build keyword list for Adsterra campaign targeting
    const keywords = searchContext ? (CONTEXT_KEYWORDS[searchContext] ?? []) : [];

    // atOptions is read by invoke.js immediately on load
    window.atOptions = {
      key: placement.key,
      format: 'iframe',
      height: placement.h,
      width: placement.w,
      params: {
        // Passed to Adsterra's targeting engine — wire these to campaigns in
        // the Adsterra dashboard to serve perspective-matched ads
        ...(keywords.length > 0 && { keywords }),
      },
    };

    const invoke = document.createElement('script');
    // Load through our first-party proxy at /ad/:key (Cloudflare Pages Function)
    // instead of directly from highperformanceformat.com (third-party, blocked by
    // Edge/Firefox Tracking Prevention). The function fetches from HPF server-side,
    // rewrites domain references to ads.truegle.info, and returns the script.
    invoke.src = `/ad/${placement.key}`;
    invoke.async = true;
    container.appendChild(invoke);
  }, [shouldRender, searchContext]);

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
