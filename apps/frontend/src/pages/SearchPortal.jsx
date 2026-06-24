import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, Zap, TrendingUp, Mic, Camera, Paperclip, File as FileIcon, MapPin, Map, Navigation, Star, Clock, Phone, ExternalLink, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TruegleLogo from '../components/ui/TruegleLogo';
import SearchBar from '../components/ui/SearchBar';
import { DeepSpaceBackground } from '../components/backgrounds/DeepSpaceBackground';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import AIChatOverlay from '../components/ui/AIChatOverlay';
import PermissionsTrigger from '../components/permissions/PermissionsTrigger';
import AsSeenOn from '../components/Content/AsSeenOn';
import AdSlot from '../components/AdSlot';
import MultimediaInterface from '../components/ui/MultimediaInterface';
import { SkeletonSearchResult, SkeletonCard } from '../components/ui/Skeleton';
import { useToast, ToastProvider } from '../components/ui/ToastProvider';
import { MapViewWrapper, useMap } from '../components/map';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { useHealthCheck } from '../hooks/useHealthCheck';
import MapApiService from '../components/map/services/mapApi';
import { checkBackendHealth, checkRadarHealth, isServiceHealthy } from '../utils/healthCheck';
import HealthStatusBanner from '../components/ui/HealthStatusBanner';
import QuickResultCard from '../components/ui/QuickResultCard';

