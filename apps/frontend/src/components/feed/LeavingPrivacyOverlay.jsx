import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';

// Shown when "Open link" is chosen on a playable feed card. Distinct from
// ExternalSiteWarning (which names a specific gated platform, Facebook or
// Instagram) — this is the general case: any playable post's own source page,
// which Truegle's player never touches once you leave it. Same portal/escape/
// scroll-lock shape as ExternalSiteWarning, deliberately: one interruption
// pattern for every "you are about to leave" moment in the feed.
export default function LeavingPrivacyOverlay({ open, url, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      data-leaving-privacy-overlay=""
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Leaving Truegle's privacy network"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:w-[26rem] sm:rounded-2xl rounded-t-2xl bg-[#0b0e12] border border-white/10
                   p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <ShieldAlert size={17} className="text-amber-300" />
          </span>
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-sm leading-snug">
              Leaving Truegle&apos;s privacy network
            </h2>
            <p className="text-white/55 text-xs leading-relaxed mt-1.5">
              Truegle cannot guarantee privacy or security beyond this point.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            data-leaving-cancel=""
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm
                       hover:text-white hover:border-white/30 transition-colors"
          >
            Stay here
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-leaving-continue=""
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm
                       font-medium hover:bg-white/15 transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            Continue
          </a>
        </div>

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full text-white/35 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
