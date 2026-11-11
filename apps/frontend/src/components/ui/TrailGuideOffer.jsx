import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, BookOpen, Gamepad2, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { vaultFound, findVault } from '../../utils/vault';
import {
  GUIDE_NAME, PLAY_URL, GUIDE_URL, OFFER_DISMISS_KEY, OFFER_REMIND_AFTER_MS, isRealAccount,
} from '../../utils/guideAccess';

// A FREE POST-APOCALYPTIC / PIONEER GUIDE — the landing-page offer that replaced the
// "add to home screen" popup (owner, 2026-11-11). The guide is The Survivor's
// Encyclopedia; it is free two ways and this modal is the door to both:
//   • PLAY Trail on the 404 page — no sign-in — and finishing a run unlocks it, or
//   • SIGN IN — and it is unlocked here, on this device, straight away.
// (utils/guideAccess.js says how; utils/vault.js stores it. Nothing is sent anywhere.)
//
// Mounted once for the whole app, like InstallTruegle, so a sign-in ANYWHERE unlocks it.

export default function TrailGuideOffer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  // A real account (not a guest session) holds the guide. Idempotent: findVault never downgrades.
  useEffect(() => {
    if (!isAuthenticated) return;
    let token = '';
    try { token = localStorage.getItem('truegle_token') || ''; } catch { /* private mode */ }
    if (isRealAccount(user, token)) findVault('guide');
  }, [isAuthenticated, user]);

  // Offered by itself once on the landing page, then not again for three weeks after
  // a dismissal, and never to somebody who already holds the guide. Waits for any other
  // dialog (the tutorial, a sign-in prompt) to be out of the way.
  useEffect(() => {
    if (pathname !== '/' || vaultFound()) return undefined;
    try {
      const at = Number(localStorage.getItem(OFFER_DISMISS_KEY) || 0);
      if (at && Date.now() - at < OFFER_REMIND_AFTER_MS) return undefined;
    } catch { /* private mode: just offer it */ }
    let tries = 0;
    let t = setTimeout(function attempt() {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && tries++ < 12) {
        t = setTimeout(attempt, 5000);
        return;
      }
      if (!vaultFound()) setOpen(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(OFFER_DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  }, []);

  const go = useCallback((to, state) => {
    close();
    navigate(to, state ? { state } : undefined);
  }, [close, navigate]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-guide-offer=""
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="A free Post-Apocalyptic and Pioneer guide"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[88svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0b0e14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <button type="button" onClick={close} aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-3 pr-8">
              <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-300">
                <BookOpen size={22} />
              </span>
              <div>
                <h2 className="text-base font-bold text-white">Free Post-Apocalyptic / Pioneer guide</h2>
                <p className="text-[12px] text-white/50">{GUIDE_NAME}</p>
              </div>
            </div>
            <p className="text-[12px] text-white/65 leading-relaxed mb-4">
              Water, fire, shelter, food, first aid and the old trades — written for the worst
              day, readable offline, and free. Get it one of two ways:
            </p>

            <div className="space-y-2">
              <button type="button" data-guide-play="" onClick={() => go(PLAY_URL)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-emerald-500 text-black text-left hover:bg-emerald-400 transition-colors">
                <Gamepad2 size={18} className="shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">Play Trail</span>
                  <span className="block text-[11px] text-black/60">No sign-in. Finish a run and the guide is yours.</span>
                </span>
              </button>
              <button type="button" data-guide-signin="" onClick={() => go('/auth/login', { redirectTo: GUIDE_URL })}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-left hover:border-white/30 transition-colors">
                <LogIn size={18} className="shrink-0 text-white/70" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">Sign in — get it free</span>
                  <span className="block text-[11px] text-white/45">Unlocked on this device the moment you sign in.</span>
                </span>
              </button>
            </div>

            <button type="button" onClick={close}
              className="mt-4 w-full py-2 text-xs text-white/40 hover:text-white/70">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
