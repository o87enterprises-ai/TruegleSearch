import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';

/*
 * Explains why Safe Search "Off" was blocked and offers the one way to
 * unlock it: signing in. Opens when SettingsContext.updateSetting rejects a
 * safeSearch:'off' change (dispatches 'truegle:safesearch-locked').
 *
 * A verified sign-in is used as a lightweight age-verification signal — it's
 * not a real age check, but it raises the bar above a single click for a
 * child to disable content filtering.
 */
export default function SafeSearchLockModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('truegle:safesearch-locked', handler);
    return () => window.removeEventListener('truegle:safesearch-locked', handler);
  }, []);

  const close = () => setOpen(false);

  const goToSignIn = () => {
    close();
    navigate('/auth/login', { state: { redirectTo: '/settings' } });
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
              Turning off content filtering requires signing in first. It's a
              quick way for us to keep this setting out of children's hands —
              please sign in to continue.
            </p>

            <button
              onClick={goToSignIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-all"
            >
              Sign In
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
