/**
 * Enhanced Traffic Camera Service
 *
 * Provides unified access to multiple traffic camera data sources:
 * 1. Multi-State Database (WA, IA, etc.) - 1500+ cameras
 * 2. OpenTrafficCamMap (GitHub) - USA cameras
 *
 * Features:
 * - Merged results from multiple sources
 * - Full-text search across all sources
 * - Geospatial queries (near location, along route)
 * - Client-side caching for performance
 * - Fallback and redundancy
 */

// Smart backend URL detection - works for both local and external (ngrok) access
const getBackendUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isLocalIP = window.location.hostname.match(/^192\.168\.\d+\.\d+$/) ||
                    window.location.hostname.match(/^10\.\d+\.\d+\.\d+$/);

  // Only use absolute URL for localhost, otherwise use relative (goes through Vite proxy)
  return (isLocalhost || isLocalIP) ? 'http://localhost:3001' : '';
};

const BACKEND_URL = getBackendUrl();

// Client-side cache
const cache = {
  multiStateCameras: null,
  openTrafficCameras: null,
  lastUpdate: null,
  CACHE_DURATION: 10 * 60 * 1000 // 10 minutes
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
function formatDistance(miles) {
  if (miles < 0.1) return 'nearby';
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Normalize camera data from different sources to unified format
 */
function normalizeCameraData(camera) {
  // Already normalized if it has all expected fields
  if (camera.imageUrl && camera.roadName && camera.city) {
    return camera;
  }

  return {
    id: camera.id,
    name: camera.name,
    location: camera.location || { lat: camera.latitude, lng: camera.longitude },
    imageUrl: camera.urls?.image || camera.image_url || null,
    streamUrl: camera.urls?.video || camera.video_url || null,
    roadName: camera.road || camera.metadata?.description || camera.name,
    direction: camera.direction || camera.metadata?.direction || 'N/A',
    city: camera.metadata?.city || camera.metadata?.region || camera.state || 'Unknown',
    state: camera.state || camera.metadata?.state || camera.metadata?.region || 'Unknown',
    isLive: camera.status === 'active' || camera.isActive || false,
    source: camera.source || 'Unknown',
    lastUpdated: camera.lastChecked || camera.lastUpdated || new Date().toISOString(),
    distance: camera.distance,
    formattedDistance: camera.formattedDistance || (camera.distance ? formatDistance(camera.distance) : null)
  };
}

/**
 * Fetch cameras from multi-state database
 */
export async function fetchMultiStateCameras(filters = {}) {
  try {
    console.log('📡 Fetching cameras from multi-state database...');

    const queryParams = new URLSearchParams();
    if (filters.state) queryParams.append('state', filters.state);
    if (filters.road) queryParams.append('road', filters.road);
    if (filters.type) queryParams.append('type', filters.type);
    if (filters.active !== undefined) queryParams.append('active', filters.active);
    if (filters.direction) queryParams.append('direction', filters.direction);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.offset) queryParams.append('offset', filters.offset);

    const url = `${BACKEND_URL}/api/maps/cameras/multi-state?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format from multi-state camera API');
    }

    console.log(`✅ Loaded ${result.data.length} cameras from multi-state database`);
    return result.data;

  } catch (error) {
    console.error('❌ Error fetching multi-state cameras:', error);
    return [];
  }
}

/**
 * Search cameras across all sources (full-text search)
 */
export async function searchCameras(searchQuery, limit = 100) {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  try {
    console.log(`🔍 Searching cameras for: "${searchQuery}"`);

    // Search both multi-state DB and OpenTrafficCam
    const [multiStateResults, openTrafficResults] = await Promise.allSettled([
      // Multi-state database search
      fetch(`${BACKEND_URL}/api/maps/cameras/multi-state/search`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: limit
        })
      }).then(r => r.ok ? r.json() : null),

      // OpenTrafficCam - get all and filter client-side
      fetch(`${BACKEND_URL}/api/maps/traffic-cameras?limit=1000`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }).then(r => r.ok ? r.json() : null)
    ]);

    const allCameras = [];

    // Add multi-state results
    if (multiStateResults.status === 'fulfilled' && multiStateResults.value?.success) {
      const cameras = multiStateResults.value.data.map(normalizeCameraData);
      allCameras.push(...cameras);
      console.log(`  ✅ Multi-State DB: ${cameras.length} cameras`);
    }

    // Add OpenTrafficCam results (filter by search query)
    if (openTrafficResults.status === 'fulfilled' && openTrafficResults.value?.success) {
      const query = searchQuery.toLowerCase();
      const filtered = openTrafficResults.value.data
        .filter(cam =>
          cam.name?.toLowerCase().includes(query) ||
          cam.metadata?.city?.toLowerCase().includes(query) ||
          cam.metadata?.region?.toLowerCase().includes(query) ||
          cam.metadata?.description?.toLowerCase().includes(query)
        )
        .slice(0, limit)
        .map(normalizeCameraData);

      allCameras.push(...filtered);
      console.log(`  ✅ OpenTrafficCam: ${filtered.length} cameras`);
    }

    // Remove duplicates (by ID) and limit
    const uniqueCameras = Array.from(
      new Map(allCameras.map(cam => [cam.id, cam])).values()
    ).slice(0, limit);

    console.log(`✅ Total: ${uniqueCameras.length} cameras matching "${searchQuery}"`);
    return uniqueCameras;

  } catch (error) {
    console.error('❌ Error searching cameras:', error);
    return [];
  }
}

/**
 * Get cameras near a location (combines multi-state DB + OpenTrafficCam)
 */
export async function getCamerasNearLocation(location, radiusMiles = 100, limit = 50) {
  if (!location || !location.lat || !location.lng) {
    console.error('❌ Invalid location provided');
    return [];
  }

  try {
    console.log(`📍 Fetching cameras near ${location.lat}, ${location.lng} (within ${radiusMiles} mi)`);

    // Query both sources in parallel
    const [multiStateResults, openTrafficResults] = await Promise.allSettled([
      // Multi-state database
      fetch(`${BACKEND_URL}/api/maps/cameras/multi-state/near/${location.lat}/${location.lng}?radius=${radiusMiles}&limit=${limit}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }).then(r => r.ok ? r.json() : null),

      // OpenTrafficCam - get all and calculate distance client-side
      fetch(`${BACKEND_URL}/api/maps/traffic-cameras?limit=2000`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }).then(r => r.ok ? r.json() : null)
    ]);

    const allCameras = [];

    // Add multi-state results
    if (multiStateResults.status === 'fulfilled' && multiStateResults.value?.success) {
      const cameras = multiStateResults.value.data.map(normalizeCameraData);
      allCameras.push(...cameras);
      console.log(`  ✅ Multi-State DB: ${cameras.length} cameras`);
    }

    // Add OpenTrafficCam results (filter by distance)
    if (openTrafficResults.status === 'fulfilled' && openTrafficResults.value?.success) {
      const nearby = openTrafficResults.value.data
        .map(cam => {
          const camLat = cam.location?.coordinates?.[1] || cam.latitude;
          const camLng = cam.location?.coordinates?.[0] || cam.longitude;
          const distance = calculateDistance(location.lat, location.lng, camLat, camLng);
          return {
            ...cam,
            distance,
            formattedDistance: formatDistance(distance)
          };
        })
        .filter(cam => cam.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit)
        .map(normalizeCameraData);

      allCameras.push(...nearby);
      console.log(`  ✅ OpenTrafficCam: ${nearby.length} cameras`);
    }

    // Remove duplicates and sort by distance
    const uniqueCameras = Array.from(
      new Map(allCameras.map(cam => [cam.id, cam])).values()
    ).sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, limit);

    console.log(`✅ Total: ${uniqueCameras.length} cameras within ${radiusMiles} miles`);

    return uniqueCameras;

  } catch (error) {
    console.error('❌ Error fetching cameras near location:', error);
    return [];
  }
}

