import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { FREE_ACCESS_MODE } from '../config/access';
import {
  ChevronDown,
  Sparkles,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Eye,
  X,
  MapPin,
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
import InlineSummaryChat from '../components/search/InlineSummaryChat';
import AdSlot from '../components/AdSlot';
import RewardAdSlot from '../components/RewardAdSlot';
import AdsterraBanner from '../components/ads/AdsterraBanner';
import AdColorWrapper from '../components/ads/AdColorWrapper';
import { SMARTLINK_URL } from '../config/ads';
import AdultConsentGate from '../components/ui/AdultConsentGate';
import { SkeletonSearchResult } from '../components/ui/Skeleton';
import QuickAnswerCard from '../components/ui/QuickAnswerCard';
import AsSeenOn from '../components/Content/AsSeenOn';
import PerspectiveSelector from '../components/search/PerspectiveSelector';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import { MapViewWrapper } from '../components/map';
import QuickResultCard from '../components/ui/QuickResultCard';
import TruegleShareButton from '../components/ui/TruegleShareButton';
import OSINTToolsPanel from '../components/ui/OSINTToolsPanel';
import TokenGate from '../components/ui/TokenGate';
import RepairsModal from '../components/ui/RepairsModal';
import LanguageSelector from '../components/ui/LanguageSelector';
// OsintClassRow is retired on the ocean page (the OSINT Tools module owns tool
// selection); osintHintPrefix is still used to tag ocean web searches.
import { osintHintPrefix } from '../components/search/OsintClassRow';
import PillModeRow from '../components/landing/PillModeRow';

// Hooks and Config
import { useSearchMode } from '../hooks/useSearchMode';
import { useLocationDetection } from '../hooks/useLocationDetection';
import useDeviceTier from '../hooks/useDeviceTier';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { isQuestionQuery, getQuickAnswer } from '../utils/queryIntent';
import { LITE_BG, PERSPECTIVE_COLORS, getModeAccent, MODE_LABELS, MODE_COLORS } from '../config/modeTheme';

// The five selectable flows. The active `mode` (from URL/toggle) is the PRIMARY
// — it drives which sources/results are fetched. Additional lenses selected
// here only blend into the AI summary + follow-up chat, so the results grid and
// its routing are never destabilized by multi-select.
const LENS_MODES = ['blue', 'green', 'red', 'purple', 'ocean'];
const MODE_TO_BACKEND = { blue: 'blue-pill', green: 'green', red: 'red-pill', purple: 'purple', ocean: 'ocean' };
import { getVideoEmbed } from '../utils/videoEmbed';

// The SearchFiltersBar "category" dropdown offers political/content labels
// (mainstream, conspiracy, democratic, republican, nonpartisan, music, videos,
// socials, reels, shopping) that don't match the backend's own category/bias
// vocab directly — map them through so picking one actually changes results
// instead of silently doing nothing.
const FILTER_CATEGORY_BIAS_MAP = {
  mainstream: 'mainstream',
  conspiracy: 'conspiracy',
  democratic: 'left',
  republican: 'right',
  nonpartisan: 'center',
};
const FILTER_CATEGORY_TYPE_MAP = {
  music: 'web',
  videos: 'videos',
  socials: 'social',
  reels: 'videos',
  shopping: 'shopping',
};

// useLocationDetection queryTypes that mean the user explicitly wants a map.
// 'location' (generic "in/at/near <place>" phrasing) and 'place' (fuzzy
// geocode fallback) are deliberately excluded — they show a "View map" chip.
const MAP_AUTO_OPEN_TYPES = ['geolocation', 'directions', 'zipcode'];

export default function UniversalSearch({ lockedGreen = false }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { settings, updateSetting } = useSettings();
  const { allowHeavyAnimations } = useDeviceTier();

  // Get query from URL
  const query = searchParams.get('q') || '';
  const queryIsQuestion = isQuestionQuery(query);

  // Mode management - Default to 'blue' (SearchPortal)
  const modeParam = searchParams.get('mode');
  const { mode: autoMode, modeConfig, overrideMode } = useSearchMode(query);
  // Persist mode preference across sessions — if user has set a preference, honour it;
  // URL param overrides (so direct links like ?mode=red still work).
  const [mode, setMode] = useState(() => {
    if (lockedGreen) return 'green';
    if (modeParam) return modeParam;
    return localStorage.getItem('truegle_mode_pref') || 'blue';
  });
  // Single cycling pill (same control as the landing page). Reflects the
  // current search mode; cycling stages a new one and submitting navigates to
  // it (black = Chat -> /chat, orange/yellow -> their page, else /search?mode=).
  const [pillMode, setPillMode] = useState(mode);
  useEffect(() => { setPillMode(mode); }, [mode]);

  // Nephesh mode (opt-in Null-Prime dual-audit protocol) and verbosity
  // (default succinct) — persistent, off by default. Purple/ocean keep their
  // own dedicated framing regardless; this layers the audit protocol on top
  // of whichever mode is active when turned on.
  const [nepheshMode, setNepheshMode] = useState(
    () => localStorage.getItem('truegle_nephesh_mode') === 'true'
  );
  useEffect(() => {
    localStorage.setItem('truegle_nephesh_mode', String(nepheshMode));
  }, [nepheshMode]);
  // Search-page AI (summary + follow-up chat) is always CONCISE — "Summarize"
  // is the fixed default here, so there's no verbosity toggle (the old
  // "Feeling chat-e?" control was removed). Chat gets the opposite default
  // (verbose) via TruegleChat's own derivation.
  const SEARCH_VERBOSE = false;

  // Summary banner: null = not chosen, 'show' = show for session, 'none' = dismissed for session
  const [sessionSummaryChoice, setSessionSummaryChoice] = useState(
    () => sessionStorage.getItem('truegle_summary_choice') || null
  );
  const [showNoSummaryConfirm, setShowNoSummaryConfirm] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // First-search modal: shown exactly once ever (localStorage, not sessionStorage).
  // Skip entirely if user already has a saved preference.
  const [showFirstSearchModal, setShowFirstSearchModal] = useState(false);
  const [firstSearchDone, setFirstSearchDone] = useState(
    () => localStorage.getItem('truegle_mode_pref_asked') === 'true'
  );

  // Search state
  const [searchValue, setSearchValue] = useState(query);
  const [activeCategory, setActiveCategory] = useState('all');
  // OSINT (ocean) exception: multi-select investigation classes that replace
  // the content categories on the ocean page and tag the query with entity types.
  const [osintClasses, setOsintClasses] = useState([]);
  const toggleOsintClass = (id) =>
    setOsintClasses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const [searchResults, setSearchResults] = useState([]);
  const [instantAnswer, setInstantAnswer] = useState(null);
  const [quickAnswer, setQuickAnswer] = useState(null);
  const [quickAnswerLoading, setQuickAnswerLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState(null);
  // Distinguish "search failed" (provider/network error) from "0 genuine results"
  // so users always get a clear message instead of a silent empty page.
  const [searchError, setSearchError] = useState(false);

  // Down-for-repairs: show a maintenance modal after consecutive search failures
  const [showRepairsModal, setShowRepairsModal] = useState(false);
  const consecutiveFailuresRef = useRef(0);
  const REPAIRS_FAILURE_THRESHOLD = 2;

  // AI state
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(true);

  // Multi-select: extra AI lenses layered on top of the primary `mode`. These
  // only affect the AI summary + follow-up chat framing (not the results grid).
  const [extraLenses, setExtraLenses] = useState(() => {
    try {
      const raw = localStorage.getItem('truegle_extra_lenses');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((m) => LENS_MODES.includes(m)) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('truegle_extra_lenses', JSON.stringify(extraLenses)); } catch { /* quota */ }
  }, [extraLenses]);

  // Primary mode first, then the extra lenses (deduped) — the full set the AI blends.
  const activeModes = useMemo(
    () => [mode, ...extraLenses.filter((m) => m !== mode)],
    [mode, extraLenses]
  );
  // Tapping the primary is a no-op here (it's driven by the main mode toggle /
  // URL, since switching primary re-runs the whole search). Others toggle on/off.
  const toggleLens = (m) => {
    if (m === mode) return;
    setExtraLenses((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  // When the lens set changes and results are already on screen, re-run just
  // the AI summary (not the whole search) so multi-select feels immediate.
  const lensSig = extraLenses.join(',');
  useEffect(() => {
    if (mode !== 'green' && sessionSummaryChoice !== 'none' && searchResults.length > 0 && query) {
      fetchAiSummary(query, searchResults, MODE_TO_BACKEND[mode]);
    }
  }, [lensSig]); // intentionally lens-only: re-summarize on lens change, not on every result update

  // Purple mode: Perspective state
  const [selectedPerspectives, setSelectedPerspectives] = useState(['neutral']);

  // Ad targeting context — prefer the most specific signal available.
  // Passed to AdsterraBanner so Adsterra campaigns can be keyword-targeted
  // to match the user's active perspective or search mode.
  const adContext = (() => {
    const p = selectedPerspectives[0];
    if (p && p !== 'neutral') return p;       // 'left' | 'right' → highest specificity
    if (mode && mode !== 'blue') return mode; // 'red' | 'purple' | 'ocean' | 'green'
    return 'neutral';
  })();
  const [activePerspectiveCategory, setActivePerspectiveCategory] = useState(0);

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRedPillMode, setIsRedPillMode] = useState(false);
  const [isOSINTMode, setIsOSINTMode] = useState(false);
  const cursorGlowRef = useRef(null);
  const [showMap, setShowMap] = useState(false);
  const [mapManuallyClosed, setMapManuallyClosed] = useState(false);
  // Detect location intent from the SUBMITTED query, not the live input. Driving
  // this off `searchValue` made the map auto-open on almost every keystroke (the
  // bare-query geocode fallback matches most short terms), so it now keys off the
  // last query the user actually searched for.
  const { isLocationQuery, detectedLocation, queryType } = useLocationDetection(lastSearchedQuery);
  // Only EXPLICIT location intent auto-opens the map. Casual "in <place>"
  // phrasing ('location') and fuzzy place geocodes ('place') get a "View map"
  // chip instead — "where is the largest fireworks show in america" is a
  // question, not a map request.
  const autoOpenMap = isLocationQuery && MAP_AUTO_OPEN_TYPES.includes(queryType);
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    category: 'all',
    dateRange: 'any',
    bias: 'all'
  });

  // Update mode when URL param changes (ignored in locked green mode)
  useEffect(() => {
    if (lockedGreen) return;
    const urlMode = searchParams.get('mode');
    if (urlMode) {
      setMode(urlMode);
    }
  }, [searchParams, lockedGreen]);

  // Update search value when query param changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam) {
      setSearchValue(queryParam);
    }
  }, [searchParams]);

  // Seed the active result category from the URL (&category=), so the landing/
  // chat search-category strip carries its selection into the results page.
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setActiveCategory(cat);
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
    // Purple page always starts on the Neutral perspective
    if (mode === 'purple') {
      setSelectedPerspectives(['neutral']);
      setActivePerspectiveCategory(0);
    }
  }, [mode]);

  // Cursor glow effect — update the overlay's style DIRECTLY (ref + rAF) instead
  // of setting React state on every mousemove. Previously this re-rendered the
  // entire (~1500-line) search page on every pixel of movement, which made the
  // result cards glitch/flicker. Now there are zero re-renders from the cursor.
  useEffect(() => {
    let rafId = null;
    let pending = null;
    const apply = () => {
      rafId = null;
      if (cursorGlowRef.current && pending) {
        cursorGlowRef.current.style.background = `radial-gradient(600px circle at ${pending.x}px ${pending.y}px, rgba(139, 92, 246, 0.15), transparent 40%)`;
      }
    };
    const handleMouseMove = (e) => {
      pending = { x: e.clientX, y: e.clientY };
      if (rafId == null) rafId = requestAnimationFrame(apply);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Auto-execute search when URL query changes
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && queryParam.trim() && queryParam !== lastSearchedQuery && !searchLoading) {
      handleSearch();
    }
  }, [searchParams]);

  // Re-search whenever the mode, active category pill, filter dropdowns, or
  // (in purple mode) the selected perspectives change — previously only `mode`
  // was wired up, so switching categories/filters/perspectives silently left
  // stale results on screen instead of re-ranking/re-filtering them.
  useEffect(() => {
    if (lastSearchedQuery && searchValue && !searchLoading) {
      handleSearch();
    }
  }, [mode, activeCategory, osintClasses, filters.bias, filters.dateRange, filters.sortBy, filters.order, filters.category, selectedPerspectives]);

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

  // Reset manual map close when a NEW search is run (so a fresh location query
  // can re-open the map), rather than on every keystroke.
  useEffect(() => {
    setMapManuallyClosed(false);
  }, [lastSearchedQuery]);

  /**
   * Handle search execution
   */
  // Re-run the active search when the engine language changes, so results
  // re-localize immediately. Skips initial mount (no prior search yet).
  useEffect(() => {
    if (lastSearchedQuery) {
      handleSearch();
    }
  }, [settings.language]);

  // Submit handler for the search bar. The single cycling pill decides where a
  // submit goes (same model as the landing page): black = Chat -> /chat,
  // orange -> /rewards, yellow -> /extract, a different search mode -> that
  // /search page; the current mode just re-runs the search in place.
  const submitSearch = () => {
    const q = searchValue.trim();
    if (!q) return;
    if (pillMode === 'black') { navigate(`/chat?q=${encodeURIComponent(q)}`); return; }
    if (pillMode === 'orange') { navigate('/rewards'); return; }
    if (pillMode === 'yellow') { navigate('/extract'); return; }
    if (pillMode !== mode) {
      setMode(pillMode);
      navigate(`/search?mode=${pillMode}&q=${encodeURIComponent(q)}`);
      return;
    }
    handleSearch();
  };

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
    setQuickAnswer(null);
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

      // OSINT (ocean) exception: tag the query with the selected investigation
      // classes so the backend entity detector + OSINT-framed AI summary treat
      // the input as that entity type (domain/email/phone/username/person/ip).
      if (mode === 'ocean') {
        const hint = osintHintPrefix(osintClasses);
        if (hint) effectiveQuery = `${hint} ${effectiveQuery}`.trim();
      }

      // The category pills (above) take priority; the filter dropdown only
      // fills in a content-type/bias hint when the pills haven't already set one.
      if (searchCategory === 'all' && FILTER_CATEGORY_TYPE_MAP[filters.category]) {
        searchCategory = FILTER_CATEGORY_TYPE_MAP[filters.category];
      }
      const filterCategoryBias = FILTER_CATEGORY_BIAS_MAP[filters.category];
      const effectiveBias = filters.bias !== 'all' ? filters.bias : (filterCategoryBias || filters.bias);

      // Determine backend mode string
      let backendMode = 'blue-pill';
      if (mode === 'red') backendMode = 'red-pill';
      else if (mode === 'purple') backendMode = 'purple';
      else if (mode === 'ocean') backendMode = 'ocean';
      else if (mode === 'green') backendMode = 'green'; // backend filters AI-generated-content domains

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
              bias: effectiveBias,
              perspectives: mode === 'purple' ? selectedPerspectives : [],
              dateRange: filters.dateRange,
              sortBy: filters.sortBy,
              order: filters.order,
              perPage: 20,
              safeSearch: settings.safeSearch,
              language: settings.language,
              country: settings.country,
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`Search error: ${response.status}`);

      const data = await response.json();
      setSearchResults(data.results || []);
      setInstantAnswer(data.instantAnswer || null);
      setSearchError(false);

      // Successful response — clear the consecutive-failure streak
      consecutiveFailuresRef.current = 0;
      if (showRepairsModal) setShowRepairsModal(false);

      // Show green-mode preference modal exactly once ever (localStorage).
      if (!firstSearchDone) {
        setFirstSearchDone(true);
        localStorage.setItem('truegle_mode_pref_asked', 'true');
        setShowFirstSearchModal(true);
      }

      // Fetch summary only if not green mode and not dismissed
      if (mode !== 'green' && sessionSummaryChoice !== 'none' && data.results && data.results.length > 0) {
        fetchAiSummary(searchValue, data.results, backendMode);
      }
      // Quick answer fires in parallel with the summary. Green mode is AI-free
      // by definition; deliberately NOT gated on sessionSummaryChoice — that
      // setting is about the summary banner, not the answer box.
      if (mode !== 'green' && data.results && data.results.length > 0) {
        fetchQuickAnswer(searchValue, data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchError(true);

      // Track consecutive malfunctions; surface the maintenance modal once we
      // hit the threshold (e.g. a backend/CORS outage), so global users aren't
      // left with a silent empty page.
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= REPAIRS_FAILURE_THRESHOLD) {
        setShowRepairsModal(true);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Fetch the DuckDuckGo-style quick answer: a short, cited answer for
   * question / factual-lookup queries. Resolves to null (card hidden) whenever
   * the query isn't answerable or the backend can't answer confidently.
   */
  const fetchQuickAnswer = async (query, results) => {
    setQuickAnswerLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/quick-answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, results: results.slice(0, 6) }),
        }
      );
      if (!response.ok) throw new Error(`Quick answer error: ${response.status}`);
      const data = await response.json();
      setQuickAnswer(data.answer ? { answer: data.answer, sources: data.sources || [] } : null);
    } catch (error) {
      console.error('Quick answer error:', error);
      setQuickAnswer(null);
    } finally {
      setQuickAnswerLoading(false);
    }
  };

  /**
   * Fetch AI summary
   */
  const fetchAiSummary = async (query, results, backendMode = 'blue-pill') => {
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
            mode: backendMode,
            // Multi-select: extra lenses (mapped to backend mode strings) blend
            // into the summary framing. Only sent when >1 flow is active.
            modes: activeModes.length > 1 ? activeModes.map((m) => MODE_TO_BACKEND[m]) : undefined,
            perspectives: selectedPerspectives,
            isQuestion: isQuestionQuery(query),
            nepheshMode,
            verbose: SEARCH_VERBOSE,
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
        isQuestion: data.isQuestion || false,
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
    // Green mode is locked — ignore any attempt to switch modes
    if (lockedGreen) return;
    // Accept either string ('blue'|'red'|'green') or legacy boolean
    const newMode = typeof newModeOrBool === 'boolean'
      ? (newModeOrBool ? 'red' : 'blue')
      : newModeOrBool;
    setMode(newMode);
    localStorage.setItem('truegle_mode_pref', newMode);
    const params = new URLSearchParams(searchParams);
    if (newMode === 'blue') {
      params.delete('mode');
    } else {
      params.set('mode', newMode);
    }
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  const handleBiasedClick = () => {
    if (lockedGreen) return;
    setMode('purple');
    const params = new URLSearchParams(searchParams);
    params.set('mode', 'purple');
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  // Red-pill "deep dive": jump straight into purple mode strictly filtered to
  // the chosen perspective, reusing the existing perspective-specific pipeline.
  const handleDeepDivePerspective = (perspectiveId) => {
    if (lockedGreen) return;
    setSelectedPerspectives([perspectiveId]);
    setMode('purple');
    const params = new URLSearchParams(searchParams);
    params.set('mode', 'purple');
    params.set('perspectives', perspectiveId);
    navigate(`/search?${params.toString()}`, { replace: true });
  };

  const toggleOSINT = () => {
    if (lockedGreen) return;
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
    setSelectedPerspectives((prev) => {
      let next;
      if (prev.includes(perspectiveId)) {
        next = prev.filter((p) => p !== perspectiveId);
      } else {
        // Selecting a real perspective drops the default 'neutral'
        next = perspectiveId === 'neutral'
          ? [...prev, perspectiveId]
          : [...prev.filter((p) => p !== 'neutral'), perspectiveId];
      }
      // Always fall back to Neutral when nothing is selected
      return next.length > 0 ? next : ['neutral'];
    });
  };

  /**
   * Render appropriate background based on mode
   */
  const renderBackground = () => {
    // Low-end devices / reduced-motion: skip heavy WebGL+particle backgrounds
    if (!allowHeavyAnimations) {
      return <div className={`fixed inset-0 ${LITE_BG[mode] || LITE_BG.blue}`} />;
    }

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

  // Perspective colors + per-mode container accent — shared with other
  // mode-aware pages via config/modeTheme.js.
  const perspectiveColors = PERSPECTIVE_COLORS;
  const modeAccent = getModeAccent(mode);

  // ── ResultCard ──────────────────────────────────────────────────────────
  function ResultCard({ result, index, perspectiveColors, accent, safeSearch, currentQuery, currentMode }) {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [iframeBlocked, setIframeBlocked] = useState(false);
    const videoEmbed = getVideoEmbed(result.url);
    const borderClass = accent.border;
    const titleClass = accent.title;
    const blurClass = safeSearch === 'blur' ? 'blur-md hover:blur-none transition-all duration-200' : '';

    // Human-friendly source URL (hostname + path)
    let displayUrl = result.domain || result.url || '';
    try {
      const u = new URL(result.url);
      displayUrl = u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
    } catch { /* keep fallback */ }

    // Whole-card tap opens the link natively. The Truegle action buttons
    // (Open link / View anonymously / Open in app / Share) sit INSIDE the
    // card, so clicks on any real link/button/iframe are excluded — they
    // keep executing their own behavior without also opening the page.
    const openCardLink = (e) => {
      if (e.target.closest('a, button, iframe, input, [role="menu"]')) return;
      if (viewerOpen) return; // in-app viewer open = user is browsing here
      // Don't hijack text selection (mobile long-press copy)
      if (window.getSelection && String(window.getSelection())) return;
      window.open(result.url, '_blank', 'noopener,noreferrer');
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        role="link"
        tabIndex={0}
        aria-label={`Open ${result.title || result.url}`}
        onClick={openCardLink}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) {
            e.preventDefault();
            window.open(result.url, '_blank', 'noopener,noreferrer');
          }
        }}
        className={`rounded-lg bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 border transition-colors duration-300 cursor-pointer ${borderClass}`}
      >
        <div className="p-4">
          <div className="flex gap-3">
            {/* Thumbnail */}
            {result.image && (
              <img
                src={result.image}
                alt=""
                className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 opacity-80 ${blurClass}`}
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

              {/* Source URL */}
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 mt-0.5 text-xs text-emerald-400/90 hover:text-emerald-300 transition-colors"
              >
                {result.favicon && (
                  <img src={result.favicon} alt="" className="w-3.5 h-3.5 object-contain opacity-70"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                )}
                <span className="truncate max-w-[320px]">{displayUrl}</span>
              </a>

              <p className="text-sm text-white/70 mt-1 line-clamp-2">{result.snippet}</p>

              <div className="flex items-center gap-3 mt-2 text-xs text-white/50 flex-wrap">
                <span className="truncate max-w-[200px]">{result.sourceName || result.domain}</span>
                {result.date && <span>{new Date(result.date).toLocaleDateString()}</span>}
                {result.bias && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${perspectiveColors[result.bias] || perspectiveColors.neutral}`}>
                    {result.biasLabel || result.bias}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 ${accent.link} transition-colors`}
                  >
                    <ExternalLink size={12} /> Open link
                  </a>
                  {result.proxyUrl && (
                    <a
                      href={result.proxyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open this page through Truegle's anonymous proxy — the site never sees your IP or browser"
                      className={`flex items-center gap-1 ${accent.link} transition-colors`}
                    >
                      <Eye size={12} /> View anonymously
                    </a>
                  )}
                  <button
                    onClick={() => { setViewerOpen(!viewerOpen); setIframeBlocked(false); }}
                    className={`${accent.link} transition-colors`}
                  >
                    {viewerOpen ? 'Close' : videoEmbed ? '▶ Play here' : 'Open in app'}
                  </button>
                  <TruegleShareButton
                    result={result}
                    query={currentQuery}
                    mode={currentMode}
                    compact
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Inline iframe viewer (Open in app) */}
          {viewerOpen && (
            <div className={`mt-3 rounded-xl overflow-hidden border ${accent.iframeBorder}`}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
                <span className="text-xs text-white/40 truncate flex-1 mr-2">{result.url}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className={`text-xs ${accent.link} flex items-center gap-1`}>
                    <ExternalLink size={11} /> Open link
                  </a>
                  <button onClick={() => setViewerOpen(false)} className="text-xs text-white/30 hover:text-white">✕</button>
                </div>
              </div>
              {videoEmbed ? (
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    key={videoEmbed}
                    src={`${videoEmbed}?autoplay=1`}
                    className="absolute inset-0 w-full h-full"
                    title="Video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : iframeBlocked ? (
                <div className="flex flex-col items-center justify-center py-8 bg-black/20 gap-2">
                  <p className="text-sm text-white/50 text-center px-4">This page can't be embedded.</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer"
                    className={`text-xs ${accent.link} flex items-center gap-1`}>
                    <ExternalLink size={12} /> Open in new tab
                  </a>
                </div>
              ) : (
                <iframe
                  key={result.proxyUrl || result.url}
                  src={result.proxyUrl || result.url}
                  className="w-full h-[60vh]"
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

      {/* Cursor Glow Effect — driven imperatively via cursorGlowRef (see effect
          above) so it never triggers a React re-render. No CSS transition: it
          would fight the per-frame updates and cause a laggy trailing glitch. */}
      <div
        ref={cursorGlowRef}
        className="pointer-events-none fixed inset-0 z-30"
      />

      {/* Content - EXACT structure from SearchResults.jsx */}
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Logo - CENTERED AND BIG (same as SearchResults). The logo is scaled
              1.5-1.8x, which visually overflows its layout box; the extra bottom
              margin keeps that overflow from covering the mode-pill row below. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-12"
          >
            <TruegleLogo className="scale-[1.5] sm:scale-[1.8]" onClick={lockedGreen ? undefined : () => navigate('/')} />
          </motion.div>

          {/* Single cycling pill — same control as the landing page. relative
              z-20 so it sits above the scaled logo's overflow and stays
              clickable. Cycling only stages the mode; navigation happens on
              submit (see the search bar's onSearch below). */}
          {!lockedGreen && (
            <div className="relative z-20 mb-2">
              <PillModeRow activeMode={pillMode} onSelect={setPillMode} />
            </div>
          )}

          {/* Search Bar - Directly Below Logo (same as SearchResults) */}
          <div className="max-w-4xl mx-auto mb-6">
            <SearchBar
              value={searchValue}
              // No buttons below the bar (uniform with landing/chat) — submit
              // via Enter or the in-bar play button.
              showSearchButton={false}
              showBiasedButton={false}
              showUnbiasedButton={false}
              onChange={(val) => setSearchValue(val)}
              onSubmit={() => submitSearch()}
              onSearch={() => submitSearch()}
              placeholder={mode === 'purple' ? 'Explore perspectives...' : mode === 'ocean' ? 'OSINT search...' : 'Search for unbiased truth...'}
              size="medium"
              // Legacy in-bar pill + OSINT toggles removed — the single cycling
              // pill above the bar now covers all modes uniformly.
              showPillToggle={false}
              safeSearch={settings.safeSearch}
              onSafeSearchChange={(v) => updateSetting('safeSearch', v)}
              showFilters={true}
              filters={filters}
              onFiltersChange={setFilters}
              compactFilters={false}
              showFilterToggle={true}
              showOSINTToggle={false}
              // OSINT exception: the ocean page swaps the content categories for
              // the investigation-class row rendered below the bar.
              showCategories={mode !== 'ocean'}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              showMap={showMap || (autoOpenMap && !mapManuallyClosed)}
              onMapToggle={() => {
                if (showMap || (autoOpenMap && !mapManuallyClosed)) {
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
              isLoading={searchLoading}
            />
            {/* (Ocean/OSINT: the investigation-class row and the "TrueGLE vs"
                toggle are removed — the interactive OSINT Tools module below the
                bar now owns tool selection and the AI. Other modes keep them.) */}
            {/* Language selector — synced to browser language by default */}
            <div className="flex justify-end items-center gap-3 mt-2">
              {/* Nephesh mode: opt-in Null-Prime dual-audit protocol for
                  contested claims. Persistent, off by default. Hidden on the
                  OSINT page (no vs mode there). */}
              {mode !== 'ocean' && (
                <button
                  type="button"
                  onClick={() => setNepheshMode((v) => !v)}
                  title="TrueGLE Mode: layer the Null-Prime dual-audit protocol onto contested claims"
                  aria-pressed={nepheshMode}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    nepheshMode
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${nepheshMode ? 'bg-cyan-300' : 'bg-white/20'}`} />
                  TrueGLE Mode
                </button>
              )}
              <LanguageSelector />
            </div>
          </div>

          {/* Quick Result Card — directly below search bar for instant visibility */}
          {instantAnswer && (
            <div className="max-w-4xl mx-auto mb-4 mt-2">
              <QuickResultCard instantAnswer={instantAnswer} mode={mode === 'green' ? 'green' : mode === 'red' ? 'red' : mode === 'purple' ? 'purple' : mode === 'ocean' ? 'ocean' : 'blue'} />
            </div>
          )}

          {/* Multimedia Interface Dropdown (same as SearchResults) */}
          <AnimatePresence>
            {(activeCategory === 'pics' ||
              activeCategory === 'vids' ||
              activeCategory === 'audio' ||
              activeCategory === 'soc') && (
              <>
                <MultimediaInterface
                  category={activeCategory}
                  onClose={() => setActiveCategory('all')}
                  searchQuery={searchValue}
                />
                <div className="max-w-4xl mx-auto mt-4 mb-2 space-y-2">
                  <div className="flex justify-center">
                    <AdsterraBanner format="banner320x50" searchContext={adContext} />
                  </div>
                  <AdColorWrapper type="adult" className="flex justify-center">
                    <AdsterraBanner
                      format="banner728x90"
                      searchContext={adContext}
                      isAuthenticated={isAuthenticated}
                      safeSearch={settings.safeSearch}
                      query={query}
                    />
                  </AdColorWrapper>
                </div>
              </>
            )}
          </AnimatePresence>

          {/* "View map" chip — location detected but not an explicit map query.
              Not gated on mapManuallyClosed so it reappears after closing. */}
          {isLocationQuery && !autoOpenMap && !showMap && detectedLocation && (
            <div className="max-w-4xl mx-auto mb-4">
              <button
                type="button"
                onClick={() => { setShowMap(true); setMapManuallyClosed(false); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/70 transition-colors"
              >
                <MapPin size={13} />
                View map{detectedLocation.locationName ? ` — ${detectedLocation.locationName}` : ''}
              </button>
            </div>
          )}

          {/* Map View Overlay */}
          <AnimatePresence>
            {((showMap || autoOpenMap) && !mapManuallyClosed) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl mx-auto mb-6"
              >
                <MapViewWrapper
                  isOpen={(showMap || autoOpenMap) && !mapManuallyClosed}
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
                <div className="mt-4 space-y-2">
                  <div className="flex justify-center">
                    <AdsterraBanner format="banner320x50" searchContext={adContext} />
                  </div>
                  <AdColorWrapper type="adult" className="flex justify-center">
                    <AdsterraBanner
                      format="banner160x300"
                      searchContext={adContext}
                      isAuthenticated={isAuthenticated}
                      safeSearch={settings.safeSearch}
                      query={query}
                    />
                  </AdColorWrapper>
                </div>
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

          {/* OSINT Tools (Ocean mode only) — the interactive investigation
              module: the searched query is routed into its input, findings +
              AI results-summary + debrief all live here (no separate summary). */}
          {mode === 'ocean' && <OSINTToolsPanel initialQuery={lastSearchedQuery} />}

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

          {/* Prominent Question Answer — auto-shown for direct questions, no click required.
              (Ocean/OSINT has no AI summary surfaces — the tools module owns the AI.) */}
          {aiSummary?.isQuestion && mode !== 'green' && mode !== 'ocean' && (
            <div className="max-w-4xl mx-auto mb-4">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl backdrop-blur-xl border shadow-lg ${
                  mode === 'red' ? 'bg-red-950/70 border-red-500/40 shadow-red-500/10' :
                  mode === 'purple' ? 'bg-purple-950/70 border-purple-500/40 shadow-purple-500/10' :
                  mode === 'ocean' ? 'bg-cyan-950/70 border-cyan-500/40 shadow-cyan-500/10' :
                  'bg-[#0d1f3c]/90 border-cyan-500/40 shadow-cyan-500/10'
                }`}
              >
                <div className={`flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-widest ${
                  mode === 'red' ? 'text-red-400' : mode === 'purple' ? 'text-purple-400' :
                  mode === 'ocean' ? 'text-cyan-400' : 'text-cyan-400'
                }`}>
                  <Sparkles size={13} />
                  Quick Answer
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-3">
                    <div className={`animate-spin w-5 h-5 border-2 border-t-transparent rounded-full ${
                      mode === 'red' ? 'border-red-500' : mode === 'purple' ? 'border-purple-500' :
                      mode === 'ocean' ? 'border-cyan-500' : 'border-cyan-500'
                    }`} />
                    <span className="text-white/60 text-sm">Finding your answer...</span>
                  </div>
                ) : (
                  <p className="text-white text-lg font-medium leading-snug">
                    {getQuickAnswer(aiSummary.summary)}
                  </p>
                )}
              </motion.div>
            </div>
          )}

          {/* Search Summary — Banner + Expandable Card.
              Excluded on ocean: the OSINT Tools module above hosts its own AI
              results-summary + debrief, so there's no separate summary here. */}
          {mode !== 'green' && mode !== 'ocean' && sessionSummaryChoice !== 'none' && (
            <div className="max-w-4xl mx-auto mb-4">
              {/* (The AI lenses now live inside the expanded summary's inline
                  mini-chat — see InlineSummaryChat — rather than an always-shown
                  row here.) */}
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
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setShowNoSummaryConfirm(true); }}
                        onKeyDown={(e) => e.key === 'Enter' && setShowNoSummaryConfirm(true)}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 cursor-pointer"
                      >
                        Dismiss
                      </span>
                      <motion.div animate={{ rotate: summaryCollapsed ? 0 : 180 }}>
                        <ChevronDown size={20} className="text-white/40" />
                      </motion.div>
                    </div>
                  </button>

                  {summaryCollapsed && aiSummary && (
                    <div className="mt-2 flex justify-center">
                      <AdsterraBanner format="banner320x50" searchContext={adContext} />
                    </div>
                  )}

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
                            {aiSummary.isQuestion && (
                              <div className={`mb-3 p-3 rounded-xl border ${
                                mode === 'red' ? 'bg-red-500/10 border-red-500/30' :
                                mode === 'purple' ? 'bg-purple-500/10 border-purple-500/30' :
                                mode === 'ocean' ? 'bg-cyan-500/10 border-cyan-500/30' :
                                'bg-cyan-500/10 border-cyan-500/30'
                              }`}>
                                <div className="text-[10px] uppercase tracking-wide text-white/40 mb-1">
                                  Quick Answer
                                </div>
                                <p className="text-sm text-white font-medium leading-snug">
                                  {getQuickAnswer(aiSummary.summary)}
                                </p>
                              </div>
                            )}
                            <div className="text-sm text-white/80 leading-relaxed mb-3 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_strong]:font-semibold [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded">
                              <ReactMarkdown>{aiSummary.summary}</ReactMarkdown>
                            </div>
                            {mode === 'red' && aiSummary.perspectives?.length > 0 && (
                              <div className="mb-3">
                                <div className="text-xs font-semibold text-red-300 mb-2">
                                  Choose a perspective to deep dive into:
                                </div>
                                <div className="space-y-2">
                                  {aiSummary.perspectives.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => handleDeepDivePerspective(p.perspectiveId)}
                                      className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/40 transition-all"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold text-white">{p.label}</span>
                                        <span className="text-xs text-white/40">
                                          {p.count} source{p.count === 1 ? '' : 's'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-white/60">{p.summary}</p>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-white/40">
                              <span>{aiSummary.sourcesAnalyzed || 0} sources analyzed</span>
                            </div>
                            {/* Inline mini-chat — a miniaturized /chat that
                                continues from this summary. Chat lenses live in
                                its mode row ("Summarize" default). */}
                            {(FREE_ACCESS_MODE || isAuthenticated) ? (
                              <InlineSummaryChat
                                query={lastSearchedQuery}
                                summary={aiSummary.summary}
                                primaryMode={mode}
                                nepheshMode={nepheshMode}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate('/auth/login', { state: { redirectTo: window.location.pathname + window.location.search } })}
                                className="mt-3 text-xs text-white/40 underline hover:text-white/60"
                              >
                                Sign in to chat
                              </button>
                            )}
                            <div className="mt-3 space-y-2 flex flex-col items-center">
                              <AdsterraBanner format="banner320x50" searchContext={adContext} />
                              <AdsterraBanner format="banner320x50" searchContext={adContext} />
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

          {/* Ad Banner 1 - Below the AI summary. Hidden on question-phrased
              queries so the quick-answer card gets the space instead. */}
          {!queryIsQuestion && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto mb-4"
            >
              <AdColorWrapper type="cpm">
                <AdSlot className="rounded-2xl" size="large" />
              </AdColorWrapper>
            </motion.div>
          )}

          {mode !== 'green' && aiSummary && !summaryCollapsed && (
            <AdColorWrapper type="adult" className="max-w-4xl mx-auto mb-4 flex justify-center">
              <AdsterraBanner
                format="banner728x90"
                searchContext={adContext}
                isAuthenticated={isAuthenticated}
                safeSearch={settings.safeSearch}
                query={query}
              />
            </AdColorWrapper>
          )}

          {mode !== 'green' && (
            <div className="my-2">
              <AdSlot size="large" query={query} className="max-w-4xl mx-auto" />
            </div>
          )}

          <AdultConsentGate
            isAuthenticated={isAuthenticated}
            safeSearch={settings.safeSearch}
            query={query}
          />
          <AdColorWrapper type="adult" className="my-4 flex justify-center">
            <AdsterraBanner
              format="banner728x90"
              searchContext={adContext}
              isAuthenticated={isAuthenticated}
              safeSearch={settings.safeSearch}
              query={query}
            />
          </AdColorWrapper>

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
                  <p className="text-white/60 text-sm mb-1">
                    Switch to <strong className="text-green-400">Green Pill Mode</strong> for a
                    completely AI-free search experience — pure results, no summaries, no chat assistant.
                  </p>
                  <p className="text-white/40 text-xs mb-5">Your choice is saved — we won't ask again. Change it anytime via the pill toggle.</p>
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
                      onClick={() => {
                        localStorage.setItem('truegle_mode_pref', 'blue');
                        setShowFirstSearchModal(false);
                      }}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all"
                    >
                      No, keep Smart features
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Down-for-repairs modal (consecutive search malfunctions) */}
          <RepairsModal
            open={showRepairsModal}
            onClose={() => setShowRepairsModal(false)}
            onRetry={() => {
              setShowRepairsModal(false);
              handleSearch();
            }}
          />

          {mode !== 'green' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto mb-4"
            >
              <AdSlot size="large" query={query} />
            </motion.div>
          )}

          {/* Results Grid (same as SearchResults) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Results Column */}
            <div className="lg:col-span-3 space-y-4">
              {searchLoading ? (
                <div className="space-y-4">
                  <div className="text-sm text-white/60 mb-4">Searching...</div>
                  <AdColorWrapper type="reward">
                    <RewardAdSlot position="search-loading" size="large" />
                  </AdColorWrapper>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonSearchResult key={i} />
                  ))}
                </div>
              ) : (
                <>
                  <div className="text-sm mb-4">
                    <span className={modeAccent.count}>
                      {searchResults.length > 0 ? `About ${searchResults.length} results` : 'No results yet - try searching!'}
                    </span>
                  </div>

                  {/* Quick answer — short cited answer for question queries;
                      hidden when a structured instant answer already covers it */}
                  {!instantAnswer && (
                    <QuickAnswerCard quickAnswer={quickAnswer} loading={quickAnswerLoading} className="mb-4" />
                  )}

                  {/* Search failed (provider/network/quota) — reassure + retry */}
                  {searchError && lastSearchedQuery && (
                    <div className="mb-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <div className="text-2xl mb-2">🛠️</div>
                      <p className="text-amber-200 text-sm font-semibold mb-1">
                        We're having trouble fetching results right now
                      </p>
                      <p className="text-white/50 text-xs mb-4 max-w-md mx-auto">
                        TruegleSearch is in early access and one of our search
                        providers may be catching its breath. This is usually
                        brief — please try again in a moment.
                      </p>
                      <button
                        onClick={() => handleSearch()}
                        className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-sm border border-amber-500/40 transition-all"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {/* Genuine zero-results (search succeeded, nothing matched) */}
                  {!searchError && lastSearchedQuery && searchResults.length === 0 && (
                    <div className="mb-4 p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                      <p className="text-white/80 text-sm font-semibold mb-1">
                        No results for "{lastSearchedQuery}"
                      </p>
                      <p className="text-white/40 text-xs max-w-md mx-auto">
                        Try different keywords, broader terms, or another search mode.
                      </p>
                    </div>
                  )}

                  {/* OSINT mode requires auth + token */}
                  {mode === 'ocean' && searchResults.length > 0 && (
                    <TokenGate featureName="osint-tools">
                      <div className="mb-4 flex justify-center">
                        <AdsterraBanner format="banner320x50" searchContext={adContext} />
                      </div>
                      <div className="space-y-4">
                        {searchResults.map((result, index) => (
                          <ResultCard
                            key={result.url || index}
                            result={result}
                            index={index}
                            mode={mode}
                            perspectiveColors={perspectiveColors}
                            accent={modeAccent}
                            safeSearch={settings.safeSearch}
                            currentQuery={lastSearchedQuery}
                            currentMode={mode}
                          />
                        ))}
                      </div>
                    </TokenGate>
                  )}

                  {mode !== 'ocean' && searchResults.map((result, index) => (
                    <Fragment key={result.url || index}>
                      <div>
                        <ResultCard
                          result={result}
                          index={index}
                          mode={mode}
                          perspectiveColors={perspectiveColors}
                          accent={modeAccent}
                          safeSearch={settings.safeSearch}
                          currentQuery={lastSearchedQuery}
                          currentMode={mode}
                        />
                      </div>
                      {(index + 1) % 3 === 0 && index !== searchResults.length - 1 && (
                        <div className="flex justify-center my-1">
                          <AdsterraBanner format="banner320x50" searchContext={adContext} />
                        </div>
                      )}
                    </Fragment>
                  ))}

                  {/* Attribution badge — appears under the results so scraped/
                      shared result pages carry a visible Truegle credit. */}
                  {searchResults.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/10 text-center">
                      <span className="text-xs text-white/40">
                        Results from{' '}
                        <a
                          href="https://truegle.info"
                          rel="noopener noreferrer"
                          className="text-white/60 hover:text-white/90 underline-offset-2 hover:underline"
                        >
                          Truegle
                        </a>{' '}
                        — the unbiased search engine
                      </span>
                    </div>
                  )}

                  {searchResults.length > 0 && SMARTLINK_URL && (
                    <div className="mt-6 text-center">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Sponsored</p>
                      <a
                        href={SMARTLINK_URL}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-sm text-blue-500 hover:text-blue-400 underline underline-offset-2"
                      >
                        Discover relevant offers →
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar Column (same as SearchResults) */}
            <div className="lg:col-span-1 space-y-4">
              {/* Ad Sidebar */}
              <div className="sticky top-4 space-y-4 flex flex-col items-center">
                {mode !== 'green' && (
                  <AdColorWrapper type="cpm">
                    <AdsterraBanner format="banner300x250" searchContext={adContext} />
                  </AdColorWrapper>
                )}
                {mode !== 'green' && (
                  <AdColorWrapper type="adult">
                    <AdsterraBanner
                      format="banner160x600"
                      searchContext={adContext}
                      isAuthenticated={isAuthenticated}
                      safeSearch={settings.safeSearch}
                      query={query}
                    />
                  </AdColorWrapper>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The follow-up chat now lives inline in the expanded summary card
          (InlineSummaryChat), not in a separate modal overlay. */}
    </div>
  );
}
