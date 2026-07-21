import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Search } from 'lucide-react';
import { MODE_COLORS } from '../../config/modeTheme';
import TruegleLogo from './TruegleLogo';

// The seven destinations — same set as the old GlobalNav drawer, now doubling
// as the color-coded pill row so search + every mode is reachable from any
// page (the user's "don't get stuck on a route" requirement).
const ITEMS = [
  { label: 'Search',       mode: 'blue',   path: '/search?mode=blue' },
  { label: 'Rabbit Hole',  mode: 'red',    path: '/search?mode=red' },
  { label: 'Perspectives', mode: 'purple', path: '/search?mode=purple' },
  { label: 'OSINT',        mode: 'ocean',  path: '/search?mode=ocean' },
  { label: 'Chat',         mode: 'black',  path: '/chat' },
  { label: 'Extract',      mode: 'yellow', path: '/extract' },
  { label: 'Rewards',      mode: 'orange', path: '/rewards' },
];

// Pages that own their full-screen branding (or must stay chrome-free).
const HIDDEN_PATHS = new Set(['/', '/auth/login', '/auth/signup', '/onboarding']);

function currentMode(location) {
  const p = location.pathname;
  if (p === '/chat') return 'black';
  if (p === '/extract') return 'yellow';
  if (p === '/rewards') return 'orange';
  if (p.startsWith('/osint')) return 'ocean';
  if (p === '/green') return 'green';
  if (p === '/search') return new URLSearchParams(location.search).get('mode') || 'blue';
  return 'blue';
}

export default function BrandBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  const mode = currentMode(location);
  const accent = MODE_COLORS[mode];

  const isActive = (item) => {
    if (item.path === '/chat') return location.pathname === '/chat';
    if (item.path === '/extract') return location.pathname === '/extract';
    if (item.path === '/rewards') return location.pathname === '/rewards';
    const params = new URLSearchParams(location.search);
    return location.pathname === '/search' && (params.get('mode') || 'blue') === item.mode;
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (mode === 'black') navigate(`/chat?q=${encodeURIComponent(q)}`);
    else navigate(`/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  };

  return (
    <header
      className="sticky top-0 z-[60] w-full bg-[#0a0a12]/90 backdrop-blur-xl border-b"
      style={{ borderColor: `${accent}55` }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
        {/* Menu */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="w-9 h-9 rounded-full border border-white/15 hover:border-white/30 flex items-center justify-center text-white/80 hover:text-white transition-colors flex-shrink-0"
        >
          <Menu size={17} />
        </button>

        {/* Logo → home */}
        <button onClick={() => navigate('/')} className="flex-shrink-0" aria-label="Home">
          <TruegleLogo size="small" animated={false} />
        </button>

        {/* Search */}
        <form onSubmit={submitSearch} className="flex-1 min-w-0 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full h-9 pl-9 pr-3 rounded-full bg-black/40 border text-sm text-white placeholder-white/40 focus:outline-none transition-all"
            style={{ borderColor: `${accent}44` }}
            onFocus={(e) => (e.target.style.borderColor = accent)}
            onBlur={(e) => (e.target.style.borderColor = `${accent}44`)}
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        </form>

        {/* Pills (destinations) — scrollable, hidden on the smallest screens */}
        <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto flex-shrink min-w-0">
          {ITEMS.map((item) => {
            const active = isActive(item);
            const color = MODE_COLORS[item.mode];
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                  active ? 'text-white' : 'text-white/60 hover:text-white border-transparent'
                }`}
                style={active ? { backgroundColor: `${color}22`, borderColor: `${color}88` } : undefined}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Slide-out drawer (covers the pill set on mobile + gives every route the full menu) */}
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
    </header>
  );
}
