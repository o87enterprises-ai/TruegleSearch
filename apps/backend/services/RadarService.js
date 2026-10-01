const axios = require('axios');
const config = require('../config/env');

class RadarService {
  constructor() {
    this.useTestKeys = config.env === 'development';
    this.secretKey = this.useTestKeys
      ? config.maps.radar.test.secretKey
      : config.maps.radar.live.secretKey;
    this.publishableKey = this.useTestKeys
      ? config.maps.radar.test.publishableKey
      : config.maps.radar.live.publishableKey;
    this.baseUrl = 'https://api.radar.io/v1';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': this.secretKey,
      },
    });
  }

  async forwardGeocode(query) {
    try {
      const response = await this.axiosInstance.get('/geocode/forward', {
        params: { query },
      });
      return {
        success: true,
        address: response.data.addresses?.[0] || null,
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar forward geocode error:', error.response?.data || error.message);
      throw new Error('Geocoding failed');
    }
  }

  async reverseGeocode(coordinates) {
    try {
      const response = await this.axiosInstance.get('/geocode/reverse', {
        params: { coordinates: `${coordinates.latitude},${coordinates.longitude}` },
      });
      return {
        success: true,
        address: response.data.addresses?.[0] || null,
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar reverse geocode error:', error.response?.data || error.message);
      throw new Error('Reverse geocoding failed');
    }
  }

  async getDirections(origin, destination, options = {}) {
    try {
      const params = {
        locations: `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`,
        mode: options.mode || 'car',
        units: options.units || 'imperial',
        ...options,
      };
      const response = await this.axiosInstance.get('/route/directions', { params });
      return {
        success: true,
        routes: response.data.routes || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar directions error:', error.response?.data || error.message);
      throw new Error('Directions failed');
    }
  }

  async getDistance(origin, destination, options = {}) {
    try {
      const params = {
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        modes: options.modes || 'car',
        units: options.units || 'imperial',
      };
      const response = await this.axiosInstance.get('/route/distance', { params });
      return {
        success: true,
        routes: response.data.routes || {},
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar distance error:', {
        response: error.response?.data,
        message: error.message,
        status: error.response?.status,
      });
      throw new Error('Distance calculation failed');
    }
  }

  async autocomplete(query, near, limit = 10) {
    try {
      const params = {
        query,
        limit: limit || 10,
      };

      // Add near parameter if provided
      if (near) {
        params.near = near;
      }

      const response = await this.axiosInstance.get('/search/autocomplete', { params });
      return {
        success: true,
        addresses: response.data.addresses || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar autocomplete error:', error.response?.data || error.message);
      throw new Error('Autocomplete failed');
    }
  }

  async searchPlaces(near, options = {}) {
    try {
      const params = {
        near: `${near.latitude},${near.longitude}`,
        limit: options.limit || 10,
        radius: options.radius || 1000,
      };
      // Only send the filters that were actually asked for. Radar treats an
      // empty `categories=` as a filter matching nothing rather than as "no
      // filter", so sending blanks unconditionally returned no places at all.
      // Chain slugs are lower-case and hyphenated ("taco-bell"); typed text is not.
      if (options.chains) params.chains = String(options.chains).trim().toLowerCase().replace(/\s+/g, '-');
      if (options.categories?.length) params.categories = options.categories;
      if (options.query) params.query = options.query;
      if (options.groups) params.groups = options.groups;
      // Radar refuses a place search with none of chains/categories/groups
      // ("At least one value must be present"), and the 400 surfaced as a 500
      // on every non-chain autocomplete. Nothing to search by is no places —
      // the caller already merges in the address suggestions.
      if (!params.chains && !params.categories && !params.groups) {
        return { success: true, places: [], meta: { skipped: 'no chains, categories or groups' } };
      }
      const response = await this.axiosInstance.get('/search/places', { params });
      return {
        success: true,
        places: response.data.places || [],
        meta: response.data.meta,
      };
    } catch (error) {
      console.error('Radar places search error:', error.response?.data || error.message);
      throw new Error('Places search failed');
    }
  }

  async getHealthStatus() {
    try {
      await this.axiosInstance.get('/geocode/forward', { params: { query: 'test' } });
      return {
        status: 'healthy',
        message: 'Radar API is accessible',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }
}

module.exports = new RadarService();