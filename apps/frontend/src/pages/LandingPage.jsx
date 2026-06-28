import { cssDebug } from '../utils/cssDebug';
import ReviveAd from '../components/ads/ReviveAd';
// MAIN LANDING PAGE ROUTE COMPONENT
// This file is now the canonical LandingPage for route "/".
// Please update your project imports to use this file for the landing page.

import { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Shield,
  Zap,
  Eye,
  ChevronRight,
  Sparkles,
  Filter,
  Gift,
  Mic,
  Camera,
  Paperclip,
  File as FileIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModesAndTrending from '../components/landing/ModesAndTrending';
import TruegleLogo from '../components/ui/TruegleLogo';
import NeonButton from '../components/ui/NeonButton';
import GlassCard from '../components/ui/GlassCard';
import CursorGlow from '../components/ui/CursorGlow';
import EnhancedFeatureCard from '../components/ui/EnhancedFeatureCard';
import BackgroundAnimation from '../components/BackgroundAnimation';
import AnonymousSearchLink from '../components/ui/AnonymousSearchLink';
import SearchBar from '../components/ui/SearchBar';
import ShareForPremiumButton from '../components/ui/ShareForPremiumButton';
import FuzzyText from '../components/ui/FuzzyText';
import GlitchRotatingText from '../components/ui/GlitchRotatingText';
import SpotlightButton from '../components/ui/SpotlightButton';
import { LearnMoreButton } from '../components/ui/FallingText';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import GlitchText from '../components/ui/GlitchText';
import RotatingGlitchText from '../components/ui/RotatingGlitchText';

/**
 * SafeButton - Fallback button when animations crash
 */
const SafeButton = ({ onClick, variant, children, className = '' }) => {
  const variantStyles = {
    search: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400',
    cta: 'bg-red-600 hover:bg-red-500 border-red-400',
    feature: 'bg-purple-600 hover:bg-purple-500 border-purple-400',
  };

  return (
    <button
      onClick={onClick}
      className={`
        px-8 py-4 rounded-xl font-semibold text-white
        border transition-all duration-200
        hover:scale-102 active:scale-98
        flex items-center justify-center gap-2
        ${variantStyles[variant] || variantStyles.search}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

/**
 * SafeLearnMore - Fallback Learn More button
 */
const SafeLearnMore = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`
      py-4 px-8
      bg-black/60 backdrop-blur-md
      border border-purple-500/50
      rounded-xl
      cursor-pointer
      text-headline-medium hover:scale-105 active:scale-98
      hover:bg-black/80 hover:border-purple-400/70
      shadow-lg shadow-purple-500/20
      transition-all duration-200
      ${className}
    `}
    style={{ zIndex: 100 }}
  >
    <span className="text-purple-400 font-semibold drop-shadow-[0_0_10px_rgba(147,51,234,0.5)]">
      Learn More
    </span>
  </button>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [pillMode, setPillMode] = useState(() => {
    return localStorage.getItem('truegle_pill_mode') || 'blue';
  });
  const [pillToast, setPillToast] = useState(null); // { label, sub, color }

  const PILL_TOAST_CONFIG = {
    blue:  { label: 'Default Mode',  sub: 'Unbiased, standard search',       color: 'from-blue-500 to-blue-700',   dot: 'bg-blue-400' },
    green: { label: 'AI Free Mode',  sub: 'Raw results — no smart features',  color: 'from-green-500 to-emerald-700', dot: 'bg-green-400' },
    red:   { label: 'Deep Dive Mode', sub: 'Full spectrum — all perspectives', color: 'from-red-600 to-red-800',     dot: 'bg-red-400' },
  };

  const updatePillMode = (mode) => {
    setPillMode(mode);
    localStorage.setItem('truegle_pill_mode', mode);
    // Show brief toast notification
    const cfg = PILL_TOAST_CONFIG[mode];
    if (cfg) {
      setPillToast(cfg);
      setTimeout(() => setPillToast(null), 2200);
    }
  };

  // Backwards-compat derived value for JSX that used isRedPillMode
  const isRedPillMode = pillMode === 'red';

  const [showWarning, setShowWarning] = useState(false);
  const [showGlitch, setShowGlitch] = useState(false);
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
  const [isOSINTMode, setIsOSINTMode] = useState(() => {
    const savedMode = localStorage.getItem('isOSINTMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const updateOSINTMode = (mode) => {
    setIsOSINTMode(mode);
    localStorage.setItem('isOSINTMode', JSON.stringify(mode));
  };

  // Constant arrays for GlitchRotatingText to avoid infinite loop
  const thoughtBubbleWords = ['Bias', 'Tracking', 'Censorship'];

  // OSINT toggle handler
  const toggleOSINT = () => {
    const newMode = !isOSINTMode;
    updateOSINTMode(newMode);
    if (newMode) {
      navigate('/osint/tools');
    }
  };

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

  // Electric border animation for warning card
  useEffect(() => {
    if (!showWarning) return;

    const timeoutId = setTimeout(() => {
      const card = document.getElementById('warning-card');
      if (!card) return;

      // Continuous animation with JavaScript for more control
      let frameCount = 0;
      const animateBorder = () => {
        frameCount++;
        // Create more dynamic electric effect
        const intensity = Math.sin(frameCount * 0.2) * 0.3 + 0.7;
        const glowSize = 15 + Math.sin(frameCount * 0.3) * 5;
        const hueShift = (frameCount * 2) % 360;

        // Update the box shadow for electric border effect
        card.style.boxShadow = `
          0 0 ${glowSize}px hsl(${hueShift}, 100%, 65%, ${0.5 * intensity}),
          inset 0 0 ${glowSize / 2}px hsl(${hueShift}, 100%, 65%, ${0.2 * intensity})
        `;

        if (showWarning) {
          requestAnimationFrame(animateBorder);
        }
      };

      const animationId = requestAnimationFrame(animateBorder);

      return () => {
        cancelAnimationFrame(animationId);
      };
    }, 10); // Small delay to ensure DOM is updated

    return () => {
      clearTimeout(timeoutId);
    };
  }, [showWarning]);

  const features = [
    {
      icon: Sparkles,
      title: 'Self-Hosted Private SERP',
      description:
        'Results powered by our own SearXNG metasearch instance — no Google tracking, no API quotas, no corporate censorship. Real results, no middlemen.',
      gradient: 'rgba(34, 197, 94, 1), rgba(0, 229, 255, 1)',
    },
    {
      icon: Zap,
      title: 'OSINT Intelligence Tools',
      description:
        'Ethical digital forensics built in. Look up usernames, emails, phone numbers, and domains without leaving the search page.',
      gradient: 'rgba(255, 107, 0, 1), rgba(239, 68, 68, 1)',
    },
    {
      icon: Eye,
      title: 'Anonymous View',
      description:
        'Open any result through our privacy proxy — the destination site never sees your real IP. Browse links from search results without leaving a trail.',
      gradient: 'rgba(139, 92, 246, 1), rgba(59, 130, 246, 1)',
    },
    {
      icon: Filter,
      title: 'Multi-Perspective AI Summary',
      description:
        'Every search gets an AI-generated briefing that surfaces mainstream, alternative, and opposing viewpoints side-by-side — not just the consensus.',
      gradient: 'rgba(245, 158, 11, 1), rgba(239, 68, 68, 1)',
    },
    {
      icon: Mic,
      title: 'Content Transcriber',
      description:
        'Paste any YouTube URL and get the full transcript instantly — no account needed. Extract images from any public page. 3 free uses per day.',
      gradient: 'rgba(234, 179, 8, 1), rgba(251, 146, 60, 1)',
    },
    {
      icon: Gift,
      title: 'Ad Rewards Program',
      description:
        'Opt in and earn real cash for ads you actually watch while results load. No extra tracking, no fake points — server-side measured, PayPal cashout.',
      gradient: 'rgba(16, 185, 129, 1), rgba(6, 182, 212, 1)',
    },
    {
      icon: Paperclip,
      title: 'Social Feed Aggregator',
      description:
        'Reddit, Hacker News, GitHub, and YouTube feeds unified in a single tab — no login, no algorithm. Switch platforms without leaving Truegle.',
      gradient: 'rgba(99, 102, 241, 1), rgba(168, 85, 247, 1)',
    },
    {
      icon: Shield,
      title: 'No Bias. No Tracking. No Agenda.',
      description:
        'History auto-deletes. Zero cookies. No profiling. Every query is treated the same whether you\'re a student, journalist, or researcher.',
      gradient: 'rgba(20, 184, 166, 1), rgba(34, 197, 94, 1)',
    },
  ];

  return (
    <div
      className={`min-h-screen relative ${isRedPillMode ? 'bg-[#1a0a0a]' : 'bg-blue-900/20'}`}
    >
      {/* Background Animation */}
      <BackgroundAnimation />

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
            <h1
              className="text-[clamp(0.5rem, 5vw, 3.5rem)] md:text-[clamp(1.5rem, 5vw, 4rem)] lg:text-[clamp(2.5rem, 5vw, 5rem)] font-bold mb-8 transition-all duration-500 relative"
              style={{
                filter: 'drop-shadow(0 4px 20px rgba(139,92,246,0.4))',
                letterSpacing: '0.05em',
                opacity: 1,
                textShadow: isRedPillMode
                  ? '0 0 10px rgba(239, 68, 68, 0.3), 0 0 5px rgba(255, 255, 255, 0.5) inset'
                  : '0 0 10px rgba(59, 130, 246, 0.3), 0 0 5px rgba(255, 255, 255, 0.5) inset',
                fontFamily: 'var(--ds-font-family-sans)',
              }}
              onMouseEnter={(e) => {
                e.target.style.opacity = '1';
                e.target.style.transform = 'scale(1.05)';
                e.target.style.textShadow = isRedPillMode
                  ? '0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.6), 0 0 10px rgba(255, 255, 255, 0.7) inset, 0 0 15px #fff, -10px 0 30px #ffaa00'
                  : '0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6), 0 0 10px rgba(255, 255, 255, 0.7) inset, 0 0 15px #fff, -10px 0 30px #00aaff';
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1';
                e.target.style.transform = 'scale(1)';
                e.target.style.textShadow = isRedPillMode
                  ? '0 0 10px rgba(239, 68, 68, 0.3), 0 0 5px rgba(255, 255, 255, 0.5) inset'
                  : '0 0 10px rgba(59, 130, 246, 0.3), 0 0 5px rgba(255, 255, 255, 0.5) inset';
              }}
            >
              <div
                style={{
                  opacity: 1,
                  transition: 'all 0.3s ease',
                }}
              >
                <div className="inline-flex items-baseline justify-center gap-1 sm:gap-4 flex-nowrap w-full max-w-[90vw] px-2">
                  {/* Placeholder for moved text - will be added after Why Truegle? */}
                </div>
              </div>
            </h1>

            {/* Search Bar with Integrated Pill Toggle */}
            <div className="w-full max-w-2xl mx-auto px-4 mb-2 relative">
              {/* Pill mode toast notification */}
              {pillToast && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                >
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${pillToast.color} shadow-lg shadow-black/40`}>
                    <div className={`w-2 h-2 rounded-full ${pillToast.dot} shrink-0`} />
                    <span className="text-white text-sm font-semibold whitespace-nowrap">{pillToast.label}</span>
                    <span className="text-white/60 text-xs whitespace-nowrap hidden sm:inline">— {pillToast.sub}</span>
                  </div>
                </motion.div>
              )}
              <SearchBar
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(typeof e === 'string' ? e : e.target.value)
                }
                showPillToggle={true}
                pillMode={pillMode}
                onPillModeChange={updatePillMode}
                showFilters={true}
                filters={filters}
                onFiltersChange={setFilters}
                compactFilters={false}
                showFilterToggle={true}
                showOSINTToggle={true}
                isOSINTMode={isOSINTMode}
                onOSINTToggle={toggleOSINT}
                themeColor="green"
                searchButtonGradient="from-green-600 to-emerald-600"
                biasedButtonGradient="from-red-600 to-red-800"
                searchIconColor="text-green-500/80"
                onSearch={() => {
                  setShowGlitch(true);
                  const modeParam = pillMode !== 'blue' ? `&mode=${pillMode}` : '';
                  if (searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery)}${modeParam}`);
                  } else {
                    navigate(pillMode !== 'blue' ? `/search?mode=${pillMode}` : '/search');
                  }
                }}
                placeholder={
                  pillMode === 'red' ? 'Explore the Rabbit Hole...' :
                  pillMode === 'green' ? 'Raw search — no smart features...' :
                  'Search Truegle...'
                }
                size="large"
                showBiasedButton={true}
                onBiasedClick={() => {
                  setShowGlitch(true);
                  navigate('/search?mode=purple');
                }}
                customActionButtons={
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/extract'); }}
                    className="inline-flex items-center justify-center gap-2 h-12 px-5 min-w-[150px] rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-semibold shadow-lg shadow-yellow-400/20 hover:shadow-yellow-300/30 transition-all duration-200 ease-out"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Transcribe URL
                  </button>
                }
              />

              {/* Learn More Button */}
              <button
                onClick={() => {
                  const featuresEl = document.getElementById('features');
                  if (featuresEl) {
                    featuresEl.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="mt-4 py-4 px-8 bg-black/60 backdrop-blur-md border border-purple-500/50 rounded-xl text-purple-400 font-semibold transition-all duration-200 hover:scale-105 hover:bg-black/80 hover:border-purple-400/70 active:scale-95 shadow-lg shadow-purple-500/20"
              >
                Learn More
              </button>
            </div>

            <div
              className="flex flex-col gap-4 items-center w-full max-w-2xl mx-auto px-4"
              style={{
                filter: 'drop-shadow(0 10px 40px rgba(0,0,0,0.5))',
              }}
            >
              {/* Share for Premium */}
              <ErrorBoundary
                fallback={
                  <SafeButton
                    variant="feature"
                    onClick={() => {}}
                    className="w-full max-w-md"
                  >
                    <Gift size={20} />
                    <span>Share & Get Premium Free</span>
                  </SafeButton>
                }
              >
                <ShareForPremiumButton
                  variant="custom"
                  onPremiumGranted={() => {
                    alert(
                      'You now have 24 hours of Premium access! Try our OSINT tools at /osint'
                    );
                  }}
                  customTrigger={(openModal) => (
                    <SpotlightButton
                      variant="feature"
                      size="lg"
                      onClick={openModal}
                      className="w-full max-w-md"
                    >
                      <Gift size={20} />
                      <span>Share & Get Premium Free</span>
                    </SpotlightButton>
                  )}
                />
              </ErrorBoundary>
            </div>
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

        {/* Mode showcase + Trending feed */}
        <ModesAndTrending />

        {/* Features Section */}
        <div id="features" className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-headline-large mb-4">
                <span className="gradient-orange-purple">Why Truegle?</span>
              </h2>
              {/* Search without text - moved from hero section */}
              <div className="mt-8">
                <div className="inline-flex items-baseline justify-center gap-0.5 sm:gap-2.5 flex-nowrap w-full max-w-[90vw] px-2">
                  <div
                    className="text-white/90 font-[300] tracking-wide flex-shrink whitespace-nowrap text-2xl sm:text-3xl md:text-4xl"
                  >
                    Search Without
                  </div>

                  {/* Rotating glitch text animation without chat bubble */}
                  <RotatingGlitchText
                    rotatingWords={thoughtBubbleWords}
                    rotationInterval={2000}
                    speed={1}
                    enableShadows={true}
                    enableOnHover={false}
                    className="font-semibold text-center"
                    style={{ fontSize: '300%' }} // 300% larger text
                    colorScheme={['#a855f7', '#22c55e', '#ef4444']} // bias / purple, tracking / green, censorship / red
                  />
                </div>
              </div>
            </motion.div>

            {/* Three Promises - Stacked cards on mobile, horizontal on desktop */}
            <div className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
                {/* Bias Card */}
                <div className="bg-white/10 backdrop-blur-lg border border-purple-500/30 rounded-xl p-5 shadow-xl hover:bg-white/15 hover:border-purple-400/50 transition-all duration-300">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center border-2 border-purple-300 shadow-lg shadow-purple-500/30">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <line
                          x1="3"
                          y1="7"
                          x2="11"
                          y2="7"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span className="text-purple-400 font-bold text-lg">
                      Bias
                    </span>
                    <span className="text-white/90 text-base">
                      All perspectives welcome
                    </span>
                  </div>
                </div>

                {/* Tracking Card */}
                <div className="bg-white/10 backdrop-blur-lg border border-green-500/30 rounded-xl p-5 shadow-xl hover:bg-white/15 hover:border-green-400/50 transition-all duration-300">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center border-2 border-green-300 shadow-lg shadow-green-500/30">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <line
                          x1="3"
                          y1="7"
                          x2="11"
                          y2="7"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span className="text-green-400 font-bold text-lg">
                      Tracking
                    </span>
                    <span className="text-white/90 text-base">
                      Auto history deletion
                    </span>
                  </div>
                </div>

                {/* Censorship Card */}
                <div className="bg-white/10 backdrop-blur-lg border border-red-500/30 rounded-xl p-5 shadow-xl hover:bg-white/15 hover:border-red-400/50 transition-all duration-300">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center border-2 border-red-300 shadow-lg shadow-red-500/30">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <line
                          x1="3"
                          y1="7"
                          x2="11"
                          y2="7"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <span className="text-red-400 font-bold text-lg">
                      Censorship
                    </span>
                    <span className="text-white/90 text-base">
                      Freedom + Rights – Judgement
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <EnhancedFeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  gradient={feature.gradient}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <GlassCard className="p-12 text-center border-2 border-purple-500/30">
              <h2 className="text-headline-large mb-6">
                <span className="gradient-cyan-purple">
                  Ready to see the truth?
                </span>
              </h2>
              <p className="text-body-large text-gray-200 mb-8">
                Join thousands discovering unbiased search results
              </p>
              <NeonButton
                variant="primary"
                size="lg"
                onClick={() => navigate('/signup')}
                className="group"
              >
                Get Started Free
                <ChevronRight
                  className="inline ml-2 group-hover:translate-x-1 transition-transform"
                  size={20}
                />
              </NeonButton>
            </GlassCard>
          </motion.div>
        </div>

        {/* Inline video ad — landing page footer */}
        <div className="py-8 px-4 flex justify-center">
          <ReviveAd zone="videoInline" style={{ width: '100%', maxWidth: 720, aspectRatio: '16/9' }} />
        </div>

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
              setShowGlitch(true);
              navigate('/auth/signup', { state: { showFreemiumMessage: true } });
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
              setShowGlitch(true);
              navigate('/auth/signup', { state: { showFreemiumMessage: true } });
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
                  setShowGlitch(true);
                  navigate('/auth/signup', { state: { showFreemiumMessage: true } });
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

      {/* Warning Card for Red Pill Mode */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            id="warning-card"
            className="relative w-full max-w-2xl bg-black p-8 rounded-2xl"
            style={{
              border: '2px solid',
              borderImageSlice: 1,
              borderImageSource:
                'linear-gradient(45deg, #EF4444, #F87171, #FCA5A5)',
            }}
          >
            {/* Electric border effect elements */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-pink-500 to-red-600 blur opacity-75 animate-pulse"></div>
            <div className="absolute inset-0 rounded-2xl bg-black"></div>

            <h2 className="text-3xl font-bold text-red-500 mb-6 text-center relative z-10">
              RED PILL WARNING!
            </h2>

            <p className="text-white text-lg mb-4 text-center relative z-10">
              Here lies the infamous "Rabbit Hole." Where it ends, uncertain.
              You will see the unseen, discover hidden secrets, and you may lose
              contact with your identity in the process. Would you like to
              proceed?*
            </p>

            <p className="text-white text-sm mb-8 text-center relative z-10 italic">
              (Truegle Coprp. is not responsible for the state of your mental
              health if you decide to continue.)
            </p>

            <div className="flex justify-center gap-6 relative z-10">
              <button
                onClick={() => {
                  updateRedPillMode(true);
                  setShowWarning(false);
                }}
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all shadow-lg shadow-red-500/30"
              >
                YES
              </button>

              <button
                onClick={() => setShowWarning(false)}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl hover:from-blue-500 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Letter Glitch Animation */}
      {showGlitch && (
        <Fragment>
          <style>
            {`
              @keyframes glitch-letters {
                0% { opacity: 0.8; transform: translateX(0); }
                20% { opacity: 0.4; transform: translateX(-2px); }
                40% { opacity: 1; transform: translateX(2px); }
                60% { opacity: 0.6; transform: translateX(-1px); }
                80% { opacity: 0.9; transform: translateX(1px); }
                100% { opacity: 0.8; transform: translateX(0); }
              }
            `}
          </style>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="relative w-full h-full overflow-hidden">
              <div className="absolute inset-0 font-mono text-white text-center text-4xl md:text-6xl flex items-center justify-center">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full h-16 flex items-center justify-center"
                    style={{ top: `${i * 5}%` }}
                  >
                    {Array.from({ length: 50 }).map((_, j) => (
                      <span
                        key={j}
                        className="inline-block glitch-char"
                        style={{
                          animation: `glitch-letters 0.1s infinite alternate`,
                          animationDelay: `${Math.random() * 0.2}s`,
                        }}
                      >
                        {String.fromCharCode(
                          Math.random() > 0.5
                            ? Math.random() * 26 + 65
                            : Math.random() * 10 + 48
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Fragment>
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
