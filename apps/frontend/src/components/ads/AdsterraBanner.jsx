import { useEffect, useRef, useState } from 'react';
import { isAdultQuery } from '../../utils/adultKeywords';
import { ADSTERRA, adInvokeUrl } from '../../config/ads';

/**
 * Maps Truegle search context to Adsterra campaign keyword categories.
 * Wire these strings to campaigns in the Adsterra dashboard to serve ads
 * matched to the user's active perspective/mode.
 */
const CONTEXT_KEYWORDS = {
  'blue':     ['mainstream', 'traditional', 'liberal', 'establishment', 'legacy-media'],
  'red':      ['alternative', 'conspiracy', 'independent', 'free-thinker', 'counter-narrative'],
  'purple':   ['conservative', 'skeptical', 'right-wing', 'traditional-values', 'anti-establishment'],
  'ocean':    ['privacy', 'cybersecurity', 'osint', 'developer', 'tech', 'infosec'],
  'green':    ['research', 'academic', 'science', 'factual'],
  'neutral':  ['non-partisan', 'centrist', 'balanced', 'independent'],
  'left':     ['progressive', 'liberal', 'social-justice', 'democrat'],
  'right':    ['conservative', 'republican', 'traditional', 'right-wing'],
  'red-pill': ['alternative', 'free-thinker', 'counter-narrative', 'independent'],
  'blue-pill':['mainstream', 'traditional', 'establishment', 'liberal'],
  'gen-z':    ['gen-z', 'youth', 'social-media', 'trending'],
  'lgbtq':    ['lgbtq', 'pride', 'inclusion', 'diversity'],
  'business': ['business', 'finance', 'investing', 'entrepreneur'],
};

/**
 * Renders ONE Adsterra placement inside its own isolated <iframe srcdoc>.
 *
 * Why an iframe per banner: Adsterra's invoke.js reads a single global
 * `window.atOptions`. With multiple banners on a page (which Truegle has),
 * injecting invoke.js into the shared page makes the last atOptions win and the
 * script's document.write can blow away the page. Giving each placement its own
 * iframe document means each gets its own `atOptions`/`window`, so any number of
 * slots coexist correctly.
 *
 * We set atOptions on the iframe's contentWindow and append invoke.js as an
 * EXTERNAL <script> (no inline script), so the page CSP is satisfied without
 * 'unsafe-inline'. invoke.js loads from the configurable AD_DOMAIN (see
 * config/ads.js) — point that at Adsterra's first-party anti-adblock domain to
 * bypass ad/tracking blockers.
 *
 * Props:
 *   format         — key from ADSTERRA (e.g. 'banner728x90')
 *   searchContext  — active search mode / perspective for campaign targeting
 *   adultGated     — if true, only renders when authenticated + safeSearch=off + adult query
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
  const iframeRef = useRef(null);
  const injected = useRef(false);

  const placement = ADSTERRA[format];

  // Ads load by default (Truegle is ad-supported). window.__truegle_ad_consent
  // is pre-set to true at app init; only an explicit opt-out flips it to false.
  const [adsAllowed, setAdsAllowed] = useState(() => window.__truegle_ad_consent !== false);

  useEffect(() => {
    const onConsent = (e) => setAdsAllowed(!!e.detail?.ads);
    window.addEventListener('truegle:consent', onConsent);
    return () => window.removeEventListener('truegle:consent', onConsent);
  }, []);

  const adultOk = !adultGated || (
    isAuthenticated &&
    safeSearch === 'off' &&
    isAdultQuery(query)
  );

  // Include `placement` so all hooks run before any early return and the effect
  // never touches placement.key for an unknown format.
  const shouldRender = !!placement && adultOk && adsAllowed;

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
        // Each iframe gets its OWN atOptions — no cross-banner collision.
        win.atOptions = {
          key: placement.key,
          format: 'iframe',
          height: placement.h,
          width: placement.w,
          params: { ...(keywords.length > 0 && { keywords }) },
        };

        doc.body.style.margin = '0';
        doc.body.style.overflow = 'hidden';

        // External script (not inline) → satisfies page CSP without unsafe-inline.
        const s = doc.createElement('script');
        s.src = adInvokeUrl(placement.key);
        s.async = true;
        doc.body.appendChild(s);
        injected.current = true;
      } catch {
        /* cross-origin or torn down — ignore */
      }
    };

    // srcdoc iframes are ready almost immediately, but guard with onload too.
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
      // allow popunder/click-through to open in a new tab
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