export default function SearchPortal() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [isFirstSearch, setIsFirstSearch] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [showHealthBanner, setShowHealthBanner] = useState(true);
  const { isLocationQuery, detectedLocation } = useLocationDetection(searchValue);
  const { health, isBackendHealthy, isRadarHealthy, isAnyServiceUnhealthy } = useHealthCheck();
  const { actions } = useMap();

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
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    order: 'desc',
    dateRange: 'any'
  });
  const [isRedPillMode, setIsRedPillMode] = useState(() => {
    const savedMode = localStorage.getItem('isRedPillMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const updateRedPillMode = (mode) => {
    setIsRedPillMode(mode);
    localStorage.setItem('isRedPillMode', JSON.stringify(mode));

    // Navigate based on pill mode change
    if (mode === true) {
      // Switching to Red Pill - navigate to Search Results with current query
      toast.success('Red Pill Activated', 'Switching to detailed search results', { pageTheme: 'search-results' });
      if (searchValue.trim()) {
        navigate(`/search-results?q=${encodeURIComponent(searchValue)}`);
      } else {
        navigate('/search-results');
      }
    } else {
      // Switching to Blue Pill
      toast.info('Blue Pill Activated', 'Quick search mode enabled', { pageTheme: 'search-portal' });
    }
    // If switching to Blue Pill, stay on SearchPortal (no navigation needed)
  };
  const [showWarning, setShowWarning] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [aiSearchValue, setAiSearchValue] = useState('');
  const [aiSearchSummary, setAiSearchSummary] = useState('');
  const [aiSearchPerspectives, setAiSearchPerspectives] = useState([]);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionType, setPermissionType] = useState(null);
  const [showMicrophoneInterface, setShowMicrophoneInterface] = useState(false);
  const [showCameraInterface, setShowCameraInterface] = useState(false);
  const [showFilesInterface, setShowFilesInterface] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showGlitch, setShowGlitch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [instantAnswer, setInstantAnswer] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isOSINTMode, setIsOSINTMode] = useState(false);

  // Check localStorage for hasRememberedFreemium preference
  const hasRememberedFreemium = localStorage.getItem('truegle_remember_freemium') === 'true';

  // Update meta tags and structured data based on search query
  useEffect(() => {
    // Update page title
    document.title = searchValue ? `${searchValue} - Truegle Search Portal` : 'Truegle - Unbiased Search Portal';

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', searchValue
        ? `Search for "${searchValue}" on Truegle - Unbiased, multi-perspective search results with AI analysis.`
        : 'Truegle Search Portal - Unbiased, multi-perspective search with AI analysis.');
    } else {
      const newMetaDescription = document.createElement('meta');
      newMetaDescription.name = 'description';
      newMetaDescription.content = searchValue
        ? `Search for "${searchValue}" on Truegle - Unbiased, multi-perspective search results with AI analysis.`
        : 'Truegle Search Portal - Unbiased, multi-perspective search with AI analysis.';
      document.head.appendChild(newMetaDescription);
    }

    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', searchValue
        ? `${searchValue}, search, unbiased, multi-perspective, AI, analysis, Truegle, portal`
        : 'search, unbiased, multi-perspective, AI, analysis, Truegle, portal');
    } else {
      const newMetaKeywords = document.createElement('meta');
      newMetaKeywords.name = 'keywords';
      newMetaKeywords.content = searchValue
        ? `${searchValue}, search, unbiased, multi-perspective, AI, analysis, Truegle, portal`
        : 'search, unbiased, multi-perspective, AI, analysis, Truegle, portal';
      document.head.appendChild(newMetaKeywords);
    }

    // Update Open Graph tags for social sharing
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', searchValue
        ? `${searchValue} - Truegle Search Portal`
        : 'Truegle - Unbiased Search Portal');
    } else {
      const newOgTitle = document.createElement('meta');
      newOgTitle.setAttribute('property', 'og:title');
      newOgTitle.setAttribute('content', searchValue
        ? `${searchValue} - Truegle Search Portal`
        : 'Truegle - Unbiased Search Portal');
      document.head.appendChild(newOgTitle);
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', searchValue
        ? `Unbiased, multi-perspective search results for "${searchValue}" with AI analysis on Truegle.`
        : 'Truegle Search Portal - Unbiased, multi-perspective search with AI analysis.');
    } else {
      const newOgDescription = document.createElement('meta');
      newOgDescription.setAttribute('property', 'og:description');
      newOgDescription.setAttribute('content', searchValue
        ? `Unbiased, multi-perspective search results for "${searchValue}" with AI analysis on Truegle.`
        : 'Truegle Search Portal - Unbiased, multi-perspective search with AI analysis.');
      document.head.appendChild(newOgDescription);
    }

    // Update canonical URL
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', `${window.location.origin}/search-portal${searchValue ? `?q=${encodeURIComponent(searchValue)}` : ''}`);
    } else {
      const newCanonicalLink = document.createElement('link');
      newCanonicalLink.rel = 'canonical';
      newCanonicalLink.href = `${window.location.origin}/search-portal${searchValue ? `?q=${encodeURIComponent(searchValue)}` : ''}`;
      document.head.appendChild(newCanonicalLink);
    }

    // Add structured data markup (JSON-LD)
    const existingStructuredData = document.querySelector('script[type="application/ld+json"]');
    if (existingStructuredData) {
      existingStructuredData.remove();
    }

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": searchValue ? `${searchValue} - Truegle Search Portal` : 'Truegle - Unbiased Search Portal',
      "description": searchValue
        ? `Search for "${searchValue}" on Truegle - Unbiased, multi-perspective search results with AI analysis.`
        : 'Truegle Search Portal - Unbiased, multi-perspective search with AI analysis.',
      "url": `${window.location.origin}/search-portal${searchValue ? `?q=${encodeURIComponent(searchValue)}` : ''}`,
      "datePublished": new Date().toISOString(),
      "dateModified": new Date().toISOString(),
      "author": {
        "@type": "Organization",
        "name": "Truegle",
        "url": window.location.origin
      },
      "publisher": {
        "@type": "Organization",
        "name": "Truegle",
        "logo": {
          "@type": "ImageObject",
          "url": `${window.location.origin}/truegle-logo.png`
        }
      },
      "mainEntity": {
        "@type": "SearchResultsPage",
        "query": searchValue || "home",
        "resultCount": 10 // This would be dynamic in a real implementation
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, [searchValue]);

  // No mock results - show default message instead


  // Maps functionality state
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [showLocationPermission, setShowLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mapsExpanded, setMapsExpanded] = useState(false);
  const [localBusinesses, setLocalBusinesses] = useState([
    {
      id: 1,
      name: 'The Coffee House',
      type: 'Coffee Shop',
      rating: 4.5,
      reviews: 324,
      address: '123 Main Street',
      phone: '(555) 123-4567',
      hours: 'Open until 9:00 PM',
      distance: '0.3 mi',
      isOpen: true,
      priceLevel: '$$',
      image: null,
      coordinates: { lat: 40.7128, lng: -74.0060 }
    },
    {
      id: 2,
      name: 'Italian Bistro',
      type: 'Restaurant',
      rating: 4.8,
      reviews: 512,
      address: '456 Oak Avenue',
      phone: '(555) 234-5678',
      hours: 'Open until 10:00 PM',
      distance: '0.5 mi',
      isOpen: true,
      priceLevel: '$$$',
      image: null,
      coordinates: { lat: 40.7138, lng: -74.0070 }
    },
    {
      id: 3,
      name: 'Quick Mart',
      type: 'Convenience Store',
      rating: 4.2,
      reviews: 89,
      address: '789 Pine Road',
      phone: '(555) 345-6789',
      hours: 'Open 24 hours',
      distance: '0.2 mi',
      isOpen: true,
      priceLevel: '$',
      image: null,
      coordinates: { lat: 40.7118, lng: -74.0050 }
    },
    {
      id: 4,
      name: 'City Gym & Fitness',
      type: 'Gym',
      rating: 4.6,
      reviews: 267,
      address: '321 Fitness Blvd',
      phone: '(555) 456-7890',
      hours: 'Open until 11:00 PM',
      distance: '0.8 mi',
      isOpen: true,
      priceLevel: '$$',
      image: null,
      coordinates: { lat: 40.7148, lng: -74.0080 }
    },
    {
      id: 5,
      name: 'Green Pharmacy',
      type: 'Pharmacy',
      rating: 4.4,
      reviews: 156,
      address: '567 Health Street',
      phone: '(555) 567-8901',
      hours: 'Closes at 8:00 PM',
      distance: '0.4 mi',
      isOpen: true,
      priceLevel: '$$',
      image: null,
      coordinates: { lat: 40.7108, lng: -74.0040 }
    }
  ]);

  const handleSearchComplete = async () => {
    if (!searchValue.trim()) return;

    localStorage.setItem('truegle_first_search', Date.now().toString());
    console.log('Search submitted:', searchValue);
    console.log('🔍 DEBUG - activeCategory:', activeCategory);

    setSearchLoading(true);
    setAiSummary(null);
    setInstantAnswer(null);
    try {
      // Use dedicated maps endpoint when Maps category is selected or for location-based queries
      const useMapsEndpoint = activeCategory === 'maps' || activeCategory === 'local' || isLocationQuery;

      if (useMapsEndpoint) {
        console.log('🗺️ Using maps endpoint for search');

        if (!showMap) {
          setShowMap(true);
        }

        if (!userLocation) {
          requestLocationPermission();
          return;
        }

        try {
          const radarHealth = await checkRadarHealth();
          if (!isServiceHealthy(radarHealth)) {
            console.warn('⚠️ Radar service unhealthy, checking backend health...');
            const backendHealth = await checkBackendHealth();
            if (!isServiceHealthy(backendHealth)) {
              toast.error('Service Unavailable', 'Backend services are not responding. Please try again later.', { pageTheme: 'search-portal' });
              return;
            }
          }

          const mapsResult = await MapApiService.searchPlaces(
            { lat: userLocation.lat, lng: userLocation.lng },
            { query: searchValue, limit: 10, radius: 5000 }
          );

          console.log('🗺️ Maps results:', mapsResult);

          const businesses = (mapsResult.data || []).map((place, index) => ({
            id: place.id || index,
            name: place.name || 'Unknown Place',
            type: place.categories?.[0] || 'Place',
            rating: place.rating || (Math.random() * 2 + 3).toFixed(1),
            reviews: place.reviewCount || Math.floor(Math.random() * 500 + 10),
            distance: place.distance ? `${(place.distance / 1609.34).toFixed(1)} mi` : 'N/A',
            isOpen: place.hours?.current !== 'closed',
            priceLevel: place.price || '$$',
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            address: place.address?.formattedAddress || '',
            phone: place.phone || '',
            website: place.website || '',
            hours: place.hours?.display || ''
          }));

          setLocalBusinesses(businesses);
          setSearchResults([]);
          setAiSearchValue(searchValue);
          setAiSearchPerspectives([]);

          toast.success('Maps Search', `Found ${businesses.length} nearby places`, { pageTheme: 'search-portal' });
          return;
        } catch (mapsError) {
          console.error('❌ Maps search failed:', mapsError);
          toast.error('Maps Search Failed', mapsError.message || 'Unable to search for places. Please try again.', { pageTheme: 'search-portal' });
          return;
        }
      }

      // Regular web search for non-maps categories
      const categoryMap = {
        'pics': 'images',
        'vids': 'videos',
        'audio': 'web',
        'soc': 'social',
        'local': 'shopping',
        'maps': 'maps'
      };

      const searchCategory = categoryMap[activeCategory] || activeCategory || 'all';
      console.log('🔍 DEBUG - searchCategory being sent to backend:', searchCategory);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchValue,
          filters: { category: searchCategory, bias: 'all', dateRange: 'any', sortBy: 'relevance', order: 'desc', perPage: 20 }
        })
      });

      if (!response.ok) throw new Error(`Search error: ${response.status}`);
      const data = await response.json();

      const results = { results: data.results || [], perspectives: [] };
      if (data.instantAnswer) setInstantAnswer(data.instantAnswer);

      toast.success('Search Complete', `Found ${data.results?.length || 0} results`, { pageTheme: 'search-portal' });

      // DEBUG: Log result sources
      const sourceCounts = {};
      results.results.forEach(r => {
        sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
      });
      console.log('🔍 DEBUG - Results received:', results.results.length, 'total');
      console.log('🔍 DEBUG - Results by source:', sourceCounts);

      setSearchResults(results.results || []);
      setAiSearchValue(searchValue);
      setAiSearchPerspectives(results.perspectives || []);
      console.log('Search results:', results);

      // Fetch AI summary in the background
      if (results.results && results.results.length > 0) {
        fetchAiSummary(searchValue, results.results);
      }

      // NAVIGATE BASED ON PILL MODE AFTER SEARCH
      if (isRedPillMode) {
        // Red Pill: Navigate to Search Results page
        toast.info('Red Pill Mode', 'Navigating to detailed search results', { pageTheme: 'search-results' });
        navigate(`/search-results?q=${encodeURIComponent(searchValue)}`);
      } else {
        // Blue Pill: Navigate to Search Portal page with query param to trigger auto-search
        navigate(`/search-portal?q=${encodeURIComponent(searchValue)}`, { replace: true });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search Failed', 'Unable to perform search. Please try again.', { pageTheme: 'search-portal' });
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch AI summary for search results
  const fetchAiSummary = async (query, results) => {
    setAiLoading(true);

    try {
      console.log('🤖 Fetching AI summary...');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          results: results.slice(0, 10),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ AI summary received:', data.model);

      setAiSummary({
        summary: data.summary,
        perspectives: data.perspectives,
        sourcesAnalyzed: data.sourcesAnalyzed,
        model: data.model,
      });
    } catch (error) {
      console.error('❌ AI summary error:', error);
      // Set a fallback summary
      setAiSummary({
        summary: `Search results for "${query}" cover multiple perspectives from various sources.`,
        perspectives: [],
        sourcesAnalyzed: results.length,
        model: 'fallback',
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-search when URL has query param
  useEffect(() => {
    const queryParam = searchParams.get('q');
    if (queryParam && queryParam.trim() && searchResults.length === 0 && !searchLoading) {
      setSearchValue(queryParam);
      // Don't auto-search immediately - let user choose category first
      // Only auto-search if user hasn't interacted with categories
    }
  }, [searchParams]);

  // Function to call search APIs
  const callSearchApis = async (query, isRedPill, category = 'all') => {
    try {
      // Call the backend search API
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters: {
            category: category,
            bias: 'all',
            dateRange: 'any',
            sortBy: 'relevance',
            order: 'desc',
            perPage: 10
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Return the search results with perspectives
      return {
        results: data.results || [],
        perspectives: data.perspectives || getSearchPerspectives(query)
      };
    } catch (error) {
      console.error('Error calling search APIs:', error);

      // Fallback to simulated results if API call fails
      return new Promise((resolve) => {
        setTimeout(() => {
          // Simulate different results based on mode
          if (isRedPill) {
            // Red Pill mode might return more controversial or alternative results
            resolve({
              results: [
                { title: `Red Pill Results for: ${query}`, url: '#', snippet: 'Controversial and alternative perspectives on your query' },
                { title: 'Alternative Viewpoints', url: '#', snippet: 'Less mainstream perspectives on this topic' },
                { title: 'Hidden Aspects', url: '#', snippet: 'Less discussed aspects of this topic' }
              ],
              perspectives: getSearchPerspectives(query)
            });
          } else {
            // Blue Pill mode returns more mainstream results
            resolve({
              results: [
                { title: 'Search Results', url: '#', snippet: 'Information on your query' },
                { title: 'Related Content', url: '#', snippet: 'Additional information' },
                { title: 'More Details', url: '#', snippet: 'Further reading' }
              ],
              perspectives: getSearchPerspectives(query)
            });
          }
        }, 800); // Simulate API delay
      });
    }
  };

  // Function to load ads from Google AdMob API
  const loadAdFromGoogleAdMob = async () => {
    try {
      // Connect to the backend ad service which securely handles AdMob API
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ads/admob`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`AdMob API error: ${response.status} ${response.statusText}`);
      }

      const adData = await response.json();

      console.log('Successfully connected to Google AdMob API:', adData);

      // In a real implementation, we would display the ad content here
      return adData;
    } catch (error) {
      console.error('Error connecting to Google AdMob API:', error);

      // Fallback to simulated ad data if API call fails
      return {
        adUnitId: 'ca-app-pub-1234567890',
        adType: 'banner',
        adContent: 'Premium Ad Content'
      };
    }
  };

  const handleAiSearch = async (e) => {
    e.preventDefault();
    if (aiSearchValue.trim()) {
      // Update the search summary with the current query
      setAiSearchSummary(aiSearchValue);

      try {
        // Call the AI API to get search results and perspectives
        const aiResults = await callAIApi(aiSearchValue);

        // Update perspectives with AI-generated results
        setAiSearchPerspectives(aiResults.perspectives || []);
      } catch (error) {
        console.error('Error calling AI API:', error);

        // Fallback to keyword-based perspective detection
        const perspectives = getSearchPerspectives(aiSearchValue);
        setAiSearchPerspectives(perspectives);
      }
    }
  };

  // Function to call the DeepSeek AI API
  const callAIApi = async (query) => {
    try {
      // First try to call the DeepSeek API through the backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/deepseek`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          options: {
            analyzePerspectives: true,
            generateSummary: true,
            includeSources: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Return the AI analysis results
      return {
        summary: data.summary || `Analysis of query: "${query}"`,
        perspectives: data.perspectives || getSearchPerspectives(query)
      };
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      console.log('Falling back to local perspective analysis...');

      // Fallback to local perspective analysis if DeepSeek API fails
      return new Promise((resolve) => {
        setTimeout(() => {
          // Perform local analysis of the query
          const localResults = {
            summary: `Analysis of query: "${query}"`,
            perspectives: getSearchPerspectives(query)
          };
          resolve(localResults);
        }, 300); // Simulate API delay
      });
    }
  };

  // Function to determine perspectives based on search query
  const getSearchPerspectives = (query) => {
    // Convert query to lowercase for easier matching
    const lowerQuery = query.toLowerCase();

    // Define perspective keywords based on provided classifications
    const politicalPerspectives = [
      { name: 'Conservative', perspective: 'Conservative', keywords: ['conservative', 'right wing', 'traditional values', 'republican', 'right-leaning', 'right wing', 'right side'] },
      { name: 'Liberal', perspective: 'Liberal', keywords: ['liberal', 'left wing', 'democrat', 'progressive', 'left-leaning', 'left wing', 'left side'] },
      { name: 'Bipartisan', perspective: 'Bipartisan', keywords: ['bipartisan', 'collaborative', 'united', 'together', 'compromise'] },
      { name: 'Libertarian', perspective: 'Libertarian', keywords: ['libertarian', 'liberty', 'freedom', 'minimal government', 'individual rights'] },
      { name: 'Progressive', perspective: 'Progressive', keywords: ['progressive', 'progress', 'change', 'advancement', 'modern'] },
      { name: 'Centrist', perspective: 'Centrist', keywords: ['centrist', 'moderate', 'middle', 'center', 'balanced'] }
    ];

    const faithPerspectives = [
      { name: 'Religious', perspective: 'Religious', keywords: ['religious', 'faith', 'god', 'bible', 'church', 'worship', 'spiritual'] },
      { name: 'Atheist', perspective: 'Atheist', keywords: ['atheist', 'no god', 'non-believer', 'secular', 'agnostic'] },
      { name: 'New World', perspective: 'New World', keywords: ['new world', 'illumination', 'conspiracy', 'secret societies', 'freemason'] },
      { name: 'Old World', perspective: 'Old World', keywords: ['old world', 'pagan', 'ancient', 'traditional', 'historical'] },
      { name: 'Spiritual', perspective: 'Spiritual', keywords: ['spiritual', 'soul', 'transcendence', 'enlightenment', 'meditation'] },
      { name: 'Secular', perspective: 'Secular', keywords: ['secular', 'non-religious', 'worldly', 'material', 'scientific'] },
      { name: 'Universal', perspective: 'Universal', keywords: ['universal', 'cosmic', 'global', 'all-encompassing', 'holistic'] }
    ];

    const societalPerspectives = [
      { name: 'Mainstream', perspective: 'Mainstream', keywords: ['mainstream', 'popular', 'common', 'accepted', 'traditional media'] },
      { name: 'Alternative', perspective: 'Alternative', keywords: ['alternative', 'different', 'unconventional', 'non-mainstream', 'independent'] },
      { name: 'Conspiracy', perspective: 'Conspiracy', keywords: ['conspiracy', 'secret', 'coverup', 'hidden', 'agenda', 'deep state', 'false flag'] },
      { name: 'Skeptic', perspective: 'Skeptic', keywords: ['skeptic', 'doubt', 'question', 'skeptical', 'disbelief'] },
      { name: 'Traditional', perspective: 'Traditional', keywords: ['traditional', 'old', 'historical', 'established', 'conventional'] },
      { name: 'Scientific', perspective: 'Scientific', keywords: ['scientific', 'research', 'study', 'data', 'evidence', 'experiment'] },
      { name: 'Government', perspective: 'Government', keywords: ['government', 'official', 'policy', 'regulation', 'state'] },
      { name: 'Community', perspective: 'Community', keywords: ['community', 'local', 'neighborhood', 'group', 'collective'] }
    ];

    const economicPerspectives = [
      { name: 'Local Economy', perspective: 'Local Economy', keywords: ['local', 'community', 'neighborhood', 'regional', 'municipal'] },
      { name: 'Global Economics', perspective: 'Global Economics', keywords: ['global', 'international', 'worldwide', 'foreign', 'multinational'] },
      { name: 'Investors', perspective: 'Investors', keywords: ['investors', 'investment', 'stocks', 'trading', 'finance'] },
      { name: 'Consumers', perspective: 'Consumers', keywords: ['consumers', 'buyers', 'customers', 'purchasers', 'market'] },
      { name: 'Small Business', perspective: 'Small Business', keywords: ['small business', 'entrepreneur', 'startup', 'local business', 'independent'] },
      { name: 'Corporate', perspective: 'Corporate', keywords: ['corporate', 'company', 'business', 'enterprise', 'organization'] }
    ];

    // Combine all perspectives
    const allPerspectives = [
      ...politicalPerspectives,
      ...faithPerspectives,
      ...societalPerspectives,
      ...economicPerspectives
    ];

    // Find matching perspectives based on keywords
    const matchedPerspectives = [];

    // Check each perspective for keyword matches
    for (const perspective of allPerspectives) {
      let matchCount = 0;
      for (const keyword of perspective.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        matchedPerspectives.push({
          name: perspective.name,
          perspective: perspective.perspective
        });
      }
    }

    // If no specific perspectives matched, default to Neutral
    if (matchedPerspectives.length === 0) {
      return [
        { name: 'Perspective 1', perspective: 'Neutral' },
        { name: 'Perspective 2', perspective: 'Neutral' },
        { name: 'Perspective 3', perspective: 'Neutral' }
      ];
    }

    // If we have fewer than 3 perspectives, fill with neutral
    while (matchedPerspectives.length < 3) {
      matchedPerspectives.push({
        name: `Perspective ${matchedPerspectives.length + 1}`,
        perspective: 'Neutral'
      });
    }

    // Return the top 3 perspectives
    return matchedPerspectives.slice(0, 3);
  };

  const handleBiasedClick = async () => {
    // First verify API connections are working
    try {
      // Test connection to backend
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/health`);
      if (response.ok) {
        console.log('Backend API connection verified');
      }
    } catch (error) {
      console.error('Backend API connection failed:', error);
    }

    // Navigate to the biased results page with current query
    if (searchValue.trim()) {
      navigate(`/biased?q=${encodeURIComponent(searchValue)}`);
    } else {
      navigate('/biased');
    }
  };

  const togglePillMode = () => {
      if (!isRedPillMode) {
        // Switching to Red Pill mode - show warning (DO NOT NAVIGATE)
        setShowWarning(true);
      } else if (!hasRememberedFreemium) {
        // User previously chose to remember, skip warning
        setIsRedPillMode(true);
      } else {
        setShowWarning(true);
      }
  };

  const confirmRedPill = () => {
    setIsRedPillMode(true);
    setShowWarning(false);
  };

  const toggleOSINT = async () => {
    setIsOSINTMode(!isOSINTMode);
    if (!isOSINTMode) {
      // Verify API connections before navigating
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/health`);
        if (response.ok) {
          console.log('Backend API connection verified for OSINT mode');
        }
      } catch (error) {
        console.error('Backend API connection failed for OSINT mode:', error);
      }

      // Navigate to OSINT tools with current search query
      if (searchValue.trim()) {
        navigate(`/osint/tools?q=${encodeURIComponent(searchValue)}`);
      } else {
        navigate('/osint/tools');
      }
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
      // Check if the browser supports the required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // In a real implementation, we would process the audio stream
      // For now, we'll simulate the transcription and analysis
      console.log('Microphone access granted, processing audio...');

      // Process microphone input here
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Microphone access denied:', err);
      let errorMessage = 'Microphone access was denied.';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access was blocked. Please enable it in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone was found on your device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Microphone access is not supported in this browser.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Microphone access was blocked due to security restrictions.';
      }

      alert(errorMessage);
    }
  };

  // Handle file upload and analysis with security measures
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Security: Validate file types and sizes
    const maxFileSize = 50 * 1024 * 1024; // 50MB limit
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov', 'video/avi', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/mpeg',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (file.size > maxFileSize) {
        alert(`File ${file.name} exceeds the 50MB size limit.`);
        continue;
      }

      // Check file type
      if (!allowedTypes.includes(file.type)) {
        alert(`File type not allowed: ${file.type}. Please upload a valid file.`);
        continue;
      }

      try {
        const analysisResult = await analyzeFile(file);

        // Process the analysis result
        console.log('File analysis result:', analysisResult);

        // Update the search value with the file content for search
        setSearchValue(analysisResult.content);

        // Update AI search with relevant information
        setAiSearchValue(`Analyze this ${analysisResult.type} file: ${file.name}`);

        // Update perspectives based on the analysis
        const perspectives = getSearchPerspectives(analysisResult.content);
        setAiSearchPerspectives(perspectives);

        // Show the AI assistant expanded to display the results
        setAiExpanded(true);
      } catch (error) {
        console.error('Error analyzing file:', error);
        alert(`Error analyzing file: ${file.name}`);
      }
    }
  };

  // Analyze different types of media files with enhanced categorization and perspective analysis
  const analyzeFile = async (file) => {
    const fileType = file.type.split('/')[0]; // 'image', 'video', 'audio', etc.
    const fileName = file.name.toLowerCase();
    const fileContent = fileName; // In a real implementation, we would extract actual content

    // Enhanced media categorization based on file type and content with perspective analysis
    if (fileName.includes('conspiracy') || fileName.includes('secret') || fileName.includes('hidden') ||
        fileName.includes('agenda') || fileName.includes('deepstate') || fileName.includes('coverup')) {
      return await analyzeConspiracyMedia(file, fileType);
    } else if (fileName.includes('science') || fileName.includes('research') || fileName.includes('study') ||
               fileName.includes('data') || fileName.includes('evidence') || fileName.includes('experiment')) {
      return await analyzeScienceMedia(file, fileType);
    } else if (fileName.includes('news') || fileName.includes('report') || fileName.includes('article') ||
               fileName.includes('journal') || fileName.includes('press') || fileName.includes('media')) {
      return await analyzeNewsMedia(file, fileType);
    } else if (fileName.includes('politic') || fileName.includes('government') || fileName.includes('election') ||
               fileName.includes('democrat') || fileName.includes('republican') || fileName.includes('conservative') ||
               fileName.includes('liberal')) {
      return await analyzePoliticalMedia(file, fileType);
    } else if (fileName.includes('religion') || fileName.includes('faith') || fileName.includes('spiritual') ||
               fileName.includes('atheist') || fileName.includes('agnostic') || fileName.includes('church') ||
               fileName.includes('temple') || fileName.includes('mosque')) {
      return await analyzeReligiousMedia(file, fileType);
    } else if (fileName.includes('economy') || fileName.includes('finance') || fileName.includes('market') ||
               fileName.includes('stock') || fileName.includes('investment') || fileName.includes('trading')) {
      return await analyzeEconomicMedia(file, fileType);
    } else {
      // Default analysis based on file type with perspective detection
      switch (fileType) {
        case 'image':
          return await analyzeImage(file, fileContent);
        case 'video':
          return await analyzeVideo(file, fileContent);
        case 'audio':
          return await analyzeAudio(file, fileContent);
        default:
          return await analyzeDocument(file, fileContent);
      }
    }
  };

  // Analyze conspiracy-related media
  const analyzeConspiracyMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'Conspiracy-related content detected',
        tags: ['conspiracy', 'alternative', 'controversial'],
        content: `Conspiracy-related ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Conspiracy'
      };
      resolve(mediaData);
    });
  };

  // Analyze science-related media
  const analyzeScienceMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'Science-related content detected',
        tags: ['science', 'research', 'evidence-based'],
        content: `Science-related ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Scientific'
      };
      resolve(mediaData);
    });
  };

  // Analyze news-related media
  const analyzeNewsMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'News-related content detected',
        tags: ['news', 'report', 'information'],
        content: `News-related ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Neutral' // Default to neutral for news
      };
      resolve(mediaData);
    });
  };

  // Analyze political-related media
  const analyzePoliticalMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'Political content detected',
        tags: ['politics', 'government', 'election'],
        content: `Political ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Political' // Will be determined more specifically based on content
      };
      resolve(mediaData);
    });
  };

  // Analyze religious-related media
  const analyzeReligiousMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'Religious content detected',
        tags: ['religion', 'faith', 'spiritual'],
        content: `Religious ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Faith' // Will be determined more specifically based on content
      };
      resolve(mediaData);
    });
  };

  // Analyze economic-related media
  const analyzeEconomicMedia = async (file, fileType) => {
    return new Promise((resolve) => {
      const mediaData = {
        type: fileType,
        name: file.name,
        size: file.size,
        analysis: 'Economic content detected',
        tags: ['economy', 'finance', 'market'],
        content: `Economic ${fileType} file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: 'Economic' // Will be determined more specifically based on content
      };
      resolve(mediaData);
    });
  };

  // Analyze image content
  const analyzeImage = async (file, fileContent = '') => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // In a real implementation, this would use an image analysis API
        // For now, we'll simulate the analysis
        const imageData = {
          type: 'image',
          name: file.name,
          size: file.size,
          analysis: 'Image analysis complete',
          tags: ['image', 'media', 'visual'],
          content: `Image file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
          perspective: getSearchPerspectives(fileContent || file.name)[0]?.perspective || 'Neutral'
        };
        resolve(imageData);
      };
      reader.readAsDataURL(file);
    });
  };

  // Analyze video content
  const analyzeVideo = async (file, fileContent = '') => {
    return new Promise((resolve) => {
      const videoData = {
        type: 'video',
        name: file.name,
        size: file.size,
        analysis: 'Video analysis complete',
        tags: ['video', 'media', 'visual'],
        content: `Video file: ${file.name} (${Math.round(file.size / (1024 * 1024))} MB)`,
        perspective: getSearchPerspectives(fileContent || file.name)[0]?.perspective || 'Neutral'
      };
      resolve(videoData);
    });
  };

  // Analyze audio content
  const analyzeAudio = async (file, fileContent = '') => {
    return new Promise((resolve) => {
      const audioData = {
        type: 'audio',
        name: file.name,
        size: file.size,
        analysis: 'Audio analysis complete',
        tags: ['audio', 'media', 'sound'],
        content: `Audio file: ${file.name} (${Math.round(file.size / (1024 * 1024))} MB)`,
        perspective: getSearchPerspectives(fileContent || file.name)[0]?.perspective || 'Neutral'
      };
      resolve(audioData);
    });
  };

  // Analyze document content
  const analyzeDocument = async (file, fileContent = '') => {
    return new Promise((resolve) => {
      const docData = {
        type: 'document',
        name: file.name,
        size: file.size,
        analysis: 'Document analysis complete',
        tags: ['document', 'text', 'content'],
        content: `Document file: ${file.name} (${Math.round(file.size / 1024)} KB)`,
        perspective: getSearchPerspectives(fileContent || file.name)[0]?.perspective || 'Neutral'
      };
      resolve(docData);
    });
  };

  // Start camera with proper error handling
  const startCamera = async () => {
    try {
      // Check if the browser supports the required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      // In a real implementation, we would process the video stream
      // For now, we'll simulate the image capture and analysis
      console.log('Camera access granted, processing video...');

      // Process camera input here
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Camera access denied:', err);
      let errorMessage = 'Camera access was denied.';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access was blocked. Please enable it in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera was found on your device.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage = 'Camera access is not supported in this browser.';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Camera access was blocked due to security restrictions.';
      }

      alert(errorMessage);
    }
  };

  // Handle category change - expand maps when Maps category is selected
  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    if (categoryId === 'maps' || categoryId === 'local') {
      setMapsExpanded(true);
      setShowMap(true);

      // Request location permission when Maps category is selected
      if (!userLocation) {
        requestLocationPermission();
      }
    } else {
      setMapsExpanded(false);
      setShowMap(false);
      setSelectedBusiness(null);
    }
  };

  // Request user location permission
  const requestLocationPermission = () => {
    setShowLocationPermission(true);
  };

  // Handle location permission granted
  const handleLocationGranted = async () => {
    setShowLocationPermission(false);
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser.');
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = { lat: latitude, lng: longitude };
          setUserLocation(location);
          console.log('User location obtained:', latitude, longitude);

          // Drive the actual map view — fly to the user and drop a marker.
          actions.flyTo(location, 15);
          actions.addMarker({
            id: 'current-location',
            lat: latitude,
            lng: longitude,
            name: 'Your Location',
            category: 'CURRENT_LOCATION',
            address: 'Current Location',
          });

          // If a business is selected, open directions
          if (selectedBusiness) {
            openDirections(selectedBusiness);
          }
        },
        (error) => {
          let errorMessage = 'Unable to get your location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission was denied. Please enable it in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'The request to get your location timed out.';
              break;
          }
          alert(errorMessage);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (err) {
      console.error('Location error:', err);
      alert(err.message);
    }
  };

  // Handle location permission denied
  const handleLocationDenied = () => {
    setShowLocationPermission(false);
  };

  // Open directions in default map app
  const openDirections = (business) => {
    const { coordinates, address, name } = business;

    // Detect platform and open appropriate maps app
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let mapsUrl;

    if (isIOS) {
      // Apple Maps
      mapsUrl = `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
    } else if (isAndroid) {
      // Google Maps on Android
      mapsUrl = `google.navigation:q=${coordinates.lat},${coordinates.lng}`;
    } else {
      // Desktop - open Google Maps in browser
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}&destination_place_id=${encodeURIComponent(name)}`;
    }

    // Try to open the maps app, fallback to Google Maps web
    try {
      window.open(mapsUrl, '_blank');
    } catch (e) {
      // Fallback to Google Maps web
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`, '_blank');
    }
  };

  // Handle directions button click
  const handleDirectionsClick = (business) => {
    setSelectedBusiness(business);
    if (userLocation) {
      // Already have location, open directions directly
      openDirections(business);
    } else {
      // Request location permission first
      requestLocationPermission();
    }
  };

  // Render star rating
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} size={14} className="text-yellow-400 fill-yellow-400/50" />
        );
      } else {
        stars.push(
          <Star key={i} size={14} className="text-gray-500" />
        );
      }
    }
    return stars;
  };

  // Simulate microphone transcription
  useEffect(() => {
    if (!showMicrophoneInterface) return;

    const sampleTranscripts = [
      "Search for quantum physics papers",
      "Find information about renewable energy",
      "Show me the latest news on AI development",
      "What is the weather forecast for tomorrow?",
      "How does blockchain technology work?",
      "Find recipes for vegan chocolate cake",
      "Who won the Nobel Prize in Physics this year?",
      "Explain the theory of relativity in simple terms"
    ];

    const interval = setInterval(() => {
      if (showMicrophoneInterface) {
        const newTranscript = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];
        setTranscript(newTranscript);

        // Update search value with the transcript
        setSearchValue(newTranscript);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showMicrophoneInterface]);

  // Auto-search when page loads with query parameter
  useEffect(() => {
    if (initialQuery && initialQuery.trim() && searchResults.length === 0 && !searchLoading) {
      console.log('🔍 Auto-searching for:', initialQuery);
      handleSearchComplete();
    }
  }, []); // Run only once on mount

  // Add CSS for animations - only once when component mounts
  useEffect(() => {
    // Check if styles already exist
    const existingStyle = document.getElementById('search-portal-styles');
    if (existingStyle) {
      return; // Styles already injected
    }

    const styleSheet = document.createElement("style");
    styleSheet.id = 'search-portal-styles';
    styleSheet.type = "text/css";

    // Build the CSS content safely
    let cssContent = `
      @keyframes glitch-letters {
        0% { opacity: 0.8; transform: translateX(0); }
        20% { opacity: 0.4; transform: translateX(-2px); }
        40% { opacity: 1; transform: translateX(2px); }
        60% { opacity: 0.6; transform: translateX(-1px); }
        80% { opacity: 0.9; transform: translateX(1px); }
        100% { opacity: 0.8; transform: translateX(0); }
      }

    `;

    // Safely add the thread-move animations
    for (let i = 0; i < 50; i++) {
      cssContent += `
        @keyframes thread-move-${i} {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `;
    }

    styleSheet.textContent = cssContent;
    document.head.appendChild(styleSheet);

    // Cleanup on unmount
    return () => {
      const style = document.getElementById('search-portal-styles');
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Memoize background to prevent remounting
  const backgroundComponent = useMemo(() => (
    <ErrorBoundary>
      <DeepSpaceBackground key="deep-space-background" />
    </ErrorBoundary>
  ), []);

  return (
    <div className="relative min-h-screen w-full overflow-y-auto">
      {/* Integrated animated background */}
      {backgroundComponent}

      {/* Health Status Banner */}
      {showHealthBanner && (
        <HealthStatusBanner
          health={health}
          onClose={() => setShowHealthBanner(false)}
        />
      )}

      {/* Content */}
      <div className={`relative z-10 min-h-screen p-4 md:p-8 ${showHealthBanner ? 'mt-12' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {/* Top Navigation Bar */}
          <div className="flex justify-end items-center gap-4 mb-4">
            <button className="px-4 py-2 text-sm text-white/70 hover:text-white transition-all">
              Sign In
            </button>
          </div>

          {/* Logo - CENTERED AND BIG */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6"
          >
            <TruegleLogo
              className="scale-[1.5] sm:scale-[1.8]"
            />
          </motion.div>

              {/* Search Bar - Directly Below Logo */}
          <PermissionsTrigger onSearchComplete={() => localStorage.setItem('truegle_first_search', Date.now().toString())}>
              <SearchBar
                value={searchValue}
                onChange={setSearchValue}
                onSubmit={handleSearchComplete}
                placeholder="Search web..."
                showBiasedButton={true}
                onBiasedClick={handleBiasedClick}
                showPillToggle={true}
                isRedPillMode={isRedPillMode}
                onPillModeChange={updateRedPillMode}
                showFilters={true}
                filters={filters}
                onFiltersChange={setFilters}
                showFilterToggle={true}
                showOSINTToggle={true}
                isOSINTMode={isOSINTMode}
                onOSINTToggle={toggleOSINT}
                showCategories={true}
                activeCategory={activeCategory}
                onSelectCategory={handleCategoryChange}
                themeColor="blue"
                showMap={showMap}
                onMapToggle={() => setShowMap(prev => !prev)}
                isLocationQuery={isLocationQuery}
                // The media input icons (mic, camera, file) are now built into the SearchBar
                // so we don't need to pass them as rightIcons anymore
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
            className="max-w-4xl mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
                <div className="text-sm font-semibold text-white">
                  Truegle Premium - Ad-Free Experience
                </div>
                <div className="text-xs text-white/90">
                  Get unlimited searches without ads
                </div>
              </div>
              <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                Upgrade Now
              </button>
            </div>
          </motion.div>

          {/* AI Summary Card - Above Search Bar */}
          <div className="max-w-4xl mx-auto mb-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border border-cyan-500/30">
              <button
                onClick={() => setIsChatOpen(true)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white">
                    (Unbiased) Search Summary
                  </h3>
                </div>
                <motion.div animate={{ rotate: aiExpanded ? 180 : 0 }}>
                  <ChevronDown size={20} className="text-cyan-400" />
                </motion.div>
              </button>

              {aiExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 pt-3 border-t border-cyan-500/20"
                >
                  {aiLoading ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-cyan-400 mb-2">
                        <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                        <span className="text-sm">Analyzing search results...</span>
                      </div>
                      {/* Skeleton for AI summary */}
                      <SkeletonCard className="h-24" />
                    </div>
                  ) : aiSummary ? (
                    <>
                      <p className="text-base text-white/90 leading-relaxed mb-4" style={{ minHeight: '5.5rem' }}>
                        {aiSummary.summary}
                      </p>
                      {/* Perspective breakdown if available */}
                      {aiSummary.perspectives && aiSummary.perspectives.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {aiSummary.perspectives.slice(0, 3).map((perspective, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                perspective.type === 'left' ? 'bg-blue-500/20 text-blue-400' :
                                perspective.type === 'right' ? 'bg-red-500/20 text-red-400' :
                                perspective.type === 'center' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-cyan-500/20 text-cyan-400'
                              }`}>
                                {perspective.title}
                              </span>
                              <span className="text-white/70 text-xs">{perspective.summary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-cyan-400">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                          <span>{aiSummary.sourcesAnalyzed} sources analyzed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span>{aiSummary.perspectives?.length || 0} perspectives</span>
                        </div>
                        {aiSummary.model && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span>Powered by {aiSummary.model === 'huggingface' ? 'HuggingFace AI' : aiSummary.model === 'openrouter' ? 'OpenRouter' : 'Truegle AI'}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-base text-white/60 leading-relaxed" style={{ minHeight: '5.5rem' }}>
                      Enter a search query to see an unbiased summary with multiple perspectives from various sources...
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </div>


          {/* Ad Banner 2 - Climate Tech Solutions (Under AI Summary) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
                <div className="text-sm font-semibold text-white">
                  Climate Tech Solutions
                </div>
                <div className="text-xs text-white/90">
                  Track your carbon footprint in real-time
                </div>
              </div>
              <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                Try Free
              </button>
            </div>
          </motion.div>

          {/* Maps/Local Expanded Panel */}
          {mapsExpanded && (activeCategory === 'maps' || activeCategory === 'local') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="max-w-4xl mx-auto mb-8"
            >
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20">
                {/* Panel Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      {activeCategory === 'maps' ? (
                        <Map size={20} className="text-emerald-400" />
                      ) : (
                        <MapPin size={20} className="text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {activeCategory === 'maps' ? 'Maps & Directions' : 'Local Businesses'}
                      </h3>
                      <p className="text-sm text-emerald-300/70">
                        {userLocation ? 'Using your current location' : 'Enable location for better results'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMapsExpanded(false);
                      setSelectedBusiness(null);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-white/60" />
                  </button>
                </div>

                {/* Business Listings */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {localBusinesses.map((business) => (
                    <motion.div
                      key={business.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedBusiness(business)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        selectedBusiness?.id === business.id
                          ? 'bg-emerald-500/20 border-2 border-emerald-400'
                          : 'bg-black/40 border border-white/10 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-white">{business.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              business.isOpen
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {business.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 mb-2">{business.type} • {business.priceLevel}</p>

                          <div className="flex items-center gap-1 mb-2">
                            {renderStars(business.rating)}
                            <span className="text-sm text-white/70 ml-1">{business.rating}</span>
                            <span className="text-sm text-white/50">({business.reviews} reviews)</span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {business.distance}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {business.hours}
                            </span>
                          </div>
                        </div>

                        {/* Directions Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirectionsClick(business);
                          }}
                          className="flex flex-col items-center gap-1 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-xl transition-colors border border-emerald-500/50"
                        >
                          <Navigation size={20} className="text-emerald-400" />
                          <span className="text-xs text-emerald-300">Directions</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Selected Business Detail */}
                {selectedBusiness && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 rounded-xl bg-black/60 border border-emerald-500/30"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-white mb-1">{selectedBusiness.name}</h4>
                        <p className="text-emerald-300">{selectedBusiness.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {renderStars(selectedBusiness.rating)}
                        <span className="text-white font-semibold ml-1">{selectedBusiness.rating}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-3 text-white/80">
                        <MapPin size={18} className="text-emerald-400" />
                        <span>{selectedBusiness.address}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/80">
                        <Phone size={18} className="text-emerald-400" />
                        <span>{selectedBusiness.phone}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/80">
                        <Clock size={18} className="text-emerald-400" />
                        <span>{selectedBusiness.hours}</span>
                      </div>
                      <div className="flex items-center gap-3 text-white/80">
                        <Navigation size={18} className="text-emerald-400" />
                        <span>{selectedBusiness.distance} away</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDirectionsClick(selectedBusiness)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/30"
                      >
                        <Navigation size={18} />
                        Get Directions
                      </button>
                      <button
                        onClick={() => window.open(`tel:${selectedBusiness.phone.replace(/\D/g, '')}`, '_self')}
                        className="px-4 py-3 bg-black/40 hover:bg-black/60 border border-emerald-500/50 text-emerald-400 font-semibold rounded-xl transition-colors"
                      >
                        <Phone size={18} />
                      </button>
                      <button
                        onClick={() => {
                          const { coordinates } = selectedBusiness;
                          window.open(`https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`, '_blank');
                        }}
                        className="px-4 py-3 bg-black/40 hover:bg-black/60 border border-emerald-500/50 text-emerald-400 font-semibold rounded-xl transition-colors"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

        {/* Results Grid - Same layout as SearchResults */}
        <div className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Results Column */}
          <div className="lg:col-span-3 space-y-4">
            <div className="text-sm text-white/60 mb-4">
              {searchLoading
                ? 'Searching...'
                : searchResults.length > 0
                  ? `About ${searchResults.length} results`
                  : 'Enter a search query to see results'}
            </div>

            {/* Instant answer card (weather, calculations, official site, etc.) */}
            {instantAnswer && !searchLoading && (
              <QuickResultCard instantAnswer={instantAnswer} />
            )}

            {/* Skeleton loading placeholders */}
            {searchLoading && (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonSearchResult key={i} />
                ))}
              </div>
            )}

            {!searchLoading && searchResults.length > 0 ? searchResults.map((result, index) => (
              <div key={result.id || result.url || index}>
                {/* Ad Banner after every 3rd result */}
                {index > 0 && index % 3 === 0 && (
                  <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-yellow-200 mb-1">
                          Sponsored
                        </div>
                        <div className="text-sm font-semibold text-white">
                          Environmental Monitoring Tools
                        </div>
                        <div className="text-xs text-white/90">
                          Real-time air quality and climate data
                        </div>
                      </div>
                      <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                        View Demo
                      </button>
                    </div>
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-blue-500/50 hover:border-[3px] hover:border-blue-400 transition-all duration-300 group hover:shadow-[0_0_40px_rgba(59,130,246,0.6),0_0_80px_rgba(59,130,246,0.3)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-emerald-400">
                          {result.domain || result.source || result.sourceName}
                        </span>
                        {result.date && (
                          <>
                            <span className="text-xs text-white/40">•</span>
                            <span className="text-xs text-white/60">
                              {typeof result.date === 'string' && result.date.includes('T')
                                ? new Date(result.date).toLocaleDateString()
                                : result.date}
                            </span>
                          </>
                        )}
                      </div>
                      <a
                        href={result.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-display font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer group-hover:underline mb-2 flex items-center gap-2"
                      >
                        {result.title}
                        <ExternalLink
                          size={16}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </a>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {result.snippet}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <button className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
                      <ThumbsUp size={14} />
                      <span>Helpful</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
                      <ThumbsDown size={14} />
                      <span>Not helpful</span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )) : (
              <div className="text-center py-12">
                <p className="text-white/70 text-lg mb-8">If it's Trueth you're looking for, ya ain't goona' find it here.</p>
                <AdSlot className="rounded-2xl" size="large" />
              </div>
            )}



            {/* Load More Button */}
            <div className="flex justify-center pt-6">
              <button className="px-8 py-4 rounded-xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border border-cyan-500/30 text-cyan-400 hover:border-cyan-500/50 transition-all font-semibold">
                Load More Results
              </button>
            </div>
          </div>

          {/* Sidebar with Multiple Sticky Ads */}
          <div className="hidden lg:block space-y-4">


            {/* Sidebar Ad 2 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
              <div className="text-xs text-yellow-200 mb-2">Sponsored</div>
              <div className="text-base font-semibold text-white mb-2">
                Research Tools
              </div>
              <div className="text-sm text-white/90 mb-4">
                Professional OSINT and SEO analytics
              </div>
              <button className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25">
                Start Free Trial
              </button>
            </div>

            {/* Sidebar Ad 3 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
              <div className="text-xs text-yellow-200 mb-2">Sponsored</div>
              <div className="text-base font-semibold text-white mb-2">
                API Access
              </div>
              <div className="text-sm text-white/90 mb-4">
                Integrate Truegle into your apps
              </div>
              <button className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-sm hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                Get API Key
              </button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Warning Card for Red Pill Mode */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="relative w-full max-w-2xl bg-black p-8 rounded-2xl"
            style={{
              border: '2px solid',
              borderImageSlice: 1,
              borderImageSource: 'linear-gradient(45deg, #EF4444, #F87171, #FCA5A5)'
            }}
          >
            {/* Electric border effect elements */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-pink-500 to-red-600 blur opacity-75 animate-pulse"></div>
            <div className="absolute inset-0 rounded-2xl bg-black"></div>

            <h2 className="text-3xl font-bold text-red-500 mb-6 text-center">WARNING!</h2>

            <p className="text-white text-lg mb-8 text-center">
              Warning going down this rabbit hole might take you places you may never return from,
              and show you things no mortal was ever meant to see. Do you accept these risks?
            </p>

            <div className="flex justify-center gap-6">
              <button
                onClick={confirmRedPill}
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

      {/* Permission Request Modal */}
      {showPermissions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-gray-900 border-2 border-cyan-500 p-8 rounded-2xl shadow-lg">
            <h3 className="text-2xl font-bold text-cyan-400 mb-6 text-center">Allow Truegle Permissions</h3>

            <p className="text-white mb-6 text-center">
              to access your:
            </p>

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
                onClick={handlePermissionGranted}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/30"
              >
                ALLOW
              </button>

              <button
                onClick={handlePermissionDenied}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
              >
                DENY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Permission Modal */}
      {showLocationPermission && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-gray-900 border-2 border-emerald-500 p-8 rounded-2xl shadow-lg shadow-emerald-500/20"
          >
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <MapPin size={32} className="text-emerald-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-emerald-400 mb-4 text-center">Enable Location</h3>

            <p className="text-white mb-6 text-center">
              Truegle needs your location to provide directions and show nearby businesses.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Navigation size={20} className="text-emerald-400" />
                <span className="text-white text-sm">Get turn-by-turn directions</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <MapPin size={20} className="text-emerald-400" />
                <span className="text-white text-sm">Find businesses near you</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <Map size={20} className="text-emerald-400" />
                <span className="text-white text-sm">Open in your preferred maps app</span>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleLocationGranted}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl hover:from-emerald-500 hover:to-green-500 transition-all shadow-lg shadow-emerald-500/30"
              >
                ALLOW LOCATION
              </button>

              <button
                onClick={handleLocationDenied}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
              >
                NOT NOW
              </button>
            </div>

            <p className="text-xs text-white/50 text-center mt-4">
              Your location is only used for directions and is never stored.
            </p>
          </motion.div>
        </div>
      )}

      {/* Microphone Interface */}
      {showMicrophoneInterface && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
          {/* Threads Background */}
          <div className="absolute inset-0 opacity-30">
            <div className="w-full h-full relative overflow-hidden">
              {Array.from({length: 50}).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
                  style={{
                    top: `${(i * 10) % 100}%`,
                    left: '-100%',
                    animation: `thread-move-${i} linear infinite`,
                    animationDuration: `${Math.random() * 3 + 2}s`,
                    opacity: 0.3 + Math.random() * 0.4
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Blur Text Animation */}
          <div className="relative z-10 text-center mb-8">
            <h2
              className="text-4xl md:text-6xl font-bold text-white"
            >
              {transcript || "Speak now..."}
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
              // Process the transcript if available
              if (transcript) {
                setSearchValue(transcript);
                setAiSearchValue(`Analyze: ${transcript}`);

                // Update perspectives based on the transcript
                const perspectives = getSearchPerspectives(transcript);
                setAiSearchPerspectives(perspectives);

                // Show the AI assistant expanded to display the results
                setAiExpanded(true);
              }

              // Stop recording and close the interface
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
              // Close the camera interface and return to search
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
            <h2 className="text-3xl font-bold text-white text-center mb-8">Select Files & Media</h2>

            {/* Dome Gallery Simulation */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {Array.from({length: 12}).map((_, i) => (
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
                  <div id={`preview-${i}`} className="hidden fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="relative max-w-3xl w-full">
                      <div className="bg-gray-800 rounded-xl p-6 max-w-2xl mx-auto">
                        <h3 className="text-2xl font-bold text-white mb-4">File {i + 1} Preview</h3>

                        <div className="bg-gray-700/50 rounded-lg p-8 mb-6 flex items-center justify-center aspect-video">
                          <div className="text-center">
                            <FileIcon size={64} className="text-cyan-400 mx-auto mb-4" />
                            <p className="text-white">Preview of File {i + 1}</p>
                          </div>
                        </div>

                        <div className="flex justify-center gap-4">
                          <button className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all">
                            YES
                          </button>

                          <button
                            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all"
                            onClick={() => {
                              const preview = document.getElementById(`preview-${i}`);
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
                  // Process the file selection (this would be handled by handleFileUpload when files are selected)
                  const fileInput = "File selection analysis";
                  setSearchValue(fileInput);
                  setAiSearchValue(`Analyze selected files: ${fileInput}`);

                  // Update perspectives based on the file input
                  const perspectives = getSearchPerspectives(fileInput);
                  setAiSearchPerspectives(perspectives);

                  // Show the AI assistant expanded to display the results
                  setAiExpanded(true);

                  // Show the glitch effect first
                  setShowGlitch(true);
                  setTimeout(() => {
                    // For media interfaces, navigate to molecular signup page with freemium message
                    navigate('/auth/signup', { state: { showFreemiumMessage: true } });

                    // Reset states
                    setShowFilesInterface(false);
                  }, 1000); // Allow glitch to show for 1 second before navigating
                }}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-800 text-white font-bold rounded-xl hover:from-gray-500 hover:to-gray-700 transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Overlay */}
      <AIChatOverlay
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        searchQuery={searchValue}
        themeColor="blue"
      />
    </div>
  );
}
