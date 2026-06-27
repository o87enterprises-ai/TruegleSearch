import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { PROVIDERS, ROUTE_MODES, DEFAULT_CENTER, MAP_CONTROLS, MAP_VIEW_MODES, DEFAULT_MAP_VIEW_MODE } from '../config/constants';

const getBackendUrl = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const MapContext = createContext(null);

/**
 * Validate geographic coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} - Whether coordinates are valid
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within MapProvider');
  }
  return context;
};

export const MapProvider = ({ children, initialConfig = {} }) => {
  const [provider, setProvider] = useState(initialConfig.provider || PROVIDERS.MAPBOX);
  const [mapStyle, setMapStyle] = useState(initialConfig.mapStyle || 'standard');
  const [center, setCenter] = useState(initialConfig.center || DEFAULT_CENTER);
  const [zoom, setZoom] = useState(initialConfig.zoom || DEFAULT_CENTER.zoom);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markers, setMarkers] = useState(initialConfig.markers || []);
  const [routes, setRoutes] = useState(initialConfig.routes || []);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showTraffic, setShowTraffic] = useState(initialConfig.showTraffic || false);
  const [showEmergencies, setShowEmergencies] = useState(initialConfig.showEmergencies || false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLocationDetails, setSelectedLocationDetails] = useState(null);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [locationDetailsLoading, setLocationDetailsLoading] = useState(false);
  const [mapViewMode, setMapViewMode] = useState(initialConfig.mapViewMode || DEFAULT_MAP_VIEW_MODE);
  const [azimuthalRotation, setAzimuthalRotationState] = useState({ azimuth: 0, polar: 90 });
  const [azimuthalFlatCenter, setAzimuthalFlatCenter] = useState(initialConfig.azimuthalFlatCenter || { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
  const [azimuthalFlatZoom, setAzimuthalFlatZoom] = useState(initialConfig.azimuthalFlatZoom || 2);

  const state = useMemo(() => ({
    provider,
    mapStyle,
    center,
    zoom,
    isLoaded,
    isLoading,
    error,
    markers,
    routes,
    selectedMarker,
    selectedRoute,
    showTraffic,
    showEmergencies,
    isFullscreen,
    selectedLocationDetails,
    showLocationDetails,
    locationDetailsLoading,
    mapViewMode,
    azimuthalRotation,
    azimuthalFlatCenter,
    azimuthalFlatZoom,
  }), [
    provider,
    mapStyle,
    center,
    zoom,
    isLoaded,
    isLoading,
    error,
    markers,
    routes,
    selectedMarker,
    selectedRoute,
    showTraffic,
    showEmergencies,
    isFullscreen,
    selectedLocationDetails,
    showLocationDetails,
    locationDetailsLoading,
    mapViewMode,
    azimuthalRotation,
    azimuthalFlatCenter,
    azimuthalFlatZoom,
  ]);

  const actions = useMemo(() => ({
    setProvider,
    setMapStyle,
    setCenter,
    setZoom,
    setIsLoaded,
    setIsLoading,
    setError,
    setMarkers,
    setRoutes,
    setSelectedMarker,
    setSelectedRoute,
    setShowTraffic,
    setShowEmergencies,
    setIsFullscreen,
    setMapViewMode,
    setAzimuthalRotation: setAzimuthalRotationState,
    setAzimuthalFlatCenter,
    setAzimuthalFlatZoom,
  }), []);

  const flyTo = useCallback((newCenter, newZoom) => {
    // Validate coordinates before setting
    if (!newCenter || !isValidCoordinate(newCenter.lat, newCenter.lng)) {
      console.error('❌ Invalid coordinates for flyTo:', newCenter);
      console.warn('⚠️ Ignoring flyTo request with invalid coordinates');
      return;
    }

    console.log('✈️ Flying to:', newCenter, 'zoom:', newZoom);
    setCenter(newCenter);
    if (newZoom !== undefined && typeof newZoom === 'number' && !isNaN(newZoom)) {
      setZoom(newZoom);
    }
  }, []);

  const addMarker = useCallback((marker) => {
    // Validate marker coordinates before adding
    if (!marker || !isValidCoordinate(marker.lat, marker.lng)) {
      console.error('❌ Invalid coordinates for marker:', marker);
      console.warn('⚠️ Ignoring addMarker request with invalid coordinates');
      return;
    }

    setMarkers(prev => {
      // Check if marker with this ID already exists
      const existingIndex = prev.findIndex(m => m.id === marker.id);

      if (existingIndex >= 0) {
        // Update existing marker instead of adding duplicate
        const updated = [...prev];
        updated[existingIndex] = { ...prev[existingIndex], ...marker };
        console.log('📍 Updated existing marker:', marker.id);
        return updated;
      }

      // Add new marker
      console.log('📍 Added new marker:', marker.id, 'at', { lat: marker.lat, lng: marker.lng });
      return [...prev, marker];
    });
  }, []);

  const removeMarker = useCallback((markerId) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
  }, []);

  const updateMarker = useCallback((markerId, updates) => {
    setMarkers(prev => prev.map(m => 
      m.id === markerId ? { ...m, ...updates } : m
    ));
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
  }, []);

  const addRoute = useCallback((route) => {
    setRoutes(prev => [...prev, route]);
  }, []);

  const removeRoute = useCallback((routeId) => {
    setRoutes(prev => prev.filter(r => r.id !== routeId));
  }, []);

  const clearRoutes = useCallback(() => {
    setRoutes([]);
  }, []);

  const toggleTraffic = useCallback(() => {
    setShowTraffic(prev => !prev);
  }, []);

  const toggleEmergencies = useCallback(() => {
    setShowEmergencies(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const changeProvider = useCallback((newProvider) => {
    setIsLoading(true);
    setProvider(newProvider);
    setIsLoaded(false);
    setTimeout(() => {
      setIsLoading(false);
      setIsLoaded(true);
    }, 500);
  }, []);

  const resetMap = useCallback(() => {
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_CENTER.zoom);
    setMarkers([]);
    setRoutes([]);
    setSelectedMarker(null);
    setSelectedRoute(null);
    setShowTraffic(false);
    setShowEmergencies(false);
    setSelectedLocationDetails(null);
    setShowLocationDetails(false);
    setLocationDetailsLoading(false);
  }, []);

  const showLocationDetailsPanel = useCallback((marker) => {
    setSelectedLocationDetails(marker);
    setShowLocationDetails(true);
  }, []);

  const hideLocationDetailsPanel = useCallback(() => {
    setShowLocationDetails(false);
    setSelectedLocationDetails(null);
    setLocationDetailsLoading(false);
  }, []);

  const enrichLocationDetails = useCallback(async (location) => {
    setLocationDetailsLoading(true);

    try {
      const response = await fetch(`${getBackendUrl()}/api/maps/business-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: location.name,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
          category: location.category,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // Update the selected location with enriched data
        setSelectedLocationDetails(prev => ({
          ...prev,
          ...data.data,
        }));
      }
    } catch (error) {
      console.error('Failed to enrich location details:', error);
    } finally {
      setLocationDetailsLoading(false);
    }
  }, []);

  const toggleMapViewMode = useCallback(() => {
    setMapViewMode(prev => {
      switch (prev) {
        case MAP_VIEW_MODES.STANDARD:
          return MAP_VIEW_MODES.AZIMUTHAL_FLAT;
        case MAP_VIEW_MODES.AZIMUTHAL_FLAT:
          return MAP_VIEW_MODES.GLOBE_3D;
        case MAP_VIEW_MODES.GLOBE_3D:
        default:
          return MAP_VIEW_MODES.STANDARD;
      }
    });
  }, []);

  const updateAzimuthalRotation = useCallback((rotation) => {
    setAzimuthalRotationState(rotation);
  }, []);

  // Memoize the complete actions object to prevent unnecessary re-renders
  const completeActions = useMemo(() => ({
    ...actions,
    flyTo,
    addMarker,
    removeMarker,
    updateMarker,
    clearMarkers,
    addRoute,
    removeRoute,
    clearRoutes,
    toggleTraffic,
    toggleEmergencies,
    toggleFullscreen,
    changeProvider,
    resetMap,
    showLocationDetailsPanel,
    hideLocationDetailsPanel,
    enrichLocationDetails,
    toggleMapViewMode,
    setAzimuthalRotation: updateAzimuthalRotation,
    setAzimuthalFlatCenter,
    setAzimuthalFlatZoom,
  }), [
    actions,
    flyTo,
    addMarker,
    removeMarker,
    updateMarker,
    clearMarkers,
    addRoute,
    removeRoute,
    clearRoutes,
    toggleTraffic,
    toggleEmergencies,
    toggleFullscreen,
    changeProvider,
    resetMap,
    showLocationDetailsPanel,
    hideLocationDetailsPanel,
    enrichLocationDetails,
    toggleMapViewMode,
    updateAzimuthalRotation,
    setAzimuthalFlatCenter,
    setAzimuthalFlatZoom,
  ]);

  const contextValue = useMemo(() => ({
    state,
    actions: completeActions,
  }), [state, completeActions]);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};

export default MapContext;