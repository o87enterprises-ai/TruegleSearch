import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench } from 'lucide-react';

/**
 * "Down for repairs" modal shown after repeated consecutive search failures
 * (e.g. a backend/CORS outage), so users aren't left staring at empty results.
 * Auto-clears on the next successful search.
 */
const RepairsModal = ({ open, onClose, onRetry }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repairs-modal-title"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#16161f] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
            <Wrench size={24} className="text-amber-400" />
          </div>
          <h3 id="repairs-modal-title" className="text-white font-bold text-lg mb-2">
            We're doing some quick maintenance
          </h3>
          <p className="text-white/60 text-sm mb-5">
            Search is temporarily having trouble returning results. This is usually brief —
            please try again in a moment. Thanks for your patience.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onRetry}
              className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-sm border border-amber-500/40 transition-all"
            >
              Try again
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default RepairsModal;
