import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Building2, Navigation2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchMapQuery, formatDistance } from './utils/mapSearch';

/**
 * LocationAutocomplete Component
 * Autocomplete for the Directions boxes — the same search as the map's own bar.
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

  // THE SAME SEARCH AS THE MAP'S OWN BOX. This used to ask Radar directly
  // (/api/radar/autocomplete + search-places), which needs a Radar key this
  // project does not hold and only matches chain names — so "Eugene library
  // Eugene Oregon" offered "Eugene, OR US" and nothing else (owner,
  // 2026-10-06). searchMapQuery is the search the map's bar already uses: it
  // reads "coffee near me" / "pharmacy in austin" / a business name / a street
  // address, ranks by distance from the user, and works with whichever
  // providers exist.
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const { rows } = await searchMapQuery(query, { near: userLocation, limit: 10 });
      // One row per place (two providers often return the same library), and
      // names that share more of the typed words first — so "Eugene library
      // Eugene Oregon" puts the library above a highway that merely contains
      // "Oregon". Distance stays the tie-break; the search already ranked by it.
      const words = new Set(String(query).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
      const overlap = (name) => (String(name || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => words.has(w)).length;
      const seen = new Set();
      const ranked = rows
        .filter((r) => { const k = `${String(r.name).toLowerCase()}|${String(r.address).toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; })
        // A row that is only an address (its "name" IS the address) matches
        // the town and state by construction, so it ranks below a named
        // place with the same word match.
        .map((r, i) => ({ r, i, score: overlap(r.name) - (!r.name || r.name === r.address ? 1.5 : 0) }))
        .sort((x, y) => (y.score - x.score) || (x.i - y.i))
        .map(({ r }) => r);
      setSuggestions(ranked.slice(0, 8).map((r, i) => {
        const [first, ...rest] = String(r.address || '').split(',').map((x) => x.trim()).filter(Boolean);
        const named = r.name && r.name !== r.address && r.name !== first;
        return {
          id: `place-${i}`,
          // A named place (a library, a shop) vs a plain address or town.
          type: named ? 'business' : 'address',
          name: r.name,
          address: r.address || '',
          lat: r.position.lat,
          lng: r.position.lng ?? r.position.lon,
          city: named ? rest[0] || '' : '',
          state: named ? (rest[1] || '').replace(/\s*\d{5}.*/, '') : '',
          distance: r.distance,
        };
      }));
    } catch (err) {
      console.error('Error fetching autocomplete suggestions:', err);
      setSuggestions([]);
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
                  {(suggestion.address || suggestion.distance != null) && (
                    <div className="text-xs text-neutral-400 mt-0.5 truncate">
                      {suggestion.address}
                      {suggestion.distance != null && (
                        <span className="text-neutral-500">{suggestion.address ? ' · ' : ''}{formatDistance(suggestion.distance)}</span>
                      )}
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
