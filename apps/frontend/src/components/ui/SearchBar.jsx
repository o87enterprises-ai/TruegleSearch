import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, X, TrendingUp, Loader2, ChevronDown, SlidersHorizontal, Zap,
  Image, Video, Users, DollarSign, Trophy, Music, ShoppingBag, Briefcase,
  BookOpen, Newspaper, Globe, Heart, Film, Mic, Code, Gamepad2, Utensils,
  Plane, Home, MapPin, Map, Star, Navigation, Phone, Clock, Mail, ExternalLink,
  Camera, Paperclip, Shield, EyeOff, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapApiService from '../map/services/mapApi';
import VoiceRecognition from './VoiceRecognition';
import CameraInput from './CameraInput';
import FileInput from './FileInput';

/**
 * Search Categories Configuration
 */
const searchCategories = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'local', label: 'Local', icon: MapPin },
  { id: 'maps', label: 'Maps', icon: Map },
  { id: 'pics', label: 'Pics', icon: Image },
  { id: 'vids', label: 'Vids', icon: Video },
  { id: 'soc', label: 'Soc', icon: Users },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'smart', label: 'Smart', icon: Zap },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'academic', label: 'Academic', icon: BookOpen },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'entertainment', label: 'Entertainment', icon: Film },
  { id: 'podcasts', label: 'Podcasts', icon: Mic },
  { id: 'tech', label: 'Tech', icon: Code },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'lifestyle', label: 'Lifestyle', icon: Home },
];

/**
 * BusinessListingDropdown - Google-style local business results with live data
 */
