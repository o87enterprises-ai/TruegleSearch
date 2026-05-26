/**
 * TomTom Maps Service - Alternative Mapping Provider
 *
 * Use as alternative/backup to Radar Maps
 * Supports geocoding, routing, traffic, places
 */
const axios = require('axios');
const config = require('../config/env');

class TomTomService {
  constructor() {
    this.apiKey = config.maps.tomtom.apiKey;
    this.baseUrl = 'https://api.tomtom.com';
  }

  /**
   * Geocode address to coordinates
   */
  async geocode(address, options = {}) {
    if (!this.apiKey) {
      throw new Error('TomTom API key not configured');
    }

    const { limit = 1, countrySet = 'US' } = options;

    try {
      const response = await axios.get(
        `${this.baseUrl}/search/2/geocode/${encodeURIComponent(address)}.json`,
        {
          params: {
            key: this.apiKey,
            limit,
            countrySet,
          },
          timeout: 10000,
        }
      );

      return this.formatGeocodeResults(response.data);
    } catch (error) {
      console.error('TomTom geocode error:', error.response?.data || error.message);

      if (error.response?.status === 403) {
        throw new Error('Invalid TomTom API key');
      }

      throw new Error(`TomTom geocoding failed: ${error.message}`);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lat, lon) {
    if (!this.apiKey) {
      throw new Error('TomTom API key not configured');
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/search/2/reverseGeocode/${lat},${lon}.json`,
        {
          params: { key: this.apiKey },
          timeout: 10000,
        }
      );

      return this.formatReverseGeocodeResults(response.data);
    } catch (error) {
      console.error('TomTom reverse geocode error:', error.response?.data || error.message);
      throw new Error('TomTom reverse geocoding failed');
    }
  }

  /**
   * Search for places
   */
  async searchPlaces(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('TomTom API key not configured');
    }

    const { lat, lon, radius = 5000, limit = 10, categorySet = null } = options;

    try {
      const params = {
        key: this.apiKey,
        limit,
      };

      if (lat && lon) {
        params.lat = lat;
        params.lon = lon;
        params.radius = radius;
      }

      if (categorySet) {
        params.categorySet = categorySet;
      }

      const response = await axios.get(
        `${this.baseUrl}/search/2/search/${encodeURIComponent(query)}.json`,
        {
          params,
          timeout: 10000,
        }
      );

      return this.formatPlaceResults(response.data);
    } catch (error) {
      console.error('TomTom place search error:', error.response?.data || error.message);
      throw new Error('TomTom place search failed');
    }
  }

  /**
   * Get route between two points
   */
  async getRoute(startLat, startLon, endLat, endLon, options = {}) {
    if (!this.apiKey) {
      throw new Error('TomTom API key not configured');
    }

    const { travelMode = 'car', traffic = true } = options;

    try {
      const response = await axios.get(
        `${this.baseUrl}/routing/1/calculateRoute/${startLat},${startLon}:${endLat},${endLon}/json`,
        {
          params: {
            key: this.apiKey,
            travelMode,
            traffic,
          },
          timeout: 10000,
        }
      );

      return this.formatRouteResults(response.data);
    } catch (error) {
      console.error('TomTom routing error:', error.response?.data || error.message);
      throw new Error('TomTom routing failed');
    }
  }

  /**
   * Format geocode results
   */
  formatGeocodeResults(data) {
    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((result) => ({
      address: result.address.freeformAddress,
      position: {
        lat: result.position.lat,
        lon: result.position.lon,
      },
      type: result.type,
      score: result.score,
      country: result.address.country,
      city: result.address.municipality,
      postalCode: result.address.postalCode,
    }));
  }

  /**
   * Format reverse geocode results
   */
  formatReverseGeocodeResults(data) {
    if (!data.addresses || data.addresses.length === 0) {
      return null;
    }

    const result = data.addresses[0];
    return {
      address: result.address.freeformAddress,
      street: result.address.streetName,
      city: result.address.municipality,
      country: result.address.country,
      postalCode: result.address.postalCode,
    };
  }

  /**
   * Format place results
   */
  formatPlaceResults(data) {
    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((place) => ({
      name: place.poi?.name || place.address.freeformAddress,
      address: place.address.freeformAddress,
      position: {
        lat: place.position.lat,
        lon: place.position.lon,
      },
      category: place.poi?.categories,
      phone: place.poi?.phone,
      url: place.poi?.url,
      distance: place.dist,
    }));
  }

  /**
   * Format route results
   */
  formatRouteResults(data) {
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    return {
      distance: route.summary.lengthInMeters,
      duration: route.summary.travelTimeInSeconds,
      trafficDelay: route.summary.trafficDelayInSeconds,
      departureTime: route.summary.departureTime,
      arrivalTime: route.summary.arrivalTime,
      legs: route.legs.map((leg) => ({
        distance: leg.summary.lengthInMeters,
        duration: leg.summary.travelTimeInSeconds,
        points: leg.points,
      })),
    };
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/search/2/geocode/London.json`,
        {
          params: { key: this.apiKey },
          timeout: 5000,
        }
      );
      return { healthy: true, results: response.data.results?.length || 0 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new TomTomService();
