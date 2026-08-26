/**
 * Mapbox Service - Alternative Mapping Provider
 *
 * Use as alternative/backup to Radar and TomTom
 * Supports geocoding, directions, static maps, places
 *
 * ── TEMPORARY GEOCODING ONLY. DO NOT PERSIST RESULTS. ──────────────────────
 *
 * Every geocoding call below hits /geocoding/v5/mapbox.places, which is the
 * TEMPORARY Geocoding API: 100,000 requests a month free, on the condition
 * that results are not stored. The Permanent Geocoding API — the one that
 * allows storage — has a free tier of ZERO, so writing a geocode result to a
 * database or a file would move this project from free to billed without
 * anything in the code looking like a spend.
 *
 * What exists today and is fine: mapApi's five-minute in-memory cache on the
 * client. What must not be added: a geocode column, a lookup table, a
 * warm-the-cache job, or a disk cache. See CLAUDE.md — this project runs at $0
 * and any spend is flagged before it is incurred.
 *
 * Other free tiers in play, for reference: Directions, Matrix and Isochrone
 * 100k/month each; Raster Tiles 750k; Static Tiles 200k.
 */
const axios = require('axios');
const config = require('../config/env');

class MapboxService {
  constructor() {
    this.accessToken = config.maps.mapbox.accessToken;
    this.baseUrl = 'https://api.mapbox.com';
  }

  /**
   * Geocode address to coordinates (Forward Geocoding)
   */
  async geocode(address, options = {}) {
    if (!this.accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    // PROXIMITY IS WHY "WALMART" MEANS THE ONE DOWN THE ROAD.
    //
    // Without it Mapbox ranks a bare brand name by global prominence, so every
    // user in the country gets the same Walmart — the reported bug. `proximity`
    // is a free bias, not a filter: it reorders by closeness to a point and
    // still returns distant matches when there is nothing near, which is
    // exactly the behaviour wanted. Costs nothing extra on the request.
    const {
      limit = 1, types = null, country = 'us', proximity = null,
    } = options;

    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
        {
          params: {
            access_token: this.accessToken,
            limit,
            types,
            country,
            proximity: proximity ? `${proximity[0]},${proximity[1]}` : null,
          },
          timeout: 10000,
        }
      );

      return this.formatGeocodeResults(response.data);
    } catch (error) {
      console.error('Mapbox geocode error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid Mapbox access token');
      }

      throw new Error(`Mapbox geocoding failed: ${error.message}`);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(lon, lat, options = {}) {
    if (!this.accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    const { types = null } = options;

    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${lon},${lat}.json`,
        {
          params: {
            access_token: this.accessToken,
            types,
          },
          timeout: 10000,
        }
      );

      return this.formatReverseGeocodeResults(response.data);
    } catch (error) {
      console.error('Mapbox reverse geocode error:', error.response?.data || error.message);
      throw new Error('Mapbox reverse geocoding failed');
    }
  }

  /**
   * Get directions between points
   */
  async getDirections(coordinates, options = {}) {
    if (!this.accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    const {
      profile = 'driving', // driving, driving-traffic, walking, cycling
      alternatives = false,
      steps = false,
      geometries = 'geojson',
    } = options;

    // Format coordinates: lon,lat;lon,lat
    const coordsString = coordinates.map((c) => `${c.lon},${c.lat}`).join(';');

    try {
      const response = await axios.get(
        `${this.baseUrl}/directions/v5/mapbox/${profile}/${coordsString}`,
        {
          params: {
            access_token: this.accessToken,
            alternatives,
            steps,
            geometries,
          },
          timeout: 10000,
        }
      );

      return this.formatDirectionsResults(response.data);
    } catch (error) {
      console.error('Mapbox directions error:', error.response?.data || error.message);
      throw new Error('Mapbox directions failed');
    }
  }

  /**
   * Search for places (POI search)
   */
  async searchPlaces(query, options = {}) {
    if (!this.accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    const {
      proximity = null, // [lon, lat]
      limit = 10,
      types = 'poi',
      country = 'us',
    } = options;

    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token: this.accessToken,
            proximity: proximity ? `${proximity[0]},${proximity[1]}` : null,
            limit,
            types,
            country,
          },
          timeout: 10000,
        }
      );

      return this.formatPlaceResults(response.data);
    } catch (error) {
      console.error('Mapbox place search error:', error.response?.data || error.message);
      throw new Error('Mapbox place search failed');
    }
  }

  /**
   * Get static map image URL
   */
  getStaticMapUrl(options = {}) {
    if (!this.accessToken) {
      throw new Error('Mapbox access token not configured');
    }

    const {
      lon,
      lat,
      zoom = 15,
      width = 600,
      height = 400,
      style = 'streets-v12',
      markers = [],
    } = options;

    let url = `${this.baseUrl}/styles/v1/mapbox/${style}/static/`;

    // Add markers if provided
    if (markers.length > 0) {
      const markerStrings = markers.map((m) => {
        const color = m.color || 'red';
        const size = m.size || 'l';
        return `pin-${size}-${color}(${m.lon},${m.lat})`;
      });
      url += `${markerStrings.join(',')}/`;
    }

    url += `${lon},${lat},${zoom}/${width}x${height}?access_token=${this.accessToken}`;

    return url;
  }

  /**
   * Format geocode results
   */
  formatGeocodeResults(data) {
    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map((feature) => ({
      address: feature.place_name,
      position: {
        lon: feature.center[0],
        lat: feature.center[1],
      },
      type: feature.place_type[0],
      relevance: feature.relevance,
      context: this.extractContext(feature.context),
    }));
  }

  /**
   * Format reverse geocode results
   */
  formatReverseGeocodeResults(data) {
    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    return {
      address: feature.place_name,
      type: feature.place_type[0],
      context: this.extractContext(feature.context),
    };
  }

  /**
   * Format directions results
   */
  formatDirectionsResults(data) {
    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    return data.routes.map((route) => ({
      distance: route.distance, // meters
      duration: route.duration, // seconds
      geometry: route.geometry,
      legs: route.legs,
      weight: route.weight,
    }));
  }

  /**
   * Format place results
   */
  formatPlaceResults(data) {
    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map((place) => ({
      name: place.text,
      address: place.place_name,
      position: {
        lon: place.center[0],
        lat: place.center[1],
      },
      type: place.place_type[0],
      relevance: place.relevance,
      category: place.properties?.category,
    }));
  }

  /**
   * Extract context information (city, state, country, etc.)
   */
  extractContext(context) {
    if (!context) return {};

    const extracted = {};

    context.forEach((item) => {
      const id = item.id.split('.')[0];
      extracted[id] = item.text;
    });

    return extracted;
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/geocoding/v5/mapbox.places/London.json`,
        {
          params: { access_token: this.accessToken },
          timeout: 5000,
        }
      );
      return { healthy: true, results: response.data.features?.length || 0 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new MapboxService();
