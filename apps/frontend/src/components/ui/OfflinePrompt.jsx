import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

// Pages that already work with no connection: no prompt needed there.
const OFFLINE_OK = ['/offline', '/nearby', '/guide'];

// Site-wide: when the device reports no connection, offer Offline mode (guide, games, map,
// saved lists, Nearby). Shown once per outage; dismissing it keeps it away until the
// connection returns and drops again. Uses the browser's own online/offline signal, which
// catches airplane mode and "no service" but not a connected-but-dead Wi-Fi.
export default function OfflinePrompt() {
  const online = useOnlineStatus();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { if (online) setDismissed(false); }, [online]);

  const show = !online && !dismissed && !OFFLINE_OK.includes(pathname);

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setDismissed(true)}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
            role="alertdialog" aria-modal="true" aria-labelledby="offline-prompt-title"
            className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-[#0a0a12] p-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.2)]"
            onClick={(e) => e.stopPropagation()}>
            <WifiOff size={32} className="mx-auto text-amber-300" />
            <h2 id="offline-prompt-title" className="mt-3 text-lg font-bold text-white">You’re offline</h2>
            <p className="mt-1 text-sm text-white/65">
              No internet or service detected. Offline mode still has the survival guide, games, your saved map areas and lists,
              and Nearby (message phones around you over Bluetooth).
            </p>
            <button type="button" autoFocus onClick={() => { setDismissed(true); navigate('/offline'); }}
              className="mt-5 w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-black hover:bg-amber-300">
              Open Offline mode
            </button>
            <button type="button" onClick={() => setDismissed(true)}
              className="mt-2 w-full rounded-full py-2 text-xs text-white/50 hover:text-white">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
