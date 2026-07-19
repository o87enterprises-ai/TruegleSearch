import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { MODE_COLORS } from '../../config/modeTheme';

// Global hamburger nav (docs/UI-REDESIGN-SPEC.md, "Global additions") — the
// seven destinations, always reachable from anywhere: Search, Rabbit Hole,
// Perspectives, OSINT, Chat, Extract, Rewards. Rendered once in App.jsx so
// every page gets it without wiring it in individually.
const ITEMS = [
  { label: 'Search',       mode: 'blue',   path: '/search?mode=blue' },
  { label: 'Rabbit Hole',  mode: 'red',    path: '/search?mode=red' },
  { label: 'Perspectives', mode: 'purple', path: '/search?mode=purple' },
  { label: 'OSINT',        mode: 'ocean',  path: '/search?mode=ocean' },
  { label: 'Chat',         mode: 'black',  path: '/chat' },
  { label: 'Extract',      mode: 'yellow', path: '/extract' },
  { label: 'Rewards',      mode: 'orange', path: '/rewards' },
];

export default function GlobalNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Close on route change (a click already closes it, but this also covers
  // back/forward navigation and the auto-sends that redirect elsewhere).
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (item) => {
    if (item.path === '/chat') return location.pathname === '/chat';
    if (item.path === '/extract') return location.pathname === '/extract';
    if (item.path === '/rewards') return location.pathname === '/rewards';
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <motion.nav
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0a0a12] border-r border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                  <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">Menu</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
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
