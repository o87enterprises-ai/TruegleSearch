import { useEffect, useRef, useState } from 'react';
import { isAdultQuery } from '../../utils/adultKeywords';
import { ADSTERRA, adInvokeUrl } from '../../config/ads';
import { adultAdsApproved } from '../ui/AdultConsentGate';

/**
 * Maps Truegle search context to Adsterra campaign keyword categories.
 */
const CONTEXT_KEYWORDS = {
  'blue':      ['mainstream', 'traditional', 'liberal', 'establishment', 'legacy-media'],
  'red':       ['alternative', 'conspiracy', 'independent', 'free-thinker', 'counter-narrative'],
  'purple':    ['conservative', 'skeptical', 'right-wing', 'traditional-values', 'anti-establishment'],
  'ocean':     ['privacy', 'cybersecurity', 'osint', 'developer', 'tech', 'infosec'],
  'green':     ['research', 'academic', 'science', 'factual'],
  'neutral':   ['non-partisan', 'centrist', 'balanced', 'independent'],
  'left':      ['progressive', 'liberal', 'social-justice', 'democrat'],
  'right':     ['conservative', 'republican', 'traditional', 'right-wing'],
  'red-pill':  ['alternative', 'free-thinker', 'counter-narrative', 'independent'],
  'blue-pill': ['mainstream', 'traditional', 'establishment', 'liberal'],
  'gen-z':     ['gen-z', 'youth', 'social-media', 'trending'],
  'lgbtq':     ['lgbtq', 'pride', 'inclusion', 'diversity'],
  'business':  ['business', 'finance', 'investing', 'entrepreneur'],
};

/**
 * Renders ONE Adsterra placement inside its own isolated <iframe srcdoc>.
 *
 * NON-ADULT banners (adultGated=false, the default):
 *   Render for ALL users as long as ad consent is not explicitly revoked.
 *   No authentication, no age check, no safe-search requirement.
 *
 * ADULT banners (adultGated=true):
 *   Require ALL five gates:
 *     1. Ad consent not revoked (window.__truegle_ad_consent !== false)
 *     2. User is authenticated (isAuthenticated prop)
 *     3. Safe search is explicitly 'off' (safeSearch prop)
 *     4. Current query contains adult keywords (isAdultQuery(query))
 *     5. User confirmed age this session via AdultConsentGate modal
 *
 * Props:
 *   format         — key from ADSTERRA config (e.g. 'banner728x90')
 *   searchContext  — active search mode / perspective for campaign targeting
 *   adultGated     — if true, apply 5-gate adult check before rendering
 *   isAuthenticated, safeSearch, query — required when adultGated=true
 *   className
 */
export default function AdsterraBanner({
  format = 'banner728x90',
  searchContext = null,
  adultGated = false,
  isAuthenticated = false,
  safeSearch = 'safe',
  query = '',
  className = '',
}) {
  const iframeRef = useRef(null);
  const injected = useRef(false);

  const placement = ADSTERRA[format];

  // Ad consent: true by default; flips to false on explicit opt-out only.
  const [adsAllowed, setAdsAllowed] = useState(
    () => window.__truegle_ad_consent !== false
  );

  // Gate 5: session-level adult consent (honor system age modal).
  // Starts from sessionStorage so it survives React re-renders.
  const [sessionAdultOk, setSessionAdultOk] = useState(() => adultAdsApproved());

  useEffect(() => {
    const onConsent = (e) => setAdsAllowed(!!e.detail?.ads);
    window.addEventListener('truegle:consent', onConsent);
    return () => window.removeEventListener('truegle:consent', onConsent);
  }, []);

  // Listen for the AdultConsentGate approval event so the banner renders
  // immediately after the user clicks "I confirm" without a page reload.
  useEffect(() => {
    const onApprove = () => setSessionAdultOk(true);
    window.addEventListener('truegle:adult-ads-approved', onApprove);
    return () => window.removeEventListener('truegle:adult-ads-approved', onApprove);
  }, []);

  // Adult gate: all 5 conditions must be true.
  const adultOk = !adultGated || (
    adsAllowed &&
    isAuthenticated &&
    safeSearch === 'off' &&
    isAdultQuery(query) &&
    sessionAdultOk
  );

  const shouldRender = !!placement && adsAllowed && adultOk;

  useEffect(() => {
    if (!shouldRender) {
      injected.current = false;
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe || injected.current) return;

    const writeAd = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return;

        const keywords = searchContext ? (CONTEXT_KEYWORDS[searchContext] ?? []) : [];
        win.atOptions = {
          key: placement.key,
          format: 'iframe',
          height: placement.h,
          width: placement.w,
          params: { ...(keywords.length > 0 && { keywords }) },
        };

        doc.body.style.margin = '0';
        doc.body.style.overflow = 'hidden';

        const s = doc.createElement('script');
        s.src = adInvokeUrl(placement.key);
        s.async = true;
        doc.body.appendChild(s);
        injected.current = true;
      } catch {
        /* cross-origin or torn-down — ignore */
      }
    };

    if (iframe.contentDocument?.body) writeAd();
    else iframe.addEventListener('load', writeAd, { once: true });

    return () => iframe.removeEventListener?.('load', writeAd);
  }, [shouldRender, searchContext, placement]);

  if (!shouldRender) return null;

  return (
    <iframe
      ref={iframeRef}
      title="Advertisement"
      srcDoc="<!doctype html><html><head></head><body></body></html>"
      width={placement.w}
      height={placement.h}
      scrolling="no"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
      className={className}
      style={{
        width: placement.w,
        height: placement.h,
        border: 0,
        display: 'block',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    />
  );
}
