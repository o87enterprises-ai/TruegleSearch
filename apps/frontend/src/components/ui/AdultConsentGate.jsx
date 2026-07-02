import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { isAdultQuery } from '../../utils/adultKeywords';

const SESSION_KEY = 'truegle_adult_ads_ok';

/**
 * AdultConsentGate — renders a consent modal when all 4 prerequisite gates
 * are met for the first time in a session, then sets a session flag so the
 * modal doesn't reappear.
 *
 * Gates 1–4 (checked here):
 *   1. Cookie / ad consent accepted (window.__truegle_ad_consent !== false)
 *   2. User is authenticated
 *   3. Safe search is explicitly set to 'off'
 *   4. Current query contains adult keywords
 *
 * Gate 5 (this component):
 *   User clicks "I confirm, I am 18 or older" in the modal this session.
 *
 * After gate 5 is satisfied, this component fires the custom event
 * 'truegle:adult-ads-approved' so any mounted AdsterraBanner can
 * immediately re-evaluate its shouldRender state.
 *
 * Props:
 *   isAuthenticated  — from AuthContext
 *   safeSearch       — settings.safeSearch ('safe' | 'blur' | 'off')
 *   query            — current search query string
 */
export default function AdultConsentGate({ isAuthenticated, safeSearch, query }) {
  const [open, setOpen] = useState(false);

  const prereqsMet =
    window.__truegle_ad_consent !== false &&
    isAuthenticated &&
    safeSearch === 'off' &&
    isAdultQuery(query);

  useEffect(() => {
    if (!prereqsMet) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setOpen(true);
  }, [prereqsMet]);

  const approve = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setOpen(false);
    window.dispatchEvent(new CustomEvent('truegle:adult-ads-approved'));
  };

  const deny = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={deny}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-gray-950 to-black border-2 border-red-500/50 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={24} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Adult Advertising</h2>
                  <p className="text-xs text-white/50">18+ content detected</p>
                </div>
              </div>
              <button onClick={deny} className="text-white/40 hover:text-white p-1 ml-2 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-white/70 mb-2 leading-relaxed">
              Your search query contains adult-intent keywords. Truegle can show
              ads relevant to 18+ content in this session.
            </p>
            <p className="text-sm text-white/70 mb-5 leading-relaxed">
              By continuing you confirm that you are{' '}
              <strong className="text-white">18 years of age or older</strong> and
              consent to seeing adult advertising.
            </p>

            <div className="flex items-start gap-2 mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                This is an honor-system age check. If you are under 18, click{' '}
                <strong>No thanks</strong> to dismiss.
              </p>
            </div>

            {/* Actions */}
            <button
              onClick={approve}
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold hover:from-red-500 hover:to-pink-500 transition-all mb-2"
            >
              I confirm — I am 18 or older
            </button>
            <button
              onClick={deny}
              className="w-full px-5 py-2 rounded-xl text-white/50 hover:text-white text-sm transition-colors"
            >
              No thanks, dismiss
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Returns true if the adult consent session flag is set.
 * Used by AdsterraBanner to check gate 5 reactively.
 */
export function adultAdsApproved() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}
