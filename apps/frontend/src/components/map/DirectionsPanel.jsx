import { useState, useCallback, useEffect } from 'react';
import { Navigation, MapPin, X, ArrowRight, Clock, TrendingUp, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationAutocomplete from './LocationAutocomplete';
import { useMap } from './context/MapContext';
import { fetchCamerasAlongRoute } from './services/dotCameraService';
import MapApiService from './services/mapApi';
import { useLiveNavigation } from './hooks/useLiveNavigation';

// The panel's travel modes, in the vocabulary the routers use. OSRM profiles
// are driving/walking/cycling; sending it "car" routes nothing.
const PROFILE_BY_MODE = { car: 'driving', foot: 'walking', bike: 'cycling' };

/**
 * DirectionsPanel Component
 * Provides route planning and turn-by-turn directions with:
 * - Automatic satellite view
 * - Traffic layer enabled
 * - Traffic cameras along the route
 * - Camera markers on map
 */
export default function DirectionsPanel({ isOpen, onClose, userLocation, onRouteCalculated }) {
  const { state, actions } = useMap();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [travelMode, setTravelMode] = useState('car'); // car, foot, bike
  const [camerasAlongRoute, setCamerasAlongRoute] = useState([]);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [imageRefreshTimestamp, setImageRefreshTimestamp] = useState(Date.now());

  // Live GPS navigation over whatever route is currently on screen. A re-route
  // replaces the line in place, so the map and the panel stay in step without
  // the user having to press anything.
  const nav = useLiveNavigation({
    route,
    destination: destCoords || (route?.destCoords
      ? { lat: route.destCoords.latitude, lng: route.destCoords.longitude }
      : null),
    profile: PROFILE_BY_MODE[travelMode] || 'driving',
    onReroute: useCallback((fresh) => {
      setRoute((prev) => (prev ? { ...prev, ...fresh } : fresh));
      onRouteCalculated?.(fresh);
    }, [onRouteCalculated]),
  });

  // Set origin to user location when available
  useEffect(() => {
    if (userLocation && !origin) {
      setOrigin(`${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`);
    }
  }, [userLocation, origin]);

  // Periodically refresh camera screenshots every minute
  useEffect(() => {
    if (camerasAlongRoute.length > 0) {
      console.log('🔄 Starting periodic camera image refresh (every 60 seconds)');
      const intervalId = setInterval(() => {
        console.log('📸 Refreshing camera screenshots...');
        setImageRefreshTimestamp(Date.now());
      }, 60000); // Refresh every 60 seconds

      return () => {
        console.log('🛑 Stopping camera image refresh');
        clearInterval(intervalId);
      };
    }
  }, [camerasAlongRoute.length]);

  // Through the provider ladder, not straight at Radar.
  //
  // This panel used to fetch /api/radar/geocode and /api/radar/directions
  // directly, so directions worked only for an account with a Radar key — and
  // the keys this project actually holds are Mapbox and TomTom. Nothing
  // reported the mismatch; the panel just said "Failed to calculate route".
  // MapApiService tries Mapbox → Radar → TomTom → OSRM and normalises whatever
  // answers, so routing now works with the keys that exist and keeps working
  // with none at all.
  const geocodeAddress = async (address) => {
    const result = await MapApiService.geocode(address, { limit: 1 });
    const best = result?.data?.[0];
    if (!best?.position) throw new Error('Address not found');
    return { latitude: best.position.lat, longitude: best.position.lng };
  };

  /**
   * Find traffic cameras along the route using OpenTrafficCamMap
   */
  const findCamerasAlongRoute = useCallback(async (originCoords, destCoords, routeGeometry) => {
    setLoadingCameras(true);

    try {
      console.log('🎥 Finding cameras along route using OpenTrafficCamMap...');

      // Extract route coordinates from geometry
      // routeGeometry is typically an array of coordinate arrays: [[lng, lat], [lng, lat], ...]
      let routeCoordinates = [];

      if (routeGeometry && Array.isArray(routeGeometry)) {
        // Sample every 10th point to avoid too many points (max ~50 points)
        const sampleRate = Math.max(1, Math.floor(routeGeometry.length / 50));
        routeCoordinates = routeGeometry
          .filter((_, index) => index % sampleRate === 0)
          .map(coord => ({
            lat: coord[1] || coord.lat,
            lng: coord[0] || coord.lng || coord.lon
          }));

        // Always include start and end points
        const firstCoord = routeGeometry[0];
        const lastCoord = routeGeometry[routeGeometry.length - 1];

        routeCoordinates[0] = {
          lat: firstCoord[1] || firstCoord.lat,
          lng: firstCoord[0] || firstCoord.lng || firstCoord.lon
        };

        routeCoordinates.push({
          lat: lastCoord[1] || lastCoord.lat,
          lng: lastCoord[0] || lastCoord.lng || lastCoord.lon
        });
      } else {
        // Fallback: use origin and destination only
        routeCoordinates = [
          { lat: originCoords.latitude, lng: originCoords.longitude },
          { lat: destCoords.latitude, lng: destCoords.longitude }
        ];
      }

      console.log(`📍 Searching cameras near ${routeCoordinates.length} route points`);

      // Fetch cameras along route (within 5km, max 15 cameras)
      const cameras = await fetchCamerasAlongRoute(routeCoordinates, 5000, 15);

      if (cameras && cameras.length > 0) {
        console.log(`✅ Found ${cameras.length} cameras along route`);

        // Mark first 3 cameras as "featured" (start, middle, end)
        const featuredCameras = [];
        if (cameras.length > 0) featuredCameras.push({ ...cameras[0], featured: true, position: 'start' });
        if (cameras.length > 2) featuredCameras.push({ ...cameras[Math.floor(cameras.length / 2)], featured: true, position: 'middle' });
        if (cameras.length > 1) featuredCameras.push({ ...cameras[cameras.length - 1], featured: true, position: 'end' });

        // Rest are "other" cameras
        const otherCameras = cameras.filter(cam => !featuredCameras.find(fc => fc.id === cam.id));

        setCamerasAlongRoute([...featuredCameras, ...otherCameras]);

        // Add featured camera markers to the map
        featuredCameras.forEach(camera => {
          if (camera.location?.lat && camera.location?.lng) {
            actions.addMarker({
              id: `camera-${camera.id}`,
              lat: camera.location.lat,
              lng: camera.location.lng,
              name: camera.name,
              category: 'TRAFFIC_CAMERA',
              address: camera.roadName || camera.name,
              distance: camera.formattedDistance || camera.distance,
              imageUrl: camera.imageUrl,
              streamUrl: camera.streamUrl,
              cameraData: camera
            });
          }
        });

        console.log(`✅ Added ${featuredCameras.length} featured cameras and ${otherCameras.length} other cameras`);
      } else {
        console.log('⚠️ No cameras found along route');
        setCamerasAlongRoute([]);
      }
    } catch (error) {
      console.error('❌ Error finding cameras along route:', error);
      setCamerasAlongRoute([]);
    } finally {
      setLoadingCameras(false);
    }
  }, [actions]);

  const calculateRoute = useCallback(async () => {
    if (!origin || !destination) {
      setError('Please enter both origin and destination');
      return;
    }

    setLoading(true);
    setError(null);
    setCamerasAlongRoute([]);

    try {
      // Use stored coordinates if available, otherwise geocode
      let finalOriginCoords = originCoords;
      let finalDestCoords = destCoords;

      // Geocode origin if not already have coordinates
      if (!finalOriginCoords) {
        if (origin.includes(',')) {
          const [lat, lng] = origin.split(',').map(s => parseFloat(s.trim()));
          finalOriginCoords = { latitude: lat, longitude: lng };
        } else {
          finalOriginCoords = await geocodeAddress(origin);
        }
      }

      // Geocode destination if not already have coordinates
      if (!finalDestCoords) {
        if (destination.includes(',')) {
          const [lat, lng] = destination.split(',').map(s => parseFloat(s.trim()));
          finalDestCoords = { latitude: lat, longitude: lng };
        } else {
          finalDestCoords = await geocodeAddress(destination);
        }
      }

      // Whichever provider can answer. The service normalises to metres and
      // SECONDS, so the ×60 that used to live here — correct only for Radar,
      // and an hour-long lie for everyone else — is gone.
      const result = await MapApiService.getDirections(
        { lat: finalOriginCoords.latitude, lng: finalOriginCoords.longitude },
        { lat: finalDestCoords.latitude, lng: finalDestCoords.longitude },
        { mode: travelMode, profile: PROFILE_BY_MODE[travelMode] || 'driving', units: 'imperial' },
      );

      const routeData = result?.data;
      if (routeData?.geometry) {
        const calculatedRoute = {
          distance: routeData.distance,
          duration: routeData.duration,
          // Filter out steps that have no distance data (usually the last "arrived" step)
          steps: (routeData.steps || []).filter(step =>
            step.distance?.value !== undefined || step.distance !== undefined
          ),
          geometry: routeData.geometry,
          provider: result.provider,
          originCoords: finalOriginCoords,
          destCoords: finalDestCoords
        };

        setRoute(calculatedRoute);

        // ✅ AUTOMATICALLY ENABLE SATELLITE VIEW
        console.log('🛰️ Switching to satellite view for route');
        actions.setMapStyle('satellite');

        // ✅ AUTOMATICALLY ENABLE TRAFFIC LAYER
        console.log('🚦 Enabling traffic layer');
        actions.setShowTraffic(true);

        // ✅ FIND TRAFFIC CAMERAS ALONG ROUTE
        console.log('🎥 Searching for traffic cameras along route');
        findCamerasAlongRoute(finalOriginCoords, finalDestCoords, routeData.geometry.coordinates);

        // ✅ FLY TO ROUTE BOUNDS
        // Calculate center point between origin and destination
        const centerLat = (finalOriginCoords.latitude + finalDestCoords.latitude) / 2;
        const centerLng = (finalOriginCoords.longitude + finalDestCoords.longitude) / 2;

        // Calculate appropriate zoom level based on distance
        const distance = calculatedRoute.distance;
        let zoom = 12;
        if (distance > 100000) zoom = 8;  // > 100km
        else if (distance > 50000) zoom = 9;  // > 50km
        else if (distance > 20000) zoom = 10; // > 20km
        else if (distance > 10000) zoom = 11; // > 10km

        actions.flyTo({ lat: centerLat, lng: centerLng }, zoom);

        // Notify parent component with route data
        if (onRouteCalculated) {
          onRouteCalculated({
            ...routeData,
            originCoords: finalOriginCoords,
            destCoords: finalDestCoords
          });
        }
      } else {
        throw new Error('No route found');
      }
    } catch (err) {
      console.error('Error calculating route:', err);
      setError(err.message || 'Failed to calculate route');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, originCoords, destCoords, travelMode, onRouteCalculated, actions, findCamerasAlongRoute]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDistance = (meters) => {
    const miles = meters * 0.000621371;
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  };

  const handleSwapLocations = () => {
    const tempOrigin = origin;
    const tempCoords = originCoords;
    setOrigin(destination);
    setOriginCoords(destCoords);
    setDestination(tempOrigin);
    setDestCoords(tempCoords);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      className="fixed left-0 top-0 h-full w-96 bg-gradient-to-br from-neutral-900 to-neutral-800 shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700/50 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Navigation size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Directions</h2>
            <p className="text-xs text-blue-400">Get turn-by-turn navigation</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Close"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Input Form */}
      <div className="p-4 space-y-3 border-b border-neutral-700/50">
        {/* Origin Input with Autocomplete */}
        <LocationAutocomplete
          value={origin}
          onChange={setOrigin}
          onSelect={(location) => {
            setOrigin(location.name);
            setOriginCoords({ latitude: location.lat, longitude: location.lng });
          }}
          placeholder="Starting location..."
          icon={<div className="w-3 h-3 rounded-full bg-blue-500"></div>}
          userLocation={userLocation}
        />

        {/* Swap Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwapLocations}
            className="p-2 hover:bg-neutral-700/50 rounded-lg transition-colors"
            title="Swap locations"
          >
            <ArrowRight size={16} className="text-neutral-400 rotate-90" />
          </button>
        </div>

        {/* Destination Input with Autocomplete */}
        <LocationAutocomplete
          value={destination}
          onChange={setDestination}
          onSelect={(location) => {
            setDestination(location.name);
            setDestCoords({ latitude: location.lat, longitude: location.lng });
          }}
          placeholder="Choose destination..."
          icon={<MapPin size={16} className="text-red-500" />}
          userLocation={userLocation}
        />

        {/* Travel Mode */}
        <div className="flex gap-2">
          {[
            { id: 'car', label: 'Drive', icon: '🚗' },
            { id: 'foot', label: 'Walk', icon: '🚶' },
            { id: 'bike', label: 'Bike', icon: '🚴' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setTravelMode(mode.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                travelMode === mode.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700/50'
              }`}
            >
              <span className="mr-1">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateRoute}
          disabled={loading || !origin || !destination}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Calculating...
            </>
          ) : (
            <>
              <Navigation size={16} />
              Get Directions
            </>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Route Summary & Directions */}
      <div className="overflow-y-auto h-[calc(100%-400px)] p-4">
        {route ? (
          <div className="space-y-4">
            {/* Route Summary */}
            <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-4 border border-blue-500/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Route Summary</h3>
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <TrendingUp size={12} />
                  <span>Fastest route</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                    <Clock size={12} />
                    <span>Duration</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatDuration(route.duration)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-white/60 mb-1">
                    <MapPin size={12} />
                    <span>Distance</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatDistance(route.distance)}
                  </div>
                </div>
              </div>

              {/* Live navigation. The route above is a static line; this is the
                  part that follows you along it and notices when you leave. */}
              <button
                type="button"
                onClick={nav.active ? nav.stop : nav.start}
                className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  nav.active
                    ? 'bg-red-500/20 text-red-200 border border-red-500/40 hover:bg-red-500/30'
                    : 'bg-blue-500/25 text-blue-100 border border-blue-400/40 hover:bg-blue-500/35'
                }`}
              >
                <Navigation size={14} />
                {nav.active ? 'Stop navigation' : 'Start navigation'}
              </button>

              {nav.active && (
                <div className="mt-2 text-xs space-y-1">
                  {nav.arrived && <p className="text-emerald-300">You have arrived.</p>}
                  {nav.rerouting && <p className="text-amber-300">Off route — finding a new way…</p>}
                  {!nav.arrived && !nav.rerouting && nav.offRoute && <p className="text-amber-300">Off route.</p>}
                  {!nav.arrived && !nav.rerouting && !nav.offRoute && nav.position && (
                    <p className="text-white/50">
                      Following your position{nav.position.speed != null ? ` · ${Math.round(nav.position.speed * 2.237)} mph` : ''}
                    </p>
                  )}
                  {nav.error && <p className="text-red-300/80">{nav.error}</p>}
                  {/* Said plainly: this is the one part of the map that reads
                      the GPS continuously, and it stops when you stop it. */}
                  <p className="text-white/25">Your position stays on this device. Nothing is sent or stored.</p>
                </div>
              )}
            </div>

            {/* Traffic Cameras Along Route */}
            {(loadingCameras || camerasAlongRoute.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Camera size={16} className="text-cyan-400" />
                    Traffic Cameras
                  </h3>
                  {loadingCameras && (
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </div>

                {camerasAlongRoute.filter(cam => cam.featured).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-cyan-400 mb-2">Featured Cameras</p>
                    <div className="space-y-2">
                      {camerasAlongRoute.filter(cam => cam.featured).map((camera) => (
                        <div
                          key={camera.id}
                          className="p-3 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-lg hover:border-cyan-400/50 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <img
                                src={camera.imageUrl ? `${camera.imageUrl}${camera.imageUrl.includes('?') ? '&' : '?'}t=${imageRefreshTimestamp}` : camera.imageUrl}
                                alt={camera.name}
                                className="w-16 h-12 object-cover rounded cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (camera.streamUrl) {
                                    window.open(camera.streamUrl, '_blank');
                                  }
                                }}
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMWExYTJlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjMDBiY2RkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Q2FtPC90ZXh0Pjwvc3ZnPg==';
                                }}
                                title={camera.streamUrl ? 'Click to view live camera feed' : 'Camera feed unavailable'}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-white truncate">{camera.name}</p>
                                <span className="flex-shrink-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full capitalize">
                                  {camera.position}
                                </span>
                              </div>
                              <p className="text-xs text-white/60 truncate">{camera.roadName}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-cyan-400">
                                <span>{camera.distance} mi away</span>
                                {camera.streamUrl && <span>• Click image to view live</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {camerasAlongRoute.filter(cam => !cam.featured).length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-white/60 hover:text-white/80 mb-2 flex items-center gap-2">
                      <span>Other cameras nearby ({camerasAlongRoute.filter(cam => !cam.featured).length})</span>
                      <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="space-y-1">
                      {camerasAlongRoute.filter(cam => !cam.featured).map((camera) => (
                        <div
                          key={camera.id}
                          className="p-2 bg-neutral-800/30 rounded hover:bg-neutral-800/50 transition-colors cursor-pointer text-xs"
                          onClick={() => camera.streamUrl && window.open(camera.streamUrl, '_blank')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white truncate flex-1">{camera.name}</span>
                            <span className="text-white/60 ml-2">{camera.distance} mi</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Turn-by-Turn Directions */}
            {route.steps && route.steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Turn-by-turn Directions</h3>
                <div className="space-y-2">
                  {route.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 bg-neutral-800/30 rounded-lg hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-sm font-semibold text-blue-400">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white mb-1">
                          {step.instructions || step.instruction || step.maneuver?.instruction || 'Continue'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          {step.distance?.value !== undefined || step.distance !== undefined ? (
                            <span>{formatDistance(step.distance?.value || step.distance || 0)}</span>
                          ) : null}
                          {(step.duration?.value || step.duration) && (
                            <>
                              <span>•</span>
                              <span>{formatDuration((step.duration?.value || step.duration || 0) * 60)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Navigation size={48} className="text-neutral-600 mb-3" />
            <p className="text-white/60 text-sm">Enter origin and destination</p>
            <p className="text-white/40 text-xs mt-1">Get turn-by-turn directions</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
