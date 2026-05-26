import axios from 'axios';

// Smart backend URL detection - works for both local and external (ngrok) access
const getBackendUrl = () => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isLocalIP = window.location.hostname.match(/^192\.168\.\d+\.\d+$/) ||
                    window.location.hostname.match(/^10\.\d+\.\d+\.\d+$/);

  // Only use absolute URL for localhost, otherwise use relative (goes through Vite proxy)
  return (isLocalhost || isLocalIP) ? 'http://localhost:3001' : '';
};

const BACKEND_URL = getBackendUrl();

class MapApiService {
  constructor() {
    this.providers = ['mapbox', 'radar', 'tomtom', 'leaflet'];
    this.currentProvider = null;
    this.requestCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  setProvider(provider) {
    this.currentProvider = provider;
  }

  async geocode(query, options = {}) {
    const cacheKey = `geocode:${query}:${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const results = await this.tryProviders(
      async (provider) => this.geocodeWithProvider(provider, query, options),
      'geocode'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  async reverseGeocode(latitude, longitude, options = {}) {
    const cacheKey = `reverse:${latitude}:${longitude}:${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const results = await this.tryProviders(
      async (provider) => this.reverseGeocodeWithProvider(provider, latitude, longitude, options),
      'reverse-geocode'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  async getDirections(origin, destination, options = {}) {
    const cacheKey = `directions:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const results = await this.tryProviders(
      async (provider) => this.getDirectionsWithProvider(provider, origin, destination, options),
      'directions'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  async searchPlaces(near, options = {}) {
    const cacheKey = `places:${near.lat},${near.lng}:${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const results = await this.tryProviders(
      async (provider) => this.searchPlacesWithProvider(provider, near, options),
      'places'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  async getDistance(origin, destination, options = {}) {
    const cacheKey = `distance:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${JSON.stringify(options)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const results = await this.tryProviders(
      async (provider) => this.getDistanceWithProvider(provider, origin, destination, options),
      'distance'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Validate result based on operation type
   * @param {*} result - Result to validate
   * @param {string} operation - Type of operation (geocode, reverse-geocode, directions, etc.)
   * @returns {boolean} - Whether result is valid
   */
  isValidResult(result, operation) {
    if (!result) return false;

    switch (operation) {
      case 'geocode':
        // Valid if array with at least one item with position/coordinates
        if (Array.isArray(result) && result.length > 0) {
          const item = result[0];
          return !!(item.position || item.coordinates || (item.latitude && item.longitude));
        }
        return false;

      case 'reverse-geocode':
        // Valid if has address or formattedAddress
        return !!(result && (result.address || result.formattedAddress || result.addressLabel));

      case 'directions':
        // Valid if has routes or geometry
        return !!(result && (result.routes || result.geometry || result.distance));

      case 'places':
        // Valid if array with at least one result
        return Array.isArray(result) && result.length > 0;

      case 'distance':
        // Valid if has distance property
        return !!(result && (result.distance !== undefined || result.routes));

      default:
        // For unknown operations, just check if result exists
        return !!result;
    }
  }

  async tryProviders(asyncFn, operation = 'unknown') {
    const providers = this.currentProvider
      ? [this.currentProvider, ...this.providers.filter(p => p !== this.currentProvider)]
      : this.providers;

    // Always include OSM as fallback if not already in list
    const allProviders = [...providers];
    if (!allProviders.includes('leaflet')) {
      allProviders.push('leaflet');
    }

    let lastError = null;

    for (const provider of allProviders) {
      try {
        console.log(`🔍 Trying provider: ${provider} for ${operation}`);
        const result = await asyncFn(provider);

        // Validate result before returning
        if (this.isValidResult(result, operation)) {
          console.log(`✅ Provider ${provider} succeeded with valid result`);
          return { success: true, provider, data: result };
        } else {
          console.warn(`⚠️ Provider ${provider} returned invalid result for ${operation}`);
          throw new Error(`Invalid result structure from ${provider}`);
        }
      } catch (error) {
        console.warn(`❌ Provider ${provider} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    console.error(`🚫 All map providers failed for ${operation}. Last error:`, lastError);
    throw new Error(`All map providers failed for ${operation}: ${lastError?.message || 'Unknown error'}`);
  }

  async geocodeWithProvider(provider, query, options) {
    switch (provider) {
      case 'mapbox':
        return this.geocodeWithMapbox(query, options);
      case 'radar':
        return this.geocodeWithRadar(query, options);
      case 'tomtom':
        return this.geocodeWithTomTom(query, options);
      case 'leaflet':
        return this.geocodeWithOSM(query, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async reverseGeocodeWithProvider(provider, latitude, longitude, options) {
    switch (provider) {
      case 'mapbox':
        return this.reverseGeocodeWithMapbox(latitude, longitude, options);
      case 'radar':
        return this.reverseGeocodeWithRadar(latitude, longitude, options);
      case 'tomtom':
        return this.reverseGeocodeWithTomTom(latitude, longitude, options);
      case 'leaflet':
        return this.reverseGeocodeWithOSM(latitude, longitude, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async getDirectionsWithProvider(provider, origin, destination, options) {
    switch (provider) {
      case 'mapbox':
        return this.getDirectionsWithMapbox(origin, destination, options);
      case 'radar':
        return this.getDirectionsWithRadar(origin, destination, options);
      case 'tomtom':
        return this.getDirectionsWithTomTom(origin, destination, options);
      case 'leaflet':
        return this.getDirectionsWithOSM(origin, destination, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async searchPlacesWithProvider(provider, near, options) {
    switch (provider) {
      case 'mapbox':
        return this.searchPlacesWithMapbox(near, options);
      case 'radar':
        return this.searchPlacesWithRadar(near, options);
      case 'tomtom':
        return this.searchPlacesWithTomTom(near, options);
      case 'leaflet':
        return this.searchPlacesWithOSM(near, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async getDistanceWithProvider(provider, origin, destination, options) {
    switch (provider) {
      case 'mapbox':
        return this.getDistanceWithMapbox(origin, destination, options);
      case 'radar':
        return this.getDistanceWithRadar(origin, destination, options);
      case 'tomtom':
        return this.getDistanceWithTomTom(origin, destination, options);
      case 'leaflet':
        return this.getDistanceWithOSM(origin, destination, options);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async geocodeWithMapbox(query, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/geocode`,
      { query, options, provider: 'mapbox' }
    );
    return response.data;
  }

  async geocodeWithRadar(query, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/radar/geocode`,
      { query, options }
    );
    return response.data;
  }

  async geocodeWithTomTom(query, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/geocode`,
      { query, options, provider: 'tomtom' }
    );
    return response.data;
  }

  async geocodeWithOSM(query, options) {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: options.limit || 10,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'Truegle/1.0',
      },
    });
    
    return response.data.map(result => ({
      address: result.display_name,
      position: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
      type: result.type,
    }));
  }

  async reverseGeocodeWithMapbox(latitude, longitude, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/reverse-geocode`,
      { latitude, longitude, options, provider: 'mapbox' }
    );
    return response.data;
  }

  async reverseGeocodeWithRadar(latitude, longitude, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/radar/reverse-geocode`,
      { latitude, longitude, options }
    );
    return response.data;
  }

  async reverseGeocodeWithTomTom(latitude, longitude, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/reverse-geocode`,
      { latitude, longitude, options, provider: 'tomtom' }
    );
    return response.data;
  }

  async reverseGeocodeWithOSM(latitude, longitude, options) {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'Truegle/1.0',
      },
    });
    
    return {
      address: response.data.display_name,
      position: {
        lat: parseFloat(response.data.lat),
        lng: parseFloat(response.data.lon),
      },
      type: response.data.type,
    };
  }

  async getDirectionsWithMapbox(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/directions`,
      { origin, destination, options, provider: 'mapbox' }
    );
    return response.data;
  }

  async getDirectionsWithRadar(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/radar/directions`,
      { origin, destination, options }
    );
    return response.data;
  }

  async getDirectionsWithTomTom(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/directions`,
      { origin, destination, options, provider: 'tomtom' }
    );
    return response.data;
  }

  async getDirectionsWithOSM(origin, destination, options) {
    const response = await axios.get('https://router.project-osrm.org/route/v1/driving', {
      params: {
        start: `${origin.lng},${origin.lat}`,
        end: `${destination.lng},${destination.lat}`,
        overview: 'full',
        geometries: 'geojson',
      },
    });
    
    if (response.data.code !== 'Ok') {
      throw new Error(response.data.message || 'OSRM routing failed');
    }
    
    const route = response.data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  }

  async searchPlacesWithMapbox(near, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/places`,
      { near, options, provider: 'mapbox' }
    );
    return response.data;
  }

  async searchPlacesWithRadar(near, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/radar/search-places`,
      { near, options }
    );
    return response.data;
  }

  async searchPlacesWithTomTom(near, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/places`,
      { near, options, provider: 'tomtom' }
    );
    return response.data;
  }

  async searchPlacesWithOSM(near, options) {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: options.query || 'amenity',
        lat: near.lat,
        lon: near.lng,
        radius: options.radius || 1000,
        format: 'json',
        limit: options.limit || 10,
      },
      headers: {
        'User-Agent': 'Truegle/1.0',
      },
    });
    
    return response.data.map(result => ({
      name: result.display_name.split(',')[0],
      address: result.display_name,
      position: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      },
      type: result.type,
    }));
  }

  async getDistanceWithMapbox(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/distance`,
      { origin, destination, options, provider: 'mapbox' }
    );
    return response.data;
  }

  async getDistanceWithRadar(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/radar/distance`,
      { origin, destination, options }
    );
    return response.data;
  }

  async getDistanceWithTomTom(origin, destination, options) {
    const response = await axios.post(
      `${BACKEND_URL}/api/maps/distance`,
      { origin, destination, options, provider: 'tomtom' }
    );
    return response.data;
  }

  async getDistanceWithOSM(origin, destination, options) {
    const response = await axios.get('https://router.project-osrm.org/route/v1/driving', {
      params: {
        start: `${origin.lng},${origin.lat}`,
        end: `${destination.lng},${destination.lat}`,
      },
    });
    
    if (response.data.code !== 'Ok') {
      throw new Error(response.data.message || 'OSRM distance failed');
    }
    
    const route = response.data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
    };
  }

  getCached(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache() {
    this.requestCache.clear();
  }
}

export default new MapApiService();