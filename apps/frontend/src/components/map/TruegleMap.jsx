import { useState, useEffect, useRef, useCallback } from 'react';
import { Map as MapboxMap, Marker, Popup, NavigationControl, ScaleControl } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import { X, Minimize2, Layers, Navigation, Camera, MapPin, Navigation as NavigationIcon, Globe, Map as MapIcon, Target, Plus, Minus, Maximize2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './context/MapContext';
import { getMarkerColor, formatAddress, generateMarkerId } from './utils/helpers';
import { MAP_STYLES, MAP_CONTROLS, MAP_VIEW_MODES, AZIMUTHAL_FLAT_CONFIG } from './config/constants';
import { defaultLogoConfig, getLogoPosition, getLogoSize } from './config/logoConfig';
import TrafficCameras from './TrafficCameras';
import DirectionsPanel from './DirectionsPanel';
import LocationPermissionModal from './LocationPermissionModal';
import Globe3D from './Globe3D';
import AzimuthalFlat from './AzimuthalFlat';
import WebGLErrorBoundary from '../ui/WebGLErrorBoundary';
import AdBanner from './AdBanner';
import EnhancedCameraSearch from './EnhancedCameraSearch';
import backgroundImage from '../../assets/images/Azimuthal-satellite-view.png';
import './styles/TruegleMap.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

export default function TruegleMap({
  provider = 'mapbox',
  style = 'standard',
  center = [-98.5795, 39.8283],
  zoom = 4,
  showTraffic = false,
  showRoutes = false,
  showEmergencies = false,
  onMapLoad = null,
  onMapClick = null,
  onMarkerClick = null,
  onClose = null,
  children,
  className = '',
}) {
  const { state, actions } = useMap();
  const mapRef = useRef(null);
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom,
  });
  const [mapStyle, setMapStyleLocal] = useState(MAP_STYLES[style] || MAP_STYLES.standard);
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMapStyle, setFullscreenMapStyle] = useState('standard');
  const [showTrafficFS, setShowTrafficFS] = useState(false);
  const [showCamerasFS, setShowCamerasFS] = useState(false);
  const [showEnhancedCameraSearch, setShowEnhancedCameraSearch] = useState(false);
  const [showDirectionsFS, setShowDirectionsFS] = useState(false);
  const [showLocationModalFS, setShowLocationModalFS] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showGlobe, setShowGlobe] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const styleMap = {
      standard: 'mapbox://styles/mapbox/streets-v12',
      dark: 'mapbox://styles/mapbox/dark-v11',
      light: 'mapbox://styles/mapbox/light-v11',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    };
    setMapStyleLocal(styleMap[style] || styleMap.standard);
  }, [style]);

  // Add traffic layer when showTraffic or showTrafficFS is true
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    // Get the underlying Mapbox GL JS map instance
    let map = mapRef.current;

    // If ref has getMap method, use it to get the actual map instance
    if (typeof map.getMap === 'function') {
      map = map.getMap();
    }

    if (!map || typeof map.getLayer !== 'function') return;

    const shouldShowTraffic = showTraffic || showTrafficFS;

    if (shouldShowTraffic) {
      // Add Mapbox traffic layer
      if (!map.getLayer('traffic')) {
        try {
          map.addLayer({
            id: 'traffic',
            type: 'line',
            source: {
              type: 'vector',
              url: 'mapbox://mapbox.mapbox-traffic-v1'
            },
            'source-layer': 'traffic',
            paint: {
              'line-width': 2,
              'line-color': [
                'case',
                ['==', ['get', 'congestion'], 'low'], '#00FF00',
                ['==', ['get', 'congestion'], 'moderate'], '#FFFF00',
                ['==', ['get', 'congestion'], 'heavy'], '#FF9900',
                ['==', ['get', 'congestion'], 'severe'], '#FF0000',
                '#888888'
              ]
            }
          });
        } catch (error) {
          console.error('Error adding traffic layer:', error);
        }
      }
    } else {
      // Remove traffic layer if it exists
      try {
        if (map.getLayer('traffic')) {
          map.removeLayer('traffic');
        }
        if (map.getSource('traffic')) {
          map.removeSource('traffic');
        }
      } catch (error) {
        console.error('Error removing traffic layer:', error);
      }
    }
  }, [showTraffic, showTrafficFS, mapLoaded]);

  useEffect(() => {
    if (state.center) {
      // Validate coordinates before updating viewState
      const lat = state.center.lat;
      const lng = state.center.lng;

      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        setViewState(prev => ({
          ...prev,
          longitude: lng,
          latitude: lat,
        }));
      } else {
        console.error('❌ Invalid center coordinates from state:', state.center);
        console.warn('⚠️ Ignoring invalid center update to prevent Mapbox errors');
      }
    }
  }, [state.center]);

  useEffect(() => {
    if (state.zoom !== undefined) {
      setViewState(prev => ({ ...prev, zoom: state.zoom }));
    }
  }, [state.zoom]);

  useEffect(() => {
    if (state.markers) {
      setMarkers(state.markers);
    }
  }, [state.markers]);

  // Detect mobile device and force fullscreen on phones only
  useEffect(() => {
    const checkMobile = () => {
      // Check if device is a phone (not tablet or desktop)
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /iphone|ipod|android.*mobile|windows phone|blackberry/i.test(userAgent);
      const isTablet = /ipad|android(?!.*mobile)|tablet|kindle/i.test(userAgent);
      const isPhone = isMobileDevice && !isTablet;

      // Additional check for screen size
      const isSmallScreen = window.innerWidth <= 768 && window.innerHeight <= 1024;

      const isPhoneDevice = isPhone || (isMobileDevice && isSmallScreen);
      setIsMobile(isPhoneDevice);

      // Force fullscreen on mobile phones
      if (isPhoneDevice && !isFullscreen) {
        setIsFullscreen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  useEffect(() => {
    const fullscreenElement = document.getElementById('truegle-map-container');
    if (isFullscreen && fullscreenElement) {
      if (fullscreenElement.requestFullscreen) {
        fullscreenElement.requestFullscreen();
      } else if (fullscreenElement.webkitRequestFullscreen) {
        fullscreenElement.webkitRequestFullscreen();
      } else if (fullscreenElement.msRequestFullscreen) {
        fullscreenElement.msRequestFullscreen();
      }
    }
    return () => {
      if (document.fullscreenElement && !isMobile) {
        document.exitFullscreen();
      }
    };
  }, [isFullscreen, isMobile]);

  const handleMapLoad = useCallback((evt) => {
    // In react-map-gl, the onLoad event gives us evt.target which is the map instance
    const map = evt.target || evt;
    setMapLoaded(true);
    actions.setIsLoaded(true);

    if (onMapLoad) {
      onMapLoad(map);
    }
  }, [actions, onMapLoad]);

  const handleZoom = useCallback((evt) => {
    const newZoom = evt.viewState.zoom;
    setViewState(prev => ({ ...prev, zoom: newZoom }));
    actions.setZoom(newZoom);

    // If zooming out to level 3 or below in standard mode, switch to azimuthal
    if (state.mapViewMode === MAP_VIEW_MODES.STANDARD && newZoom <= 3) {
      actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT);
      actions.setAzimuthalFlatCenter({ lat: evt.viewState.latitude, lng: evt.viewState.longitude });
      actions.setAzimuthalFlatZoom(2);
    }
  }, [actions, state.mapViewMode]);

  const handleMapClick = useCallback((e) => {
    // Always center and zoom to clicked location
    const clickedLocation = {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
    };

    // Center map on clicked location with zoom level 15
    setViewState(prev => ({
      ...prev,
      longitude: clickedLocation.lng,
      latitude: clickedLocation.lat,
      zoom: 15
    }));

    actions.flyTo(clickedLocation, 15);

    if (onMapClick) {
      onMapClick(clickedLocation);
    }

    if (selectedMarker) {
      setSelectedMarker(null);
      actions.setSelectedMarker(null);
    }
  }, [actions, onMapClick, selectedMarker]);

  const handleMarkerClick = useCallback((marker, e) => {
    e.originalEvent.stopPropagation();

    setSelectedMarker(marker);
    actions.setSelectedMarker(marker);

    // Center and zoom to the marker location
    setViewState(prev => ({
      ...prev,
      longitude: marker.lng,
      latitude: marker.lat,
      zoom: 15
    }));

    actions.flyTo({ lat: marker.lat, lng: marker.lng }, 15);

    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  }, [actions, onMarkerClick]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const minimizeFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else if (onClose) {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, exitFullscreen, onClose]);

  const toggleFullscreenMapStyle = useCallback(() => {
    const styles = ['standard', 'dark', 'light', 'satellite'];
    const currentIndex = styles.indexOf(fullscreenMapStyle);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    setFullscreenMapStyle(nextStyle);

    const styleMap = {
      standard: 'mapbox://styles/mapbox/streets-v12',
      dark: 'mapbox://styles/mapbox/dark-v11',
      light: 'mapbox://styles/mapbox/light-v11',
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    };
    setMapStyleLocal(styleMap[nextStyle]);
  }, [fullscreenMapStyle]);

  const toggleGlobeView = useCallback(() => {
    actions.toggleMapViewMode();
    setShowGlobe(prev => !prev);
  }, [actions]);

  const handleLocationGranted = useCallback((location) => {
    setUserLocation(location);
    setViewState(prev => ({
      ...prev,
      longitude: location.lng,
      latitude: location.lat,
      zoom: 15  // Increased zoom level for better focus
    }));

    // Add current location marker
    actions.addMarker({
      id: 'current-location',
      lat: location.lat,
      lng: location.lng,
      name: 'Your Location',
      category: 'CURRENT_LOCATION',
      address: 'Current Location'
    });

    // Ensure the map centers and zooms to the user's location
    actions.flyTo(location, 15);
  }, [actions]);

  const handleLocationDenied = useCallback((error) => {
    console.log('Location denied:', error);
  }, []);

  const handleRouteCalculated = useCallback((route) => {
    console.log('Route calculated:', route);
    // You could draw the route on the map here
  }, []);

  // Get user location for traffic cameras
  useEffect(() => {
    if (isFullscreen && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error.message);
        }
      );
    }
  }, [isFullscreen, userLocation]);

  const MarkerElement = ({ marker }) => {
    // Special rendering for current location
    if (marker.category === 'CURRENT_LOCATION') {
      return (
        <div
          className="current-location-marker"
          style={{
            transform: `translate(-50%, -50%)`,
          }}
        >
          {/* Pulsing outer ring */}
          <div
            style={{
              position: 'absolute',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.3)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
          {/* Middle ring */}
          <div
            style={{
              position: 'absolute',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.5)',
              border: '2px solid white',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
          {/* Inner dot */}
          <div
            style={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#3B82F6',
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
            }}
          />
        </div>
      );
    }

    const color = getMarkerColor(marker.category);

    return (
      <div
        className="truegle-marker"
        style={{
          color: color,
          transform: `translate(-50%, -100%)`,
        }}
        onClick={(e) => handleMarkerClick(marker, e)}
      >
        <svg
          width={32}
          height={32}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      </div>
    );
  };

  const handleZoomIn = useCallback(() => {
    setViewState(prev => {
      const newZoom = Math.min(prev.zoom + 1, MAP_CONTROLS.ZOOM.max);
      actions.setZoom(newZoom);
      return { ...prev, zoom: newZoom };
    });
  }, [actions]);

  const handleZoomOut = useCallback(() => {
    setViewState(prev => {
      const newZoom = Math.max(prev.zoom - 1, MAP_CONTROLS.ZOOM.min);
      actions.setZoom(newZoom);
      return { ...prev, zoom: newZoom };
    });
  }, [actions]);

  return (
    <div
      id="truegle-map-container"
      className={`truegle-map-container ${className}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Top Ad Banner */}
      <AdBanner position="top" />

      {/* Map Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {state.mapViewMode === MAP_VIEW_MODES.STANDARD ? (
        <MapboxMap
          ref={mapRef}
          {...viewState}
          onMove={handleZoom}
          mapStyle={mapStyle}
          mapboxAccessToken={mapboxgl.accessToken}
          style={{ width: '100%', height: '100%' }}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
          attributionControl={true}
          navigationControl={false}
          scaleControl={false}
        >
        <NavigationControl
          position="bottom-right"
          showCompass={true}
          showZoom={true}
        />
        <ScaleControl
          position="bottom-right"
          maxWidth={200}
          unit="imperial"
        />

        {markers.map(marker => (
          <Marker
            key={marker.id}
            longitude={marker.lng}
            latitude={marker.lat}
            anchor="bottom"
          >
            <MarkerElement marker={marker} />
          </Marker>
        ))}

        {selectedMarker && (
          <Popup
            longitude={selectedMarker.lng}
            latitude={selectedMarker.lat}
            onClose={() => {
              setSelectedMarker(null);
              actions.setSelectedMarker(null);
            }}
            closeOnClick={false}
            anchor="top"
            maxWidth="300px"
            className="truegle-popup"
          >
            <div className="truegle-popup">
              <div className="name">{selectedMarker.name}</div>
              <div className="address">{formatAddress(selectedMarker.address)}</div>
              {selectedMarker.category && (
                <div className="category">{selectedMarker.category}</div>
              )}
              <div className="actions">
                <button
                  className="truegle-popup-action primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${selectedMarker.lat},${selectedMarker.lng}`,
                      '_blank'
                    );
                  }}
                >
                  Get Directions
                </button>
                <button
                  className="truegle-popup-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.flyTo(
                      { lat: selectedMarker.lat, lng: selectedMarker.lng },
                      15
                    );
                  }}
                >
                  Zoom
                </button>
              </div>
            </div>
          </Popup>
        )}

        {children}
      </MapboxMap>
      ) : state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D ? (
        <WebGLErrorBoundary componentName="Globe3D" fallback={<p className="text-white text-center p-4">3D Globe requires WebGL. Switching to standard map.</p>}>
          <Globe3D
            center={state.center || { lat: center[1], lng: center[0] }}
            zoom={viewState.zoom}
            onMapClick={onMapClick}
            onMarkerClick={onMarkerClick}
            showTraffic={showTraffic || showTrafficFS}
            markers={markers}
            routes={state.routes}
          />
        </WebGLErrorBoundary>
      ) : state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT ? (
        <WebGLErrorBoundary componentName="AzimuthalFlat" fallback={<p className="text-white text-center p-4">Azimuthal view requires WebGL. Switching to standard map.</p>}>
          <AzimuthalFlat
            center={state.center || { lat: center[1], lng: center[0] }}
            zoom={viewState.zoom}
            onMapClick={onMapClick}
            onMarkerClick={onMarkerClick}
            showTraffic={showTraffic || showTrafficFS}
            markers={markers}
            routes={state.routes}
            backgroundImage={backgroundImage}
            showGraticule={AZIMUTHAL_FLAT_CONFIG.showGraticule}
            userLocation={userLocation}
          />
        </WebGLErrorBoundary>
      ) : null}

      {/* Non-Fullscreen Controls */}
      {!isFullscreen && (
        <>
          {/* Traditional Map Controls - Top Left */}
          <div className="truegle-traditional-controls">
            {/* Zoom In Button */}
            <button
              className="truegle-control-btn truegle-control-zoom-in"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <Plus size={18} />
            </button>

            {/* Zoom Out Button */}
            <button
              className="truegle-control-btn truegle-control-zoom-out"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <Minus size={18} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              className="truegle-control-btn truegle-control-fullscreen"
              onClick={toggleFullscreen}
              title="Enter Fullscreen"
            >
              <Maximize2 size={18} />
            </button>
          </div>

          {/* Function Bar - Top Center (Non-Fullscreen) */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
            <div className="bg-gradient-to-r from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl rounded-xl border border-neutral-700/50 shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-2">
                {/* View Mode Selector */}
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.STANDARD
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.STANDARD)}
                  title="Standard Map View"
                >
                  <MapIcon size={14} />
                  <span className="hidden sm:inline">Map</span>
                </button>
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT)}
                  title="Azimuthal Flat View"
                >
                  <Target size={14} />
                  <span className="hidden sm:inline">Azimuthal</span>
                </button>
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.GLOBE_3D)}
                  title="3D Globe View"
                >
                  <Globe size={14} />
                  <span className="hidden sm:inline">Globe</span>
                </button>

                <div className="w-px h-6 bg-neutral-700 mx-1"></div>

                {/* Map Style Toggle */}
                <button
                  onClick={toggleFullscreenMapStyle}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    fullscreenMapStyle === 'satellite'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title={fullscreenMapStyle === 'satellite' ? 'Satellite View' : 'Street View'}
                >
                  <Layers size={14} />
                  <span className="hidden md:inline">{fullscreenMapStyle === 'satellite' ? 'Satellite' : 'Street'}</span>
                </button>

                {/* Traffic Toggle */}
                <button
                  onClick={() => setShowTrafficFS(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showTrafficFS
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Toggle Traffic"
                >
                  <Navigation size={14} />
                  <span className="hidden md:inline">Traffic</span>
                </button>

                {/* Cameras Toggle */}
                <button
                  onClick={() => setShowCamerasFS(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showCamerasFS
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Traffic Cameras"
                >
                  <Camera size={14} />
                  <span className="hidden lg:inline">Cameras</span>
                </button>

                {/* Search Cameras Toggle */}
                <button
                  onClick={() => setShowEnhancedCameraSearch(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showEnhancedCameraSearch
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Search Cameras"
                >
                  <Search size={14} />
                  <span className="hidden lg:inline">Search</span>
                </button>

                {/* Directions Toggle */}
                <button
                  onClick={() => setShowDirectionsFS(prev => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    showDirectionsFS
                      ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                  title="Directions"
                >
                  <NavigationIcon size={14} />
                  <span className="hidden lg:inline">Directions</span>
                </button>

                {/* My Location */}
                <button
                  onClick={() => setShowLocationModalFS(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-blue-400"
                  title="My Location"
                >
                  <MapPin size={14} />
                  <span className="hidden lg:inline">Location</span>
                </button>

                {/* Close Map */}
                {onClose && (
                  <>
                    <div className="w-px h-6 bg-neutral-700 mx-1"></div>
                    <button
                      onClick={onClose}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-neutral-800 text-red-400 hover:bg-red-600 hover:text-white"
                      title="Close Map"
                    >
                      <X size={14} />
                      <span className="hidden sm:inline">Close</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unified Top Bar - Fullscreen Mode */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-50"
          >
            <div className="bg-gradient-to-r from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl border-b border-neutral-700/50 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3">
                {/* Left: macOS Window Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={exitFullscreen}
                    className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors group relative"
                    title="Close"
                  >
                    <X size={8} className="absolute inset-0 m-auto text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={minimizeFullscreen}
                    className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors group relative"
                    title="Minimize"
                  >
                    <Minus size={8} className="absolute inset-0 m-auto text-yellow-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                    title="Fullscreen"
                  >
                  </button>
                </div>

                {/* Center: View Mode Selector */}
                <div className="flex items-center gap-2">
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.STANDARD
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.STANDARD)}
                    title="Standard Map View"
                  >
                    <MapIcon size={14} />
                    <span className="hidden sm:inline">Map</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.AZIMUTHAL_FLAT
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.AZIMUTHAL_FLAT)}
                    title="Azimuthal Flat View"
                  >
                    <Target size={14} />
                    <span className="hidden sm:inline">Azimuthal</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.mapViewMode === MAP_VIEW_MODES.GLOBE_3D
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    onClick={() => actions.setMapViewMode(MAP_VIEW_MODES.GLOBE_3D)}
                    title="3D Globe View"
                  >
                    <Globe size={14} />
                    <span className="hidden sm:inline">Globe</span>
                  </button>

                  <div className="w-px h-6 bg-neutral-700 mx-1"></div>

                  {/* Map Style Toggle */}
                  <button
                    onClick={toggleFullscreenMapStyle}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      fullscreenMapStyle === 'satellite'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title={fullscreenMapStyle === 'satellite' ? 'Satellite View' : 'Street View'}
                  >
                    <Layers size={14} />
                    <span className="hidden md:inline">{fullscreenMapStyle === 'satellite' ? 'Satellite' : 'Street'}</span>
                  </button>

                  {/* Traffic Toggle */}
                  <button
                    onClick={() => setShowTrafficFS(prev => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showTrafficFS
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Toggle Traffic"
                  >
                    <Navigation size={14} />
                    <span className="hidden md:inline">Traffic</span>
                  </button>

                  {/* Cameras Toggle */}
                  <button
                    onClick={() => setShowCamerasFS(prev => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showCamerasFS
                        ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Traffic Cameras"
                  >
                    <Camera size={14} />
                    <span className="hidden lg:inline">Cameras</span>
                  </button>

                  {/* Search Cameras Toggle */}
                  <button
                    onClick={() => setShowEnhancedCameraSearch(prev => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showEnhancedCameraSearch
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Search Cameras"
                  >
                    <Search size={14} />
                    <span className="hidden lg:inline">Search</span>
                  </button>

                  {/* Directions Toggle */}
                  <button
                    onClick={() => setShowDirectionsFS(prev => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      showDirectionsFS
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                    }`}
                    title="Directions"
                  >
                    <NavigationIcon size={14} />
                    <span className="hidden lg:inline">Directions</span>
                  </button>

                  {/* My Location */}
                  <button
                    onClick={() => setShowLocationModalFS(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-blue-400"
                    title="My Location"
                  >
                    <MapPin size={14} />
                    <span className="hidden lg:inline">Location</span>
                  </button>
                </div>

                {/* Right: Status Info */}
                <div className="flex items-center gap-2 text-xs text-cyan-400">
                  <span className="hidden md:inline">
                    {fullscreenMapStyle === 'satellite' ? 'Satellite' : fullscreenMapStyle.charAt(0).toUpperCase() + fullscreenMapStyle.slice(1)}
                    {showTrafficFS && ' • Traffic'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Traffic Legend (when traffic is enabled in fullscreen) */}
      <AnimatePresence>
        {isFullscreen && showTrafficFS && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-700/50 p-3 shadow-lg z-40"
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

      {/* Traffic Cameras Panel (Fullscreen) - Positioned below top bar */}
      <AnimatePresence>
        {isFullscreen && showCamerasFS && (
          <div className="absolute top-16 left-0 right-0 bottom-0 z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <TrafficCameras
                userLocation={userLocation}
                isOpen={showCamerasFS}
                onClose={() => setShowCamerasFS(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Enhanced Camera Search Modal - Positioned below top bar */}
      <AnimatePresence>
        {showEnhancedCameraSearch && (
          <div className="absolute top-16 left-0 right-0 bottom-0 z-40 pointer-events-none">
            <div className="pointer-events-auto">
              <EnhancedCameraSearch
                userLocation={userLocation}
                onCameraSelect={(camera) => {
                  // Add marker for the camera
                  actions.addMarker({
                    id: `camera-${camera.id}`,
                    lat: camera.location.lat,
                    lng: camera.location.lng,
                    name: camera.name,
                    category: 'CAMERA',
                    address: `${camera.roadName || ''} - ${camera.city}, ${camera.state}`
                  });

                  // Fly to camera location
                  actions.flyTo({ lat: camera.location.lat, lng: camera.location.lng }, 15);

                  // Close the search modal
                  setShowEnhancedCameraSearch(false);
                }}
                onClose={() => setShowEnhancedCameraSearch(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Directions Panel (Fullscreen) - Positioned below top bar */}
      <AnimatePresence>
        {isFullscreen && showDirectionsFS && (
          <div className="absolute top-16 left-0 right-0 bottom-0 z-30 pointer-events-none">
            <div className="pointer-events-auto">
              <DirectionsPanel
                isOpen={showDirectionsFS}
                onClose={() => setShowDirectionsFS(false)}
                userLocation={userLocation}
                onRouteCalculated={handleRouteCalculated}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Permission Modal (Fullscreen) */}
      <LocationPermissionModal
        isOpen={showLocationModalFS}
        onClose={() => setShowLocationModalFS(false)}
        onLocationGranted={handleLocationGranted}
        onLocationDenied={handleLocationDenied}
      />

      {/* Reset View Button - Bottom Right */}
      <button
        onClick={() => {
          setViewState({
            longitude: center[0],
            latitude: center[1],
            zoom: 4,
          });
          actions.flyTo({ lat: center[1], lng: center[0] }, 4);
        }}
        className="absolute bottom-24 right-4 z-40 bg-neutral-800/90 hover:bg-neutral-700/90 text-white rounded-lg px-3 py-2 text-sm font-medium transition-all border border-neutral-600/50 shadow-lg backdrop-blur-sm"
        title="Reset View"
      >
        Reset View
      </button>

      <img
        src={defaultLogoConfig.src}
        alt={defaultLogoConfig.alt}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '80px',
          ...getLogoPosition('bottomRight'),
          ...defaultLogoConfig.style,
        }}
        {...getLogoSize(defaultLogoConfig.size)}
      />
      </div>

      {/* Bottom Ad Banner */}
      <AdBanner position="bottom" />
    </div>
  );
}