/**
 * Get cameras along a route
 */
export async function getCamerasAlongRoute(routeCoordinates, maxDistanceMeters = 5000, limit = 10) {
  if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    console.error('❌ Invalid route coordinates');
    return [];
  }

  try {
    console.log(`🛣️ Fetching cameras along route (${routeCoordinates.length} points)`);

    const response = await fetch(`${BACKEND_URL}/api/maps/cameras/multi-state/near-route`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        routeCoordinates,
        maxDistance: maxDistanceMeters,
        limit
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }

    console.log(`✅ Found ${result.data.length} cameras along route`);

    return result.data.map(cam => ({
      ...normalizeCameraData(cam),
      distanceFromRoute: cam.distanceFromRoute,
      formattedDistanceFromRoute: formatDistance(cam.distanceFromRoute / 1609.34)
    }));

  } catch (error) {
    console.error('❌ Error fetching cameras along route:', error);
    return [];
  }
}

/**
 * Get camera by ID (checks all sources)
 */
export async function getCameraById(cameraId) {
  if (!cameraId) {
    return null;
  }

  try {
    // Try multi-state database first
    const response = await fetch(`${BACKEND_URL}/api/maps/cameras/multi-state/${cameraId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return normalizeCameraData(result.data);
      }
    }

    // Fallback to OpenTrafficCam if not found in multi-state
    const otcResponse = await fetch(`${BACKEND_URL}/api/maps/traffic-cameras/${cameraId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (otcResponse.ok) {
      const otcResult = await otcResponse.json();
      if (otcResult.success && otcResult.data) {
        return normalizeCameraData(otcResult.data);
      }
    }

    return null;

  } catch (error) {
    console.error('❌ Error fetching camera by ID:', error);
    return null;
  }
}

/**
 * Get camera statistics from all sources
 */
export async function getCameraStats() {
  try {
    const [multiStateStats, openTrafficStats] = await Promise.all([
      fetch(`${BACKEND_URL}/api/maps/cameras/multi-state-stats`).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/maps/traffic-cameras-stats`).then(r => r.json())
    ]);

    return {
      multiState: multiStateStats.success ? multiStateStats.data : null,
      openTraffic: openTrafficStats.success ? openTrafficStats.data : null,
      combined: {
        total: (multiStateStats.data?.total || 0) + (openTrafficStats.data?.total || 0),
        sources: ['MultiStateDatabase', 'OpenTrafficCamMap']
      }
    };

  } catch (error) {
    console.error('❌ Error fetching camera stats:', error);
    return null;
  }
}

/**
 * Get available states (combines multi-state DB + OpenTrafficCam)
 */
export async function getAvailableStates() {
  try {
    console.log('🔍 Fetching available states from all sources...');

    // Fetch from both sources in parallel
    const [multiStateResponse, openTrafficResponse] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/maps/cameras/multi-state-states`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }),
      fetch(`${BACKEND_URL}/api/maps/traffic-cameras-stats`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
    ]);

    const statesMap = new Map();

    // Add multi-state database states
    if (multiStateResponse.status === 'fulfilled' && multiStateResponse.value.ok) {
      const result = await multiStateResponse.value.json();
      if (result.success && result.data) {
        result.data.forEach(state => {
          statesMap.set(state.state, {
            state: state.state,
            count: state.count || state.camera_count || 0,
            source: 'multi-state'
          });
        });
        console.log(`  ✅ Multi-State DB: ${result.data.length} states`);
      }
    }

    // Add OpenTrafficCam states
    if (openTrafficResponse.status === 'fulfilled' && openTrafficResponse.value.ok) {
      const result = await openTrafficResponse.value.json();
      if (result.success && result.data && result.data.byRegion) {
        Object.entries(result.data.byRegion).forEach(([state, count]) => {
          if (statesMap.has(state)) {
            // Combine counts if state exists in both sources
            const existing = statesMap.get(state);
            existing.count += count;
            existing.source = 'combined';
          } else {
            statesMap.set(state, {
              state: state,
              count: count,
              source: 'opentraffic'
            });
          }
        });
        console.log(`  ✅ OpenTrafficCam: ${Object.keys(result.data.byRegion).length} states`);
      }
    }

    const states = Array.from(statesMap.values()).sort((a, b) => b.count - a.count);
    console.log(`✅ Total: ${states.length} states, ${states.reduce((sum, s) => sum + s.count, 0)} cameras`);

    return states;

  } catch (error) {
    console.error('❌ Error fetching available states:', error);
    return [];
  }
}

/**
 * Get cameras by state and road (for specific queries like "I-5 cameras in WA")
 */
export async function getCamerasByStateAndRoad(state, road, limit = 100) {
  return await fetchMultiStateCameras({
    state,
    road,
    active: true,
    limit
  });
}

// Export all functions
export default {
  fetchMultiStateCameras,
  searchCameras,
  getCamerasNearLocation,
  getCamerasAlongRoute,
  getCameraById,
  getCameraStats,
  getAvailableStates,
  getCamerasByStateAndRoad
};
