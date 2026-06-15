import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, MessageSquarePlus, AlertTriangle } from 'lucide-react';
import { PREPRODUCTION_MODE, FEEDBACK_EMAIL } from '../../config/access';

const DISMISS_KEY = 'truegle_preprod_banner_dismissed_v1';

function feedbackMailto(kind = 'feedback') {
  const subject =
    kind === 'bug' ? 'TruegleSearch bug report' : 'TruegleSearch feedback / suggestion';
  const body =
    kind === 'bug'
      ? `What went wrong:\n\n\nWhat I expected:\n\n\n---\nPage: ${location.href}\nBrowser: ${navigator.userAgent}`
      : `My suggestion / what I'd love to see:\n\n\n---\nPage: ${location.href}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * PreProductionBanner
 * 1. A dismissible "early access" notice telling users the site isn't open to
 *    the world yet, things may break, and inviting bug reports / suggestions.
 * 2. A transient error bar that appears whenever a breaking error is detected
 *    (via the global 'truegle:app-error' event) so users get reassurance
 *    instead of silence when something fails.
 */
const PreProductionBanner = () => {
  const [dismissed, setDismissed] = useState(true);
  const [errorVisible, setErrorVisible] = useState(false);

  useEffect(() => {
    if (!PREPRODUCTION_MODE) return;
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    let hideTimer;
    const onError = () => {
      setErrorVisible(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setErrorVisible(false), 8000);
    };
    window.addEventListener('truegle:app-error', onError);
    return () => {
      window.removeEventListener('truegle:app-error', onError);
      clearTimeout(hideTimer);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {/* Transient breaking-error bar (highest priority) */}
      <AnimatePresence>
        {errorVisible && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 inset-x-0 z-[70] bg-amber-500 text-black px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
            role="alert"
          >
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              Something glitched on our end — we've been notified and are on it.
              Please try again in a moment.
            </span>
            <a href={feedbackMailto('bug')} className="underline font-semibold ml-1 hidden sm:inline">
              Report
            </a>
            <button onClick={() => setErrorVisible(false)} className="ml-2 opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standing pre-production notice */}
      <AnimatePresence>
        {PREPRODUCTION_MODE && !dismissed && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed bottom-0 inset-x-0 z-[60] px-3 py-2 sm:py-2.5"
          >
            <div className="mx-auto max-w-3xl flex items-center gap-3 rounded-xl border border-cyan-400/25 bg-[#13131f]/95 backdrop-blur px-3 sm:px-4 py-2 shadow-2xl">
              <div className="hidden sm:flex w-8 h-8 rounded-lg bg-cyan-400/15 border border-cyan-400/30 items-center justify-center shrink-0">
                <Sparkles size={16} className="text-cyan-300" />
              </div>
              <p className="text-[11px] sm:text-xs text-white/75 leading-snug flex-1">
                <span className="text-cyan-300 font-semibold">Early access:</span>{' '}
                You're using TruegleSearch before it's open to the world. Some things
                may break — your feedback shapes what we build next.
              </p>
              <a
                href={feedbackMailto('feedback')}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/30 text-cyan-200 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors"
              >
                <MessageSquarePlus size={14} />
                <span className="hidden sm:inline">Share feedback</span>
                <span className="sm:hidden">Feedback</span>
              </a>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PreProductionBanner;
