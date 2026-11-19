import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Download, WifiOff, Radio, Link2, Zap, ShieldCheck } from 'lucide-react';
import { APK_URL, showApkLink } from '../../utils/apk';
import { OPEN_INSTALL_EVENT } from './InstallTruegle';

// THE LANDING-PAGE OFFER for Android browsers: get the real app instead of the browser tab.
// (Replaces the free-guide popup for these visitors — the guide is unlocked automatically in the
// app, see utils/guideAccess.js. Everyone else still gets TrailGuideOffer.)
//
// Offered once on the landing page, then not again for three weeks after a dismissal, and it
// waits for any other dialog to be out of the way. Nothing is sent anywhere.
const DISMISS_KEY = 'truegle_app_offer_dismissed_at';
const REMIND_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

const BENEFITS = [
  { icon: WifiOff, title: 'Works with no signal', text: 'Survival guide, games, saved map areas and your offline music player — all on your phone.' },
  { icon: Radio, title: 'Nearby: chat over Bluetooth', text: 'Message phones around you, send voice notes, queue messages for later. No internet, no accounts.' },
  { icon: Link2, title: 'Links open in the app', text: 'Share lists and Truegle links open straight in Truegle instead of a browser tab.' },
  { icon: Zap, title: 'One tap, full screen', text: 'Its own icon, no address bar, and it never gets lost among your tabs.' },
  { icon: ShieldCheck, title: 'Still private', text: 'No ads, no tracking, no cookies — and the survival guide is unlocked without signing in.' },
];

export default function AppOffer() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pathname !== '/' || !showApkLink()) return undefined;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (at && Date.now() - at < REMIND_AFTER_MS) return undefined;
    } catch { /* private mode: just offer it */ }
    let tries = 0;
    let t = setTimeout(function attempt() {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && tries++ < 12) {
        t = setTimeout(attempt, 5000);
        return;
      }
      setOpen(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  }, []);

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
        <motion.div data-app-offer=""
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={close}>
          <motion.div role="dialog" aria-modal="true" aria-label="Get the Truegle app"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[90svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0b0e14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <button type="button" onClick={close} aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-3 pr-8">
              <img src="/truegle.png" alt="" className="w-11 h-11 rounded-xl shrink-0 object-cover" />
              <div>
                <h2 className="text-base font-bold text-white">Get the Truegle app</h2>
                <p className="text-[12px] text-white/50">More than the website — and it works when the internet doesn’t.</p>
              </div>
            </div>

            <ul className="space-y-2.5 mb-4">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/15 text-orange-300"><Icon size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-white">{title}</span>
                    <span className="block text-[12px] text-white/55 leading-snug">{text}</span>
                  </span>
                </li>
              ))}
            </ul>

            <a href={APK_URL} download data-app-offer-download="" onClick={() => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-black hover:bg-emerald-400">
              <Download size={17} /> Download the app (APK, 24 MB)
            </a>
            <p className="mt-2 text-[11px] text-white/40 leading-snug">
              Android will ask to allow installs from your browser — normal for apps outside the Play Store. This is an early build.
            </p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <button type="button" onClick={() => { close(); window.dispatchEvent(new Event(OPEN_INSTALL_EVENT)); }}
                className="text-white/45 hover:text-white/80 underline">Or add the website to your home screen</button>
              <button type="button" onClick={close} className="text-white/40 hover:text-white/70">Not now</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