function BusinessListingDropdown({ isVisible, onClose, categoryType, searchQuery }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Get user's location
  useEffect(() => {
    if (isVisible && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error.message);
          // Default to US center if geolocation fails
          setUserLocation({ latitude: 39.8283, longitude: -98.5795 });
        }
      );
    }
  }, [isVisible, userLocation]);

  // Fetch nearby places when we have location
  useEffect(() => {
    if (isVisible && userLocation && searchQuery) {
      setLoading(true);

      // Build search options based on category and query
      const options = {
        query: searchQuery,
        limit: 10,
        radius: 5000, // 5km radius
      };

      // Add category filters based on the categoryType
      if (categoryType === 'local') {
        options.categories = ['restaurant', 'cafe', 'store', 'pharmacy', 'gym'];
      }

      MapApiService.searchPlaces(
        { lat: userLocation.latitude, lng: userLocation.longitude },
        options
      )
        .then(result => {
          if (result.data && Array.isArray(result.data)) {
            // Transform API response to business format
            const transformedBusinesses = result.data.map((place, index) => ({
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
              hours: place.hours?.display || '',
              email: place.email || ''
            }));
            setBusinesses(transformedBusinesses);
          } else {
            setBusinesses([]);
          }
        })
        .catch((error) => {
          console.error('Error fetching places:', error);
          setBusinesses([]);
        })
        .finally(() => setLoading(false));
    }
  }, [isVisible, searchQuery, categoryType, userLocation]);

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute left-0 right-0 top-full mt-2 z-50"
    >
      <div className="bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50">
          <div className="flex items-center gap-2">
            {categoryType === 'maps' ? <Map size={16} className="text-emerald-400" /> : <MapPin size={16} className="text-emerald-400" />}
            <span className="text-sm font-medium text-white">
              {categoryType === 'maps' ? 'Nearby Places' : 'Local Businesses'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-700/50 rounded-md transition-colors"
          >
            <X size={14} className="text-neutral-400" />
          </button>
        </div>

        {/* Business List */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
              <span className="ml-2 text-white/60">Finding nearby places...</span>
            </div>
          ) : businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <MapPin size={32} className="text-neutral-600 mb-2" />
              <p className="text-white/60 text-sm">No nearby places found</p>
              <p className="text-white/40 text-xs mt-1">Try a different search query</p>
            </div>
           ) : businesses.map((business) => (
             <div
               key={business.id}
               className="px-4 py-3 hover:bg-neutral-800/50 cursor-pointer transition-colors border-b border-neutral-800/50 last:border-0"
             >
               <div className="flex items-start justify-between mb-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <h4 className="text-sm font-medium text-white">{business.name}</h4>
                     <span className={`text-[10px] px-1.5 py-0.5 rounded ${business.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                       {business.isOpen ? 'Open' : 'Closed'}
                     </span>
                   </div>
                   <p className="text-xs text-neutral-400">{business.type} · {business.priceLevel}</p>
                   <div className="flex items-center gap-0.5 mt-1">
                     <div className="flex items-center gap-0.5">
                       <Star size={10} className="text-yellow-400 fill-yellow-400" />
                       <span className="text-xs text-yellow-400">{business.rating}</span>
                       <span className="text-xs text-neutral-500">({business.reviews})</span>
                     </div>
                     <span className="text-xs text-neutral-500">·</span>
                     <span className="text-xs text-neutral-400">{business.distance}</span>
                   </div>
                 </div>
                 <div className="flex items-center gap-1 ml-2">
                   <button className="p-1.5 hover:bg-neutral-700/50 rounded-md transition-colors" title="Directions">
                     <Navigation size={12} className="text-emerald-400" />
                   </button>
                   {business.phone && (
                     <button className="p-1.5 hover:bg-neutral-700/50 rounded-md transition-colors" title="Call">
                       <Phone size={12} className="text-blue-400" />
                     </button>
                   )}
                   {business.website && (
                     <a
                       href={business.website}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="p-1.5 hover:bg-neutral-700/50 rounded-md transition-colors"
                       title="Website"
                     >
                       <ExternalLink size={12} className="text-purple-400" />
                     </a>
                   )}
                 </div>
               </div>
               {business.address && (
                 <div className="text-xs text-neutral-400 mb-2">
                   <MapPin size={10} className="inline mr-1" />
                   {business.address}
                 </div>
               )}
               {business.hours && (
                 <div className="text-xs text-neutral-400 mb-2">
                   <Clock size={10} className="inline mr-1" />
                   {business.hours}
                 </div>
               )}
               {business.email && (
                 <div className="text-xs text-neutral-400 mb-2">
                   <Mail size={10} className="inline mr-1" />
                   {business.email}
                 </div>
               )}
             </div>
            ))}
         </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-neutral-800/50 border-t border-neutral-700/50">
          <button className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            View all results on map →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * CategoryBar Component - Scrollable category pills with business dropdown
 */
function CategoryBar({ activeCategory, onSelectCategory, compact = false, value, isRedPillMode = false, themeColor = 'blue', showMap, onMapToggle, isLocationQuery }) {
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [dropdownCategory, setDropdownCategory] = useState(null);

  // Theme color mappings
  const getThemeColors = () => {
    switch (themeColor) {
      case 'green':
        return {
          activeBg: 'bg-green-500/20',
          activeBorder: 'border-green-500/50',
          activeText: 'text-green-400',
          activeShadow: 'shadow-green-500/20',
          hoverBorder: 'hover:border-green-500/30',
          hoverText: 'hover:text-green-400'
        };
      case 'red':
        return {
          activeBg: 'bg-red-500/20',
          activeBorder: 'border-red-500/50',
          activeText: 'text-red-400',
          activeShadow: 'shadow-red-500/20',
          hoverBorder: 'hover:border-red-500/30',
          hoverText: 'hover:text-red-400'
        };
      case 'purple':
        return {
          activeBg: 'bg-purple-500/20',
          activeBorder: 'border-purple-500/50',
          activeText: 'text-purple-400',
          activeShadow: 'shadow-purple-500/20',
          hoverBorder: 'hover:border-purple-500/30',
          hoverText: 'hover:text-purple-400'
        };
      case 'cyan':
        return {
          activeBg: 'bg-cyan-500/20',
          activeBorder: 'border-cyan-500/50',
          activeText: 'text-cyan-400',
          activeShadow: 'shadow-cyan-500/20',
          hoverBorder: 'hover:border-cyan-500/30',
          hoverText: 'hover:text-cyan-400'
        };
      default: // 'blue'
        return {
          activeBg: 'bg-blue-500/20',
          activeBorder: 'border-blue-500/50',
          activeText: 'text-blue-400',
          activeShadow: 'shadow-blue-500/20',
          hoverBorder: 'hover:border-blue-500/30',
          hoverText: 'hover:text-blue-400'
        };
    }
  };

  const colors = getThemeColors();

  const handleCategoryClick = (catId) => {
    onSelectCategory(catId);

    // Don't auto-show dropdown - allow direct access to map functionality
    setShowBusinessDropdown(false);
    setDropdownCategory(null);
  };

  const handleCloseDropdown = () => {
    setShowBusinessDropdown(false);
    setDropdownCategory(null);
  };

  return (
    <div className="relative w-full mt-2">
      <div className="overflow-x-auto pb-1 scrollbar-hide">
        <div className={`flex gap-1.5 min-w-max ${compact ? 'px-0' : 'px-1'}`}>
          {searchCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <motion.button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-[11px]
                  transition-all backdrop-blur-sm whitespace-nowrap border
                  ${isActive
                    ? `${colors.activeBg} ${colors.activeBorder} ${colors.activeText} shadow-sm ${colors.activeShadow}`
                    : `bg-neutral-800/40 border-neutral-700/30 text-neutral-400 ${colors.hoverBorder} ${colors.hoverText} hover:bg-neutral-800/60`
                  }
                `}
              >
                <Icon size={12} />
                <span>{cat.label}</span>
                {(cat.id === 'local' || cat.id === 'maps') && isActive && (
                  <ChevronDown size={10} className={`transition-transform ${showBusinessDropdown ? 'rotate-180' : ''}`} />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Map Toggle Button - Shows when maps or local category is selected */}
      <AnimatePresence>
        {(activeCategory === 'maps' || activeCategory === 'local') && onMapToggle && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="max-w-4xl mx-auto mt-3"
          >
            <button
              type="button"
              onClick={onMapToggle}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                transition-all w-full justify-center
                ${showMap || isLocationQuery
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700/50'
                }
              `}
            >
              <Map size={16} />
              <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
              {isLocationQuery && !showMap && (
                <span className="ml-2 text-emerald-400 text-xs font-semibold">
                  • Location Detected
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Business Listing Dropdown */}
      <AnimatePresence>
        {showBusinessDropdown && (
      <BusinessListingDropdown
        isVisible={showBusinessDropdown}
        onClose={handleCloseDropdown}
        categoryType={dropdownCategory}
        searchQuery={value}
      />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Filter Options Configuration
 */
const filterOptions = {
  sortBy: [
    { value: 'relevance', label: 'Relevance' },
    { value: 'date', label: 'Date' },
    { value: 'views', label: 'Views' },
  ],
  order: [
    { value: 'desc', label: 'High to Low' },
    { value: 'asc', label: 'Low to High' },
  ],
  category: [
    { value: 'all', label: 'All Results' },
    { value: 'mainstream', label: 'Mainstream' },
    { value: 'conspiracy', label: 'Conspiracy' },
    { value: 'democratic', label: 'Democratic' },
    { value: 'republican', label: 'Republican' },
    { value: 'nonpartisan', label: 'Nonpartisan' },
    { value: 'music', label: 'Music' },
    { value: 'videos', label: 'Videos' },
    { value: 'socials', label: 'Socials' },
    { value: 'reels', label: 'Reels/Shorts' },
    { value: 'shopping', label: 'Shopping' },
  ],
  dateRange: [
    { value: 'any', label: 'Any Time' },
    { value: 'hour', label: 'Past Hour' },
    { value: 'day', label: 'Past 24 Hours' },
    { value: 'week', label: 'Past Week' },
    { value: 'month', label: 'Past Month' },
    { value: 'year', label: 'Past Year' },
  ],
  bias: [
    { value: 'all', label: 'All Perspectives' },
    { value: 'unbiased', label: 'Unbiased Only' },
    { value: 'left', label: 'Left-leaning' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right-leaning' },
  ],
};

/**
 * FilterDropdown Component - Styled select for search filters
 */
function FilterDropdown({ label, value, options, onChange, compact = false, isRedPillMode = false, themeColor = 'blue' }) {
  // Theme color mappings for borders and focus
  const getBorderColors = () => {
    switch (themeColor) {
      case 'green':
        return {
          hover: 'hover:border-green-500/40',
          focus: 'focus:ring-green-500/40 focus:border-green-500/40'
        };
      case 'red':
        return {
          hover: 'hover:border-red-500/40',
          focus: 'focus:ring-red-500/40 focus:border-red-500/40'
        };
      case 'purple':
        return {
          hover: 'hover:border-purple-500/40',
          focus: 'focus:ring-purple-500/40 focus:border-purple-500/40'
        };
      case 'cyan':
        return {
          hover: 'hover:border-cyan-500/40',
          focus: 'focus:ring-cyan-500/40 focus:border-cyan-500/40'
        };
      default: // 'blue'
        return {
          hover: 'hover:border-blue-500/40',
          focus: 'focus:ring-blue-500/40 focus:border-blue-500/40'
        };
    }
  };

  const colors = getBorderColors();

  return (
    <div className={`relative ${compact ? 'min-w-[80px]' : 'min-w-[100px]'}`}>
      <label className="block text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5 font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full appearance-none
            ${compact ? 'py-1 px-1.5 pr-5 text-[10px]' : 'py-1 px-2 pr-6 text-[11px]'}
            bg-neutral-800/70 backdrop-blur-sm
            border border-neutral-700/40 ${colors.hover}
            rounded-md
            text-neutral-200 font-medium
            cursor-pointer
            transition-all duration-200
            focus:outline-none focus:ring-1 ${colors.focus}
          `}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-neutral-900">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={compact ? 10 : 11}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
        />
      </div>
    </div>
  );
}

/**
 * SearchFiltersBar Component - Integrated filter bar for SearchBar
 */
function SearchFiltersBar({ filters, onFiltersChange, compact = false, showToggle = true, isRedPillMode = false, themeColor = 'blue' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Theme color mappings
  const getFilterColors = () => {
    switch (themeColor) {
      case 'green':
        return {
          expanded: 'bg-green-500/15 text-green-400 border border-green-500/25',
          badge: 'bg-green-500/25 text-green-300'
        };
      case 'red':
        return {
          expanded: 'bg-red-500/15 text-red-400 border border-red-500/25',
          badge: 'bg-red-500/25 text-red-300'
        };
      case 'purple':
        return {
          expanded: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
          badge: 'bg-purple-500/25 text-purple-300'
        };
      case 'cyan':
        return {
          expanded: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
          badge: 'bg-cyan-500/25 text-cyan-300'
        };
      default: // 'blue'
        return {
          expanded: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
          badge: 'bg-blue-500/25 text-blue-300'
        };
    }
  };

  const colors = getFilterColors();

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Count active filters (non-default values) - only for displayed filters
  const activeFilterCount = Object.entries(filters || {}).filter(([key, value]) => {
    const defaults = { sortBy: 'relevance', order: 'desc', dateRange: 'any' };
    return defaults[key] !== undefined && value !== defaults[key];
  }).length;

  return (
    <div>
      {/* Toggle Button (optional) */}
      {showToggle && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center gap-1.5 mb-1 px-2 py-1 rounded-md
            text-[11px] font-medium
            ${isExpanded
              ? colors.expanded
              : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/40 hover:border-neutral-600'
            }
            transition-all duration-200
          `}
        >
          <SlidersHorizontal size={12} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className={`px-1 py-0.5 ${colors.badge} rounded text-[9px] font-bold`}>
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={10}
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* Filter Dropdowns */}
      <AnimatePresence>
        {(isExpanded || !showToggle) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className={`flex flex-wrap items-end ${compact ? 'gap-1' : 'gap-2'}`}>
              <FilterDropdown
                label="Sort By"
                value={filters?.sortBy || 'relevance'}
                options={filterOptions.sortBy}
                onChange={(val) => handleFilterChange('sortBy', val)}
                compact={compact}
                isRedPillMode={isRedPillMode}
                themeColor={themeColor}
              />
              <FilterDropdown
                label="Order"
                value={filters?.order || 'desc'}
                options={filterOptions.order}
                onChange={(val) => handleFilterChange('order', val)}
                compact={compact}
                isRedPillMode={isRedPillMode}
                themeColor={themeColor}
              />
              <FilterDropdown
                label="Date"
                value={filters?.dateRange || 'any'}
                options={filterOptions.dateRange}
                onChange={(val) => handleFilterChange('dateRange', val)}
                compact={compact}
                isRedPillMode={isRedPillMode}
                themeColor={themeColor}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * PillToggle Component - Blue / Red / Green 3-way Pill Mode Toggle
 * Cycles: Blue → Red → Green → Blue
 * Integrated into SearchBar for consistent usage across the app
 */
const PILL_CYCLE = ['blue', 'red', 'green'];
const PILL_CONFIG = {
  blue:  { label: 'Blue Pill Mode',  tag: 'BLUE',  bg: 'from-blue-500 to-blue-700',   text: 'text-blue-500',  tagText: 'text-blue-100'  },
  red:   { label: 'Red Pill Mode',   tag: 'RED',   bg: 'from-red-600 to-red-800',     text: 'text-red-500',   tagText: 'text-red-100'   },
  green: { label: 'Green Pill Mode', tag: 'GREEN', bg: 'from-green-600 to-green-800', text: 'text-green-500', tagText: 'text-green-100' },
};

function PillToggle({ isRedPillMode, pillMode: externalPillMode, onToggle, onModeChange, showLabel = true, showWarningModal = true }) {
  const [showWarning, setShowWarning] = useState(false);

  // Derive current mode: prefer explicit pillMode prop, fall back to isRedPillMode boolean
  const currentMode = externalPillMode || (isRedPillMode ? 'red' : 'blue');
  const config = PILL_CONFIG[currentMode] || PILL_CONFIG.blue;

  const getNextMode = () => {
    const idx = PILL_CYCLE.indexOf(currentMode);
    return PILL_CYCLE[(idx + 1) % PILL_CYCLE.length];
  };

  const handleToggleClick = () => {
    const next = getNextMode();
    if (next === 'red' && showWarningModal) {
      setShowWarning(true);
    } else {
      if (onModeChange) onModeChange(next);
      else if (onToggle) onToggle(next !== 'blue');
    }
  };

  const handleConfirmRedPill = () => {
    setShowWarning(false);
    if (onModeChange) onModeChange('red');
    else if (onToggle) onToggle(true);
  };

  const handleCancelRedPill = () => {
    setShowWarning(false);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        {/* Mode Label */}
        {showLabel && (
          <span className={`text-lg font-bold transition-colors duration-300 ${config.text}`}>
            {config.label}
          </span>
        )}

        {/* 3-way Cycle Button */}
        <button
          type="button"
          onClick={handleToggleClick}
          className={`relative w-24 h-8 flex items-center justify-center rounded-xl p-1 transition-all duration-300 bg-gradient-to-r ${config.bg}`}
          aria-label={`Current: ${config.label}. Click to cycle pill mode.`}
        >
          <span className={`text-xs font-bold ${config.tagText}`}>
            {config.tag}
          </span>
        </button>
      </div>

      {/* Red Pill Warning Modal */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancelRedPill}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative w-full max-w-2xl bg-black p-8 rounded-2xl"
              style={{
                border: '2px solid',
                borderImageSlice: 1,
                borderImageSource: 'linear-gradient(45deg, #EF4444, #F87171, #FCA5A5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Electric border effect */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-pink-500 to-red-600 blur opacity-75 animate-pulse"></div>
              <div className="absolute inset-0 rounded-2xl bg-black"></div>

              <h2 className="text-3xl font-bold text-red-500 mb-6 text-center relative z-10">
                RED PILL WARNING!
              </h2>

              <p className="text-white text-lg mb-4 text-center relative z-10">
                Here lies the infamous "Rabbit Hole." Where it ends, uncertain. You will see the unseen,
                discover hidden secrets, and you may lose contact with your identity in the process.
                Would you like to proceed?
              </p>

              <p className="text-white/60 text-sm mb-8 text-center relative z-10 italic">
                (Truegle Corp. is not responsible for the state of your mental health if you decide to continue.)
              </p>

              <div className="flex justify-center gap-6 relative z-10">
                <button
                  onClick={handleConfirmRedPill}
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all shadow-lg shadow-red-500/30"
                >
                  YES
                </button>

                <button
                  onClick={handleCancelRedPill}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl hover:from-blue-500 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
                >
                  NO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * SearchBar Component - Redesigned for Enhanced Usability
 *
 * CONSTRAINT CHECK:
 * ✅ No background/animation changes (parent handles backgrounds)
 * ✅ Preserves brand colors (emerald gradients)
 * ✅ Uses 8px spacing grid system
 * ✅ Uses MD3 typography tokens
 *
 * CHANGE SCOPE:
 * - Enhanced placeholder with typing animation
 * - Clear button with smooth animation
 * - Improved focus states with accessibility
 * - Loading state indicator
  * - Character count (optional)
  * - Search suggestions container ready
  */

// Trending searches for suggestions - defined outside component to prevent re-creation
const TRENDING_SUGGESTIONS = [
  { type: 'trending', text: 'climate change news' },
  { type: 'trending', text: 'AI technology updates' },
  { type: 'trending', text: 'renewable energy solutions' },
  { type: 'trending', text: 'space exploration discoveries' },
  { type: 'trending', text: 'health and wellness tips' },
];

export default function SearchBar({
  value,
  onChange,
  onSearch,
  onSubmit,
  onClear,
  placeholder = 'Search without bias...',
  size = 'medium',
  className = '',
  showBiasedButton = false,
  onBiasedClick,
  showUnbiasedButton = false,
  onUnbiasedClick,
  rightIcons = null,
  isLoading = false,
  showCharCount = false,
  maxLength = 2048,
  autoFocus = false,
  disabled = false,
  ariaLabel = 'Search input',
  // Pill Toggle Props
  showPillToggle = false,
  isRedPillMode: externalRedPillMode,
  pillMode: externalPillMode,      // 'blue' | 'red' | 'green' — overrides isRedPillMode
  onPillModeChange,                // called with new mode string
  showPillLabel = true,
  // Filter Props
  showFilters = false,
  filters = { sortBy: 'relevance', order: 'desc', category: 'all', dateRange: 'any', bias: 'all' },
  onFiltersChange,
  compactFilters = false,
  showFilterToggle = true,
  // OSINT Mode Props
  showOSINTToggle = false,
  isOSINTMode = false,
  onOSINTToggle,
  // Category Props
  showCategories = false,
  activeCategory = 'all',
  onSelectCategory,
  // Map Props
  showMap = false,
  onMapToggle = null,
  isLocationQuery = false,
  // Safe Search Props
  safeSearch: externalSafeSearch = 'safe', // 'safe' | 'blur' | 'off'
  onSafeSearchChange,
  // Theme Props
  usePurpleTheme = false,
  themeColor = 'blue', // 'blue', 'red', 'purple', or 'cyan'
  // Custom Action Buttons
  customActionButtons = null,
  // Custom Button Gradients (for landing page only)
  searchButtonGradient = null,
  biasedButtonGradient = null,
  unbiasedButtonGradient = null,
  // Custom Search Icon Color (for landing page only)
  searchIconColor = null,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const [internalRedPillMode, setInternalRedPillMode] = useState(false);
  const [showPillWarning, setShowPillWarning] = useState(false);
  const [rememberRedPill, setRememberRedPill] = useState(false);
  const [localSafeSearch, setLocalSafeSearch] = useState(externalSafeSearch);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isHoveringDropdown, setIsHoveringDropdown] = useState(false);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const typingTimerRef = useRef(null);
  const pendingSearchRef = useRef(null);

  // Theme color mappings - comprehensive color system for the search bar
  const getThemeColors = useCallback(() => {
    const colorMap = {
      green: {
        // Border gradients
        borderFocused: 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-400',
        borderHovered: 'bg-gradient-to-r from-green-500 via-emerald-600 to-green-500',
        borderDefault: 'bg-green-700/40',
        // Icon colors
        iconFocused: 'text-green-300',
        iconHovered: 'text-green-400',
        iconDefault: 'text-green-500/80',
        // Shadows (CSS custom properties)
        shadowFocused: '0_0_40px_rgba(34,197,94,0.4),0_0_80px_rgba(34,197,94,0.15),inset_0_0_30px_rgba(34,197,94,0.08)',
        shadowHovered: '0_0_25px_rgba(34,197,94,0.25),inset_0_0_15px_rgba(34,197,94,0.05)',
        shadowDefault: '0_0_15px_rgba(34,197,94,0.12)',
        // Focus ring
        focusRing: 'focus-visible:ring-green-400/60',
        // Selection
        selection: 'selection:bg-green-500/30',
        // Loading/Spinner
        spinner: 'text-green-400',
        // Suggestion dropdown
        suggestionBorder: 'border-green-500/30',
        suggestionActive: 'bg-green-500/20 text-green-300',
        suggestionIcon: 'text-green-500',
        suggestionHighlight: 'text-green-400',
        suggestionBadge: 'bg-green-500/20 text-green-400',
      },
      blue: {
        // Border gradients
        borderFocused: 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400',
        borderHovered: 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500',
        borderDefault: 'bg-blue-700/40',
        // Icon colors
        iconFocused: 'text-blue-300',
        iconHovered: 'text-blue-400',
        iconDefault: 'text-blue-500/80',
        // Shadows (CSS custom properties)
        shadowFocused: '0_0_40px_rgba(59,130,246,0.4),0_0_80px_rgba(59,130,246,0.15),inset_0_0_30px_rgba(59,130,246,0.08)',
        shadowHovered: '0_0_25px_rgba(59,130,246,0.25),inset_0_0_15px_rgba(59,130,246,0.05)',
        shadowDefault: '0_0_15px_rgba(59,130,246,0.12)',
        // Focus ring
        focusRing: 'focus-visible:ring-blue-400/60',
        // Selection
        selection: 'selection:bg-blue-500/30',
        // Loading/Spinner
        spinner: 'text-blue-400',
        // Suggestion dropdown
        suggestionBorder: 'border-blue-500/30',
        suggestionActive: 'bg-blue-500/20 text-blue-300',
        suggestionIcon: 'text-blue-500',
        suggestionHighlight: 'text-blue-400',
        suggestionBadge: 'bg-blue-500/20 text-blue-400',
      },
      red: {
        borderFocused: 'bg-gradient-to-r from-red-400 via-red-500 to-red-400',
        borderHovered: 'bg-gradient-to-r from-red-500 via-red-600 to-red-500',
        borderDefault: 'bg-red-700/40',
        iconFocused: 'text-red-300',
        iconHovered: 'text-red-400',
        iconDefault: 'text-red-500/80',
        shadowFocused: '0_0_40px_rgba(239,68,68,0.4),0_0_80px_rgba(239,68,68,0.15),inset_0_0_30px_rgba(239,68,68,0.08)',
        shadowHovered: '0_0_25px_rgba(239,68,68,0.25),inset_0_0_15px_rgba(239,68,68,0.05)',
        shadowDefault: '0_0_15px_rgba(239,68,68,0.12)',
        focusRing: 'focus-visible:ring-red-400/60',
        selection: 'selection:bg-red-500/30',
        spinner: 'text-red-400',
        suggestionBorder: 'border-red-500/30',
        suggestionActive: 'bg-red-500/20 text-red-300',
        suggestionIcon: 'text-red-500',
        suggestionHighlight: 'text-red-400',
        suggestionBadge: 'bg-red-500/20 text-red-400',
      },
      purple: {
        borderFocused: 'bg-gradient-to-r from-purple-400 via-purple-500 to-purple-400',
        borderHovered: 'bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500',
        borderDefault: 'bg-purple-700/40',
        iconFocused: 'text-purple-300',
        iconHovered: 'text-purple-400',
        iconDefault: 'text-purple-500/80',
        shadowFocused: '0_0_40px_rgba(168,85,247,0.4),0_0_80px_rgba(168,85,247,0.15),inset_0_0_30px_rgba(168,85,247,0.08)',
        shadowHovered: '0_0_25px_rgba(168,85,247,0.25),inset_0_0_15px_rgba(168,85,247,0.05)',
        shadowDefault: '0_0_15px_rgba(168,85,247,0.12)',
        focusRing: 'focus-visible:ring-purple-400/60',
        selection: 'selection:bg-purple-500/30',
        spinner: 'text-purple-400',
        suggestionBorder: 'border-purple-500/30',
        suggestionActive: 'bg-purple-500/20 text-purple-300',
        suggestionIcon: 'text-purple-500',
        suggestionHighlight: 'text-purple-400',
        suggestionBadge: 'bg-purple-500/20 text-purple-400',
      },
      cyan: {
        borderFocused: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-400',
        borderHovered: 'bg-gradient-to-r from-cyan-500 via-cyan-600 to-cyan-500',
        borderDefault: 'bg-cyan-700/40',
        iconFocused: 'text-cyan-300',
        iconHovered: 'text-cyan-400',
        iconDefault: 'text-cyan-500/80',
        shadowFocused: '0_0_40px_rgba(6,182,212,0.4),0_0_80px_rgba(6,182,212,0.15),inset_0_0_30px_rgba(6,182,212,0.08)',
        shadowHovered: '0_0_25px_rgba(6,182,212,0.25),inset_0_0_15px_rgba(6,182,212,0.05)',
        shadowDefault: '0_0_15px_rgba(6,182,212,0.12)',
        focusRing: 'focus-visible:ring-cyan-400/60',
        selection: 'selection:bg-cyan-500/30',
        spinner: 'text-cyan-400',
        suggestionBorder: 'border-cyan-500/30',
        suggestionActive: 'bg-cyan-500/20 text-cyan-300',
        suggestionIcon: 'text-cyan-500',
        suggestionHighlight: 'text-cyan-400',
        suggestionBadge: 'bg-cyan-500/20 text-cyan-400',
      },
    };
    return colorMap[themeColor] || colorMap.blue;
  }, [themeColor]);

  const colors = getThemeColors();

  // Get recent searches from localStorage
  const getRecentSearches = useCallback(() => {
    try {
      const recent = localStorage.getItem('truegle_recent_searches');
      return recent ? JSON.parse(recent).slice(0, 5) : [];
    } catch {
      return [];
    }
  }, []);

  // Save search to recent
  const saveToRecentSearches = useCallback((query) => {
    try {
      const recent = getRecentSearches();
      const filtered = recent.filter(s => s.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, 10);
      localStorage.setItem('truegle_recent_searches', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }, [getRecentSearches]);

  // Generate suggestions based on input
  const generateSuggestions = useCallback((query) => {
    if (!query.trim()) {
      // Show recent searches and trending when empty
      const recent = getRecentSearches().map(text => ({ type: 'recent', text }));
      return [...recent, ...TRENDING_SUGGESTIONS.slice(0, 5 - recent.length)];
    }

    const queryLower = query.toLowerCase();
    const recent = getRecentSearches()
      .filter(s => s.toLowerCase().includes(queryLower))
      .map(text => ({ type: 'recent', text }));

    const trending = TRENDING_SUGGESTIONS
      .filter(s => s.text.toLowerCase().includes(queryLower));

    // Generate autocomplete suggestions
    const autocomplete = [
      `${query} news`,
      `${query} explained`,
      `${query} facts`,
      `${query} analysis`,
    ].map(text => ({ type: 'suggestion', text }));

    return [...recent, ...trending, ...autocomplete].slice(0, 8);
  }, [getRecentSearches]);

  // Update suggestions when input changes
  useEffect(() => {
    if (isFocused) {
      const newSuggestions = generateSuggestions(localValue);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    }
  }, [localValue, isFocused, generateSuggestions]);

  // Auto-hide suggestions after 3 seconds of typing inactivity
  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    if (localValue.trim() && isFocused) {
      typingTimerRef.current = setTimeout(() => {
        if (!isHoveringDropdown) {
          setShowSuggestions(false);
        }
      }, 3000);
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [localValue, isFocused, isHoveringDropdown]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion) => {
    setLocalValue(suggestion.text);
    onChange?.(suggestion.text);
    setShowSuggestions(false);
    saveToRecentSearches(suggestion.text);
    inputRef.current?.focus();
    // Trigger search
    setTimeout(() => {
      onSubmit?.();
      onSearch?.();
    }, 100);
  }, [onChange, onSubmit, onSearch, saveToRecentSearches]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Use external state if provided, otherwise use internal state
  const isRedPillMode = externalRedPillMode !== undefined ? externalRedPillMode : internalRedPillMode;

  // Check if user has previously chosen to skip the warning
  const shouldSkipWarning = useCallback(() => {
    try {
      return localStorage.getItem('truegle_skip_redpill_warning') === 'true';
    } catch {
      return false;
    }
  }, []);

  // Derive current pill mode from explicit prop or isRedPillMode boolean
  const currentPillMode = externalPillMode || (externalRedPillMode ? 'red' : 'blue');
  const internalPillMode = externalPillMode || (internalRedPillMode ? 'red' : 'blue');
  const activePillMode = externalPillMode !== undefined ? currentPillMode : internalPillMode;

  const pillCycle = ['blue', 'red', 'green'];
  const pillColors = {
    blue:  { dot: 'bg-blue-500',  text: 'text-blue-400',  border: 'border-blue-500/40',  bg: 'bg-blue-500/20',  shadow: 'shadow-blue-500/20',  label: 'Blue Pill'  },
    red:   { dot: 'bg-red-500',   text: 'text-red-400',   border: 'border-red-500/40',   bg: 'bg-red-500/20',   shadow: 'shadow-red-500/20',   label: 'Red Pill'   },
    green: { dot: 'bg-green-500', text: 'text-green-400', border: 'border-green-500/40', bg: 'bg-green-500/20', shadow: 'shadow-green-500/20', label: 'Green Pill' },
  };

  // Cycle safe search state: safe → blur → off → safe
  const SAFE_CYCLE = ['safe', 'blur', 'off'];
  const activeSafeSearch = externalSafeSearch !== undefined ? externalSafeSearch : localSafeSearch;
  const handleSafeSearchCycle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = SAFE_CYCLE.indexOf(activeSafeSearch);
    const next = SAFE_CYCLE[(idx + 1) % SAFE_CYCLE.length];
    setLocalSafeSearch(next);
    onSafeSearchChange?.(next);
    if (onFiltersChange) {
      onFiltersChange({ ...filters, safeSearch: next });
    }
  }, [activeSafeSearch, onSafeSearchChange, onFiltersChange, filters]);

  // Handle pill mode toggle - cycle Blue → Red → Green → Blue (no warning on click)
  const handlePillToggleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = pillCycle.indexOf(activePillMode);
    const nextMode = pillCycle[(idx + 1) % pillCycle.length];

    if (onPillModeChange) {
      onPillModeChange(nextMode);
    } else {
      setInternalRedPillMode(nextMode === 'red');
    }
  }, [activePillMode, onPillModeChange]);

  // Confirm Red Pill search after warning
  const handleConfirmRedPill = useCallback(() => {
    if (rememberRedPill) {
      try {
        localStorage.setItem('truegle_skip_redpill_warning', 'true');
      } catch {
        // ignore
      }
    }
    setShowPillWarning(false);
    setRememberRedPill(false);
    // Run the queued search
    const pending = pendingSearchRef.current;
    pendingSearchRef.current = null;
    pending?.();
  }, [rememberRedPill]);

  // Cancel Red Pill search
  const handleCancelRedPill = useCallback(() => {
    setShowPillWarning(false);
    setRememberRedPill(false);
    pendingSearchRef.current = null;
  }, []);

  // Sync external value
  useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value);
    }
  }, [value]);

  // Design System: Input sizes aligned to 8px spacing grid
  const sizeConfig = {
    large: {
      height: 'h-14',           // 56px = 7 × 8px (increased for better touch targets)
      text: 'text-body-large',  // MD3 Body Large: 16px
      iconSize: 22,
      padding: 'pl-14 pr-14',
    },
    medium: {
      height: 'h-12',           // 48px = 6 × 8px
      text: 'text-body-medium', // MD3 Body Medium: 14px
      iconSize: 20,
      padding: 'pl-12 pr-12',
    },
    small: {
      height: 'h-10',           // 40px = 5 × 8px
      text: 'text-body-small',  // MD3 Body Small: 12px
      iconSize: 18,
      padding: 'pl-10 pr-10',
    },
  };

  const config = sizeConfig[size];
  const hasValue = localValue && localValue.length > 0;

  // Handle input change
const handleChange = useCallback((e) => {
  // Support both event objects and direct string values
  const newValue = typeof e === 'string' ? e : (e?.target?.value ?? '');
  if (maxLength && newValue.length > maxLength) return;

  setLocalValue(newValue);
  // Pass the string value, not the event object
  onChange?.(newValue);
}, [onChange, maxLength]);

  // Handle clear
  const handleClear = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setLocalValue('');
    onClear?.();
    // Pass empty string directly
    onChange?.('');
    inputRef.current?.focus();
  }, [onChange, onClear]);

  // Handle input mouse leave - hide suggestions with delay
  const handleInputMouseLeave = useCallback(() => {
    setTimeout(() => {
      if (!isHoveringDropdown) {
        setShowSuggestions(false);
      }
    }, 200);
  }, [isHoveringDropdown]);

  // Handle dropdown mouse enter - keep suggestions open
  const handleDropdownMouseEnter = useCallback(() => {
    setIsHoveringDropdown(true);
  }, []);

  // Handle dropdown mouse leave - hide suggestions
  const handleDropdownMouseLeave = useCallback(() => {
    setIsHoveringDropdown(false);
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  }, []);

  // Execute the actual search (called after any gate checks)
  const executeSearch = useCallback(() => {
    onSubmit?.();
    onSearch?.();
  }, [onSubmit, onSearch]);

  // Gate search through red pill warning if needed
  const gatedSearch = useCallback(() => {
    if (activePillMode === 'red' && !shouldSkipWarning()) {
      pendingSearchRef.current = executeSearch;
      setShowPillWarning(true);
      return;
    }
    executeSearch();
  }, [activePillMode, shouldSkipWarning, executeSearch]);

  // Handle form submit
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (localValue.trim()) {
      gatedSearch();
    }
  }, [localValue, gatedSearch]);

  // Handle keyboard shortcuts including suggestion navigation
  const handleKeyDown = useCallback((e) => {
    // Escape to clear or close suggestions
    if (e.key === 'Escape') {
      if (showSuggestions) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      } else if (hasValue) {
        handleClear(e);
      }
      return;
    }

    // Navigate suggestions with arrow keys
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      }
    }
  }, [hasValue, handleClear, showSuggestions, suggestions, selectedSuggestionIndex, handleSuggestionClick]);

  // Calculate dynamic right padding based on icons
  const getRightPadding = () => {
    // Get CSS variable with fallback to 16px
    const cssValue = typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--ds-space-2')
      : '16px';
    let padding = parseInt(cssValue, 10) || 16; // fallback to 16px if parsing fails
    if (hasValue) padding += 40; // clear button space

    // Account for media input components (mic, camera, file) - always present
    padding += 120; // 3 icons * ~40px each

    if (isLoading) padding += 32; // loader space

    // Account for any custom right icons if provided
    if (rightIcons) padding += 72; // additional icons space
    return `${padding}px`;
  };

  return (
    <div className={`w-full ${className}`}>
          {/* Filters (Left) - Blue Pill Mode (Center) - OSINT (Right) */}
          {(showFilters || showPillToggle || showOSINTToggle) && (
            <div className="flex items-end justify-between mb-2">
              {/* Filters - Left Side */}
              <div className="flex items-end">
                {showFilters && onFiltersChange ? (
                  <SearchFiltersBar
                    filters={filters}
                    onFiltersChange={onFiltersChange}
                    compact={compactFilters}
                    showToggle={showFilterToggle}
                    isRedPillMode={isRedPillMode}
                    themeColor={themeColor}
                  />
                ) : (
                  <div className="w-20" /> /* Spacer when no filters */
                )}
              </div>

          {/* Pill Mode Toggle - Center (cycles Blue → Red → Green → Blue) */}
          <div className="flex justify-center">
            {showPillToggle ? (
              <motion.button
                type="button"
                onClick={(e) => handlePillToggleClick(e)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ zIndex: 9999 }}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md
                  text-[11px] font-medium
                  ${pillColors[activePillMode].bg} ${pillColors[activePillMode].text}
                  border ${pillColors[activePillMode].border}
                  shadow-sm ${pillColors[activePillMode].shadow}
                  transition-all duration-200
                `}
              >
                <div className={`w-3 h-3 rounded-full ${pillColors[activePillMode].dot}`} />
                <span>{pillColors[activePillMode].label}</span>
              </motion.button>
            ) : (
              <div /> /* Empty div to maintain layout */
            )}
          </div>

          {/* OSINT Mode Toggle + Safe Search - Right Side */}
          <div className="flex items-end justify-end gap-1.5">
            {/* Safe Search Toggle — subtle 3-state cycle */}
            {(() => {
              const safeConfig = {
                safe:  { Icon: Shield,  label: 'Safe',    cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
                blur:  { Icon: Eye,     label: 'Blur',    cls: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
                off:   { Icon: EyeOff,  label: 'Off',     cls: 'text-red-400 border-red-500/30 bg-red-500/10' },
              };
              const sc = safeConfig[activeSafeSearch] || safeConfig.safe;
              return (
                <motion.button
                  type="button"
                  onClick={handleSafeSearchCycle}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  title={`Safe Search: ${sc.label} (click to cycle)`}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] font-medium border opacity-60 hover:opacity-100 transition-all ${sc.cls}`}
                >
                  <sc.Icon size={10} />
                  <span className="hidden sm:inline">{sc.label}</span>
                </motion.button>
              );
            })()}
            {showOSINTToggle ? (
              <motion.button
                type="button"
                onClick={onOSINTToggle}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md
                  text-[11px] font-medium
                  ${isOSINTMode
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                    : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/40 hover:border-cyan-500/30 hover:text-cyan-400'
                  }
                  transition-all duration-200
                `}
              >
                <Zap size={12} />
                <span>OSINT / SEO</span>
              </motion.button>
            ) : null}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative w-full">
        <motion.div
          initial={false}
          animate={{
            scale: isFocused ? 1.005 : 1,
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glowing Border Effect - Enhanced with animation */}
          <div
            className={`
              absolute inset-0 rounded-2xl
              transition-all duration-300 ease-out
              ${isFocused
                ? `${colors.borderFocused} p-[2px] opacity-100`
                : isHovered
                  ? `${colors.borderHovered} p-[2px] opacity-80`
                  : `${colors.borderDefault} p-[1px] opacity-60`
              }
            `}
            style={{
              backgroundSize: isFocused ? '200% 200%' : '100% 100%',
              animation: isFocused ? 'gradient-shift 3s ease infinite' : 'none',
            }}
          >
            <div className="w-full h-full bg-neutral-900/95 rounded-2xl" />
          </div>

          {/* Search Icon - Animated on focus */}
          <motion.div
            className="absolute left-4 top-1/2 z-10 pointer-events-none"
            initial={false}
            animate={{
              y: '-50%',
              scale: isFocused ? 1.1 : 1,
              rotate: isFocused ? -10 : 0,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Search
              size={config.iconSize}
              className={`
                transition-colors duration-200 ease-out
                ${searchIconColor
                  ? searchIconColor
                  : isFocused
                    ? colors.iconFocused
                    : isHovered
                      ? colors.iconHovered
                      : colors.iconDefault
                }
              `}
              strokeWidth={2.5}
            />
          </motion.div>

          {/* Main Input */}
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onMouseLeave={handleInputMouseLeave}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            maxLength={maxLength}
            aria-label={ariaLabel}
            aria-describedby={showCharCount ? 'char-count' : undefined}
            className={`
              relative z-[5]
              w-full ${config.height}
              pl-12
              bg-neutral-900/90 backdrop-blur-xl
              border-0
              ${isFocused
                ? `shadow-[${colors.shadowFocused}]`
                : isHovered
                  ? `shadow-[${colors.shadowHovered}]`
                  : `shadow-[${colors.shadowDefault}]`
              }
              rounded-2xl
              text-neutral-50 font-medium tracking-wide
              placeholder:text-neutral-400 placeholder:font-normal
              placeholder:transition-opacity placeholder:duration-200
              ${isFocused ? 'placeholder:opacity-60' : 'placeholder:opacity-100'}
              focus:outline-none
              ${colors.focusRing} focus-visible:ring-2
              focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900
              transition-all duration-200 ease-out
              disabled:opacity-50 disabled:cursor-not-allowed
              ${colors.selection}
            `}
            style={{
              paddingRight: getRightPadding(),
              letterSpacing: '0.025em',
            }}
          />

          {/* Right Side Actions Container */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
            {/* Loading Indicator */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Loader2
                    size={config.iconSize - 2}
                    className={`${colors.spinner} animate-spin`}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Clear Button - Appears when there's text */}
            <AnimatePresence>
              {hasValue && !isLoading && (
                <motion.button
                  type="button"
                  onClick={handleClear}
                  initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  className={`
                    flex items-center justify-center
                    w-7 h-7 rounded-full
                    bg-neutral-700/60 hover:bg-neutral-600/80
                    text-neutral-400 hover:text-neutral-200
                    transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                  `}
                  aria-label="Clear search"
                >
                  <X size={config.iconSize - 4} strokeWidth={2.5} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Media Input Components - Mic, Camera, File */}
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-neutral-700/50">
              {/* Voice Recognition */}
              <VoiceRecognition
                onTranscriptChange={(transcript) => {
                  setLocalValue(transcript);
                  onChange?.(transcript);
                }}
                onStatusChange={(status, error) => {
                  if (status === 'error') {
                    console.error('Voice recognition error:', error);
                  } else if (status === 'stopped') {
                    // Automatically trigger search when voice input stops
                    if (localValue.trim()) {
                      onSubmit?.();
                      onSearch?.();
                    }
                  }
                }}
                size={config.iconSize - 4}
              />

              {/* Camera Input */}
              <CameraInput
                onImageCapture={(imageDataUrl) => {
                  // Handle image capture - could trigger image search
                  console.log('Image captured for search:', imageDataUrl);
                }}
                onSearchSubmit={() => {
                  // Trigger search when image is captured/uploaded
                  if (localValue.trim()) {
                    onSubmit?.();
                    onSearch?.();
                  }
                }}
                size={config.iconSize - 4}
              />

              {/* File Input */}
              <FileInput
                onFileSelect={(files) => {
                  // Handle file selection - could trigger file-based search
                  console.log('Files selected for search:', files);
                }}
                onSearchSubmit={() => {
                  // Trigger search when file is uploaded
                  if (localValue.trim()) {
                    onSubmit?.();
                    onSearch?.();
                  }
                }}
                size={config.iconSize - 4}
              />

              {/* Custom Right Icons - if provided, they will be added after the media inputs */}
              {rightIcons && (
                <div className="flex items-center gap-1 ml-1 pl-2 border-l border-neutral-700/50">
                  {rightIcons}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Character Count - Optional */}
        <AnimatePresence>
          {showCharCount && isFocused && (
            <motion.div
              id="char-count"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-4 -bottom-6 text-label-small text-neutral-500"
            >
              {localValue.length.toLocaleString()} / {maxLength.toLocaleString()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-full mt-2 z-50"
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleDropdownMouseLeave}
            >
              <div className={`bg-neutral-900/98 backdrop-blur-xl border ${colors.suggestionBorder} rounded-xl shadow-2xl shadow-black/50 overflow-hidden`}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.text}-${index}`}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3
                      text-left transition-colors duration-100
                      ${selectedSuggestionIndex === index
                        ? colors.suggestionActive
                        : 'hover:bg-neutral-800/80 text-neutral-200'
                      }
                      ${index < suggestions.length - 1 ? 'border-b border-neutral-800/50' : ''}
                    `}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  >
                    {/* Icon based on suggestion type */}
                    {suggestion.type === 'recent' && (
                      <Clock size={16} className="text-neutral-500" />
                    )}
                    {suggestion.type === 'trending' && (
                      <TrendingUp size={16} className="text-orange-400" />
                    )}
                    {suggestion.type === 'suggestion' && (
                      <Search size={16} className={colors.suggestionIcon} />
                    )}

                    {/* Suggestion text with highlighting */}
                    <span className="flex-1 text-sm">
                      {localValue && suggestion.text.toLowerCase().includes(localValue.toLowerCase()) ? (
                        <>
                          {suggestion.text.substring(0, suggestion.text.toLowerCase().indexOf(localValue.toLowerCase()))}
                          <span className={`font-semibold ${colors.suggestionHighlight}`}>
                            {suggestion.text.substring(
                              suggestion.text.toLowerCase().indexOf(localValue.toLowerCase()),
                              suggestion.text.toLowerCase().indexOf(localValue.toLowerCase()) + localValue.length
                            )}
                          </span>
                          {suggestion.text.substring(
                            suggestion.text.toLowerCase().indexOf(localValue.toLowerCase()) + localValue.length
                          )}
                        </>
                      ) : (
                        suggestion.text
                      )}
                    </span>

                    {/* Type label */}
                    <span className={`
                      text-[10px] px-2 py-0.5 rounded-full
                      ${suggestion.type === 'recent' ? 'bg-neutral-700/50 text-neutral-400' : ''}
                      ${suggestion.type === 'trending' ? 'bg-orange-500/20 text-orange-400' : ''}
                      ${suggestion.type === 'suggestion' ? colors.suggestionBadge : ''}
                    `}>
                      {suggestion.type === 'recent' && 'Recent'}
                      {suggestion.type === 'trending' && 'Trending'}
                      {suggestion.type === 'suggestion' && 'Suggested'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Category Bar - Above Action Buttons */}
      {showCategories && onSelectCategory && (
        <CategoryBar
          activeCategory={activeCategory}
          onSelectCategory={onSelectCategory}
          value={localValue}
          isRedPillMode={isRedPillMode}
          themeColor={themeColor}
          showMap={showMap}
          onMapToggle={onMapToggle}
          isLocationQuery={isLocationQuery}
        />
      )}

      {/* Action Buttons Below Search Bar */}
      <div className="flex items-center justify-center gap-3 mt-6">
        {/* Primary Search Button */}
        <motion.button
          type="button"
          onClick={() => {
            if (localValue.trim()) {
              gatedSearch();
            }
          }}
          disabled={disabled || !localValue.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            inline-flex items-center justify-center gap-2
            h-12 px-6 min-w-[160px]
            ${searchButtonGradient
              ? `bg-gradient-to-r ${searchButtonGradient} hover:opacity-90 shadow-lg hover:shadow-xl focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`
              : themeColor === 'green'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-500/40 focus:ring-green-500/50'
                : themeColor === 'red'
                  ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-500/40 focus:ring-red-500/50'
                  : usePurpleTheme || themeColor === 'purple'
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-500/40 focus:ring-purple-500/50'
                    : themeColor === 'cyan'
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-lg shadow-cyan-600/30 hover:shadow-xl hover:shadow-cyan-500/40 focus:ring-cyan-500/50'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-500/40 focus:ring-blue-500/50'
            }
            text-white text-label-large font-semibold
            rounded-xl
            transition-all duration-200 ease-out
            disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:scale-100
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900
          `}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Search size={18} strokeWidth={2.5} />
          )}
          <span>Search</span>
        </motion.button>

        {/* Custom Action Buttons */}
        {customActionButtons}

        {/* Biased Button - Purple Variant */}
        <AnimatePresence>
          {showBiasedButton && (
            <motion.button
              type="button"
              onClick={onBiasedClick}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                inline-flex items-center justify-center gap-2
                h-12 px-6 min-w-[160px]
                ${biasedButtonGradient
                  ? `bg-gradient-to-r ${biasedButtonGradient} hover:opacity-90 shadow-lg hover:shadow-xl focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`
                  : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-500/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900'
                }
                text-white text-label-large font-semibold
                rounded-xl
                transition-all duration-200 ease-out
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900
              `}
            >
              <TrendingUp size={18} strokeWidth={2.5} />
              <span>Feeling Biased?</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Unbiased Button - Info Variant */}
        <AnimatePresence>
          {showUnbiasedButton && (
            <motion.button
              type="button"
              onClick={onUnbiasedClick}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                inline-flex items-center justify-center gap-2
                h-12 px-6 min-w-[160px]
                ${unbiasedButtonGradient
                  ? `bg-gradient-to-r ${unbiasedButtonGradient} hover:opacity-90 shadow-lg hover:shadow-xl focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-500/40 focus:ring-blue-500/50'
                }
                text-white text-label-large font-semibold
                rounded-xl
                transition-all duration-200 ease-out
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900
              `}
            >
              <Search size={18} strokeWidth={2.5} />
              <span>Unbiased Search</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Red Pill Warning Modal */}
      <AnimatePresence>
        {showPillWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancelRedPill}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative w-full max-w-2xl bg-black p-8 rounded-2xl"
              style={{
                border: '2px solid',
                borderImageSlice: 1,
                borderImageSource: 'linear-gradient(45deg, #EF4444, #F87171, #FCA5A5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Electric border effect */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-pink-500 to-red-600 blur opacity-75 animate-pulse"></div>
              <div className="absolute inset-0 rounded-2xl bg-black"></div>

              <h2 className="text-3xl font-bold text-red-500 mb-6 text-center relative z-10">
                RED PILL WARNING!
              </h2>

              <p className="text-white text-lg mb-4 text-center relative z-10">
                Here lies the infamous "Rabbit Hole." Where it ends, uncertain. You will see the unseen,
                discover hidden secrets, and you may lose contact with your identity in the process.
                Would you like to proceed?
              </p>

              <p className="text-white/60 text-sm mb-6 text-center relative z-10 italic">
                (Truegle Corp. is not responsible for the state of your mental health if you decide to continue.)
              </p>

              {/* Remember Me Checkbox */}
              <label className="flex items-center justify-center gap-3 mb-6 relative z-10 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberRedPill}
                  onChange={(e) => setRememberRedPill(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-red-500/50 bg-black/50 text-red-500
                    focus:ring-2 focus:ring-red-500/50 focus:ring-offset-0
                    checked:bg-red-600 checked:border-red-600
                    cursor-pointer transition-all"
                />
                <span className="text-white/80 text-sm group-hover:text-white transition-colors">
                  Don't show this warning again
                </span>
              </label>

              <div className="flex justify-center gap-6 relative z-10">
                <button
                  onClick={handleConfirmRedPill}
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl hover:from-red-500 hover:to-red-700 transition-all shadow-lg shadow-red-500/30"
                >
                  YES
                </button>

                <button
                  onClick={handleCancelRedPill}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl hover:from-blue-500 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
                >
                  NO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Keyboard Shortcut Helper Component
 * Shows users available shortcuts when input is focused
 */
export function SearchShortcutHint({ visible = false }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex items-center gap-4 mt-3 text-label-small text-neutral-500"
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono text-[10px]">
              Enter
            </kbd>
            <span>to search</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono text-[10px]">
              Esc
            </kbd>
            <span>to clear</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Export filter components and options for standalone use
export { SearchFiltersBar, FilterDropdown, filterOptions, CategoryBar, searchCategories, BusinessListingDropdown };
