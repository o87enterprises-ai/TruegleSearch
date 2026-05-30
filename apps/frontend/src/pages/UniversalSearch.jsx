import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  Sparkles,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react';

// Backgrounds - Import all backgrounds
import { WarpSpeedBackground } from '../components/backgrounds/WarpSpeedBackground';
import { DeepSpaceBackground } from '../components/backgrounds/DeepSpaceBackground';
import DeepSeaEnhanced from '../components/backgrounds/DeepSeaEnhanced';
import DeepseekParticles from '../components/backgrounds/DeepseekParticles';
import LightRays from '../components/backgrounds/LightRays';
import LetterGlitch from '../components/backgrounds/LetterGlitch';

// Components
import TruegleLogo from '../components/ui/TruegleLogo';
import SearchBar from '../components/ui/SearchBar';
import MultimediaInterface from '../components/ui/MultimediaInterface';
import AIChatOverlay from '../components/ui/AIChatOverlay';
import AdSenseAd from '../components/ui/AdSenseAd';
import { SkeletonSearchResult } from '../components/ui/Skeleton';
import AsSeenOn from '../components/Content/AsSeenOn';
import PerspectiveSelector from '../components/search/PerspectiveSelector';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { MapViewWrapper } from '../components/map';
import TutorialModal from '../components/ui/TutorialModal';
import QuickResultCard from '../components/ui/QuickResultCard';

// Hooks and Config
import { useSearchMode } from '../hooks/useSearchMode';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { useAuth } from '../context/AuthContext';

