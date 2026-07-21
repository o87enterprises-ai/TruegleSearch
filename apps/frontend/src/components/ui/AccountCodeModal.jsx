import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, KeyRound } from 'lucide-react';

/*
 * One-time reveal of a durable account code. Shown after the first sign-in
 * (and after a regenerate). The code is only ever displayed here — the server
 * stores a bcrypt hash and can never show it again, so the user must save it
 * now. onClose runs after they acknowledge.
 */
export default function AccountCodeModal({ code, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is on screen to copy manually
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl bg-[rgba(15,15,35,0.97)] backdrop-blur-xl border border-cyan-500/30 shadow-2xl p-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
          <KeyRound size={22} className="text-cyan-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Save your account code</h2>
        <p className="text-sm text-white/60 mb-5">
          This code signs you in on any device — no waiting for an email. We can't show it again,
          so save it somewhere safe now.
        </p>

        <button
          type="button"
          onClick={copy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-black/40 border border-white/15 hover:border-cyan-500/40 transition-all mb-4 group"
        >
          <span className="font-mono text-xl tracking-[0.3em] text-white">{code}</span>
          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-white/50 group-hover:text-white" />}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:opacity-90 text-white font-semibold transition-all"
        >
          I've saved it — continue
        </button>
      </motion.div>
    </div>
  );
}
