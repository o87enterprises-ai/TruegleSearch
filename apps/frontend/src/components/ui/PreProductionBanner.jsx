import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, MessageSquarePlus, AlertTriangle } from 'lucide-react';
import { PREPRODUCTION_MODE, FEEDBACK_EMAIL } from '../../config/access';

// Same storage key as before "dismiss" meant "collapse to a small re-openable
// chip" instead of gone-forever — anyone who'd already dismissed it stays
// collapsed (no regression), and there's now always a way back in.
const DISMISS_KEY = 'truegle_preprod_banner_dismissed_v1';

// Anything that pins itself to the bottom of the page (the footer-docked
// player) has to sit ABOVE the feedback bar, so it needs to know whether the
// bar is expanded or collapsed to a chip — and to hear about it the moment
// that changes, not on the next reload.
// The bar is MEASURED rather than assumed: its copy wraps to four lines on a
// narrow phone and to one on a laptop, so any fixed constant would have the
// player sitting on top of it at exactly the widths where space is tightest.
const BAR_EVENT = 'truegle:feedback-bar';
export const FEEDBACK_CHIP_HEIGHT = 12;

export function useFeedbackBarHeight() {
  const [height, setHeight] = useState(FEEDBACK_CHIP_HEIGHT);
  useEffect(() => {
    let ro;
    const attach = () => {
      const el = document.querySelector('[data-feedback-bar]');
      ro?.disconnect();
      if (!el) { setHeight(FEEDBACK_CHIP_HEIGHT); return; }
      const measure = () => setHeight(el.getBoundingClientRect().height + 8);
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(measure);
        ro.observe(el);
      }
    };
    // The banner may mount after whatever is asking; retry a couple of times
    // rather than latch onto its absence.
    const timers = [0, 600, 1500].map((d) => setTimeout(attach, d));
    window.addEventListener(BAR_EVENT, attach);
    window.addEventListener('resize', attach);
    return () => {
      timers.forEach(clearTimeout);
      ro?.disconnect();
      window.removeEventListener(BAR_EVENT, attach);
      window.removeEventListener('resize', attach);
    };
  }, []);
  return height;
}

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
    window.dispatchEvent(new Event(BAR_EVENT));
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

      {/* Standing pre-production notice — collapses to a small re-openable
          chip instead of vanishing forever, so feedback is always reachable. */}
      <AnimatePresence mode="wait">
        {PREPRODUCTION_MODE && (
          dismissed ? (
            <motion.button
              key="chip"
              type="button"
              onClick={() => {
                setDismissed(false);
                try { localStorage.setItem(DISMISS_KEY, 'false'); } catch { /* ignore */ }
                window.dispatchEvent(new Event(BAR_EVENT));
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              title="Early access feedback"
              aria-label="Open early-access feedback"
              className="fixed bottom-4 right-4 z-[60] w-10 h-10 rounded-full bg-[#13131f]/95 border border-cyan-400/30 backdrop-blur shadow-2xl flex items-center justify-center hover:border-cyan-400/60 transition-colors"
            >
              <Sparkles size={16} className="text-cyan-300" />
            </motion.button>
          ) : (
            <motion.div
              key="banner"
              data-feedback-bar
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
                  aria-label="Collapse"
                  title="Collapse"
                  className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </>
  );
};

export default PreProductionBanner;
