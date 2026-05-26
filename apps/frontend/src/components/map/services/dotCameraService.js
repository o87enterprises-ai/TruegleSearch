/**
 * Traffic Camera Service - OpenTrafficCamMap Integration
 * Fetches public traffic cameras from OpenTrafficCamMap (no API keys required)
 * Source: https://github.com/opentrafficcam/map
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
 * Fetch all available traffic cameras with optional filters
 */
export async function fetchAllCameras(filters = {}) {
  try {
    console.log('📡 Fetching traffic cameras from OpenTrafficCamMap...');

    const queryParams = new URLSearchParams();
    if (filters.region) queryParams.append('region', filters.region);
    if (filters.country) queryParams.append('country', filters.country);
    if (filters.city) queryParams.append('city', filters.city);
    if (filters.hasVideo) queryParams.append('hasVideo', 'true');
    if (filters.hasImage) queryParams.append('hasImage', 'true');
    if (filters.limit) queryParams.append('limit', filters.limit);

    const url = `${BACKEND_URL}/api/maps/traffic-cameras?${queryParams.toString()}`;
    console.log('📍 Request URL:', url);

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
      throw new Error('Invalid response format from camera API');
    }

    console.log(`✅ Loaded ${result.data.length} traffic cameras`);
    console.log(`📊 Total available: ${result.pagination?.total || 'unknown'}`);
    console.log(`🕒 Last updated: ${result.lastUpdated || 'unknown'}`);

    return result.data;

  } catch (error) {
    console.error('❌ Error fetching traffic cameras:', error);
    return [];
  }
}

/**
 * Fetch cameras near a specific location
 * @param {Object} location - { lat, lng } coordinates
 * @param {number} maxDistance - Maximum distance in miles (default: 50)
 * @param {number} limit - Maximum number of cameras to return (default: 15)
 */
export async function fetchCamerasNearLocation(location, maxDistance = 50, limit = 15) {
  if (!location || !location.lat || !location.lng) {
    console.error('❌ Invalid location provided to fetchCamerasNearLocation');
    return [];
  }

  try {
    console.log(`📍 Fetching cameras near ${location.lat}, ${location.lng} (within ${maxDistance} mi)`);

    // Fetch all cameras (or with regional filter if we know the region)
    const cameras = await fetchAllCameras({ limit: 1000 });

    if (cameras.length === 0) {
      console.warn('⚠️ No cameras found');
      return [];
    }

    // Debug: Check first few cameras
    console.log(`🔍 DEBUG: First 5 cameras from API:`, cameras.slice(0, 5).map(cam => ({
      id: cam.id,
      name: cam.name,
      location: cam.location,
      hasLocation: !!(cam.location && cam.location.lat && cam.location.lng)
    })));

    // Calculate distances and filter by maxDistance
    const camerasWithLocation = cameras.filter(cam => cam.location && cam.location.lat && cam.location.lng);
    console.log(`📍 Cameras with valid location: ${camerasWithLocation.length} out of ${cameras.length}`);

    const camerasWithDistance = camerasWithLocation
      .map(cam => {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          cam.location.lat,
          cam.location.lng
        );

        return {
          ...cam,
          distance,
          formattedDistance: formatDistance(distance),
          // Transform to match expected format
          imageUrl: cam.urls?.image || null,
          streamUrl: cam.urls?.video || null,
          roadName: cam.metadata?.description || cam.name,
          city: cam.metadata?.city || cam.metadata?.region || 'Unknown',
          state: cam.metadata?.region || cam.metadata?.country || 'Unknown',
          isLive: cam.status === 'active',
          lastUpdated: cam.lastChecked || new Date().toISOString()
        };
      });

    // Debug: Show distance distribution
    if (camerasWithDistance.length > 0) {
      const sortedByDistance = [...camerasWithDistance].sort((a, b) => a.distance - b.distance);
      console.log(`🎯 Closest camera: ${sortedByDistance[0].name} at ${sortedByDistance[0].formattedDistance} (${sortedByDistance[0].distance.toFixed(1)} mi)`);
      console.log(`🎯 5 closest cameras:`, sortedByDistance.slice(0, 5).map(c => `${c.name} (${c.distance.toFixed(1)} mi)`));
    }

    const filteredCameras = camerasWithDistance
      .filter(cam => cam.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    console.log(`✅ Found ${filteredCameras.length} cameras within ${maxDistance} miles`);

    if (filteredCameras.length > 0) {
      console.log(`📷 Nearest camera: ${filteredCameras[0].name} at ${filteredCameras[0].formattedDistance}`);
    }

    return filteredCameras;

  } catch (error) {
    console.error('❌ Error fetching cameras near location:', error);
    return [];
  }
}

