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
import MapPopOutFrame from './MapPopOutFrame';
import { useMap } from './context/MapContext';
import { USER_LOCATION_ZOOM, GEOLOCATION_OPTIONS } from './config/constants';
import MapApiService from './services/mapApi';
import { useBottomDockClaim } from '../../hooks/useBottomDock';
// No logo here. TruegleMap — the only thing this mounts — draws the single
// Truegle watermark inside the map container. This file used to draw it twice
// more (an inline <img> in the card and a <LogoOverlay/> over the wrapper), so
// an open map carried THREE marks in one corner, in three different sizes and
// treatments. Same lesson as the four ad slots: the wrapper owns the chrome,
// the map owns what sits on the map.

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function MapViewWrapper({
  children,
  isOpen,
  onClose,
  onToggle,
  detectedLocation,
  // WHERE THE MAP STARTS, and where that choice is remembered.
  //
  // The search page opens the map in the results column; Chat has no results
  // column to open it in, so it starts floating. Each surface keeps its own
  // preference under its own key — sharing one meant popping the map out in
  // Chat also popped it out of the search results, which is not a preference
  // anybody expressed.
  defaultPoppedOut = false,
  popOutStorageKey = 'truegle_map_popped',
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
  // What the nearby lookup did, in the lookup's own words. Rendered on the
  // map — see TruegleMap's nearbyStatus. 'searching' | 'found' | 'empty' |
  // 'failed', with the reason when it failed.
  const [nearbyStatus, setNearbyStatus] = useState({ state: 'idle', query: '', reason: '' });
  // Popped out = floating over the page instead of sitting in the results
  // column, so the map is no longer a mode you are stuck in. Remembered,
  // because it is a preference about how you like to work, not a per-search
  // decision — same reasoning as the player's dock.
  const [poppedOut, setPoppedOut] = useState(() => {
    try {
      const stored = localStorage.getItem(popOutStorageKey);
      return stored === null ? defaultPoppedOut : stored === '1';
    } catch { return defaultPoppedOut; }
  });
  useEffect(() => {
    try { localStorage.setItem(popOutStorageKey, poppedOut ? '1' : '0'); } catch { /* private mode */ }
  }, [poppedOut, popOutStorageKey]);

  // Update map center when location is detected
  useEffect(() => {
    if (detectedLocation?.coordinates) {
      const { lat, lng } = detectedLocation.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      setMapCenter([lng, lat]);
      setMapZoom(USER_LOCATION_ZOOM);
      setUserLocation({ lat, lng });
      actions.flyTo({ lat, lng }, USER_LOCATION_ZOOM);

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

  // Try to get user's current location — but only when the map actually needs
  // it: manual open with no detected location (center on the user), "near me"
  // queries (permission already granted in the hook), or directions (origin).
  // Opening the map for a geocoded city/zip/place must NOT fire a browser
  // permission prompt — the map already has a center.
  useEffect(() => {
    const needsUserPosition =
      !detectedLocation ||
      detectedLocation.type === 'geolocation' ||
      detectedLocation.type === 'directions';
    if (isOpen && !userLocation && needsUserPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);

          // THE DOT IS DRAWN WHENEVER WE KNOW WHERE YOU ARE.
          //
          // It used to be inside the `if (!detectedLocation)` branch below,
          // together with the decision about where to centre the map. Those
          // are two different questions, and tying them together meant the
          // one journey that most needs the dot never got it: "coffee near
          // me" IS a detectedLocation, so the map centred on you, scattered
          // cafes around you, and marked everything on screen except you.
          // Nothing could then hover the dot for an address, and the Location
          // button had nothing to light up about.
          actions.addMarker({
            id: 'current-location',
            lat: location.lat,
            lng: location.lng,
            name: 'Your Location',
            category: 'CURRENT_LOCATION',
            address: 'Current Location',
          });

          // Where to LOOK, on the other hand, is only ours to decide when the
          // query did not already say.
          if (!detectedLocation) {
            setMapCenter([location.lng, location.lat]);
            // Match the zoom level used by the explicit "allow location" flow
            // (SearchPortal) so the two redundant geolocation requests converge
            // on the same end state instead of fighting over the zoom level.
            setMapZoom(USER_LOCATION_ZOOM);
            actions.flyTo(location, USER_LOCATION_ZOOM);
          }
        },
        (error) => {
          console.log('Geolocation error:', error.message);
        },
        GEOLOCATION_OPTIONS
      );
    }
  }, [isOpen, detectedLocation, userLocation]); // actions.flyTo is stable, no need to include in deps

  // Fetch nearby businesses and travel destinations when location is available
  useEffect(() => {
    const fetchNearbyPlaces = async (location, subject) => {
      try {
        // Fetch real local businesses with enriched data (ratings, hours, etc.)
        const response = await fetch(`${getBackendUrl()}/api/maps/local-businesses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { lat: location.lat, lng: location.lng },
            radius: 5000, // 5km radius
            // Only sweep broad categories when nothing specific was asked
            // for; otherwise the subject is the search.
            categories: subject ? [] : ['restaurant', 'cafe', 'shop', 'gas_station', 'hotel', 'grocery'],
            query: subject || undefined,
            limit: 25
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.businesses && data.data.businesses.length > 0) {
            // Additive, never clearMarkers(). Wiping the map first also wiped
            // the "Your Location" pin and whatever the user had just searched
            // for — the marker they were actually looking at vanished the
            // moment nearby places loaded. addMarker() already updates in
            // place on an id collision, so repeats cannot pile up.

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

            return true;
          }
        }
      } catch (error) {
        console.warn('Local business lookup unavailable:', error.message);
      }
      return false;
    };

    // The enriched endpoint above is Radar-only, and Radar is optional — with
    // Mapbox/TomTom keys and no Radar key it returns nothing at all, which is
    // why the map showed no local businesses. This is the same question asked
    // through the provider ladder: fewer fields, but it works with the keys
    // that actually exist, and with none at all via OpenStreetMap.
    const fetchNearbyFallback = async (location, subject) => {
      try {
        // WHAT THE USER ASKED FOR. This was hardcoded to
        // 'restaurant cafe shop', so "coffee near me" got your position, a
        // correct map — and a scatter of restaurants. The one word that made
        // the query a question was never used. An empty subject (the query was
        // just a place) falls back to a general sweep, which is the only case
        // the old constant was ever right for.
        const query = subject || 'restaurant cafe shop';
        const result = await MapApiService.searchPlaces(location, { query, radius: 5000, limit: 20 });
        setNearbyStatus({ state: (result?.data || []).length ? 'found' : 'empty', query, reason: '' });
        for (const place of result?.data || []) {
          actions.addMarker({
            id: `place-${place.position.lat.toFixed(5)}-${place.position.lng.toFixed(5)}`,
            lat: place.position.lat,
            lng: place.position.lng,
            name: place.name,
            address: place.address,
            category: 'BUSINESS',
          });
        }
        return (result?.data || []).length > 0;
      } catch (error) {
        // WHICH PROVIDER, AND WHY. The ladder attaches `failures` — one entry
        // per provider with its own message — and this used to drop all of it
        // into console.warn, where nobody on a phone can read it. An empty map
        // and a blocked map look identical, and only one of them is a bug you
        // can act on. Same lesson as the social feed.
        const detail = Array.isArray(error.failures) ? error.failures.join(' · ') : error.message;
        console.warn('Nearby places unavailable:', detail);
        setNearbyStatus({ state: 'failed', query: subject || '', reason: detail });
        return false;
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
      // Enriched first; the ladder if that endpoint has nothing to give. This
      // whole call was commented out with "Disabled auto-open", which is why
      // no local business ever appeared on the map — the reason it was
      // disabled (it cleared every existing marker) is fixed above rather
      // than worked around by not calling it.
      const subject = detectedLocation?.subject || '';
      setNearbyStatus({ state: 'searching', query: subject, reason: '' });
      fetchNearbyPlaces(location, subject).then((served) => {
        if (served) { setNearbyStatus({ state: 'found', query: subject, reason: '' }); return undefined; }
        return fetchNearbyFallback(location, subject);
      });
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
    setMapZoom(USER_LOCATION_ZOOM);
    actions.flyTo(location, USER_LOCATION_ZOOM);
      
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

  // An open map carries its own bottom furniture — the function bar, the
  // attribution line, and the mini player transport above them. Stacking the
  // early-access feedback bar under all of that leaves the map's own controls
  // pressed up against the page edge, so while the map is on screen the bar
  // yields its strip and comes back when the map closes.
  useBottomDockClaim(isOpen);

  if (!isOpen) return null;

  // ONE map, two homes. The same element is rendered either in the results
  // column or inside the floating frame — not two copies with their own state,
  // which is how the player's three presentations stay one player.
  const theMap = (
    // Place search bar lives inside TruegleMap so it stays visible in native
    // fullscreen (mobile always fullscreens the map).
    <TruegleMap
      style={mapStyle}
      center={mapCenter}
      zoom={mapZoom}
      showTraffic={showTraffic}
      userLocation={userLocation}
      onClose={handleClose}
      poppedOut={poppedOut}
      onTogglePopOut={() => setPoppedOut((v) => !v)}
      nearbyStatus={nearbyStatus}
    />
  );

  if (poppedOut) {
    return (
      <>
        <MapPopOutFrame
          title={detectedLocation?.locationName || detectedLocation?.query || 'Map'}
          onDock={() => setPoppedOut(false)}
          onClose={handleClose}
        >
          {/* No ad banners in the floating frame. The window is 420x340 by
              default and two banners would leave barely any map — the policy
              permits ads here (it is not the landing page), it does not
              require them to crowd out the thing being advertised around. */}
          {theMap}
        </MapPopOutFrame>
        <LocationPermissionModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onLocationGranted={handleLocationGranted}
          onLocationDenied={handleLocationDenied}
        />
      </>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <motion.div
        // FADE, NOT HEIGHT. The card used to animate height 0 -> 600, and an
        // animated height is a value the renderer inside it has to chase: the
        // map measures its container on a debounced ResizeObserver, so a run
        // that interrupted or re-started that animation could leave the card —
        // and the canvas — settled at some fraction of 600. It was seen at
        // 98px and at 63px, which is a map that has technically loaded and
        // shows nobody anything.
        //
        // The height is fixed now and only the opacity animates. The reveal
        // reads the same, and there is no moving target for the map to
        // measure against.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-2xl bg-gradient-to-br from-neutral-900 to-neutral-800"
        style={{ display: 'flex', flexDirection: 'column', height: 600 }}
      >
        {/* Top Ad Banner */}
        <AdBanner position="top" />

        {/* Map Container - Removed redundant header controls */}
        <div style={{ flex: 1, position: 'relative' }}>
          {theMap}
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
    </div>
  );
}
