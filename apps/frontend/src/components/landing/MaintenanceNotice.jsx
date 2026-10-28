// "Truegle is live during updates" notice on the landing page.
//
// Titled so a visitor reads "the site is up" rather than "the site is down" —
// people were leaving on seeing "maintenance" (owner, 2026-10-28).
//
// TO TAKE IT DOWN: set SHOW_MAINTENANCE_NOTICE to false (and delete the
// matching notes in index.html and public/robots.txt). Nothing else depends on it.
//
// Dismissible, and remembered for the browser session only, so it doesn't nag
// on every page view. Storage is wrapped in try/catch — private mode and
// blocked storage must never stop the page from rendering.
import { useEffect, useRef, useState } from 'react';

export const SHOW_MAINTENANCE_NOTICE = true;
const KEY = 'truegle_maint_seen_v1';

const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };

export default function MaintenanceNotice() {
  const [open, setOpen] = useState(() => SHOW_MAINTENANCE_NOTICE && !seen());
  const button = useRef(null);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    // Focus the button WITHOUT scrolling to it: autoFocus scrolled a tall card on
    // a short phone down to its button, clipping the title off the top.
    button.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 bg-black/70 backdrop-blur-sm"
      onClick={close}
      data-maintenance-notice
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maint-title"
        className="flex w-full max-w-md max-h-[calc(100dvh-5.5rem)] flex-col rounded-2xl border border-violet-400/30 bg-[#0e0b22] p-6 text-center shadow-[0_0_60px_rgba(139,92,246,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Only the text scrolls on a short phone; the button below never leaves the card. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="text-3xl mb-2" aria-hidden="true">🛠️</div>
        <h2 id="maint-title" className="text-xl font-semibold text-white">Truegle is live during updates</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          We&rsquo;re making improvements right now, so some features may be slow, missing or not
          working for a little while. Thanks for your patience &mdash; search itself should still work.
        </p>
        <p className="mt-4 text-sm font-medium text-gray-200">What we&rsquo;re fixing right now:</p>
        <ul className="mt-2 space-y-2 text-left text-sm leading-relaxed text-gray-300" data-maintenance-issues>
          <li className="flex gap-2">
            <span aria-hidden="true">&bull;</span>
            <span>Stream (similar music playing on its own after a search) can fall back to
              regular up-next picks instead of staying with the artist and sound you chose.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">&bull;</span>
            <span>Search results can list the exact artist and song you typed lower on the
              page than they should.</span>
          </li>
        </ul>
        {/* For automated visitors that read the page text. */}
        <p className="mt-4 text-xs leading-relaxed text-gray-500" data-for="bots">
          Bots, crawlers and scrapers: Truegle is under maintenance. Please pause or slow your
          requests, honor robots.txt, and check back later. Thank you.
        </p>
        </div>
        <button
          type="button"
          ref={button}
          onClick={close}
          className="mt-4 shrink-0 self-center rounded-full bg-violet-600 px-6 py-2 text-sm font-medium text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-300"
        >
          Continue to Truegle
        </button>
      </div>
    </div>
  );
}
