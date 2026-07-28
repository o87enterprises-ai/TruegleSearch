import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Spec item #8: "Get paid for the ads you see" CTA — the on-page conversion
// prompt that sends an interested visitor to sign up. (CookieConsent.jsx,
// which used to auto-surface the "explains procedure + options" cookie
// banner, is temporarily disabled in App.jsx while the landing flow is
// being finalized — re-wire the two once modal placement is decided.)
export default function RewardsCTA() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          exit={{ opacity: 0, height: 0 }}
          className="max-w-2xl mx-auto px-4"
        >
          <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 backdrop-blur-sm p-6 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
              <Gift size={18} className="text-yellow-400" />
            </div>
            <h3 className="text-white font-semibold">Earn a share of real ad revenue</h3>
            <p className="text-white/50 text-sm max-w-md">
              Opt in and earn a share of every sponsored offer you complete — real conversions, confirmed server-side, no extra tracking.
            </p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => navigate('/auth/login')}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold text-sm transition-all"
              >
                Sign up
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm transition-all"
              >
                No thanks
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
