import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { APK_URL, findUpdate } from '../../utils/apk';
import { isNativeApp } from '../../utils/profileShare';

// IN THE ANDROID APP ONLY: say when a newer APK has been released. Sideloaded apps cannot install
// silently, so this opens the download and Android's installer asks the user to confirm. The check
// asks GitHub's public releases list and sends nothing about the user.
const DISMISS_KEY = 'truegle_update_dismissed';
const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const CURRENT = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

export default function UpdatePrompt({ current = CURRENT }) {
  const [version, setVersion] = useState(null);

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let live = true;
    findUpdate(current).then((latest) => {
      if (!live || !latest) return;
      try {
        const seen = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null');
        if (seen?.version === latest && Date.now() - seen.at < REMIND_AFTER_MS) return;
      } catch { /* unreadable: just offer it */ }
      setVersion(latest);
    });
    return () => { live = false; };
  }, [current]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ version, at: Date.now() })); } catch { /* private mode */ }
    setVersion(null);
  };

  return (
    <AnimatePresence>
      {version && (
        <motion.div role="status"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[10001] mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0b0e14] p-3 shadow-2xl">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Truegle {version} is available</p>
              <p className="text-[12px] text-white/55 leading-snug">You have {current}. Your saved data stays. Android will ask you to confirm the install.</p>
            </div>
            <button type="button" onClick={dismiss} aria-label="Not now"
              className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
          <a href={APK_URL} onClick={dismiss}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-black hover:bg-emerald-400">
            <Download size={16} /> Download update
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
