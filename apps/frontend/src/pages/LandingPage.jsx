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
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ChatModeRow from '../components/landing/ChatModeRow';
import CategoryModeRow from '../components/landing/CategoryModeRow';
import SmartPill from '../components/landing/SmartPill';
import { MODE_COLORS, MODE_HINT_TEXT, searchThemeFor, searchGradientFor, searchIconFor, normalizePillMode } from '../config/modeTheme';
import HoverHint from '../components/ui/HoverHint';
import { useUnhingedGate } from '../hooks/useUnhingedGate';
import { useSettings } from '../context/SettingsContext';
import TruegleLogo from '../components/ui/TruegleLogo';
import CursorGlow from '../components/ui/CursorGlow';
import LandingBackground from '../components/LandingBackground';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import SearchBar from '../components/ui/SearchBar';
import TrailGameLink from '../components/ui/TrailGameLink';
import LandingModules from '../components/landing/LandingModules';
import LandingTagline from '../components/landing/LandingTagline';
import PickerModeRow from '../components/landing/PickerModeRow';
import { SEARCH_SCOPES } from '../utils/playerQuery';
import { OSINT_TOOLS } from '../components/ui/OSINTToolsPanel';
import { CATEGORIES as FEED_CATEGORIES } from '../config/feedCategories';
import { searchPath } from '../utils/modeRoute';

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  // The "+18 safe mode" toggle on the "Search without…" card — the SAME
  // Safe Search setting Settings itself edits, so switching it here changes
  // real behaviour everywhere, not just this card's own display. "Off"
  // requires the same bar every other gated control on the site holds to: a
  // verified sign-in (see SettingsContext.canDisableSafeSearch) — a phone
  // number or address never enters into it, just proof of an inbox.
  const { settings, updateSetting, canDisableSafeSearch } = useSettings();
  const safeModeOff = settings.safeSearch === 'off';
  const toggleSafeMode = () => {
    if (!canDisableSafeSearch) { navigate('/auth/login', { state: { redirectTo: '/' } }); return; }
    updateSetting('safeSearch', safeModeOff ? 'safe' : 'off');
  };

  // Pill Mode (spec #2, ABOVE the search bar): the SEARCH mode selector.
  // Single-select — one active at a time. Black = Chat, the default state,
  // no navigation. Every other color navigates immediately when clicked.
  const [pillMode, setPillMode] = useState(() => {
    return normalizePillMode(localStorage.getItem('truegle_pill_mode_pref'));
  });
  const [pillToast, setPillToast] = useState(null); // { label, sub, color }

  const PILL_TOAST_CONFIG = {
    black:  { label: 'Chat',             sub: 'TrueGLE answers directly',               color: 'from-neutral-200 to-neutral-400', dot: 'bg-neutral-200' },
    blue:   { label: 'Mainstream',        sub: 'Unbiased, standard search',              color: 'from-blue-500 to-blue-700',       dot: 'bg-blue-400' },
    green:  { label: 'Green',            sub: 'Zero AI — nothing generated',            color: 'from-green-500 to-emerald-700',   dot: 'bg-green-400' },
    red:    { label: 'Rabbit Hole',       sub: 'Full spectrum — all perspectives',       color: 'from-red-600 to-red-800',         dot: 'bg-red-400' },
    purple: { label: 'Wonderland',        sub: 'Isolate one perspective at a time',      color: 'from-purple-500 to-violet-700',   dot: 'bg-purple-400' },
    ocean:  { label: 'Privacy / OSINT',   sub: 'Digital investigation lens',             color: 'from-cyan-500 to-teal-700',       dot: 'bg-cyan-400' },
    // Yellow stopped being Transcripts when Extract was parked, then spent a
    // while pointed at /creators. RESTORED to Feed 2026-09-02 (modeTheme.js) —
    // the aggregated feed needs a way in that isn't typing the URL. Creators
    // isn't lost, it's a Browse category inside Feed now.
    yellow: { label: 'Feed',             sub: 'Every source you follow, one timeline',  color: 'from-yellow-400 to-amber-600',    dot: 'bg-yellow-300' },
    tube:   { label: 'True Tube',        sub: 'Watch and queue without leaving search', color: 'from-slate-300 to-slate-500',     dot: 'bg-slate-300' },
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
  // Unhinged is one of the chips in this row, so the landing page needs the
  // same gate /chat has — including snapping it back off if the user signs out
  // or turns Safe Search back on with the preference already stored.
  const { unhingedAllowed, onLockedUnhinged } = useUnhingedGate(chatModes, setChatModes);
  const toggleChatMode = (id) => {
    if (id === 'unhinged' && !unhingedAllowed) { onLockedUnhinged(); return; }
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
  // Ocean got its OWN picker below (OSINT tool, not a result category) —
  // "Search" and "Investigate" are different verbs, per the pill's own
  // activity label (PillModeRow), so they no longer share one dropdown.
  const SEARCH_MODES = ['blue', 'green', 'red', 'purple'];
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchCatOpen, setSearchCatOpen] = useState(false);
  const [searchCatTouched, setSearchCatTouched] = useState(false);
  const selectSearchCategory = (id) => { setSearchCatTouched(true); setSearchCategory(id); };
  useEffect(() => {
    if (SEARCH_MODES.includes(pillMode) && !searchCatTouched && searchQuery.trim()) {
      setSearchCatOpen(true);
    }
  }, [searchQuery, pillMode, searchCatTouched]);

  // Tube's picker: the same "what kind of result" axis /tube itself uses
  // (SEARCH_SCOPES) — All / Shorts / Channel / Song / Artist / Title / Topic —
  // seeded through as &scope= so the pick is not thrown away on submit.
  const [tubeScope, setTubeScope] = useState('all');
  const [tubeScopeOpen, setTubeScopeOpen] = useState(false);
  const [tubeScopeTouched, setTubeScopeTouched] = useState(false);
  const selectTubeScope = (id) => { setTubeScopeTouched(true); setTubeScope(id); };
  useEffect(() => {
    if (pillMode === 'tube' && !tubeScopeTouched && searchQuery.trim()) {
      setTubeScopeOpen(true);
    }
  }, [searchQuery, pillMode, tubeScopeTouched]);

  // Intel's (Ocean) picker: which OSINT tool the typed text is — the same
  // six OSINTToolsPanel itself offers — carried through as &tool=.
  const [intelTool, setIntelTool] = useState('');
  const [intelToolOpen, setIntelToolOpen] = useState(false);
  const [intelToolTouched, setIntelToolTouched] = useState(false);
  const selectIntelTool = (id) => { setIntelToolTouched(true); setIntelTool(id); };
  useEffect(() => {
    if (pillMode === 'ocean' && !intelToolTouched && searchQuery.trim()) {
      setIntelToolOpen(true);
    }
  }, [searchQuery, pillMode, intelToolTouched]);

  // Feed's picker: Browse's category NAMES only (Soc / Tube / Live / Music /
  // Entertainment / Collections / Creators) — never the listings themselves,
  // which is what Browse is for. Carried through as &category=.
  const [feedCategory, setFeedCategory] = useState('');
  const [feedCategoryOpen, setFeedCategoryOpen] = useState(false);
  const [feedCategoryTouched, setFeedCategoryTouched] = useState(false);
  const selectFeedCategory = (id) => { setFeedCategoryTouched(true); setFeedCategory(id); };
  useEffect(() => {
    if (pillMode === 'yellow' && !feedCategoryTouched && searchQuery.trim()) {
      setFeedCategoryOpen(true);
    }
  }, [searchQuery, pillMode, feedCategoryTouched]);

  // The "vs. TrueGLE" toggle was REMOVED here (owner's call, 2026-08-13). It
  // staged the Null-Prime dual-audit for /chat, and chat's register selector is
  // Unhinged now. The protocol itself is untouched in the backend — only the
  // control is gone, so re-surfacing it later is a UI change, not a rebuild.

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
    // One open feature card at a time, page-wide — see CollapsibleCard.
    <>
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

                {/* Small spacing, then the tide-fade tagline. */}
                <LandingTagline />

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
            // relative z-10: the inline transform makes this its own stacking
            // context, so without a z-index the scroll indicator (a later
            // sibling) painted over the pill's hint card.
            className="relative z-10 text-center w-full"
          >
            {/* Visually-hidden h1 — a11y/SEO title only; the wordmark logo above
                is the visible brand treatment. */}
            <h1 className="sr-only">Truegle — Unbiased, Transparent &amp; Secure Search</h1>

            {/* Pill Mode (single cycling pill, search mode selector) — ABOVE the search bar */}
            <div className="mb-3">
              <HoverHint
                isEntryPoint
                elementExplain="This is the mode pill — click it to cycle through Truegle's search modes, or press and hold to jump straight back to Chat."
                modeExplain={MODE_HINT_TEXT[pillMode]}
              >
                <SmartPill activeMode={pillMode} onSelect={handlePillModeSelect} pageMode={null} query={searchQuery} />
              </HoverHint>
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
                // The bar tells you what Enter will do before you press it:
                // a chat box on Chat, one continuous line on every search
                // mode. Tube keeps its own `singleLine`, which outranks this.
                shape={pillMode === 'black' ? 'chat' : 'line'}
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
                // The bar wears the colour of the pill above it. These were
                // hardcoded to green, so every mode but Green showed a bar that
                // disagreed with the selector.
                themeColor={searchThemeFor(pillMode)}
                searchButtonGradient={searchGradientFor(pillMode)}
                biasedButtonGradient="from-red-600 to-red-800"
                searchIconColor={searchIconFor(pillMode)}
                showSearchButton={false}
                onSearch={() => {
                  // Navigation happens here, on actual submit — honoring
                  // whichever Pill Mode is active. Black = Chat (chatModes/
                  // nephesh/verbose are already live in localStorage via their
                  // sync effects — TruegleChat reads them fresh on mount).
                  // Yellow (Feed) searches the feeds for what was typed.
                  // Everything else ->
                  // /search?mode=X.
                  const q = searchQuery.trim();
                  if (pillMode === 'black') {
                    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat');
                  } else if (pillMode === 'yellow') {
                    // Carried now: "FB Daniel Oden" has to arrive as a search,
                    // and a picked Browse category opens straight into it.
                    const catParam = feedCategory ? `${q ? '&' : '?'}category=${feedCategory}` : '';
                    navigate(`/feed${q ? `?q=${encodeURIComponent(q)}` : ''}${catParam}`);
                  } else if (pillMode === 'tube') {
                    // True Tube owns /tube — that's the link people share.
                    const scopeParam = tubeScope !== 'all' ? `${q ? '&' : '?'}scope=${tubeScope}` : '';
                    navigate(`/tube${q ? `?q=${encodeURIComponent(q)}` : ''}${scopeParam}`);
                  } else {
                    // Search color mode: carry the chosen category (if any) through
                    // to the results page as &category=; Ocean carries its OSINT
                    // tool pick the same way, as &tool=.
                    const catParam = searchCategory && searchCategory !== 'all' ? `&category=${searchCategory}` : '';
                    const toolParam = pillMode === 'ocean' && intelTool ? `&tool=${intelTool}` : '';
                    const extra = `${catParam}${toolParam}`.replace(/^&/, '');
                    const base = searchPath(pillMode, q ? { q } : '');
                    navigate(extra ? `${base}${base.includes('?') ? '&' : '?'}${extra}` : base);
                  }
                }}
                placeholder={
                  pillMode === 'red' ? 'Explore the Rabbit Hole...' :
                  pillMode === 'green' ? 'Search — concise summaries...' :
                  'Search Like G****e'
                }
                size="large"
              />
              {/* The one thing a first-time visitor needs to know. Quiet, and
                  gone once they start typing — by then they know. */}
            </div>

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
                unhingedAllowed={unhingedAllowed}
                onLockedUnhinged={onLockedUnhinged}
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

            {pillMode === 'tube' && (
              <PickerModeRow
                items={SEARCH_SCOPES}
                activeId={tubeScope}
                onSelect={selectTubeScope}
                open={tubeScopeOpen}
                onToggleOpen={() => setTubeScopeOpen((v) => !v)}
                accentColor={MODE_COLORS.tube}
                prefixLabel="Looking for"
              />
            )}

            {pillMode === 'ocean' && (
              <PickerModeRow
                items={OSINT_TOOLS}
                activeId={intelTool}
                onSelect={selectIntelTool}
                open={intelToolOpen}
                onToggleOpen={() => setIntelToolOpen((v) => !v)}
                accentColor={MODE_COLORS.ocean}
                prefixLabel="OSINT type"
              />
            )}

            {pillMode === 'yellow' && (
              <PickerModeRow
                items={FEED_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
                activeId={feedCategory}
                onSelect={selectFeedCategory}
                open={feedCategoryOpen}
                onToggleOpen={() => setFeedCategoryOpen((v) => !v)}
                accentColor={MODE_COLORS.yellow}
                prefixLabel="Browse"
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
        <div id="features" className="pt-10 pb-12 px-4">
          <div className="max-w-7xl mx-auto">
            {/* The whole page's modules — Why, Search, Chat, Tube, Feed, News,
                Markets — as ONE grid of tiles that open one at a time; see
                LandingModules. Tube is opened through the pill so the pill
                and the page agree. */}
            <LandingModules
              safeModeOff={safeModeOff}
              canDisableSafeSearch={canDisableSafeSearch}
              toggleSafeMode={toggleSafeMode}
              onOpenTube={() => { setPillMode('tube'); navigate('/tube'); }}
            />
          </div>
        </div>



        {/* No rewards CTA and no ad slot: advertising was removed from Truegle
            entirely on 2026-08-24, and the rewards program it funded went with
            it. The whole site is ad-free now, not just this page. */}

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
                      href="/red?fold=1"
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

            <div className="mt-8 text-center">
              <TrailGameLink />
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
    </>
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
