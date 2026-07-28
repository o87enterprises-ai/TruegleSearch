import { useCallback, useEffect, useRef, useState } from 'react';
import { isAdultQuery } from '../../utils/adultKeywords';
import { ADSTERRA, AD_DOMAIN } from '../../config/ads';
import { adultAdsApproved } from '../ui/AdultConsentGate';
import { useAdGeo } from '../../context/AdGeoContext';

// Highest-CPM banner format only. Per the revenue plan we stopped serving the
// low-CPM display banners (300x250/468x60/728x90/160x600 all earned ~$0) and
// serve the native banner exclusively — it was the top non-adult CPM format and
// is on-brand. Any legacy format prop is coerced to it, so every call site
// upgrades without a change.
const HIGH_CPM_FORMATS = new Set(['nativeBanner']);

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
  // Serve only the highest-CPM format; the country-of-origin native key comes
  // from the geo config (GeoAdService), falling back to the static global key.
  const { zones } = useAdGeo();
  const fmt = HIGH_CPM_FORMATS.has(format) ? format : 'nativeBanner';
  const base = ADSTERRA[fmt];
  const placement = base
    ? { ...base, key: (fmt === 'nativeBanner' && zones?.nativeBanner) || base.key }
    : base;

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

  // Responsive fit: scale a fixed-size banner down to its container so a wide
  // format (e.g. 728x90) fits a narrow mobile column instead of overflowing.
  // A callback ref attaches the observer exactly when the node mounts, so it
  // works even for banners that start hidden and render later.
  const roRef = useRef(null);
  const [scale, setScale] = useState(1);
  const setWrap = useCallback((el) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (!el || !placement || placement.native) return;
    const update = () => {
      const cw = el.clientWidth;
      if (cw && placement.w) setScale(Math.min(1, cw / placement.w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    roRef.current = ro;
  }, [placement]);

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

  const dParam = `&d=${encodeURIComponent(AD_DOMAIN)}`;
  const src = placement.native
    ? `/adframe.html?k=${placement.key}&native=1${dParam}${kwParam}`
    : `/adframe.html?k=${placement.key}&h=${placement.h}&w=${placement.w}${dParam}${kwParam}`;

  // Native ads fill their container width directly.
  if (placement.native) {
    return (
      <iframe
        title="Advertisement"
        src={src}
        width="100%"
        height={placement.h}
        scrolling="no"
        referrerPolicy="strict-origin-when-cross-origin"
        className={className}
        style={{ width: '100%', height: placement.h, border: 0, display: 'block', margin: '0 auto' }}
      />
    );
  }

  // Fixed-size banner: render at native size but scale to fit the container, so
  // the whole creative shows (no clipping) and never overflows on mobile. The
  // outer box reserves only the scaled height to avoid leaving whitespace.
  return (
    <div
      ref={setWrap}
      className={className}
      style={{
        width: '100%',
        maxWidth: placement.w,
        height: placement.h * scale,
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: placement.w, height: placement.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <iframe
          title="Advertisement"
          src={src}
          width={placement.w}
          height={placement.h}
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ border: 0, display: 'block' }}
        />
      </div>
    </div>
  );
}
