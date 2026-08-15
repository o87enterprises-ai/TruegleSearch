import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { MODE_COLORS } from '../../config/modeTheme';

// Global navigation — ONLY a hamburger button that opens a slide-out drawer.
// No logo, no search, no pill row: each page owns its own hero (logo + pill +
// search live in the page body, matching the search-page layout). This is the
// single always-reachable nav for the whole site.
const ITEMS = [
  { label: 'Search',       mode: 'blue',   path: '/search?mode=blue' },
  { label: 'Rabbit Hole',  mode: 'red',    path: '/search?mode=red' },
  // Perspectives folded into the Rabbit Hole 2026-08-08 — its entry point is
  // now the re-ask fold on Red, so a separate nav item would lead to the same
  // page with a different name on it.
  { label: 'OSINT',        mode: 'ocean',  path: '/search?mode=ocean' },
  { label: 'Chat',         mode: 'black',  path: '/chat' },
  { label: 'Extract',      mode: 'yellow', path: '/extract' },
  // 'Shorts' removed 2026-08-09 — folded into Tube as the Shorts scope.
  { label: 'Tube',         mode: 'tube',   path: '/tube' },
  // 'Rewards' removed 2026-07-24 — ad-pay/rewards program paused.
];

// Auth pages are focused flows with their own chrome — no menu there.
const HIDDEN_PATHS = new Set(['/auth/login', '/auth/signup']);

export default function BrandBar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (HIDDEN_PATHS.has(location.pathname)) return null;

  const isActive = (item) => {
    if (item.path === '/chat') return location.pathname === '/chat';
    if (item.path === '/feed') return location.pathname.startsWith('/feed');
    if (item.path === '/rewards') return location.pathname === '/rewards';
    // Modes that own a route of their own, rather than a ?mode= on /search.
    if (item.path === '/tube') return location.pathname === '/tube';
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
