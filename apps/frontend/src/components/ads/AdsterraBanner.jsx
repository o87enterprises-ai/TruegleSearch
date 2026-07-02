import { useEffect, useState } from 'react';
import { isAdultQuery } from '../../utils/adultKeywords';
import { ADSTERRA } from '../../config/ads';
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
 * Renders ONE Adsterra placement inside an <iframe src="/adframe.html?...">.
 *
 * Loading via a real same-origin URL (not srcdoc) ensures Adsterra sees
 * "Referer: https://truegle.info" and serves the ad. The srcdoc approach
 * sent a null referer, causing Adsterra to reject every impression.
 *
 * NON-ADULT banners (adultGated=false, the default):
 *   Render for ALL users as long as ad consent is not explicitly revoked.
 *
 * ADULT banners (adultGated=true):
 *   Require ALL five gates:
 *     1. Ad consent not revoked (window.__truegle_ad_consent !== false)
 *     2. User is authenticated (isAuthenticated prop)
 *     3. Safe search is explicitly 'off' (safeSearch prop)
 *     4. Current query contains adult keywords (isAdultQuery(query))
 *     5. User confirmed age this session via AdultConsentGate modal
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
  const placement = ADSTERRA[format];

  // Ad consent: true by default; flips to false on explicit opt-out only.
  const [adsAllowed, setAdsAllowed] = useState(
    () => window.__truegle_ad_consent !== false
  );

  // Gate 5: session-level adult consent (honor system age modal).
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

  if (!shouldRender) return null;

  const keywords = searchContext ? (CONTEXT_KEYWORDS[searchContext] ?? []) : [];
  const kwParam = keywords.length > 0 ? `&kw=${encodeURIComponent(keywords.join(','))}` : '';

  const src = placement.native
    ? `/adframe.html?k=${placement.key}&native=1${kwParam}`
    : `/adframe.html?k=${placement.key}&h=${placement.h}&w=${placement.w}${kwParam}`;

  const w = placement.native ? '100%' : placement.w;

  return (
    <iframe
      title="Advertisement"
      src={src}
      width={w}
      height={placement.h}
      scrolling="no"
      referrerPolicy="strict-origin-when-cross-origin"
      className={className}
      style={{
        width: w,
        height: placement.h,
        border: 0,
        display: 'block',
        margin: '0 auto',
        overflow: 'hidden',
      }}
    />
  );
}
