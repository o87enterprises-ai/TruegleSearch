import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowLeft } from 'lucide-react';
import { MODE_COLORS } from '../../config/modeTheme';
import { OPEN_INSTALL_EVENT } from './InstallTruegle';
import { useInstallState } from '../../utils/installPrompt';

// Global navigation — ONLY a hamburger button that opens a slide-out drawer.
// No logo, no search, no pill row: each page owns its own hero (logo + pill +
// search live in the page body, matching the search-page layout). This is the
// single always-reachable nav for the whole site.
const ITEMS = [
  { label: 'Search',       mode: 'blue',   path: '/search?mode=blue' },
  { label: 'Rabbit Hole',  mode: 'red',    path: '/red' },
  // Perspectives folded into the Rabbit Hole 2026-08-08 — its entry point is
  // now the re-ask fold on Red, so a separate nav item would lead to the same
  // page with a different name on it.
  { label: 'OSINT',        mode: 'ocean',  path: '/search?mode=ocean' },
  { label: 'Chat',         mode: 'black',  path: '/chat' },
  // Feed was restored to the yellow pill 2026-09-02 (see modeTheme.js) — the
  // aggregated feed needs a way in that isn't typing the URL. Creators isn't
  // lost: it's a Browse category inside Feed now, not a top-level pill.
  { label: 'Feed',         mode: 'yellow', path: '/feed' },
  // 'Shorts' removed 2026-08-09 — folded into Tube as the Shorts scope.
  { label: 'Tube',         mode: 'tube',   path: '/tube' },
  // 'Rewards' removed 2026-07-24 — ad-pay/rewards program paused.
];

// Auth pages are focused flows with their own chrome — no menu there.
const HIDDEN_PATHS = new Set(['/auth/login', '/auth/signup']);

// The browser's own Back button doesn't reliably return here: this is a
// client-routed SPA, and a page that changes what's shown (a mode toggle, an
// opened panel, a pill switch) without pushing a new history entry leaves
// nothing for the browser's back button to land on — it skips straight past
// that state to whatever came before it, or off the site entirely from the
// first page landed on. This button keeps ITS OWN stack of full paths
// (pathname + query) as the app actually navigates, independent of the
// browser's history, and always has a real previous page to return to.
let ROUTE_HISTORY = [];

function useBackTarget() {
  const location = useLocation();
  const key = `${location.pathname}${location.search}`;
  const prevKeyRef = useRef(null);
  if (prevKeyRef.current !== key) {
    // A route change while this render commits — record it once, here,
    // rather than in an effect: an effect fires after paint, and the very
    // first click on the fresh page would still read the stale top-of-stack.
    if (ROUTE_HISTORY[ROUTE_HISTORY.length - 1] !== key) ROUTE_HISTORY.push(key);
    if (ROUTE_HISTORY.length > 50) ROUTE_HISTORY = ROUTE_HISTORY.slice(-50);
    prevKeyRef.current = key;
  }
  // The entry below the current page — null when this IS the first page,
  // which hides the button rather than sending someone off the site.
  return ROUTE_HISTORY.length > 1 ? ROUTE_HISTORY[ROUTE_HISTORY.length - 2] : null;
}

export default function BrandBar() {
  const [open, setOpen] = useState(false);
  const { installed } = useInstallState();
  const navigate = useNavigate();
  const location = useLocation();
  const backTarget = useBackTarget();

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (HIDDEN_PATHS.has(location.pathname)) return null;

  // Colour-coded to the CURRENT page's mode, same palette as the drawer's own
  // dots — a search page's back button reads blue, chat's reads the neutral
  // "black" chip, and so on. Falls back to a neutral grey off any mode page.
  const currentParams = new URLSearchParams(location.search);
  const currentModeKey = location.pathname === '/chat' ? 'black'
    : location.pathname.startsWith('/feed') ? 'yellow'
      : location.pathname === '/tube' ? 'tube'
        : location.pathname === '/red' ? 'red'
        : location.pathname === '/green' ? 'green'
        : location.pathname === '/search' ? (currentParams.get('mode') || 'blue')
          : null;
  const backColor = currentModeKey ? MODE_COLORS[currentModeKey] : '#9aa7b8';

  const isActive = (item) => {
    if (item.path === '/chat') return location.pathname === '/chat';
    // startsWith, not exact: /feed/tube and /feed/callback are still Feed.
    if (item.path === '/feed') return location.pathname.startsWith('/feed');
    if (item.path === '/rewards') return location.pathname === '/rewards';
    // Modes that own a route of their own, rather than a ?mode= on /search.
    if (item.path === '/tube' || item.path === '/red' || item.path === '/green') return location.pathname === item.path;
    const params = new URLSearchParams(location.search);
    return location.pathname === '/search' && (params.get('mode') || 'blue') === item.mode;
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open menu"
        className="fixed top-4 left-4 z-[9998] w-10 h-10 rounded-full bg-[#13131f]/90 border border-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center text-white/80 hover:text-white hover:border-white/30 transition-colors"
      >
        <Menu size={18} />
      </motion.button>

      {/* OPAQUE (not translucent like the hamburger) — the point is to read
          instantly as "the way back", not blend into the page behind it. */}
      {backTarget && (
        <motion.button
          type="button"
          onClick={() => {
            // Pop past the current entry too — the one just under it on the
            // stack is where "back" actually goes.
            ROUTE_HISTORY = ROUTE_HISTORY.slice(0, -1);
            navigate(backTarget);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Back"
          title="Back"
          className="fixed top-16 left-4 z-[9998] w-10 h-10 rounded-full bg-[#13131f] shadow-xl flex items-center justify-center text-white transition-colors"
          style={{ border: `1.5px solid ${backColor}` }}
        >
          <ArrowLeft size={18} style={{ color: backColor }} />
        </motion.button>
      )}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <motion.nav
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0a0a12] border-r border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Menu</span>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {ITEMS.map((item) => {
                    const active = isActive(item);
                    const color = MODE_COLORS[item.mode];
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => navigate(item.path)}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        {item.label}
                      </button>
                    );
                  })}
                  {!installed && (
                    <button
                      type="button"
                      data-menu-install=""
                      onClick={() => { setOpen(false); window.dispatchEvent(new Event(OPEN_INSTALL_EVENT)); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-emerald-300/90 hover:bg-white/5 hover:text-emerald-200 transition-colors border-t border-white/10 mt-2"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-400" />
                      Install Truegle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors border-t border-white/10 mt-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-white/40" />
                    Settings
                  </button>
                </div>
                <div className="px-4 py-4 border-t border-white/10 text-[11px] text-white/30">
                  Truegle — private, unbiased search
                </div>
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
