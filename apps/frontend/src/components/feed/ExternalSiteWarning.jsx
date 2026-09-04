import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';

// "You are about to leave Truegle." Shown before following a link to a site
// whose posts cannot be read in-app — Facebook and Instagram today, see
// utils/externalSites.js for why those two and not everything.
//
// PORTALED, like FeedCardActions, for the same reason: feed cards live inside
// scrolling containers that would clip an absolutely-positioned child at
// their own overflow boundary.
//
// THE COPY IS THE POINT. It says what actually changes — their cookies, their
// tracking, their idea of who you are — because that is the whole reason this
// interruption is justified. It does not scold, and it does not pretend
// Truegle can protect anybody past its own edge. Continue is the primary
// action: somebody who tapped a Facebook post wants to read the Facebook
// post, and the warning's job is to be informative, not obstructive.
export default function ExternalSiteWarning({ open, site, url, onClose }) {
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
      data-external-warning={site || ''}
      className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={`Leaving Truegle for ${site}`}
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
              You&apos;re leaving Truegle for {site}
            </h2>
            <p className="text-white/55 text-xs leading-relaxed mt-1.5">
              {site} posts can&apos;t be shown inside Truegle, so this opens their site in a new
              tab. Once you&apos;re there you&apos;re on their terms — their cookies, their
              tracking, and whoever that browser is signed in as. Nothing about you is sent
              from here.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            data-external-cancel=""
            onClick={onClose}
            className="flex-1 px-3 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm
                       hover:text-white hover:border-white/30 transition-colors"
          >
            Stay here
          </button>
          {/* A real anchor, not a scripted window.open: it keeps middle-click,
              long-press and "open in new tab" working the way every other
              link on the page does, and noopener is what stops the opened tab
              reaching back into this one. */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            data-external-continue=""
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
