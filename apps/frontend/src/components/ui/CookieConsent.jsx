import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Shield, Zap, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'truegle_cookie_consent';
const CONSENT_VERSION = '1';

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConsent(preferences) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: Date.now(),
      ...preferences,
    }));
  } catch { /* ignore */ }
}

export function useCookieConsent() {
  const consent = getStoredConsent();
  return {
    hasConsented: !!consent,
    adsAllowed: consent?.ads === true,
    analyticsAllowed: consent?.analytics === true,
  };
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adPref, setAdPref] = useState(true);
  const [analyticsPref, setAnalyticsPref] = useState(true);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      // Small delay so it doesn't flash over the loading screen
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const acceptAll = () => {
    saveConsent({ ads: true, analytics: true, essential: true });
    setVisible(false);
    // Signal to Adsterra that consent was given
    window.__truegle_ad_consent = true;
    window.dispatchEvent(new CustomEvent('truegle:consent', { detail: { ads: true } }));
  };

  const saveCustom = () => {
    saveConsent({ ads: adPref, analytics: analyticsPref, essential: true });
    setVisible(false);
    window.__truegle_ad_consent = adPref;
    window.dispatchEvent(new CustomEvent('truegle:consent', { detail: { ads: adPref } }));
  };

  const rejectAll = () => {
    saveConsent({ ads: false, analytics: false, essential: true });
    setVisible(false);
    window.__truegle_ad_consent = false;
    window.dispatchEvent(new CustomEvent('truegle:consent', { detail: { ads: false } }));
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4"
        >
          <div className="max-w-2xl mx-auto bg-gray-950 border border-white/15 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">
            {/* Main row */}
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Cookie size={17} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm mb-1">We use cookies to keep Truegle free</h3>
                  <p className="text-white/55 text-xs leading-relaxed">
                    Truegle is ad-supported. Accepting ad cookies lets us show relevant ads that
                    fund the service — keeping search free for everyone. We never sell your data or
                    track your searches beyond what's needed to serve ads.{' '}
                    <Link to="/privacy" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-0.5">
                      Privacy policy <ExternalLink size={10} />
                    </Link>
                  </p>
                </div>
              </div>

              {/* What each type means — collapsed by default */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors mb-3"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expanded ? 'Hide details' : 'What do these cookies do?'}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-3"
                  >
                    <div className="space-y-2.5 pb-1">
                      {/* Essential */}
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <Shield size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white/80 text-xs font-medium">Essential</span>
                            <span className="text-emerald-400/70 text-[10px] font-semibold">Always on</span>
                          </div>
                          <p className="text-white/40 text-[11px] mt-0.5">Session auth, preferences, freemium quota. No ad targeting.</p>
                        </div>
                      </div>

                      {/* Advertising */}
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <Zap size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white/80 text-xs font-medium">Advertising (Adsterra)</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={adPref}
                                onChange={e => setAdPref(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-white/20 peer-checked:bg-yellow-500 rounded-full transition-colors peer-focus:ring-1 peer-focus:ring-yellow-400/50" />
                              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                            </label>
                          </div>
                          <p className="text-white/40 text-[11px] mt-0.5">Enables ad targeting via Adsterra. Required for the ad rewards program and to keep Truegle free.</p>
                        </div>
                      </div>

                      {/* Analytics */}
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                        <div className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400">
                          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 10l3-4 3 3 3-5 3 2"/></svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white/80 text-xs font-medium">Analytics (Cloudflare)</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={analyticsPref}
                                onChange={e => setAnalyticsPref(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-white/20 peer-checked:bg-blue-500 rounded-full transition-colors peer-focus:ring-1 peer-focus:ring-blue-400/50" />
                              <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                            </label>
                          </div>
                          <p className="text-white/40 text-[11px] mt-0.5">Anonymous visit counts and performance metrics. No personal data. Helps us improve the product.</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={acceptAll}
                  className="flex-1 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold text-sm rounded-xl transition-all"
                >
                  Accept all — keep Truegle free
                </button>
                {expanded ? (
                  <button
                    onClick={saveCustom}
                    className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white/80 font-medium text-sm rounded-xl transition-all"
                  >
                    Save my choices
                  </button>
                ) : (
                  <button
                    onClick={() => setExpanded(true)}
                    className="sm:w-auto px-4 py-2.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white/60 hover:text-white/80 text-sm rounded-xl transition-all"
                  >
                    Customize
                  </button>
                )}
                <button
                  onClick={rejectAll}
                  className="sm:w-auto px-4 py-2.5 text-white/30 hover:text-white/60 text-sm transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
