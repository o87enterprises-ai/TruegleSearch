import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Shield, Zap, ChevronDown, ChevronUp, ExternalLink, Lock, DollarSign } from 'lucide-react';
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

// CPM interaction types shown in the rewards explainer
const CPM_INTERACTIONS = [
  { label: 'Impressions', desc: 'Ad loads on screen — counted per 1,000 views (CPM)' },
  { label: 'Clicks', desc: 'Tapping or clicking an ad creative (CPC)' },
  { label: 'Video completions', desc: 'Watching a video ad through to the end' },
  { label: 'Lead actions', desc: 'Completing an advertiser form, install, or survey (CPA)' },
];

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsPref, setAnalyticsPref] = useState(true);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored || stored.version !== CONSENT_VERSION) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dispatchConsent = (ads) => {
    window.__truegle_ad_consent = ads;
    window.dispatchEvent(new CustomEvent('truegle:consent', { detail: { ads } }));
  };

  const acceptAll = () => {
    saveConsent({ ads: true, analytics: true, essential: true });
    setVisible(false);
    dispatchConsent(true);
  };

  const saveCustom = () => {
    // Ad cookies are always on for free users — premium is the only way to remove ads
    saveConsent({ ads: true, analytics: analyticsPref, essential: true });
    setVisible(false);
    dispatchConsent(true);
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
            <div className="p-4 sm:p-5">

              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Cookie size={17} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm mb-1">Ad cookies keep Truegle free — and pay you back</h3>
                  <p className="text-white/55 text-xs leading-relaxed">
                    Truegle is 100% ad-supported.{' '}
                    <span className="text-white/75">We do not track, store, or sell your search queries, browsing history, or personal data — ever.</span>{' '}
                    Ad cookies are used exclusively to accurately meter ad interactions so advertisers pay fairly and your rewards are calculated correctly.{' '}
                    <Link to="/privacy" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-0.5">
                      Privacy policy <ExternalLink size={10} />
                    </Link>
                  </p>
                </div>
              </div>

              {/* Rewards callout */}
              <div className="flex items-start gap-2.5 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl mb-3">
                <DollarSign size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/65 text-[11px] leading-relaxed">
                  <span className="text-yellow-300 font-semibold">Earn up to 50% of ad revenue</span> through the Truegle Rewards program.
                  Every eligible ad interaction you generate earns you a share of the Adsterra partnership payout —
                  and payouts scale with volume. Qualifying interaction types:{' '}
                  {CPM_INTERACTIONS.map((t, i) => (
                    <span key={t.label}>
                      <span className="text-white/80 font-medium">{t.label}</span>
                      {i < CPM_INTERACTIONS.length - 1 ? ', ' : '.'}
                    </span>
                  ))}
                </p>
              </div>

              {/* Expandable details */}
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
                          <p className="text-white/40 text-[11px] mt-0.5">
                            Session auth, preferences, freemium quota. Never used for ad targeting or profiling.
                          </p>
                        </div>
                      </div>

                      {/* Advertising — always on, locked for free users */}
                      <div className="flex items-start gap-3 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                        <Zap size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white/80 text-xs font-medium">Advertising (Adsterra)</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-yellow-400/70 text-[10px] font-semibold">Required — free plan</span>
                              <Lock size={10} className="text-yellow-500/60" />
                            </div>
                          </div>
                          <p className="text-white/40 text-[11px] mt-0.5">
                            Accurately meters ad impressions, clicks, video completions, and lead actions so Adsterra can
                            pay Truegle — and Truegle can pay you. No search history or personal data is ever shared.
                            Remove ads by upgrading to{' '}
                            <Link to="/auth/signup" className="text-yellow-400 hover:text-yellow-300">Premium</Link>.
                          </p>
                          {/* CPM interaction breakdown */}
                          <div className="mt-2 space-y-1">
                            {CPM_INTERACTIONS.map(t => (
                              <div key={t.label} className="flex items-start gap-1.5">
                                <span className="text-yellow-400/60 text-[10px] font-semibold w-[90px] flex-shrink-0">{t.label}</span>
                                <span className="text-white/30 text-[10px]">{t.desc}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Analytics — optional */}
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
                          <p className="text-white/40 text-[11px] mt-0.5">
                            Anonymous visit counts and performance metrics only. No personal data. Helps us improve the product.
                          </p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons — no Reject option */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={acceptAll}
                  className="flex-1 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold text-sm rounded-xl transition-all"
                >
                  Accept &amp; start earning rewards
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
              </div>

              <p className="text-center text-white/20 text-[10px] mt-2.5">
                Want an ad-free experience?{' '}
                <Link to="/auth/signup" className="text-white/40 hover:text-white/60">Upgrade to Premium</Link>
              </p>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