/**
 * Fetch cameras along a route
 * @param {Array} routeCoordinates - Array of { lat, lng } points along the route
 * @param {number} maxDistance - Maximum distance from route in meters (default: 5000)
 * @param {number} limit - Maximum number of cameras to return
 */
export async function fetchCamerasAlongRoute(routeCoordinates, maxDistance = 5000, limit = 10) {
  if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    console.error('❌ Invalid route coordinates provided');
    return [];
  }

  try {
    console.log(`📍 Fetching cameras along route (${routeCoordinates.length} points, within ${maxDistance}m)`);

    const response = await fetch(`${BACKEND_URL}/api/maps/traffic-cameras/near-route`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        routeCoordinates,
        maxDistance
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format from camera API');
    }

    console.log(`✅ Found ${result.data.length} cameras along route`);

    // Transform to match expected format and limit results
    const cameras = result.data
      .slice(0, limit)
      .map(cam => ({
        ...cam,
        distance: (cam.distanceFromRoute / 1609.34).toFixed(1), // Convert meters to miles
        formattedDistance: formatDistance(cam.distanceFromRoute / 1609.34),
        imageUrl: cam.urls?.image || null,
        streamUrl: cam.urls?.video || null,
        roadName: cam.metadata?.description || cam.name,
        city: cam.metadata?.city || cam.metadata?.region || 'Unknown',
        state: cam.metadata?.region || cam.metadata?.country || 'Unknown',
        isLive: cam.status === 'active',
        lastUpdated: cam.lastChecked || new Date().toISOString()
      }));

    return cameras;

  } catch (error) {
    console.error('❌ Error fetching cameras along route:', error);
    return [];
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use fetchCamerasNearLocation instead
 */
export async function fetchDOTCameras(stateCode, userLocation) {
  console.warn('⚠️ fetchDOTCameras is deprecated. Use fetchCamerasNearLocation instead.');

  if (!userLocation) {
    return [];
  }

  // Convert to new API
  return await fetchCamerasNearLocation(userLocation, 100, 15);
}

/**
 * Get state code from coordinates using reverse geocoding
 */
export async function getStateFromCoordinates(lat, lng) {
  if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.error('❌ Invalid coordinates for reverse geocoding:', { lat, lng });
    return null;
  }

  console.log('🔍 Getting state from coordinates:', { lat, lng });

  try {
    const response = await fetch(`${BACKEND_URL}/api/radar/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng })
    });

    console.log('📡 Reverse geocode response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('📦 Reverse geocode response data:', data);

      let address = null;

      // Try different response structures
      if (data.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
        address = data.addresses[0];
      } else if (data.address && typeof data.address === 'object') {
        address = data.address;
      } else if (data.data) {
        if (Array.isArray(data.data) && data.data.length > 0) {
          address = data.data[0];
        } else if (data.data.address) {
          address = data.data.address;
        } else if (data.data.addresses && Array.isArray(data.data.addresses) && data.data.addresses.length > 0) {
          address = data.data.addresses[0];
        } else {
          address = data.data;
        }
      }

      if (address) {
        const stateCode = address.stateCode || address.state || address.administrativeArea || address.region;
        console.log('🗺️ Extracted state code:', stateCode);

        if (stateCode) {
          return stateCode;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error getting state from coordinates:', error);
  }

  return null;
}

/**
 * Get camera statistics
 */
export async function getCameraStats() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/maps/traffic-cameras-stats`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error('Invalid response format from stats API');
    }

    console.log('📊 Camera statistics:', result.data);
    return result.data;

  } catch (error) {
    console.error('❌ Error fetching camera stats:', error);
    return null;
  }
}

export default {
  fetchAllCameras,
  fetchCamerasNearLocation,
  fetchCamerasAlongRoute,
  fetchDOTCameras, // Deprecated but kept for compatibility
  getStateFromCoordinates,
  getCameraStats
};
