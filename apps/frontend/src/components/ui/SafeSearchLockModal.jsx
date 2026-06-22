import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/*
 * Explains why Safe Search "Off" was blocked and offers the one way to
 * unlock it: signing in with Google. Opens when SettingsContext.updateSetting
 * rejects a safeSearch:'off' change (dispatches 'truegle:safesearch-locked').
 *
 * Google sign-in is used as a lightweight age-verification signal — it's not
 * a real age check, but it raises the bar above a single click for a child
 * to disable content filtering.
 */
export default function SafeSearchLockModal() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('truegle:safesearch-locked', handler);
    return () => window.removeEventListener('truegle:safesearch-locked', handler);
  }, []);

  const close = () => setOpen(false);

  const continueWithGoogle = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://backend-seven-khaki-60.vercel.app';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500/40 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center">
                <ShieldAlert size={24} className="text-cyan-400" />
              </div>
              <button onClick={close} className="text-white/50 hover:text-white p-1"><X size={20} /></button>
            </div>

            <h2 className="text-lg font-bold text-white mb-2">Safe Search "Off" is locked</h2>
            <p className="text-sm text-white/70 mb-5">
              Turning off content filtering requires signing in with Google first.
              It's a quick way for us to keep this setting out of children's hands —
              {isAuthenticated
                ? " your current account isn't Google-verified yet."
                : ' please sign in to continue.'}
            </p>

            <button
              onClick={continueWithGoogle}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.88 2.69-6.64z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.96H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.34z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={close}
              className="w-full mt-2 px-5 py-2 rounded-xl text-white/50 hover:text-white text-sm transition-colors"
            >
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
