import { useState, useCallback, useEffect } from 'react';
import { useMap } from './context/MapContext';
import { MapPin, Navigation, Layers, X, Map as MapIcon } from 'lucide-react';
import MapApiService from './services/mapApi';
import './styles/Controls.css';

export default function MapPanel({
  isOpen = true,
  onClose = null,
  onToggle = null,
  showSearch = true,
  showFilters = true,
  showDirections = false,
  children,
}) {
  const { state, actions } = useMap();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const handleSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await MapApiService.geocode(query);
      if (result && result.data) {
        setSearchResults(result.data);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleResultClick = useCallback((result) => {
    actions.flyTo(result.position, 14);
    actions.addMarker({
      id: `search-${Date.now()}`,
      name: result.address,
      lat: result.position.lat,
      lng: result.position.lng,
      category: 'DEFAULT',
      address: result.address,
    });
    setSearchQuery('');
    setSearchResults([]);
  }, [actions]);

  const handleToggleProvider = useCallback(() => {
    const providers = ['mapbox', 'radar', 'tomtom', 'leaflet'];
    const currentIndex = providers.indexOf(state.provider);
    const nextIndex = (currentIndex + 1) % providers.length;
    actions.changeProvider(providers[nextIndex]);
  }, [state.provider, actions]);

  const handleToggleStyle = useCallback(() => {
    const styles = ['standard', 'dark', 'light', 'satellite'];
    const currentIndex = styles.indexOf(state.mapStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    actions.setMapStyle(styles[nextIndex]);
  }, [state.mapStyle, actions]);

  const toggleCategory = useCallback((category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeoutId = setTimeout(() => handleSearch(searchQuery), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, handleSearch]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="truegle-map-panel">
          {onToggle && (
            <button
              className="truegle-map-toggle-btn"
              onClick={onToggle}
              title="Toggle Map"
            >
              <MapIcon size={20} />
            </button>
          )}

      {onClose && (
        <button
          className="truegle-map-close-btn"
          onClick={onClose}
          title="Close Map"
        >
          <X size={20} />
        </button>
      )}

      {showSearch && (
        <div className="truegle-map-search">
          <input
            type="text"
            className="truegle-search-input"
            placeholder="Search for places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
          />
          {isSearchOpen && searchResults.length > 0 && (
            <div className="truegle-search-suggestions">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="truegle-suggestion-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="name">{result.address}</div>
                </div>
              ))}
              {isSearching && (
                <div className="truegle-suggestion-item">
                  <div className="address">Searching...</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="truegle-map-controls">
        <div className="truegle-control-group">
          <button
            className={`truegle-control-btn ${state.showTraffic ? 'active' : ''}`}
            onClick={actions.toggleTraffic}
            title="Toggle Traffic"
          >
            <Navigation size={20} />
          </button>
          <button
            className={`truegle-control-btn ${state.showEmergencies ? 'active' : ''}`}
            onClick={actions.toggleEmergencies}
            title="Toggle Emergencies"
          >
            <Layers size={20} />
          </button>
        </div>

        <div className="truegle-control-group">
          <button
            className="truegle-control-btn"
            onClick={handleToggleStyle}
            title={`Switch Style: ${state.mapStyle}`}
          >
            <Layers size={20} />
          </button>
          <button
            className="truegle-control-btn"
            onClick={handleToggleProvider}
            title={`Switch Provider: ${state.provider}`}
          >
            <MapPin size={20} />
          </button>
        </div>
      </div>

      {showFilters && isFiltersOpen && (
        <div className="truegle-filter-panel">
          <div className="header">
            <span className="title">Filters</span>
            <button className="toggle" onClick={() => setIsFiltersOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="truegle-filter-group">
            <label className="truegle-filter-label">Category</label>
            <div className="truegle-category-filters">
              {['RESTAURANT', 'HOTEL', 'SHOP', 'ENTERTAINMENT', 'MEDICAL'].map(category => (
                <button
                  key={category}
                  className={`truegle-category-chip ${selectedCategories.includes(category) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <button className="truegle-reset-btn" onClick={actions.clearMarkers}>
            Clear All Markers
          </button>
        </div>
      )}

      {children}
    </div>
  );
}