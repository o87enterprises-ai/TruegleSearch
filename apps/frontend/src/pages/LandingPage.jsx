import { cssDebug } from '../utils/cssDebug';
// 🚫 NO ADS ON THE LANDING PAGE. Do not import AdSlot / AdsterraBanner /
// SponsoredAd / RewardAdSlot into this file or any component it renders.
// See docs/AD-POLICY.md — enforced by `npm run check:ads` (runs on build).
// MAIN LANDING PAGE ROUTE COMPONENT
// This file is now the canonical LandingPage for route "/".
// Please update your project imports to use this file for the landing page.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Mic,
  Camera,
  Paperclip,
  File as FileIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModesAndTrending from '../components/landing/ModesAndTrending';
import ChatModeRow from '../components/landing/ChatModeRow';
import CategoryModeRow from '../components/landing/CategoryModeRow';
import PillModeRow from '../components/landing/PillModeRow';
import { MODE_COLORS } from '../config/modeTheme';
import VsToggleRow from '../components/landing/VsToggleRow';
import ThreeCards from '../components/landing/ThreeCards';
import PlayerFeatureCard from '../components/landing/PlayerFeatureCard';
import TruegleLogo from '../components/ui/TruegleLogo';
import CursorGlow from '../components/ui/CursorGlow';
import LandingBackground from '../components/LandingBackground';
import FeaturedCreator from '../components/FeaturedCreator';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import SearchBar from '../components/ui/SearchBar';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Pill Mode (spec #2, ABOVE the search bar): the SEARCH mode selector.
  // Single-select — one active at a time. Black = Chat, the default state,
  // no navigation. Every other color navigates immediately when clicked.
  const [pillMode, setPillMode] = useState(() => {
    return localStorage.getItem('truegle_pill_mode_pref') || 'black';
  });
  const [pillToast, setPillToast] = useState(null); // { label, sub, color }

  const PILL_TOAST_CONFIG = {
    black:  { label: 'Chat',             sub: 'TrueGLE answers directly',               color: 'from-neutral-200 to-neutral-400', dot: 'bg-neutral-200' },
    blue:   { label: 'Mainstream',        sub: 'Unbiased, standard search',              color: 'from-blue-500 to-blue-700',       dot: 'bg-blue-400' },
    green:  { label: 'Summarize',          sub: 'Concise, plain-language answers',        color: 'from-green-500 to-emerald-700',   dot: 'bg-green-400' },
    red:    { label: 'Rabbit Hole',       sub: 'Full spectrum — all perspectives',       color: 'from-red-600 to-red-800',         dot: 'bg-red-400' },
    purple: { label: 'Perspectives',      sub: 'Multiple viewpoints, skeptical framing', color: 'from-purple-500 to-violet-700',   dot: 'bg-purple-400' },
    ocean:  { label: 'Privacy / OSINT',   sub: 'Digital investigation lens',             color: 'from-cyan-500 to-teal-700',       dot: 'bg-cyan-400' },
    orange: { label: 'Rewards',           sub: 'Earn a share of ad revenue',             color: 'from-orange-500 to-amber-700',    dot: 'bg-orange-400' },
    yellow: { label: 'Transcripts',       sub: 'Extract & transcribe',                   color: 'from-yellow-400 to-amber-600',    dot: 'bg-yellow-300' },
    tube:   { label: 'Tube',             sub: 'Watch and queue without leaving search', color: 'from-slate-300 to-slate-500',     dot: 'bg-slate-300' },
  };

  // Pill Mode click handler — cycling the single pill only ever changes
  // state, it never navigates. Navigation happens when the query is actually
  // submitted (see the search bar's onSearch below), honoring whichever
  // mode is active at that moment.
  const handlePillModeSelect = (id) => {
    setPillMode(id);
    localStorage.setItem('truegle_pill_mode_pref', id);
    const cfg = PILL_TOAST_CONFIG[id];
    if (cfg) {
      setPillToast(cfg);
      setTimeout(() => setPillToast(null), 2200);
    }
  };

  // Chat Mode row (spec #4, below the search bar): the CHAT lens selector.
  // Multi-select — mirrors TruegleChat.jsx's own toggleMode/modes exactly,
  // and is persisted to the SAME localStorage keys TruegleChat reads on
  // mount, so whatever's staged here carries silently into /chat.
  const [chatModes, setChatModes] = useState(() => {
    try {
      const raw = localStorage.getItem('truegle_modes_pref');
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length) return arr;
    } catch { /* fall through */ }
    return ['blue'];
  });
  // Collapsible by default (like the AI-summary card) so the hero doesn't dump
  // every option on a first-time visitor. Auto-opens the moment someone starts
  // typing while still in Chat mode without having picked a lens yet — that's
  // the one case where staying collapsed would silently hide a real decision.
  // Once the user has touched it themselves, we stop auto-opening it for them.
  const [chatModesOpen, setChatModesOpen] = useState(false);
  const [chatModeTouched, setChatModeTouched] = useState(false);
  const toggleChatMode = (id) => {
    setChatModeTouched(true);
    setChatModes((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };
  useEffect(() => {
    localStorage.setItem('truegle_modes_pref', JSON.stringify(chatModes));
    localStorage.setItem('truegle_mode_pref', chatModes[0]);
  }, [chatModes]);
  useEffect(() => {
    if (pillMode === 'black' && !chatModeTouched && searchQuery.trim()) {
      setChatModesOpen(true);
    }
  }, [searchQuery, pillMode, chatModeTouched]);

  // Search-category row (the counterpart to the chat modes): the moment the
  // Pill Mode switches from Chat (black) to a search color, the chat lenses are
  // replaced by the scrollable, collapsible search categories. Single-select;
  // 'all' is the default and adds no URL param. Same minimized-by-default +
  // auto-open-on-typing behavior as the chat modes.
  const SEARCH_MODES = ['blue', 'green', 'red', 'purple', 'ocean'];
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchCatOpen, setSearchCatOpen] = useState(false);
  const [searchCatTouched, setSearchCatTouched] = useState(false);
  const selectSearchCategory = (id) => { setSearchCatTouched(true); setSearchCategory(id); };
  useEffect(() => {
    if (SEARCH_MODES.includes(pillMode) && !searchCatTouched && searchQuery.trim()) {
      setSearchCatOpen(true);
    }
  }, [searchQuery, pillMode, searchCatTouched]);

  // vs. TrueGLE (Null-Prime dual-audit) — same localStorage key TruegleChat.jsx
  // reads on mount, so a preference set here carries silently into the first
  // /chat visit. (Verbosity is no longer a toggle: chat is verbose by default,
  // and the "Summarize" mode makes it concise.)
  const [nepheshMode, setNepheshMode] = useState(() => localStorage.getItem('truegle_nephesh_mode') === 'true');
  useEffect(() => { localStorage.setItem('truegle_nephesh_mode', String(nepheshMode)); }, [nepheshMode]);

  // Backwards-compat derived value for JSX that used isRedPillMode
  const isRedPillMode = pillMode === 'red';

  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionType, setPermissionType] = useState(null);
  const [showMicrophoneInterface, setShowMicrophoneInterface] = useState(false);
  const [showCameraInterface, setShowCameraInterface] = useState(false);
  const [showFilesInterface, setShowFilesInterface] = useState(false);
  const [transcript, setTranscript] = useState('');
  // Filter state (like SearchResults page)
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all',
  });

  // Simulate microphone transcription
  useEffect(() => {
    if (!showMicrophoneInterface) return;

    const sampleTranscripts = [
      'Search for quantum physics papers',
      'Find information about renewable energy',
      'Show me the latest news on AI development',
      'What is the weather forecast for tomorrow?',
      'How does blockchain technology work?',
      'Find recipes for vegan chocolate cake',
      'Who won the Nobel Prize in Physics this year?',
      'Explain the theory of relativity in simple terms',
    ];

    const interval = setInterval(() => {
      if (showMicrophoneInterface) {
        setTranscript(
          sampleTranscripts[
            Math.floor(Math.random() * sampleTranscripts.length)
          ]
        );
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showMicrophoneInterface]);

  return (
    <div
      className={`min-h-screen relative ${isRedPillMode ? 'bg-[#1a0a0a]' : 'bg-blue-900/20'}`}
    >
      {/* Animated background: always-on CSS aurora/starfield with the rich WebGL
          layer gated behind capability detection + an error boundary that falls
          back to the CSS layer (so it can never crash-loop like before). */}
      <LandingBackground />

      {/* Content */}
      <div className="relative z-10">
        {/* Cursor Glow Effect - only after animation */}
        <CursorGlow />

        {/* Hero Section */}
        <div className="min-h-0 flex flex-col items-center justify-start px-4 pt-24 pb-20 relative">
          {/* Logo - will be shown after animation */}
          <div
            className="text-center w-full"
            style={{
              opacity: 1,
              transition: 'opacity 0.1s linear',
            }}
          >
            {/* Logo with reflection effect */}
            <div className="mb-2 inline-block">
              <div
                className="relative"
                style={{
                  filter:
                    'drop-shadow(0 0 20px rgba(139,92,246,0.3)) drop-shadow(0 0 40px rgba(139,92,246,0.2))',
                  transition: 'filter 0.1s linear',
                }}
              >
                <motion.div
                  animate={{
                    scale: [1, 1.01, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '16px',
                      transform: 'scale(1.4)',
                      transformOrigin: 'center',
                    }}
                  >
                    <TruegleLogo size="xxxlarge" animated={true} />
                  </div>
                </motion.div>

                {/* Reflection underneath logo */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
                  style={{
                    top: '100%',
                    width: '100%',
                    height: '60px',
                    background:
                      'linear-gradient(to bottom, rgba(139,92,246,0.3) 0%, transparent 100%)',
                    filter: 'blur(20px)',
                    transform: 'scaleY(-0.3) translateY(-20px)',
                    opacity: 0.5,
                  }}
                />
              </div>
            </div>
          </div>

          {/* UI Content - fades in after animation completes */}
          <div
            style={{
              opacity: 1,
              transform: 'translateY(0px)',
              transition: 'transform 0.3s ease-out',
              pointerEvents: 'auto',
            }}
            className="text-center w-full"
          >
            {/* Visually-hidden h1 — a11y/SEO title only; the wordmark logo above
                is the visible brand treatment. */}
            <h1 className="sr-only">Truegle — Unbiased, Transparent &amp; Secure Search</h1>

            {/* Pill Mode (single cycling pill, search mode selector) — ABOVE the search bar */}
            <div className="mb-3">
              <PillModeRow activeMode={pillMode} onSelect={handlePillModeSelect} />
            </div>

            {/* Search Bar */}
            <div className="w-full max-w-2xl mx-auto px-4 mb-2 relative">
              {/* Mode toast — portalled to <body> so it escapes the hero's
                  transformed/filtered ancestors (which would otherwise capture
                  position:fixed and pin it mid-page over the controls). Anchored
                  to the top of the viewport, well clear of the pill + search bar. */}
              {pillToast && createPortal(
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="fixed left-1/2 top-4 -translate-x-1/2 z-[9999] pointer-events-none"
                >
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${pillToast.color} shadow-lg shadow-black/40`}>
                    <div className={`w-2 h-2 rounded-full ${pillToast.dot} shrink-0`} />
                    <span className="text-white text-sm font-semibold whitespace-nowrap">{pillToast.label}</span>
                    <span className="text-white/60 text-xs whitespace-nowrap hidden sm:inline">— {pillToast.sub}</span>
                  </div>
                </motion.div>,
                document.body
              )}
              <SearchBar
                // Chat pill = a chat box: declutter to a normal-search-box feel
                // (mic/camera/attach behind a "+", more compact growth).
                variant={pillMode === 'black' ? 'chat' : 'default'}
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(typeof e === 'string' ? e : e.target.value)
                }
                // Tube's bar is the player's bar: single line, no filters,
                // and voice only — a camera and a file picker have nothing to
                // do with choosing something to watch.
                showFilters={pillMode !== 'black' && pillMode !== 'tube'}
                filters={filters}
                onFiltersChange={setFilters}
                compactFilters={false}
                showFilterToggle={pillMode !== 'tube'}
                singleLine={pillMode === 'tube'}
                showCameraInput={pillMode !== 'tube'}
                showFileInput={pillMode !== 'tube'}
                themeColor="green"
                searchButtonGradient="from-green-600 to-emerald-600"
                biasedButtonGradient="from-red-600 to-red-800"
                searchIconColor="text-green-500/80"
                showSearchButton={false}
                onSearch={() => {
                  // Navigation happens here, on actual submit — honoring
                  // whichever Pill Mode is active. Black = Chat (chatModes/
                  // nephesh/verbose are already live in localStorage via their
                  // sync effects — TruegleChat reads them fresh on mount).
                  // Orange/Yellow have no query concept, so they just jump to
                  // their page. Everything else -> /search?mode=X.
                  const q = searchQuery.trim();
                  if (pillMode === 'black') {
                    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
                  } else if (pillMode === 'orange') {
                    navigate('/rewards');
                  } else if (pillMode === 'yellow') {
                    navigate('/extract');
                  } else {
                    // Search color mode: carry the chosen category (if any) through
                    // to the results page as &category=.
                    const catParam = searchCategory && searchCategory !== 'all' ? `&category=${searchCategory}` : '';
                    navigate(q
                      ? `/search?q=${encodeURIComponent(q)}&mode=${pillMode}${catParam}`
                      : `/search?mode=${pillMode}${catParam}`);
                  }
                }}
                placeholder={
                  pillMode === 'red' ? 'Explore the Rabbit Hole...' :
                  pillMode === 'green' ? 'Search — concise summaries...' :
                  'Search Truegle...'
                }
                size="large"
              />
            </div>

            {/* Player introduction — directly under the search bar. Hidden in
                Tube mode, where the bar already IS the player and the card
                would be introducing something the user is looking at. */}
            {pillMode !== 'tube' && (
              <PlayerFeatureCard onOpen={() => { setPillMode('tube'); navigate('/tube'); }} />
            )}

            {/* Chat Mode row (multi-select chat lenses) — directly below the
                search bar. Collapsed by default; only relevant in Chat mode
                (retracts + locks the moment the pill switches to a search
                color, since filters/safe-search take over down there). */}
            {pillMode === 'black' && (
              <ChatModeRow
                activeModes={chatModes}
                onToggle={toggleChatMode}
                open={chatModesOpen}
                onToggleOpen={() => setChatModesOpen((v) => !v)}
              />
            )}

            {/* Search categories — swapped in for the chat modes whenever a
                search-color pill is active (Chat is black). Same collapsible,
                scrollable treatment; the pick rides the /search URL. */}
            {SEARCH_MODES.includes(pillMode) && (
              <CategoryModeRow
                activeCategory={searchCategory}
                onSelect={selectSearchCategory}
                open={searchCatOpen}
                onToggleOpen={() => setSearchCatOpen((v) => !v)}
                accentColor={MODE_COLORS[pillMode]}
              />
            )}

            {/* vs. TrueGLE toggle — a Chat-only feature (the Null-Prime
                dual-audit layers onto chat answers), so it disappears the
                same way chat modes do the moment the pill switches to a
                search color. */}
            {pillMode === 'black' && (
              <VsToggleRow
                nepheshMode={nepheshMode}
                onToggleNephesh={() => setNepheshMode((v) => !v)}
              />
            )}

          </div>

          {/* Scroll Indicator - only shows after animation */}
          <motion.div
            animate={{
              y: [0, 10, 0],
              opacity: 1,
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-10"
          >
            <div className="w-6 h-10 border-2 border-purple-500/50 rounded-full flex justify-center">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2"
              />
            </div>
          </motion.div>
        </div>

        {/* Features Section (Learn More scrolls here: three principles + cards) */}
        <div id="features" className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-headline-large mb-4">
                <span className="gradient-orange-purple">Why Truegle?</span>
              </h2>
            </motion.div>

            {/* The three promises, simplified into one horizontal card
                (was three separate stacked cards). */}
            <div className="mb-16 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 sm:p-6 shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                  {[
                    { label: 'Bias', detail: 'All perspectives welcome', color: 'text-purple-400', dot: 'bg-purple-500 border-purple-300 shadow-purple-500/30' },
                    { label: 'Tracking', detail: 'Auto history deletion', color: 'text-green-400', dot: 'bg-green-500 border-green-300 shadow-green-500/30' },
                    { label: 'Censorship', detail: 'Freedom + Rights – Judgement', color: 'text-red-400', dot: 'bg-red-500 border-red-300 shadow-red-500/30' },
                  ].map((p) => (
                    <div key={p.label} className="flex flex-col items-center text-center gap-2 py-3 sm:py-0 sm:px-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg ${p.dot}`}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <line x1="3" y1="7" x2="11" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      </div>
                      <span className={`font-bold text-base ${p.color}`}>{p.label}</span>
                      <span className="text-white/80 text-sm">{p.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Brief explanations: chat modes, search modes, vs. TrueGLE / GLE */}
            <ThreeCards />
          </div>
        </div>

        {/* Mode showcase + Trending feed — bonus content beneath the core
            spec flow (not one of the 9 numbered landing sections, kept
            because the live trending feed is real backend-integrated work). */}
        <ModesAndTrending />

        {/* Featured Creator slot — surfaces the weekly featured YouTuber's
            latest upload, links to their on-site /creator page. */}
        <FeaturedCreator />

        {/* Rewards CTA removed 2026-07-24 — the ad-pay/rewards program is paused
            (Adsterra pays CPM, not the clicks the loop rewarded). Re-add when the
            program returns. */}

        {/* Landing-page ad slot REMOVED 2026-08-01 — the Adsterra tag hijacked
            the top window (redirect to bulsis.net/go/...) and made the site
            unusable for first-time visitors. The landing page stays ad-free
            permanently; see docs/AD-POLICY.md. */}

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-purple-500/20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <TruegleLogo size="small" animated={false} className="mb-4" />
                <p className="text-body-medium text-gray-400">
                  Unbiased, transparent, and private search.
                </p>
              </div>

              <div>
                <h4 className="text-title-small text-white mb-4">Product</h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="/search"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Search
                    </a>
                  </li>
                  <li>
                    <a
                      href="/search?mode=purple"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Feeling Biased
                    </a>
                  </li>
                  <li>
                    <a
                      href="/osint/tools"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      OSINT Tools
                    </a>
                  </li>
                  <li>
                    <a
                      href="/pricing"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-title-small text-white mb-4">Company</h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      About
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Terms
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-title-small text-white mb-4">Connect</h4>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Twitter
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Discord
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="text-body-medium text-gray-400 hover:text-purple-400 transition-colors"
                    >
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-purple-500/20 flex justify-center">
              <AnonymousSearchLink />
            </div>

            <div className="mt-8 text-center text-body-small text-gray-500">
              © 2025 Truegle. All rights reserved.
            </div>
          </div>
        </footer>
      </div>

      {/* Learn More removed 2026-08-04 — the fixed bottom-right pill sat on
          top of whatever scrolled under it (it was clipping the player feature
          card on a phone). The features section is still reachable by
          scrolling and from the footer. */}

      {/* Permission Request Modal */}
      {showPermissions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-gray-900 border-2 border-cyan-500 p-8 rounded-2xl shadow-lg">
            <h3 className="text-2xl font-bold text-cyan-400 mb-6 text-center">
              Allow Truegle Permissions
            </h3>

            <p className="text-white mb-6 text-center">to access your:</p>

            <div className="space-y-4 mb-8">
              {permissionType === 'microphone' && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <Mic size={24} className="text-cyan-400" />
                  <span className="text-white">Microphone</span>
                </div>
              )}

              {permissionType === 'camera' && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <Camera size={24} className="text-cyan-400" />
                  <span className="text-white">Camera</span>
                </div>
              )}

              {permissionType === 'files' && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                  <Paperclip size={24} className="text-cyan-400" />
                  <span className="text-white">Files and Media</span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowPermissions(false);
                  // Activate the selected media type
                  if (permissionType === 'microphone') {
                    setShowMicrophoneInterface(true);
                  } else if (permissionType === 'camera') {
                    setShowCameraInterface(true);
                  } else if (permissionType === 'files') {
                    setShowFilesInterface(true);
                  }
                }}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30"
              >
                ALLOW
              </button>

              <button
                onClick={() => setShowPermissions(false)}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
              >
                DENY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Microphone Interface */}
      {showMicrophoneInterface && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
          {/* Threads Background */}
          <div className="absolute inset-0 opacity-30">
            <div className="w-full h-full relative overflow-hidden">
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
                  style={{
                    top: `${(i * 10) % 100}%`,
                    left: '-100%',
                    animation: `thread-move-${i} linear infinite`,
                    animationDuration: `${Math.random() * 3 + 2}s`,
                    opacity: 0.3 + Math.random() * 0.4,
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Blur Text Animation */}
          <div className="relative z-10 text-center mb-8">
            <h2
              className="text-4xl md:text-6xl font-bold text-white"
              style={{
                filter: `blur(${Math.random() * 4}px)`,
                animation: 'blur-text 3s ease-in-out infinite alternate',
              }}
            >
              {transcript || 'Speak now...'}
            </h2>
          </div>

          <div className="relative z-10">
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center animate-pulse">
              <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center">
                <Mic size={48} className="text-cyan-400" />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              navigate('/auth/login', { state: { showFreemiumMessage: true } });
              setShowMicrophoneInterface(false);
              setTranscript('');
            }}
            className="mt-8 px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all"
          >
            STOP
          </button>
        </div>
      )}

      {/* Camera Interface */}
      {showCameraInterface && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-2xl h-2/3 bg-gray-900 rounded-xl overflow-hidden border-2 border-cyan-500">
            {/* Camera preview simulation */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gray-700 border-4 border-dashed border-cyan-500 mx-auto flex items-center justify-center mb-4">
                  <Camera size={64} className="text-cyan-400" />
                </div>
                <p className="text-white text-lg">Camera Preview</p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className="absolute top-4 right-4 bg-gray-800/80 backdrop-blur px-3 py-2 rounded-full">
              <span className="text-white text-sm">Front/Back</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-8 mt-6">
            {/* Snap Photo Button */}
            <button className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center hover:from-cyan-500 hover:to-blue-500 transition-all">
              <div className="w-16 h-16 rounded-full bg-white"></div>
            </button>

            {/* Record Button */}
            <button className="w-16 h-16 rounded-full bg-gradient-to-r from-red-600 to-red-800 flex items-center justify-center hover:from-red-500 hover:to-red-700 transition-all">
              <div className="w-8 h-8 rounded bg-white"></div>
            </button>
          </div>

          <button
            onClick={() => {
              navigate('/auth/login', { state: { showFreemiumMessage: true } });
              setShowCameraInterface(false);
            }}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
          >
            CLOSE
          </button>
        </div>
      )}

      {/* Files Interface */}
      {showFilesInterface && (
        <div className="fixed inset-0 bg-black z-50 p-4 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-8">
              Select Files & Media
            </h2>

            {/* Dome Gallery Simulation */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gradient-to-br from-cyan-700/50 to-purple-700/50 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform border-2 border-cyan-500/30"
                  onClick={() => {
                    // Show larger preview
                    const preview = document.getElementById(`preview-${i}`);
                    if (preview) {
                      preview.classList.toggle('hidden');
                    }
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-white text-center">
                      <FileIcon size={32} className="mx-auto mb-2" />
                      <span className="text-xs">File {i + 1}</span>
                    </div>
                  </div>

                  {/* Preview Overlay */}
                  <div
                    id={`preview-${i}`}
                    className="hidden fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                  >
                    <div className="relative max-w-3xl w-full">
                      <div className="bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto">
                        <h3 className="text-2xl font-bold text-white mb-4">
                          File {i + 1} Preview
                        </h3>

                        <div className="bg-gray-700/50 rounded-lg p-8 mb-6 flex items-center justify-center aspect-video">
                          <div className="text-center">
                            <FileIcon
                              size={64}
                              className="text-cyan-400 mx-auto mb-4"
                            />
                            <p className="text-white">
                              Preview of File {i + 1}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-center gap-4">
                          <button className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all">
                            YES
                          </button>

                          <button
                            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all"
                            onClick={() => {
                              const preview = document.getElementById(
                                `preview-${i}`
                              );
                              if (preview) {
                                preview.classList.add('hidden');
                              }
                            }}
                          >
                            NO
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  navigate('/auth/login', { state: { showFreemiumMessage: true } });
                  setShowFilesInterface(false);
                }}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Add the CSS for all animations
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = `
  @keyframes glitch-letters {
    0% { opacity: 0.8; transform: translateX(0); }
    20% { opacity: 0.4; transform: translateX(-2px); }
    40% { opacity: 1; transform: translateX(2px); }
    60% { opacity: 0.6; transform: translateX(-1px); }
    80% { opacity: 0.9; transform: translateX(1px); }
    100% { opacity: 0.8; transform: translateX(0); }
  }

  @keyframes blur-text {
    0% { filter: blur(0px); }
    100% { filter: blur(4px); }
  }

  .perspective-1000 {
    perspective: 1000px;
  }

  ${Array.from({ length: 50 })
    .map(
      (_, i) => `
    @keyframes thread-move-${i} {
      0% { left: -100%; }
      100% { left: 100%; }
    }
  `
    )
    .join('')}
`;
document.head.appendChild(styleSheet);

{
  /* Add this somewhere in your LandingPage component */
}
<div className="mt-8 p-4 border border-yellow-400 rounded-lg bg-yellow-50 text-yellow-800">
  <h3 className="text-lg font-bold mb-2">🎮 Test 404 Game</h3>
  <p className="mb-3">Test the Game Boy 404 page:</p>
  <a
    href="/gameboy-404-test"
    className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
  >
    Play 404 Game Boy Game
  </a>
  <p className="text-sm mt-2">
    Click to test the 404 page with the side-scrolling game
  </p>
</div>;
