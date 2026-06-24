import { useState, useEffect, useRef } from 'react';
import { Map as MapIcon, Camera, Layers, Navigation, X, MapPin, Route as NavigationIcon, Globe, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TruegleMap from './TruegleMap';
import MapPanel from './MapPanel';
import TrafficCameras from './TrafficCameras';
import DirectionsPanel from './DirectionsPanel';
import LocationPermissionModal from './LocationPermissionModal';
import AdBanner from './AdBanner';
import { useMap } from './context/MapContext';
import MapApiService from './services/mapApi';
import truegleLogo from '../../assets/images/truegle.png';
import LogoOverlay from './LogoOverlay';
import { Search as SearchIcon } from 'lucide-react';

// Smart backend URL detection - works for both local and external (ngrok) access
const getBackendUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isLocalIP = window.location.hostname.match(/^192\.168\.\d+\.\d+$/) ||
                    window.location.hostname.match(/^10\.\d+\.\d+\.\d+$/);
  return (isLocalhost || isLocalIP) ? 'http://localhost:3001' : '';
};

export default function MapViewWrapper({
  children,
  isOpen,
  onClose,
  onToggle,
  detectedLocation,
  className = ''
}) {
  const { state, actions } = useMap();
  const [mapStyle, setMapStyle] = useState('standard');
  const [showTraffic, setShowTraffic] = useState(false);
  const [showTrafficCams, setShowTrafficCams] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [currentLocationMarker, setCurrentLocationMarker] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [mapCenter, setMapCenter] = useState([-98.5795, 39.8283]);
  const [mapZoom, setMapZoom] = useState(4);
  const hasFetchedPlacesRef = useRef(false);
  const lastLocationRef = useRef(null);

  // Map search bar (Google-Maps-style place search)
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const [showMapSearchResults, setShowMapSearchResults] = useState(false);

  // Update map center when location is detected
  useEffect(() => {
    if (detectedLocation?.coordinates) {
      const { lat, lng } = detectedLocation.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      setMapCenter([lng, lat]);
      setMapZoom(15);
      setUserLocation({ lat, lng });
      actions.flyTo({ lat, lng }, 15);

      // For a named place/business, drop a marker and pop its contact card open.
      if (detectedLocation.type === 'place' || detectedLocation.type === 'location') {
        const marker = {
          id: `search-result-${lat}-${lng}`,
          lat,
          lng,
          name: detectedLocation.locationName || detectedLocation.query,
          address: detectedLocation.address,
          category: 'SEARCH_RESULT',
        };
        actions.addMarker(marker);
        actions.setSelectedMarker(marker);
      }
    }
  }, [detectedLocation]); // actions.flyTo is stable, no need to include in deps

  // Try to get user's current location
  useEffect(() => {
    if (isOpen && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          // Only update map if no detected location
          if (!detectedLocation) {
            setMapCenter([location.lng, location.lat]);
            // Match the zoom level used by the explicit "allow location" flow
            // (SearchPortal) so the two redundant geolocation requests converge
            // on the same end state instead of fighting over the zoom level.
            setMapZoom(15);
            actions.flyTo(location, 15);
            actions.addMarker({
              id: 'current-location',
              lat: location.lat,
              lng: location.lng,
              name: 'Your Location',
              category: 'CURRENT_LOCATION',
              address: 'Current Location',
            });
          }
        },
        (error) => {
          console.log('Geolocation error:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, [isOpen, detectedLocation, userLocation]); // actions.flyTo is stable, no need to include in deps

  // Fetch nearby businesses and travel destinations when location is available
  useEffect(() => {
    const fetchNearbyPlaces = async (location) => {
      try {
        // Fetch real local businesses with enriched data (ratings, hours, etc.)
        const response = await fetch(`${getBackendUrl()}/api/maps/local-businesses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { lat: location.lat, lng: location.lng },
            radius: 5000, // 5km radius
            categories: ['restaurant', 'cafe', 'shop', 'gas_station', 
'hotel', 'grocery'], // Diverse local businesses
            limit: 25
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.businesses && data.data.businesses.length > 0) {
            // Clear existing markers before adding new ones
            actions.clearMarkers?.();
            
            // Add markers for nearby businesses with enriched data
            data.data.businesses.forEach((business) => {
              actions.addMarker({
                id: business.id || `business-${business.name}-${business.lat}`,
                lat: business.lat,
                lng: business.lng,
                name: business.name,
                address: business.address,
                category: business.category || 'BUSINESS',
                // Include enriched data
                rating: business.rating,
                reviewCount: business.reviewCount,
                priceRange: business.priceRange,
                isOpen: business.isOpen,
                hours: business.hours,
                phone: business.phone,
                email: business.email,
                website: business.website,
                distance: business.distance,
                formattedDistance: business.formattedDistance,
                sources: business.sources
              });
            });

            console.log(`✅ Loaded ${data.data.businesses.length} local businesses`);
          }
        }
      } catch (error) {
        console.error('Error fetching local businesses:', error);
      }
    };
                
    // Fetch when we have a location
    const location = userLocation || (detectedLocation?.coordinates ? {
      lat: detectedLocation.coordinates.lat,
      lng: detectedLocation.coordinates.lng
    } : null);
                
    if (!isOpen || !location) {
      return;
    }
                
    // Create a location key to track if location has changed
    const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;

    // Only fetch if we haven't fetched for this location yet
    if (lastLocationRef.current !== locationKey) {
      lastLocationRef.current = locationKey;
      hasFetchedPlacesRef.current = true;
      // fetchNearbyPlaces(location); // Disabled auto-open
    }
  }, [isOpen, userLocation, detectedLocation]);
      
  const toggleMapStyle = () => {
    const styles = ['standard', 'dark', 'light', 'satellite'];
    const currentIndex = styles.indexOf(mapStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    setMapStyle(nextStyle);
    actions.setMapStyle(nextStyle);
  };

  const toggleGlobeView = () => {
    setShowGlobe(prev => !prev);
    actions.toggleMapViewMode();
  };

  const toggleTraffic = () => {
    setShowTraffic(prev => !prev);
    actions.toggleTraffic();
  };
    
  const handleLocationGranted = (location) => {
    setUserLocation(location);
    setMapCenter([location.lng, location.lat]);   
    setMapZoom(13);
    actions.flyTo(location, 13);
      
    // Add current location marker
    setCurrentLocationMarker({
      id: 'current-location',
      lat: location.lat,
      lng: location.lng,
      name: 'Your Location',
      category: 'CURRENT_LOCATION'
    });

    actions.addMarker({
      id: 'current-location',
      lat: location.lat,
      lng: location.lng,
      name: 'Your Location',
      category: 'CURRENT_LOCATION',
      address: 'Current Location'
    });
  };
    
  const handleLocationDenied = (error) => {
    console.log('Location denied:', error);
  };  

  const handleRouteCalculated = (route) => {
    setRouteData(route);
    // You could draw the route on the map here
    console.log('Route calculated:', route);
  };
      
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Debounced place search for the map's own search bar
  useEffect(() => {
    if (!mapSearchQuery || mapSearchQuery.trim().length < 3) {
      setMapSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsMapSearching(true);
      try {
        const result = await MapApiService.geocode(mapSearchQuery);
        setMapSearchResults(result?.data || []);
      } catch (err) {
        console.error('Map search error:', err);
        setMapSearchResults([]);
      } finally {
        setIsMapSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [mapSearchQuery]);

  const handleMapSearchResultClick = (result) => {
    const lat = result.position?.lat;
    const lng = result.position?.lng ?? result.position?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    setMapCenter([lng, lat]);
    setMapZoom(15);
    actions.flyTo({ lat, lng }, 15);

    const marker = {
      id: `search-result-${lat}-${lng}`,
      lat,
      lng,
      name: result.address,
      address: result.address,
      category: 'SEARCH_RESULT',
    };
    actions.addMarker(marker);
    actions.setSelectedMarker(marker);

    setMapSearchQuery('');
    setMapSearchResults([]);
    setShowMapSearchResults(false);
  };

  const getViewModeTitle = (mode) => {
    switch (mode) {
      case 'standard':
        return 'Switch to Azimuthal View';
      case 'azimuthal_flat':
        return 'Switch to Globe View';
      case 'globe_3d':
        return 'Switch to Map View';
      default:
        return 'Switch View';
    }
  };

  const getViewModeIcon = (mode) => {
    switch (mode) {
      case 'standard':
        return <Target size={14} />;
      case 'azimuthal_flat':
        return <Globe size={14} />;
      case 'globe_3d':
        return <MapIcon size={14} />;
      default:
        return <Target size={14} />;
    }
  };

  const getViewModeLabel = (mode) => {
    switch (mode) {
      case 'standard':
        return 'Azimuthal';
      case 'azimuthal_flat':
        return 'Globe';
      case 'globe_3d':
        return 'Map';
      default:
        return 'View';
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`relative ${className}`}>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 600 }}
        exit={{ opacity: 0, height: 0 }}
        className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl bg-gradient-to-br from-neutral-900 to-neutral-800"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Top Ad Banner */}
        <AdBanner position="top" />

        {/* Map Container - Removed redundant header controls */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Google-Maps-style place search bar */}
          <div className="absolute top-3 left-3 right-3 z-[60] max-w-sm">
            <div className="flex items-center gap-2 bg-white rounded-full shadow-lg px-4 py-2.5">
              <SearchIcon size={16} className="text-gray-500 shrink-0" />
              <input
                type="text"
                value={mapSearchQuery}
                onChange={(e) => {
                  setMapSearchQuery(e.target.value);
                  setShowMapSearchResults(true);
                }}
                onFocus={() => setShowMapSearchResults(true)}
                placeholder="Search Truegle Maps"
                className="flex-1 text-sm text-gray-800 outline-none bg-transparent"
              />
            </div>
            {showMapSearchResults && (mapSearchResults.length > 0 || isMapSearching) && (
              <div className="mt-1 bg-white rounded-xl shadow-lg overflow-hidden">
                {isMapSearching && (
                  <div className="px-4 py-2 text-xs text-gray-500">Searching...</div>
                )}
                {mapSearchResults.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleMapSearchResultClick(result)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 border-t border-gray-100 first:border-t-0"
                  >
                    {result.address}
                  </button>
                ))}
              </div>
            )}
          </div>

          <TruegleMap
            provider="mapbox"
            style={mapStyle}
            center={mapCenter}
            zoom={mapZoom}
            showTraffic={showTraffic}
            onClose={handleClose}
          />
        </div>

        {/* Bottom Ad Banner */}
        <AdBanner position="bottom" isDismissible={true} />
                
        {/* Traffic Legend (when traffic is enabled) */}
        <AnimatePresence>
          {showTraffic && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-4 bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-700/50 p-3 shadow-lg"
            >
              <h4 className="text-xs font-semibold text-white mb-2">Traffic Conditions</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500 rounded"></div>
                  <span className="text-white/70">Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-yellow-500 rounded"></div>
                  <span className="text-white/70">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-orange-500 rounded"></div>
                  <span className="text-white/70">Heavy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-red-500 rounded"></div>
                  <span className="text-white/70">Severe</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>                                                   
  {/* Truegle Logo */}
        <div className="absolute bottom-4 right-4 z-10"> 
          <img
            src={truegleLogo}
            alt="Truegle"
            className="h-8 w-auto opacity-80 hover:opacity-100 
transition-opacity"
          />
        </div>
      </motion.div>   
                
      {/* Traffic Cameras Panel */}
      <AnimatePresence>
        {showTrafficCams && (
          <TrafficCameras
            userLocation={userLocation || (detectedLocation?.coordinates && 
{
              lat: detectedLocation.coordinates.lat,
              lng: detectedLocation.coordinates.lng
            })}
            isOpen={showTrafficCams}
            onClose={() => setShowTrafficCams(false)}
          />
        )}                                                                   
  </AnimatePresence>
        
      {/* Directions Panel */}
      <AnimatePresence>
        {showDirections && (
          <DirectionsPanel
            isOpen={showDirections}
            onClose={() => setShowDirections(false)}
            userLocation={userLocation}
            onRouteCalculated={handleRouteCalculated}
          />
        )}
      </AnimatePresence>
          
      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationGranted={handleLocationGranted}
        onLocationDenied={handleLocationDenied}
      />
        <LogoOverlay />                                                      
   </div>
  );
}
