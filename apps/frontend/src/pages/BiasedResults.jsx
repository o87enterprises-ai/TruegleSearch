import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronDown,
  Zap,
  X,
  Send,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Mic,
  Camera,
  Paperclip,
} from 'lucide-react';
import TruegleLogo from '../components/ui/TruegleLogo';
import SearchBar from '../components/ui/SearchBar';
import MultimediaInterface from '../components/ui/MultimediaInterface';
import { DeepSpaceBackground } from '../components/backgrounds/DeepSpaceBackground';
import DeepseekParticles from '../components/backgrounds/DeepseekParticles';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import AsSeenOn from '../components/Content/AsSeenOn';
import PermissionsTrigger from '../components/permissions/PermissionsTrigger';
import { useToast } from '../components/ui/ToastProvider';
import { MapViewWrapper } from '../components/map';
import { useLocationDetection } from '../hooks/useLocationDetection';

export default function BiasedResults() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('news');
  const [showMap, setShowMap] = useState(false);
  const { isLocationQuery, detectedLocation } = useLocationDetection(searchValue);

  // Search and AI state
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Token system: 10 tokens per session (5 searches + 5 chats)
  const [tokens, setTokens] = useState(() => {
    const stored = sessionStorage.getItem('redPillTokens');
    return stored !== null ? parseInt(stored, 10) : 10;
  });
  const [showPaywall, setShowPaywall] = useState(false);

  // spendToken, NOT useToken. This is a plain helper that decrements a
  // counter — it is not a React hook and never was. The `use` prefix made
  // eslint's rules-of-hooks read every call site as a hook called from a
  // non-component, which is two permanent errors in the lint run about code
  // that is not wrong. The convention exists precisely so that `use*` means
  // "hook"; borrowing the prefix for something else is what broke the signal.
  const spendToken = () => {
    const next = tokens - 1;
    setTokens(next);
    sessionStorage.setItem('redPillTokens', String(next));
    if (next <= 0) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  // Function to detect if the search query is shopping-related
  const isShoppingQuery = (query) => {
    const shoppingKeywords = [
      'buy', 'purchase', 'price', 'deal', 'discount', 'sale',
      'best', 'top', 'review', 'compare', 'cost', 'cheap', 'affordable', 'bargain',
      'order', 'cart', 'checkout', 'wholesale', 'retail', 'get a', 'get an'
    ];
    const lowerQuery = query.toLowerCase();
    return shoppingKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  // Automatically set category to 'shopping' if the query is shopping-related
  useEffect(() => {
    if (searchValue && isShoppingQuery(searchValue)) {
      setActiveCategory('shopping');
    }
  }, [searchValue]);

  // Show map when maps/local category is selected
  useEffect(() => {
    if (activeCategory === 'maps' || activeCategory === 'local') {
      setShowMap(true);
    } else {
      setShowMap(false);
    }
  }, [activeCategory]);

  const [selectedPerspectives, setSelectedPerspectives] = useState(['neutral']);
  const [activePerspectiveCategory, setActivePerspectiveCategory] = useState(0);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [isRedPillMode, setIsRedPillMode] = useState(true); // Default to Red Pill on biased results page
  const [isOSINTMode, setIsOSINTMode] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all'
  });
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isHoveringSecret, setIsHoveringSecret] = useState(false);
  const [secretCursorPosition, setSecretCursorPosition] = useState({ x: 0, y: 0 });

  // Permission handling state
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionType, setPermissionType] = useState(null);
  const [showMicrophoneInterface, setShowMicrophoneInterface] = useState(false);
  const [showCameraInterface, setShowCameraInterface] = useState(false);
  const [showFilesInterface, setShowFilesInterface] = useState(false);

  // Cursor glow effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
      if (isHoveringSecret) {
        setSecretCursorPosition({ x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHoveringSecret]);

  // Ensure Red Pill mode is activated when accessing Biased page
  useEffect(() => {
    localStorage.setItem('isRedPillMode', JSON.stringify(true));
    setIsRedPillMode(true);
  }, []);

  // Context-aware pill mode navigation
  const updateRedPillMode = (newMode) => {
    const currentQuery = searchParams.get('q') || searchValue;

    if (!newMode) {
      // Red → Blue Pill: Navigate to SearchPortal
      // Update localStorage BEFORE navigating
      localStorage.setItem('isRedPillMode', JSON.stringify(false));
      setIsRedPillMode(false);

      if (currentQuery && currentQuery.trim()) {
        navigate(`/search-portal?q=${encodeURIComponent(currentQuery)}`);
      } else {
        navigate('/search-portal');
      }
    } else {
      // Blue → Red Pill: Already on Biased page (stay here)
      setIsRedPillMode(true);
      localStorage.setItem('isRedPillMode', JSON.stringify(true));
    }
  };

  const toggleOSINT = () => {
    const currentQuery = searchParams.get('q') || searchValue;

    if (!isOSINTMode) {
      // Navigate to OSINT tools with query
      if (currentQuery && currentQuery.trim()) {
        navigate(`/osint/tools?q=${encodeURIComponent(currentQuery)}`);
      } else {
        navigate('/osint/tools');
      }
    } else {
      setIsOSINTMode(false);
    }
  };

  // Permission handling functions
  const requestPermission = (type) => {
    setPermissionType(type);
    setShowPermissions(true);
  };

  const handlePermissionGranted = () => {
    setShowPermissions(false);
    // Activate the selected media type
    if (permissionType === 'microphone') {
      setShowMicrophoneInterface(true);
      startMicrophone();
    } else if (permissionType === 'camera') {
      setShowCameraInterface(true);
      startCamera();
    } else if (permissionType === 'files') {
      setShowFilesInterface(true);
    }
  };

  const handlePermissionDenied = () => {
    setShowPermissions(false);
  };

  const startMicrophone = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted, processing audio...');
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Microphone access denied:', err);
      let errorMessage = 'Microphone access was denied.';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access was blocked. Please enable it in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone was found on your device.';
      }
      alert(errorMessage);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log('Camera access granted, processing video...');
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Camera access was denied.');
    }
  };

  // Using activeCategory from CategoryBar for multimedia

  // Comprehensive perspectives organized by classification
  const perspectiveCategories = [
    {
      id: 'neutral',
      title: 'Neutral',
      perspectives: [
        { id: 'neutral', label: 'Neutral', icon: '⚪' },
      ],
    },
    {
      id: 'political',
      title: 'Political',
      perspectives: [
        { id: 'conservative', label: 'Conservative', icon: '🔴' },
        { id: 'liberal', label: 'Liberal', icon: '🔵' },
        { id: 'bipartisan', label: 'Bipartisan', icon: '🤝' },
        { id: 'libertarian', label: 'Libertarian', icon: '🗽' },
        { id: 'progressive', label: 'Progressive', icon: '⚡' },
        { id: 'centrist', label: 'Centrist', icon: '⚖️' },
      ],
    },
    {
      id: 'faith',
      title: 'Faith',
      perspectives: [
        { id: 'religious', label: 'Religious', icon: '✝️' },
        { id: 'atheist', label: 'Atheist', icon: '⚛️' },
        { id: 'new_world', label: 'New World / Illumination', icon: '🔺' },
        { id: 'old_world', label: 'Old World / Pagan', icon: '🌙' },
        { id: 'spiritual', label: 'Spiritual', icon: '🕉️' },
        { id: 'secular', label: 'Secular', icon: '🔬' },
        { id: 'universal', label: 'Universal', icon: '🌍' },
      ],
    },
    {
      id: 'societal',
      title: 'Societal',
      perspectives: [
        { id: 'mainstream', label: 'Mainstream', icon: '📰' },
        { id: 'alternative', label: 'Alternative', icon: '🔍' },
        { id: 'conspiracy', label: 'Conspiracy', icon: '👁️' },
        { id: 'skeptical', label: 'Skeptical', icon: '🤔' },
        { id: 'traditional', label: 'Traditional', icon: '📜' },
        { id: 'scientific', label: 'Scientific / Academic', icon: '🎓' },
        { id: 'government', label: 'Government', icon: '🏛️' },
        { id: 'community', label: 'Community', icon: '👥' },
      ],
    },
    {
      id: 'economic',
      title: 'Economic',
      perspectives: [
        { id: 'local_economy', label: 'Local Economy', icon: '💰' },
        { id: 'global_economics', label: 'Global Economics', icon: '🌐' },
        { id: 'investors', label: 'Investors', icon: '📈' },
        { id: 'consumers', label: 'Consumers', icon: '🛒' },
        { id: 'small_business', label: 'Small Business', icon: '🏪' },
        { id: 'corporate', label: 'Corporate', icon: '🏢' },
      ],
    },
  ];

  const togglePerspective = (id) => {
    setSelectedPerspectives((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    if (tokens <= 0) { setShowPaywall(true); return; }
    if (!spendToken()) return;

    // Build query params with search value and selected perspectives
    const params = new URLSearchParams();
    params.set('q', searchValue);
    if (selectedPerspectives.length > 0) {
      params.set('perspectives', selectedPerspectives.join(','));
    }

    // Update URL without navigation (for bookmarking/sharing)
    window.history.replaceState({}, '', `/biased?${params.toString()}`);

    // Perform actual search
    setSearchLoading(true);
    setAiSummary(null);
    try {
      const categoryMap = {
        'pics': 'images',
        'vids': 'videos',
        'audio': 'web',
        'soc': 'social',
        'local': 'shopping',
        'maps': 'shopping'
      };

      const searchCategory = categoryMap[activeCategory] || activeCategory || 'all';

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchValue,
          mode: 'purple',
          filters: {
            category: searchCategory,
            perspectives: selectedPerspectives,
            dateRange: 'any',
            sortBy: 'relevance',
            order: 'desc',
            perPage: 20
          }
        })
      });

      if (!response.ok) throw new Error(`Search error: ${response.status}`);
      const data = await response.json();
      console.log('Biased search results:', data.results?.length || 0);
      setSearchResults(data.results || []);
      toast.success('Biased Search Complete', `Found ${data.results?.length || 0} results`, { pageTheme: 'biased' });

      // Fetch AI summary
      if (data.results && data.results.length > 0) {
        fetchAiSummary(searchValue, data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search Failed', 'Unable to perform biased search', { pageTheme: 'biased' });
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch AI summary
  const fetchAiSummary = async (query, results) => {
    setAiLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, results: results.slice(0, 10), perspectives: selectedPerspectives }),
      });
      if (!response.ok) throw new Error(`AI error: ${response.status}`);
      const data = await response.json();
      setAiSummary({ summary: data.summary, perspectives: data.perspectives, sourcesAnalyzed: data.sourcesAnalyzed, model: data.model });
    } catch (error) {
      console.error('AI summary error:', error);
      setAiSummary({ summary: `Analysis of "${query}" from selected perspectives: ${getSelectedPerspectiveLabels().join(', ') || 'none selected'}.`, perspectives: [], sourcesAnalyzed: results.length, model: 'fallback' });
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-search when URL has query param
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && queryParam.trim() && searchResults.length === 0 && !searchLoading) {
      handleSearch();
    }
  }, [searchParams]);

  const handleUnbiasedClick = () => {
    toast.info('Unbiased View', 'Switching to neutral search', { pageTheme: 'biased' });
    // Red pill → search results, Blue pill → search portal
    if (isRedPillMode) {
      navigate(`/search-results?q=${encodeURIComponent(searchValue)}`);
    } else {
      navigate(`/search-portal?q=${encodeURIComponent(searchValue)}`);
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    if (tokens <= 0) { setShowPaywall(true); return; }
    if (selectedPerspectives.length === 0) {
      alert('Please select at least one bias perspective first!');
      return;
    }
    if (!spendToken()) return;
    setChatMessage('');
  };

  const getSelectedPerspectiveLabels = () => {
    const allPersp = perspectiveCategories.flatMap((cat) => cat.perspectives);
    return selectedPerspectives
      .map((id) => allPersp.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => p.label);
  };

  // No mock results - show default message instead

  // Memoize background to prevent remounting
  const backgroundComponent = useMemo(() => (
    <ErrorBoundary>
      <DeepSpaceBackground key="deep-space-background" />
    </ErrorBoundary>
  ), []);

  return (
    <div className="relative min-h-screen w-full bg-black overflow-y-auto">
      {/* Background Layer 1: Deep Space (z-0) */}
      <div className="fixed inset-0 z-0">
        {backgroundComponent}
      </div>

      {/* Background Layer 2: Deepseek Particles (z-5) */}
      <div className="fixed inset-0" style={{ zIndex: 5 }}>
        <ErrorBoundary>
          <DeepseekParticles key="deepseek-particles" showStageControls={false} enableMouseMovement={true} />
        </ErrorBoundary>
      </div>

      {/* Cursor Glow Effect */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition duration-300"
        style={{
          background: `radial-gradient(600px circle at ${cursorPosition.x}px ${cursorPosition.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`,
        }}
      />

      {/* Token Counter Badge */}
      <div className="fixed top-4 right-4 z-40">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-xl border ${
          tokens <= 2
            ? 'bg-red-950/80 border-red-500/50 text-red-300'
            : 'bg-purple-950/80 border-purple-500/30 text-purple-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${tokens <= 2 ? 'bg-red-400 animate-pulse' : 'bg-purple-400'}`} />
          {tokens} token{tokens !== 1 ? 's' : ''} left
        </div>
      </div>

      {/* Paywall Modal */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gradient-to-br from-[#1a0a2e] to-[#0a0a1e] border border-purple-500/40 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-purple-500/20 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                <Zap size={28} className="text-purple-400" />
              </div>
              <h3 className="text-white font-bold text-2xl mb-2">Out of Tokens</h3>
              <p className="text-white/60 text-sm mb-6">
                You've used all <strong className="text-purple-300">10 free tokens</strong> for this session.
                Subscribe to Premium for unlimited access.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.href = '/pricing'}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                  Subscribe to Premium
                </button>
                <button
                  onClick={() => setShowPaywall(false)}
                  className="text-sm text-white/30 hover:text-white/50 transition-colors py-1"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Logo - CENTERED AND BIG */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6"
          >
            <TruegleLogo className="scale-[1.5] sm:scale-[1.8]" onClick={() => navigate('/')} />
          </motion.div>

          {/* Search Bar - Directly Below Logo */}
          <PermissionsTrigger onSearchComplete={() => localStorage.setItem('truegle_first_search', Date.now().toString())}>
            <SearchBar
              value={searchValue}
              onChange={(val) => setSearchValue(val)}
              onSubmit={handleSearch}
              onSearch={handleSearch}
              placeholder="Search with selected bias..."
              size="medium"
              showBiasedButton={false}
              showUnbiasedButton={false}
              showPillToggle={true}
              isRedPillMode={isRedPillMode}
              onPillModeChange={updateRedPillMode}
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
              usePurpleTheme={true}
              themeColor="purple"
              showMap={showMap}
              onMapToggle={() => setShowMap(prev => !prev)}
              isLocationQuery={isLocationQuery}
              // The media input icons (mic, camera, file) are now built into the SearchBar
              // so we don't need to pass them as rightIcons anymore
              customActionButtons={
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={handleUnbiasedClick}
                  disabled={!searchValue.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`inline-flex items-center justify-center gap-2 h-12 px-6 min-w-[160px] rounded-xl font-semibold transition-all shadow-lg ${
                    isRedPillMode
                      ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-500/25 disabled:from-red-600/50 disabled:to-red-500/50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900'
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/25 disabled:from-blue-600/50 disabled:to-blue-500/50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900'
                  }`}
                >
                  <span>Unbiased Search</span>
                </motion.button>
              }
            />
          </PermissionsTrigger>

          {/* Multimedia Interface Dropdown */}
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

          {/* AsSeenOn Interface Dropdown - Shows when shopping category is selected */}
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

          {/* Map Interface - Shows when local/maps category selected or location query detected */}
          <AnimatePresence>
            {(showMap || isLocationQuery) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6"
              >
                <MapViewWrapper
                  isOpen={showMap || isLocationQuery}
                  onToggle={() => setShowMap(false)}
                  detectedLocation={detectedLocation}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ad Banner 1 - Under Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-6"
          >
          </motion.div>

          {/* Perspective Selector - Directly Below First Ad */}
          <div className="max-w-4xl mx-auto mb-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border border-red-500/30"
            >
              {/* Line 1: Title + Selected Perspectives */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="text-purple-500" size={20} />
                  <h2 className="text-base font-bold text-white">
                    Select Perspective(s)
                  </h2>
                </div>
                {selectedPerspectives.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-white/60">Selected:</span>
                    <div className="flex flex-wrap gap-1">
                      {getSelectedPerspectiveLabels().map((label, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-red-600/50 text-white"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Line 2: Category Buttons */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  {perspectiveCategories.map((cat, idx) => (
                    <button
                      key={cat.id}
                      onClick={() => setActivePerspectiveCategory(idx)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        activePerspectiveCategory === idx
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line 3: Perspective Cards */}
              <div className="flex flex-wrap gap-2">
                {perspectiveCategories[
                  activePerspectiveCategory
                ].perspectives.map((perspective) => (
                  <button
                    key={perspective.id}
                    onClick={() => togglePerspective(perspective.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                      selectedPerspectives.includes(perspective.id)
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/50 text-purple-300 hover:from-purple-600/40 hover:to-pink-600/40'
                    }`}
                  >
                    <span className="mr-1.5">{perspective.icon}</span>
                    {perspective.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Biased AI Summary Card - Above Search Bar */}
          <div className="max-w-4xl mx-auto mb-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border border-purple-500/30">
              <button
                onClick={() => setIsChatOpen(true)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white">
                    Perspective Search Summary
                  </h3>
                  {aiLoading && (
                    <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                  )}
                </div>
                <motion.div animate={{ rotate: aiExpanded ? 180 : 0 }}>
                  <ChevronDown size={20} className="text-purple-400" />
                </motion.div>
              </button>

              {aiExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 pt-3 border-t border-purple-500/20"
                >
                  {aiLoading ? (
                    <div className="flex items-center gap-3 py-4">
                      <div className="animate-spin w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full"></div>
                      <span className="text-white/60 text-sm">Analyzing with selected perspectives...</span>
                    </div>
                  ) : aiSummary ? (
                    <>
                      <p className="text-sm text-white/80 leading-relaxed mb-3" style={{ minHeight: '5.5rem' }}>
                        {aiSummary.summary}
                        {selectedPerspectives.length > 0
                          ? ` Filtered through ${selectedPerspectives.length} perspective(s): ${getSelectedPerspectiveLabels().join(', ')}.`
                          : ''}
                      </p>
                      {/* Perspective breakdown */}
                      {aiSummary.perspectives && aiSummary.perspectives.length > 0 && (
                        <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                          <div className="text-xs font-semibold text-purple-300 mb-2">Perspective Breakdown:</div>
                          <div className="space-y-1">
                            {aiSummary.perspectives.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  p.perspective === 'left' ? 'bg-red-500/30 text-red-300' :
                                  p.perspective === 'right' ? 'bg-blue-500/30 text-blue-300' :
                                  p.perspective === 'center' ? 'bg-yellow-500/30 text-yellow-300' :
                                  'bg-rose-500/30 text-rose-300'
                                }`}>
                                  {p.perspective}
                                </span>
                                <span className="text-white/70 flex-1">{p.summary}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-purple-400">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span>{aiSummary.sourcesAnalyzed || 0} sources analyzed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                          <span>Powered by Truegle Search</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-white/60 leading-relaxed mb-3" style={{ minHeight: '5.5rem' }}>
                      This analyzes your query through the lens of your selected bias perspectives,
                      surfacing content that aligns with specific viewpoints and ideological frameworks.
                      {selectedPerspectives.length > 0
                        ? ` Currently filtering through ${selectedPerspectives.length} perspective(s): ${getSelectedPerspectiveLabels().join(', ')}.`
                        : ' Select perspective(s) above and search to see filtered results.'}
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Ad Banner 2 - Under AI Summary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-4"
          >
          </motion.div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Results Column */}
            <div className="lg:col-span-3 space-y-4">
              {searchLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                  <span className="ml-3 text-white/70">Searching...</span>
                </div>
              ) : (
                <>
              <div className="text-sm text-white/60 mb-4">
                {searchResults.length > 0 ? `About ${searchResults.length} results` : 'No results yet - search to get started!'} • {selectedPerspectives.length > 0 ? `Filtered by: ${getSelectedPerspectiveLabels().join(', ')}` : 'No perspective filter applied'}
              </div>

              {searchResults.length > 0 ? searchResults.map((result, index) => (
                <div key={result.id}>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-purple-500/50 hover:border-[3px] hover:border-purple-400 transition-all duration-300 group hover:shadow-[0_0_40px_rgba(139,92,246,0.6),0_0_80px_rgba(139,92,246,0.3)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-white/60">
                            {result.source}
                          </span>
                          <span className="text-xs text-white/40">•</span>
                          <span className="text-xs text-white/60">
                            {result.date || '2 days ago'}
                          </span>
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold border border-purple-500/50 text-purple-400 bg-black/40">
                            Biased
                          </span>
                        </div>
                        <h3 className="text-lg font-display font-bold text-purple-400 hover:text-purple-300 cursor-pointer group-hover:underline mb-2 flex items-center gap-2">
                          {result.title}
                          <ExternalLink
                            size={16}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </h3>
                        <p className="text-sm text-white/70 leading-relaxed">
                          {result.snippet}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <button className="flex items-center gap-1.5 hover:text-purple-400 transition-colors">
                        <ThumbsUp size={14} />
                        <span>Helpful</span>
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-purple-400 transition-colors">
                        <ThumbsDown size={14} />
                        <span>Not helpful</span>
                      </button>
                    </div>
                  </motion.div>
                </div>
              )) : (
                <div className="text-center py-12">
                  <p className="text-white/70 text-lg mb-8">If it's Trueth you're looking for, ya ain't goona' find it here.</p>
                </div>
              )}


              {/* Load More Button */}
              <div className="flex justify-center pt-6">
                <button className="px-8 py-4 rounded-xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border border-purple-500/30 text-purple-400 hover:border-purple-500/50 transition-all font-semibold">
                  Load More Results
                </button>
              </div>

              {/* Secret Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="flex justify-center pt-4 pb-8 relative"
                onMouseEnter={() => setIsHoveringSecret(true)}
                onMouseLeave={() => setIsHoveringSecret(false)}
              >
                <style>{`
                  @keyframes rainbow-glow {
                    0%, 100% {
                      text-shadow: 0 0 10px rgba(239, 68, 68, 0.1);
                      opacity: 0.3;
                    }
                    16.66% {
                      text-shadow: 0 0 15px rgba(249, 115, 22, 0.2);
                      opacity: 0.35;
                    }
                    33.33% {
                      text-shadow: 0 0 20px rgba(234, 179, 8, 0.15);
                      opacity: 0.4;
                    }
                    50% {
                      text-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
                      opacity: 0.35;
                    }
                    66.66% {
                      text-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
                      opacity: 0.4;
                    }
                    83.33% {
                      text-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
                      opacity: 0.35;
                    }
                  }
                  @keyframes cursor-rainbow-glow {
                    0%, 100% {
                      text-shadow: 0 0 25px rgba(239, 68, 68, 0.9),
                                  0 0 50px rgba(239, 68, 68, 0.6),
                                  0 0 75px rgba(239, 68, 68, 0.3);
                    }
                    16.66% {
                      text-shadow: 0 0 25px rgba(249, 115, 22, 0.9),
                                  0 0 50px rgba(249, 115, 22, 0.6),
                                  0 0 75px rgba(249, 115, 22, 0.3);
                    }
                    33.33% {
                      text-shadow: 0 0 25px rgba(234, 179, 8, 0.9),
                                  0 0 50px rgba(234, 179, 8, 0.6),
                                  0 0 75px rgba(234, 179, 8, 0.3);
                    }
                    50% {
                      text-shadow: 0 0 25px rgba(34, 197, 94, 0.9),
                                  0 0 50px rgba(34, 197, 94, 0.6),
                                  0 0 75px rgba(34, 197, 94, 0.3);
                    }
                    66.66% {
                      text-shadow: 0 0 25px rgba(6, 182, 212, 0.9),
                                  0 0 50px rgba(6, 182, 212, 0.6),
                                  0 0 75px rgba(6, 182, 212, 0.3);
                    }
                    83.33% {
                      text-shadow: 0 0 25px rgba(59, 130, 246, 0.9),
                                  0 0 50px rgba(59, 130, 246, 0.6),
                                  0 0 75px rgba(59, 130, 246, 0.3);
                    }
                  }
                  .animate-rainbow-glow {
                    animation: rainbow-glow 4s ease-in-out infinite;
                  }
                  .animate-rainbow-glow-fast {
                    animation: rainbow-glow 1.5s ease-in-out infinite;
                  }
                  .animate-cursor-rainbow-glow {
                    animation: cursor-rainbow-glow 4s ease-in-out infinite;
                  }
                  .animate-cursor-rainbow-glow-fast {
                    animation: cursor-rainbow-glow 1.5s ease-in-out infinite;
                  }
                  .secret-cursor {
                    color: rgba(255, 255, 255, 0.9);
                  }
                `}</style>
                <motion.p
                  className="text-xs text-white/40 italic text-center animate-rainbow-glow transition-all duration-500"
                  whileHover={{
                    scale: 1.05,
                    opacity: 1,
                    textShadow: "0 0 30px rgba(239,68,68,0.5), 0 0 60px rgba(249,115,22,0.4), 0 0 90px rgba(234,179,8,0.3), 0 0 120px rgba(34,197,94,0.2)"
                  }}
                  transition={{ duration: 0.3 }}
                  onMouseEnter={(e) => {
                    e.target.classList.remove('animate-rainbow-glow');
                    e.target.classList.add('animate-rainbow-glow-fast');
                  }}
                  onMouseLeave={(e) => {
                    e.target.classList.remove('animate-rainbow-glow-fast');
                    e.target.classList.add('animate-rainbow-glow');
                  }}
                  style={{
                    cursor: isHoveringSecret ? 'none' : 'help',
                  }}
                >
                  You've discovered a key that opens a secret door. Find the magic. 1,2,3,4.
                </motion.p>
                {searchResults.length > 0 && (
                  <AnimatePresence>
                    {isHoveringSecret && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                        className="secret-cursor fixed pointer-events-none z-50 text-4xl font-bold animate-cursor-rainbow-glow-fast"
                        style={{
                          left: secretCursorPosition.x,
                          top: secretCursorPosition.y,
                          transform: 'translate(-50%, -50%)',
                          fontFamily: 'Georgia, serif',
                        }}
                      >
                        ?
                      </motion.span>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
                </>
              )}
            </div>

            {/* Sidebar with Multiple Sticky Ads */}
            <div className="hidden lg:block space-y-4">


            </div>
          </div>
        </div>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsChatOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 md:inset-8 lg:inset-16 bg-gradient-to-br from-[#0a0a0f] to-[#1a1a2e] rounded-3xl border-2 border-purple-500/50 shadow-2xl shadow-purple-500/50 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Perspective Search Assistant
                    </h2>
                    <p className="text-sm text-white/60">
                      Ask follow-up questions through your selected perspectives
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 transition-all border border-purple-500/30"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Ad Banner 1 - Top */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-6 mt-4"
              >
              </motion.div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Initial AI Message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="max-w-[80%] p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border-2 border-purple-500/50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm leading-relaxed">
                          This analyzes your query through the lens of your selected bias perspectives,
                          surfacing content that aligns with specific viewpoints and ideological frameworks.
                          Results are filtered to emphasize narratives, sources, and interpretations that
                          match your chosen perspective categories.
                          {selectedPerspectives.length > 0
                            ? ` Currently filtering through: ${getSelectedPerspectiveLabels().join(', ')}.`
                            : ' Select perspective(s) to see filtered results.'}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-xs text-white/40">
                            {new Date().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            <button className="text-white/40 hover:text-green-400 transition-colors">
                              <ThumbsUp size={12} />
                            </button>
                            <button className="text-white/40 hover:text-red-400 transition-colors">
                              <ThumbsDown size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
 
              {/* Ad Banner - Stripe Sponsored (Bottom) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
              </motion.div>

              {/* Input Area */}
              <div className="p-6 border-t border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 px-4 py-3 rounded-xl bg-black/40 border-2 border-purple-500/50 text-white placeholder-white/40 focus:border-purple-400 focus:outline-none transition-all"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25"
                  >
                    <Send size={20} />
                    <span>Send</span>
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