export default function UniversalSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Get query from URL
  const query = searchParams.get('q') || '';

  // Mode management - Default to 'blue' (SearchPortal)
  const modeParam = searchParams.get('mode');
  const { mode: autoMode, modeConfig, overrideMode } = useSearchMode(query);
  const [mode, setMode] = useState(modeParam || 'blue'); // Default to blue

  // Tutorial modal — shown once per device on first visit
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      return localStorage.getItem('truegle_tutorial_done') !== 'true';
    } catch {
      return false;
    }
  });

  // Summary banner: null = not chosen, 'show' = show for session, 'none' = dismissed for session
  const [sessionSummaryChoice, setSessionSummaryChoice] = useState(
    () => sessionStorage.getItem('truegle_summary_choice') || null
  );
  const [showNoSummaryConfirm, setShowNoSummaryConfirm] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // First-search modal (shown once per session)
  const [showFirstSearchModal, setShowFirstSearchModal] = useState(false);
  const [firstSearchDone, setFirstSearchDone] = useState(
    () => sessionStorage.getItem('truegle_first_search_done') === 'true'
  );

  // Search state
  const [searchValue, setSearchValue] = useState(query);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchResults, setSearchResults] = useState([]);
  const [instantAnswer, setInstantAnswer] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState(null);

  // AI state
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(true);

  // Purple mode: Perspective state
  const [selectedPerspectives, setSelectedPerspectives] = useState([]);
  const [activePerspectiveCategory, setActivePerspectiveCategory] = useState(0);

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRedPillMode, setIsRedPillMode] = useState(false);
  const [isOSINTMode, setIsOSINTMode] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showMap, setShowMap] = useState(false);
  const [mapManuallyClosed, setMapManuallyClosed] = useState(false);
  const { isLocationQuery, detectedLocation } = useLocationDetection(searchValue);
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all'
  });

  // Update mode when URL param changes
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode) {
      setMode(urlMode);
    }
  }, [searchParams]);

  // Update search value when query param changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchValue(queryParam);
    }
  }, [searchParams]);

  // Sync pill modes with current mode
  // Purple, Red, and Ocean pages: Red pill mode by default
  // Blue page: Blue pill mode by default
  useEffect(() => {
    setIsRedPillMode(mode === 'red' || mode === 'purple' || mode === 'ocean');
    setIsOSINTMode(mode === 'ocean');
    // Green pill mode disables Smart features
    if (mode === 'green') {
      setSessionSummaryChoice('none');
    }
  }, [mode]);

  // Cursor glow effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-execute search when URL query changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && queryParam.trim() && queryParam !== lastSearchedQuery && !searchLoading) {
      handleSearch();
    }
  }, [searchParams]);

  // Auto-detect shopping category
  const isShoppingQuery = (query) => {
    const shoppingKeywords = [
      'buy', 'purchase', 'shop', 'store', 'price', 'deal', 'discount', 'sale',
      'best', 'top', 'review', 'compare', 'amazon', 'walmart',
    ];
    return shoppingKeywords.some((keyword) => query.toLowerCase().includes(keyword));
  };

  useEffect(() => {
    if (searchValue && isShoppingQuery(searchValue)) {
      setActiveCategory('shopping');
    }
  }, [searchValue]);

  // Reset manual map close when search value changes
  useEffect(() => {
    setMapManuallyClosed(false);
  }, [searchValue]);

  /**
   * Handle search execution
   */
  const handleSearch = async () => {
    if (!searchValue.trim()) return;

    // Update URL
    const params = new URLSearchParams();
    params.set('q', searchValue);
    if (mode !== 'blue') {
      params.set('mode', mode);
    }
    if (selectedPerspectives.length > 0) {
      params.set('perspectives', selectedPerspectives.join(','));
    }
    window.history.replaceState({}, '', `/search?${params.toString()}`);

    setSearchLoading(true);
    setAiSummary(null);
    setInstantAnswer(null);
    setLastSearchedQuery(searchValue);

    try {
      const categoryMap = {
        pics: 'images',
        vids: 'videos',
        audio: 'web',
        soc: 'social',
        local: 'shopping',
        maps: 'shopping',
      };

      const categoryKeywords = {
        finance: 'finance stocks market',
        sports: 'sports scores',
        business: 'business company',
        academic: 'research paper academic',
        world: 'world international news',
        health: 'health medical',
        entertainment: 'entertainment movies tv',
        podcasts: 'podcast episode',
        tech: 'technology software',
        gaming: 'gaming video game',
        food: 'food recipe restaurant',
        travel: 'travel destination',
        lifestyle: 'lifestyle wellness',
      };

      let effectiveQuery = searchValue;
      let searchCategory = categoryMap[activeCategory] || 'all';

      if (categoryKeywords[activeCategory]) {
        effectiveQuery = `${searchValue} ${categoryKeywords[activeCategory]}`;
        searchCategory = activeCategory === 'world' ? 'news' : 'all';
      }

      // Determine backend mode string
      let backendMode = 'blue-pill';
      if (mode === 'red') backendMode = 'red-pill';
      else if (mode === 'purple') backendMode = 'purple';
      else if (mode === 'ocean') backendMode = 'ocean';

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: effectiveQuery,
            mode: backendMode,
            filters: {
              category: searchCategory,
              bias: 'all',
              perspectives: mode === 'purple' ? selectedPerspectives : [],
              dateRange: 'any',
              sortBy: 'relevance',
              order: 'desc',
              perPage: 20,
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`Search error: ${response.status}`);

      const data = await response.json();
      setSearchResults(data.results || []);
      setInstantAnswer(data.instantAnswer || null);

      // Show first-search modal once per session
      if (!firstSearchDone) {
        setFirstSearchDone(true);
        sessionStorage.setItem('truegle_first_search_done', 'true');
        setShowFirstSearchModal(true);
      }

      // Fetch summary only if not green mode and not dismissed
      if (mode !== 'green' && sessionSummaryChoice !== 'none' && data.results && data.results.length > 0) {
        fetchAiSummary(searchValue, data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Fetch AI summary
   */
  const fetchAiSummary = async (query, results) => {
    setAiLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            results: results.slice(0, 10),
            perspectives: selectedPerspectives,
          }),
        }
      );

      if (!response.ok) throw new Error(`AI error: ${response.status}`);

      const data = await response.json();
      setAiSummary({
        summary: data.summary,
        perspectives: data.perspectives,
        sourcesAnalyzed: data.sourcesAnalyzed,
        model: data.model,
      });
    } catch (error) {
      console.error('AI summary error:', error);
      setAiSummary({
        summary: `Analysis of "${query}" from multiple perspectives.`,
        perspectives: [],
        sourcesAnalyzed: results.length,
        model: 'fallback',
      });
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * Handle mode switching via pill toggle (now receives mode string)
   */
  const handlePillModeChange = (newModeOrBool) => {
    // Accept either string ('blue'|'red'|'green') or legacy boolean
    const newMode = typeof newModeOrBool === 'boolean'
      ? (newModeOrBool ? 'red' : 'blue')
      : newModeOrBool;
    setMode(newMode);
    const params = new URLSearchParams(searchParams);
    if (newMode === 'blue') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  const handleBiasedClick = () => {
    setMode('purple');
    const params = new URLSearchParams(searchParams);
    params.set('mode', 'purple');
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  const toggleOSINT = () => {
    const newMode = mode === 'ocean' ? 'blue' : 'ocean';
    setMode(newMode);
    const params = new URLSearchParams(searchParams);
    if (newMode === 'blue') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  /**
   * Handle perspective toggle (purple mode)
   */
  const handleTogglePerspective = (perspectiveId) => {
    setSelectedPerspectives((prev) =>
      prev.includes(perspectiveId)
        ? prev.filter((p) => p !== perspectiveId)
        : [...prev, perspectiveId]
    );
  };

  /**
   * Render appropriate background based on mode
   */
  const renderBackground = () => {
    switch (mode) {
      case 'blue':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <DeepSpaceBackground />
          </ErrorBoundary>
        );

      case 'red':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <WarpSpeedBackground />
          </ErrorBoundary>
        );

      case 'purple':
        return (
          <>
            <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
              <DeepSpaceBackground />
            </ErrorBoundary>
            <div className="fixed inset-0" style={{ zIndex: 5 }}>
              <ErrorBoundary fallback={null}>
                <DeepseekParticles />
              </ErrorBoundary>
            </div>
          </>
        );

      case 'ocean':
        return (
          <>
            <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
              <DeepSeaEnhanced />
            </ErrorBoundary>
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
              <ErrorBoundary fallback={null}>
                <LightRays raysColor="#1983FF" />
              </ErrorBoundary>
            </div>
          </>
        );

      case 'green':
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-br from-green-950 via-black to-emerald-950" />}>
            <div className="fixed inset-0">
              <LetterGlitch
                glitchColors={['#2b4539', '#61dca3', '#61b3dc']}
                glitchSpeed={50}
                centerVignette={true}
                outerVignette={false}
                smooth={true}
              />
              <div className="absolute inset-0 bg-black/72" />
            </div>
          </ErrorBoundary>
        );

      default:
        return (
          <ErrorBoundary fallback={<div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black" />}>
            <DeepSpaceBackground />
          </ErrorBoundary>
        );
    }
  };

  // Perspective colors (same as SearchResults)
  const perspectiveColors = {
    left: 'bg-red-500/20 border border-red-500/50 text-red-400',
    center: 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400',
    right: 'bg-blue-500/20 border border-blue-500/50 text-blue-400',
    unbiased: 'bg-green-500/20 border border-green-500/50 text-green-400',
    neutral: 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400',
    mainstream: 'bg-purple-500/20 border border-purple-500/50 text-purple-400',
  };

  // ── ResultCard ──────────────────────────────────────────────────────────
  function ResultCard({ result, index, mode, isRedPillMode, perspectiveColors }) {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [iframeBlocked, setIframeBlocked] = useState(false);
    const borderClass = mode === 'green'
      ? 'border-green-500/30 hover:border-green-500/50'
      : 'border-cyan-500/30 hover:border-cyan-500/50';
    const titleClass = mode === 'green'
      ? 'text-green-400 group-hover:text-green-300'
      : 'text-cyan-400 group-hover:text-cyan-300';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border transition-all duration-300 ${borderClass}`}
      >
        <div className="p-4">
          <div className="flex gap-3">
            {/* Thumbnail */}
            {result.image && (
              <img
                src={result.image}
                alt=""
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0 opacity-80"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {!result.image && result.favicon && (
              <img
                src={result.favicon}
                alt=""
                className="w-5 h-5 object-contain flex-shrink-0 mt-1 opacity-60"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}

            <div className="flex-1 min-w-0">
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="group">
                <h3 className={`text-base font-semibold transition-colors flex items-center gap-2 ${titleClass}`}>
                  <span className="line-clamp-2">{result.title}</span>
                  <ExternalLink size={13} className="flex-shrink-0 opacity-40" />
                </h3>
              </a>
              <p className="text-sm text-white/70 mt-1 line-clamp-2">{result.snippet}</p>

              <div className="flex items-center gap-3 mt-2 text-xs text-white/50 flex-wrap">
                {result.favicon && result.image && (
                  <img src={result.favicon} alt="" className="w-4 h-4 object-contain opacity-60"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <span className="truncate max-w-[200px]">{result.sourceName || result.domain}</span>
                {result.date && <span>{new Date(result.date).toLocaleDateString()}</span>}
                {(isRedPillMode || mode === 'purple') && result.bias && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${perspectiveColors[result.bias] || perspectiveColors.neutral}`}>
                    {result.biasLabel || result.bias}
                  </span>
                )}
                <button
                  onClick={() => { setViewerOpen(!viewerOpen); setIframeBlocked(false); }}
                  className="ml-auto text-white/30 hover:text-cyan-400 transition-colors text-xs"
                >
                  {viewerOpen ? 'Close viewer' : 'Open in viewer'}
                </button>
              </div>
            </div>
          </div>

          {/* Inline iframe viewer */}
          {viewerOpen && (
            <div className="mt-3 rounded-xl overflow-hidden border border-cyan-500/20">
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
                <span className="text-xs text-white/40 truncate flex-1 mr-2">{result.url}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <ExternalLink size={11} /> Open
                  </a>
                  <button onClick={() => setViewerOpen(false)} className="text-xs text-white/30 hover:text-white">✕</button>
                </div>
              </div>
              {iframeBlocked ? (
                <div className="flex flex-col items-center justify-center py-8 bg-black/20 gap-2">
                  <p className="text-sm text-white/50 text-center px-4">This page can't be embedded.</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <ExternalLink size={12} /> Open in new tab
                  </a>
                </div>
              ) : (
                <iframe
                  key={result.url}
                  src={result.url}
                  className="w-full h-80"
                  title="Result preview"
                  sandbox="allow-scripts allow-same-origin"
                  onError={() => setIframeBlocked(true)}
                  onLoad={(e) => {
                    try {
                      if (!e.target.contentDocument || e.target.contentDocument.body?.innerHTML === '')
                        setIframeBlocked(true);
                    } catch { setIframeBlocked(true); }
                  }}
                />
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }
  // ── end ResultCard ───────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen w-full bg-black overflow-y-auto">
      {/* Background - Changes based on mode */}
      <div className="fixed inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="w-full h-full"
          >
            {renderBackground()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cursor Glow Effect */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition duration-300"
        style={{
          background: `radial-gradient(600px circle at ${cursorPosition.x}px ${cursorPosition.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`,
        }}
      />

      {/* Content - EXACT structure from SearchResults.jsx */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Logo - CENTERED AND BIG (same as SearchResults) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6"
          >
            <TruegleLogo className="scale-[1.5] sm:scale-[1.8]" onClick={() => navigate('/')} />
          </motion.div>

          {/* Search Bar - Directly Below Logo (same as SearchResults) */}
          <div className="max-w-4xl mx-auto mb-6">
            <SearchBar
              value={searchValue}
              showBiasedButton={mode !== 'purple'}
              onBiasedClick={handleBiasedClick}
              showUnbiasedButton={mode === 'purple'}
              onUnbiasedClick={() => {
                setMode(isRedPillMode ? 'red' : 'blue');
                const params = new URLSearchParams(searchParams);
                if (isRedPillMode) {
                  params.set('mode', 'red');
                } else {
                  params.delete('mode');
                }
                navigate(`/search?${params.toString()}`, { replace: true });
              }}
              onChange={(val) => setSearchValue(val)}
              onSubmit={handleSearch}
              onSearch={handleSearch}
              placeholder={mode === 'purple' ? 'Explore perspectives...' : mode === 'ocean' ? 'OSINT search...' : 'Search for unbiased truth...'}
              size="medium"
              showPillToggle={true}
              isRedPillMode={isRedPillMode}
              pillMode={mode === 'green' ? 'green' : isRedPillMode ? 'red' : 'blue'}
              onPillModeChange={handlePillModeChange}
              showFilters={true}
              filters={filters}
              onFiltersChange={setFilters}
              compactFilters={false}
              showFilterToggle={true}
              showOSINTToggle={true}
              isOSINTMode={isOSINTMode}
              onOSINTToggle={toggleOSINT}
              showCategories={true}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              showMap={showMap || (isLocationQuery && !mapManuallyClosed)}
              onMapToggle={() => {
                if (showMap || (isLocationQuery && !mapManuallyClosed)) {
                  // If map is currently visible, hide it and mark as manually closed
                  setShowMap(false);
                  setMapManuallyClosed(true);
                } else {
                  // If map is hidden, show it and clear manual close flag
                  setShowMap(true);
                  setMapManuallyClosed(false);
                }
              }}
              isLocationQuery={isLocationQuery}
              themeColor={
                mode === 'red' ? 'red' :
                mode === 'purple' ? 'purple' :
                mode === 'ocean' ? 'cyan' :
                mode === 'green' ? 'green' :
                'blue'
              }
              searchButtonGradient={
                mode === 'purple' ? 'from-purple-600 to-purple-500' :
                mode === 'ocean' ? 'from-red-600 to-red-500' :
                undefined
              }
              biasedButtonGradient={
                mode === 'ocean' ? 'from-purple-600 to-purple-500' :
                undefined
              }
              unbiasedButtonGradient={
                mode === 'purple' ? (
                  isRedPillMode ? 'from-red-600 to-red-500' : 'from-blue-600 to-cyan-600'
                ) : undefined
              }
            />
          </div>

          {/* Multimedia Interface Dropdown (same as SearchResults) */}
          <AnimatePresence>
            {(activeCategory === 'pics' ||
              activeCategory === 'vids' ||
              activeCategory === 'audio' ||
              activeCategory === 'soc') && (
              <MultimediaInterface
                category={activeCategory}
                onClose={() => setActiveCategory('all')}
                searchQuery={searchValue}
              />
            )}
          </AnimatePresence>

          {/* Map View Overlay */}
          <AnimatePresence>
            {((showMap || isLocationQuery) && !mapManuallyClosed) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6"
              >
                <MapViewWrapper
                  isOpen={(showMap || isLocationQuery) && !mapManuallyClosed}
                  onToggle={() => {
                    setShowMap(false);
                    setMapManuallyClosed(true);
                  }}
                  onClose={() => {
                    setShowMap(false);
                    setMapManuallyClosed(true);
                  }}
                  detectedLocation={detectedLocation}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shopping Interface (same as SearchResults) */}
          <AnimatePresence>
            {activeCategory === 'shopping' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6 overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                          <circle cx="6" cy="19" r="3"></circle>
                          <circle cx="18" cy="19" r="3"></circle>
                          <path d="M2.5 6.5h19v10h-19z"></path>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">As Seen On</h3>
                        <p className="text-sm text-emerald-300/70">Find the best deals across retailers</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-white" />
                    </button>
                  </div>
                  <AsSeenOn searchQuery={searchValue} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Perspective Selector (Purple mode only) */}
          {mode === 'purple' && (
            <div className="max-w-4xl mx-auto mb-6">
              <PerspectiveSelector
                selectedPerspectives={selectedPerspectives}
                onTogglePerspective={handleTogglePerspective}
                show={true}
                onClose={() => {}}
                activeCategoryIndex={activePerspectiveCategory}
                onCategoryChange={setActivePerspectiveCategory}
              />
            </div>
          )}

          {/* Ad Banner 1 - Under Search Bar (same as SearchResults) */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-6"
          >
            <AdSenseAd className="rounded-2xl" />
          </motion.div>

          {/* Search Summary — Banner + Expandable Card */}
          {mode !== 'green' && sessionSummaryChoice !== 'none' && (
            <div className="max-w-4xl mx-auto mb-4">
              {/* Banner: shown when choice not yet made */}
              {!sessionSummaryChoice && (aiSummary || aiLoading || searchResults.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl backdrop-blur-xl border ${
                    mode === 'red' ? 'bg-red-950/60 border-red-500/30' :
                    mode === 'purple' ? 'bg-purple-950/60 border-purple-500/30' :
                    mode === 'ocean' ? 'bg-cyan-950/60 border-cyan-500/30' :
                    'bg-[#1a1a2e]/80 border-cyan-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className={
                      mode === 'red' ? 'text-red-400' : mode === 'purple' ? 'text-purple-400' :
                      mode === 'ocean' ? 'text-cyan-400' : 'text-cyan-400'
                    } />
                    <span className="text-sm text-white/70">
                      {mode === 'purple' ? 'Perspective Search Summary available' :
                       mode === 'red' ? 'Deep Dive Search Summary available' :
                       mode === 'ocean' ? 'OSINT Search Summary available' :
                       '(Unbiased) Search Summary available'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSessionSummaryChoice('show');
                        sessionStorage.setItem('truegle_summary_choice', 'show');
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        mode === 'red' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40' :
                        mode === 'purple' ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40' :
                        mode === 'ocean' ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40' :
                        'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40'
                      }`}
                    >
                      Show Summary
                    </button>
                    <button
                      onClick={() => setShowNoSummaryConfirm(true)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-white/5 text-white/50 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      No Summary
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Expanded summary card: shown after user selects "Show Summary" */}
              {sessionSummaryChoice === 'show' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border ${
                    mode === 'red' ? 'border-red-500/30' :
                    mode === 'purple' ? 'border-purple-500/30' :
                    mode === 'ocean' ? 'border-cyan-500/30' :
                    'border-cyan-500/30'
                  }`}
                >
                  <button
                    onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                        mode === 'red' ? 'from-red-500 to-red-600' :
                        mode === 'purple' ? 'from-purple-500 to-purple-600' :
                        mode === 'ocean' ? 'from-cyan-500 to-blue-500' :
                        'from-cyan-500 to-purple-500'
                      } flex items-center justify-center`}>
                        <Sparkles size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-left text-lg font-display font-bold text-white">
                          {mode === 'purple' ? 'Perspective Search Summary' :
                           mode === 'red' ? 'Deep Dive Search Summary' :
                           mode === 'ocean' ? 'OSINT Search Summary' :
                           '(Unbiased) Search Summary'}
                        </h3>
                        <p className="text-xs text-white/40 text-left">Powered by Truegle Search</p>
                      </div>
                      {aiLoading && (
                        <div className={`animate-spin w-4 h-4 border-2 ${
                          mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                          mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                        } border-t-transparent rounded-full`} />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowNoSummaryConfirm(true); }}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
                      >
                        Dismiss
                      </button>
                      <motion.div animate={{ rotate: summaryCollapsed ? 0 : 180 }}>
                        <ChevronDown size={20} className="text-white/40" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {!summaryCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`overflow-hidden mt-3 pt-3 border-t ${
                          mode === 'red' ? 'border-red-500/20' : mode === 'purple' ? 'border-purple-500/20' :
                          mode === 'ocean' ? 'border-cyan-500/20' : 'border-cyan-500/20'
                        }`}
                      >
                        {aiLoading ? (
                          <div className="flex items-center gap-3 py-4">
                            <div className={`animate-spin w-5 h-5 border-2 ${
                              mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                              mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                            } border-t-transparent rounded-full`} />
                            <span className="text-white/60 text-sm">Analyzing search results...</span>
                          </div>
                        ) : aiSummary ? (
                          <>
                            <p className="text-sm text-white/80 leading-relaxed mb-3">{aiSummary.summary}</p>
                            {mode === 'purple' && aiSummary.perspectives?.length > 0 && (
                              <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                                <div className="text-xs font-semibold text-cyan-300 mb-2">Perspective Breakdown:</div>
                                <div className="space-y-1">
                                  {aiSummary.perspectives.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        p.perspective === 'left' ? 'bg-red-500/30 text-red-300' :
                                        p.perspective === 'right' ? 'bg-blue-500/30 text-blue-300' :
                                        p.perspective === 'center' ? 'bg-yellow-500/30 text-yellow-300' :
                                        'bg-cyan-500/30 text-cyan-300'
                                      }`}>{p.perspective}</span>
                                      <span className="text-white/70 flex-1">{p.summary}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-white/40">
                              <span>{aiSummary.sourcesAnalyzed || 0} sources analyzed</span>
                              <span>•</span>
                              <button
                                onClick={() => {
                                  if (!isAuthenticated) {
                                    navigate('/auth/login', { state: { redirectTo: window.location.pathname + window.location.search } });
                                  } else {
                                    setIsChatOpen(true);
                                  }
                                }}
                                className="underline hover:text-white/60 transition-colors"
                              >
                                {isAuthenticated ? 'Ask follow-up' : 'Sign in to chat'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-white/60 leading-relaxed">
                            Search for a topic to get an unbiased summary analyzing multiple sources.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          )}

          {/* No Summary Confirmation Modal */}
          <AnimatePresence>
            {showNoSummaryConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                  <h3 className="text-white font-bold text-lg mb-2">Disable Search Summary?</h3>
                  <p className="text-white/60 text-sm mb-5">
                    Clicking <strong>Yes</strong> will hide search summaries for the rest of this session.
                    You can restore them by refreshing the page.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSessionSummaryChoice('none');
                        sessionStorage.setItem('truegle_summary_choice', 'none');
                        setShowNoSummaryConfirm(false);
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                    >
                      Yes, hide it
                    </button>
                    <button
                      onClick={() => setShowNoSummaryConfirm(false)}
                      className="flex-1 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-sm border border-cyan-500/40 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* First-Search Modal: Disable Smart Features? */}
          <AnimatePresence>
            {showFirstSearchModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#0f1a0f] border border-green-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Sparkles size={18} className="text-green-400" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Disable Smart Features?</h3>
                  </div>
                  <p className="text-white/60 text-sm mb-5">
                    Switch to <strong className="text-green-400">Green Pill Mode</strong> for a
                    completely AI-free search experience — pure results, no summaries, no chat assistant.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowFirstSearchModal(false);
                        handlePillModeChange('green');
                      }}
                      className="flex-1 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold text-sm border border-green-500/40 transition-all"
                    >
                      Yes, go Green
                    </button>
                    <button
                      onClick={() => setShowFirstSearchModal(false)}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                    >
                      No, keep Smart features
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ad Banner 2 - Under AI Summary (same as SearchResults) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-4"
          >
            <AdSenseAd className="rounded-2xl" adSlot="8883172859" />
          </motion.div>

          {/* Results Grid (same as SearchResults) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Results Column */}
            <div className="lg:col-span-3 space-y-4">
              {searchLoading ? (
                <div className="space-y-4">
                  <div className="text-sm text-white/60 mb-4">Searching...</div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonSearchResult key={i} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="text-sm text-white/60 mb-4">
                    {searchResults.length > 0 ? `About ${searchResults.length} results` : 'No results yet - try searching!'}
                  </div>

                  {instantAnswer && (
                    <QuickResultCard
                      instantAnswer={instantAnswer}
                      onDirections={() => setActiveCategory('maps')}
                    />
                  )}

                  {searchResults.map((result, index) => (
                    <div key={result.url || index}>
                      {/* Ad Banner after every 3rd result */}
                      {index > 0 && index % 3 === 0 && (
                        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-yellow-200 mb-1">
                                Sponsored
                              </div>
                              <div className="text-sm font-semibold text-white">
                                Premium Ad Content
                              </div>
                              <div className="text-xs text-white/90">
                                High-quality products and services
                              </div>
                            </div>
                            <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                              Learn More
                            </button>
                          </div>
                        </div>
                      )}

                      <ResultCard
                        result={result}
                        index={index}
                        mode={mode}
                        isRedPillMode={isRedPillMode}
                        perspectiveColors={perspectiveColors}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Sidebar Column (same as SearchResults) */}
            <div className="lg:col-span-1 space-y-4">
              {/* Ad Sidebar */}
              <div className="sticky top-4">
                <AdSenseAd className="rounded-xl" adSlot="7891234567" format="vertical" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Search Assistant Overlay */}
      {isChatOpen && (
        <AIChatOverlay
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          initialSummary={aiSummary?.summary || null}
          mode={mode}
          themeColor={
            mode === 'red' ? 'red' :
            mode === 'purple' ? 'purple' :
            mode === 'ocean' ? 'ocean' :
            'blue'
          }
        />
      )}

      {/* Tutorial Modal — shown once on first visit */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
    </div>
  );
}
