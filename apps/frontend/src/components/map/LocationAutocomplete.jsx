import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Building2, Navigation2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * LocationAutocomplete Component
 * Provides autocomplete suggestions for location inputs using Radar API
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  icon,
  userLocation,
  className = ''
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Fetch autocomplete suggestions from Radar API (both addresses and places)
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    try {
      const backendUrl = getBackendUrl();

      // Search for both addresses AND places in parallel
      const [addressResponse, placesResponse] = await Promise.allSettled([
        // Search addresses
        fetch(`${backendUrl}/api/radar/autocomplete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            near: userLocation ? `${userLocation.lat},${userLocation.lng}` : undefined,
            limit: 5
          })
        }),
        // Search places/businesses
        userLocation ? fetch(`${backendUrl}/api/radar/search-places`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            near: { lat: userLocation.lat, lng: userLocation.lng },
            options: {
              limit: 10,
              radius: 50000, // 50km radius
              chains: query, // Search for chain names like "Walmart"
              categories: '' // Search all categories
            }
          })
        }) : Promise.resolve(null)
      ]);

      const combinedSuggestions = [];

      // Process places (prioritize these - they're what users usually want)
      if (placesResponse.status === 'fulfilled' && placesResponse.value) {
        const placesData = await placesResponse.value.json();
        const places = placesData.data || placesData.places || [];

        // Filter places that match the query
        const matchingPlaces = places.filter(place => {
          const name = (place.name || '').toLowerCase();
          const queryLower = query.toLowerCase();
          return name.includes(queryLower);
        });

        matchingPlaces.forEach((place, index) => {
          combinedSuggestions.push({
            id: `place-${index}`,
            type: 'business',
            name: place.name,
            address: place.formattedAddress || place.address || '',
            lat: place.location?.coordinates?.[1] || place.latitude,
            lng: place.location?.coordinates?.[0] || place.longitude,
            city: place.city,
            state: place.state,
            country: place.country,
            chain: place.chain?.name,
            categories: place.categories
          });
        });
      }

      // Process addresses (show these after places)
      if (addressResponse.status === 'fulfilled') {
        const addressData = await addressResponse.value.json();
        const addresses = addressData.addresses || addressData.data?.addresses || [];

        addresses.forEach((address, index) => {
          combinedSuggestions.push({
            id: `address-${index}`,
            type: 'address',
            name: address.formattedAddress || address.addressLabel,
            address: address.formattedAddress,
            lat: address.latitude,
            lng: address.longitude,
            city: address.city,
            state: address.state,
            country: address.country
          });
        });
      }

      // Limit total suggestions to 10
      setSuggestions(combinedSuggestions.slice(0, 10));
    } catch (err) {
      console.error('Error fetching autocomplete suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (value && showSuggestions) {
        fetchSuggestions(value);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value, showSuggestions, fetchSuggestions]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (suggestion) => {
    onSelect(suggestion);
    onChange(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleInputFocus = () => {
    setShowSuggestions(true);
    if (value && value.length >= 3) {
      fetchSuggestions(value);
    }
  };

  const handleInputBlur = () => {
    // Delay to allow click on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'business':
        return <Building2 size={16} className="text-cyan-400" />;
      case 'address':
        return <MapPin size={16} className="text-blue-400" />;
      default:
        return <Navigation2 size={16} className="text-neutral-400" />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-10' : 'pl-4'} pr-10 py-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 transition-colors`}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 size={16} className="text-blue-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-neutral-800/95 backdrop-blur-xl border border-neutral-700/50 rounded-lg shadow-2xl max-h-64 overflow-y-auto z-50"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`flex items-start gap-3 p-3 cursor-pointer transition-colors border-b border-neutral-700/30 last:border-b-0 ${
                  index === selectedIndex
                    ? 'bg-blue-500/20'
                    : 'hover:bg-neutral-700/50'
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getIcon(suggestion.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {suggestion.name}
                  </div>
                  {suggestion.city && suggestion.state && (
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {suggestion.city}, {suggestion.state}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
