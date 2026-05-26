import { useState, useEffect, useCallback } from 'react';
import { Camera, Search, MapPin, Navigation, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  searchCameras,
  getCamerasNearLocation,
  getCamerasByStateAndRoad,
  getAvailableStates
} from './services/enhancedCameraService';

/**
 * EnhancedCameraSearch Component
 *
 * Advanced traffic camera search interface with:
 * - Full-text search across 1500+ cameras
 * - State/road filtering
 * - Geospatial search (near location)
 * - Real-time results
 * - Pagination
 */
export default function EnhancedCameraSearch({ userLocation, onCameraSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState('text'); // 'text', 'nearby', 'filter'
  const [error, setError] = useState(null);

  // Filter states
  const [selectedState, setSelectedState] = useState('');
  const [selectedRoad, setSelectedRoad] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [displayLimit, setDisplayLimit] = useState(20);

  // Load available states on mount
  useEffect(() => {
    const loadStates = async () => {
      const states = await getAvailableStates();
      setAvailableStates(states || []);
    };
    loadStates();
  }, []);

  /**
   * Handle text search
   */
  const handleTextSearch = useCallback(async (query) => {
    if (!query || query.trim().length === 0) {
      setCameras([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchCameras(query, 100);
      setCameras(results);

      if (results.length === 0) {
        setError(`No cameras found for "${query}"`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle nearby search
   */
  const handleNearbySearch = useCallback(async () => {
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      setError('Location not available. Please enable location services.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await getCamerasNearLocation(userLocation, 100, 50);
      setCameras(results);

      if (results.length === 0) {
        setError('No cameras found within 100 miles of your location.');
      }
    } catch (err) {
      console.error('Nearby search error:', err);
      setError('Failed to find nearby cameras.');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  /**
   * Handle filter search
   */
  const handleFilterSearch = useCallback(async () => {
    if (!selectedState && !selectedRoad) {
      setError('Please select a state or enter a road name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await getCamerasByStateAndRoad(
        selectedState || undefined,
        selectedRoad || undefined,
        100
      );
      setCameras(results);

      if (results.length === 0) {
        setError('No cameras found matching your filters.');
      }
    } catch (err) {
      console.error('Filter search error:', err);
      setError('Failed to search with filters.');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [selectedState, selectedRoad]);

  /**
   * Debounced text search
   */
  useEffect(() => {
    if (searchMode === 'text' && searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        handleTextSearch(searchQuery);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [searchQuery, searchMode, handleTextSearch]);

  /**
   * Switch search mode
   */
  const switchMode = (mode) => {
    setSearchMode(mode);
    setError(null);
    setCameras([]);
    setSearchQuery('');

    if (mode === 'nearby') {
      handleNearbySearch();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-neutral-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700/50 bg-gradient-to-r from-cyan-900/20 to-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Camera size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Traffic Camera Search</h2>
              <p className="text-sm text-cyan-400">1500+ cameras across multiple states</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Search Mode Tabs */}
        <div className="flex gap-2 p-4 border-b border-neutral-700/50">
          <button
            onClick={() => switchMode('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              searchMode === 'text'
                ? 'bg-cyan-600 text-white'
                : 'bg-neutral-800 text-white/60 hover:bg-neutral-700'
            }`}
          >
            <Search size={18} />
            <span>Search</span>
          </button>
          <button
            onClick={() => switchMode('nearby')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              searchMode === 'nearby'
                ? 'bg-cyan-600 text-white'
                : 'bg-neutral-800 text-white/60 hover:bg-neutral-700'
            }`}
          >
            <Navigation size={18} />
            <span>Nearby</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showFilters || searchMode === 'filter'
                ? 'bg-cyan-600 text-white'
                : 'bg-neutral-800 text-white/60 hover:bg-neutral-700'
            }`}
          >
            <Filter size={18} />
            <span>Filters</span>
          </button>
        </div>

        {/* Search Input / Filters */}
        <div className="p-4 border-b border-neutral-700/50">
          {searchMode === 'text' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cameras by location, road, or name..."
                className="w-full pl-12 pr-4 py-3 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:border-cyan-500 focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {searchMode === 'nearby' && (
            <div className="text-center py-4">
              <MapPin className="mx-auto mb-2 text-cyan-400" size={32} />
              <p className="text-white mb-2">Searching for cameras near your location</p>
              <p className="text-white/60 text-sm">
                {userLocation
                  ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
                  : 'Location not available'}
              </p>
            </div>
          )}

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 mt-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">State</label>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">All States</option>
                      {availableStates.map((state) => (
                        <option key={state.state} value={state.state}>
                          {state.state} ({state.count})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Road</label>
                    <input
                      type="text"
                      value={selectedRoad}
                      onChange={(e) => setSelectedRoad(e.target.value)}
                      placeholder="e.g., I-5, US-101"
                      className="w-full px-3 py-2 bg-neutral-800 text-white rounded-lg border border-neutral-700 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSearchMode('filter');
                    handleFilterSearch();
                  }}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                >
                  Apply Filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[calc(90vh-300px)] p-4">
          {error && (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white/60 mt-3">Searching cameras...</p>
            </div>
          )}

          {!loading && !error && cameras.length === 0 && (
            <div className="text-center py-12">
              <Camera size={48} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/60">
                {searchMode === 'text'
                  ? 'Enter a search term to find cameras'
                  : 'No cameras found'}
              </p>
            </div>
          )}

          {!loading && cameras.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-white/60 mb-3">
                Showing {Math.min(displayLimit, cameras.length)} of {cameras.length} cameras
              </div>

              {cameras.slice(0, displayLimit).map((camera) => (
                <motion.div
                  key={camera.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-800 rounded-lg p-4 border border-neutral-700 hover:border-cyan-500 cursor-pointer transition-all"
                  onClick={() => onCameraSelect(camera)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{camera.name}</h3>
                      <p className="text-cyan-400 text-sm mb-2">{camera.roadName}</p>
                      <div className="flex items-center gap-4 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {camera.city}, {camera.state}
                        </span>
                        {camera.formattedDistance && (
                          <span>{camera.formattedDistance}</span>
                        )}
                        <span>Direction: {camera.direction}</span>
                      </div>
                    </div>
                    {camera.isLive && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-red-600 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs font-semibold text-white">LIVE</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {cameras.length > displayLimit && (
                <button
                  onClick={() => setDisplayLimit(prev => prev + 20)}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Load More ({cameras.length - displayLimit} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
