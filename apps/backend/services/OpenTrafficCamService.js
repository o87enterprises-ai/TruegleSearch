/**
 * OpenTrafficCamMap Service - Public Traffic Camera Data
 *
 * Fetches and caches traffic camera data from OpenTrafficCamMap GitHub repository.
 * No API keys required - fully open source.
 *
 * Source: https://github.com/opentrafficcam/map
 */
const axios = require('axios');

class OpenTrafficCamService {
  constructor() {
    // Primary data sources - OpenTrafficCamMap JSON files by country
    // Repository: https://github.com/AidanWelch/OpenTrafficCamMap
    this.dataSources = {
      USA: 'https://raw.githubusercontent.com/AidanWelch/OpenTrafficCamMap/master/cameras/USA.json'
      // Note: Only USA.json currently exists in the repository
      // Other countries can be added as they become available
    };
    this.cameraData = null;
    this.lastUpdated = null;
    this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Fetch camera data from OpenTrafficCamMap (multiple countries)
   */
  async fetchCameraData() {
    try {
      console.log('📡 Fetching camera data from OpenTrafficCamMap (multiple countries)...');

      const allCameras = [];

      // Fetch cameras from each country
      for (const [countryCode, url] of Object.entries(this.dataSources)) {
        try {
          console.log(`  Fetching ${countryCode} cameras...`);

          const response = await axios.get(url, {
            timeout: 15000,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Truegle Maps/1.0'
            }
          });

          if (response.data && typeof response.data === 'object') {
            const countryCameras = this.transformData(response.data, countryCode);
            allCameras.push(...countryCameras);
            console.log(`  ✅ Loaded ${countryCameras.length} cameras from ${countryCode}`);
          }
        } catch (countryError) {
          console.warn(`  ⚠️ Failed to fetch ${countryCode} cameras: ${countryError.message}`);
          // Continue with other countries
        }
      }

      if (allCameras.length === 0) {
        throw new Error('No camera data could be loaded from any country');
      }

      // Transform to standardized schema
      this.cameraData = allCameras;
      this.lastUpdated = new Date();

      console.log(`✅ Successfully loaded ${this.cameraData.length} cameras from OpenTrafficCamMap (${Object.keys(this.dataSources).length} countries)`);
      return this.cameraData;

    } catch (error) {
      console.error('❌ Error fetching OpenTrafficCamMap data:', error.message);
      // Return cached data if available
      if (this.cameraData) {
        console.log(`⚠️ Using cached data (${this.cameraData.length} cameras)`);
        return this.cameraData;
      }
      throw new Error(`Failed to fetch camera data: ${error.message}`);
    }
  }

  /**
   * Transform OpenTrafficCamMap data to standardized format
   * Handles nested structure: State -> County/Region -> Array of cameras
   */
  transformData(rawData, countryCode = 'Unknown') {
    const cameras = [];

    // Check if data is already an array (old format) or nested object (new format)
    if (Array.isArray(rawData)) {
      // Old flat array format
      return rawData
        .filter(camera => camera.latitude && camera.longitude)
        .map((camera, index) => this.transformSingleCamera(camera, countryCode, 'Unknown', 'Unknown', index));
    }

    // New nested format: { State: { County: [cameras] } }
    for (const [state, counties] of Object.entries(rawData)) {
      if (typeof counties !== 'object') continue;

      for (const [county, camerasArray] of Object.entries(counties)) {
        if (!Array.isArray(camerasArray)) continue;

        camerasArray
          .filter(camera => camera.latitude && camera.longitude)
          .forEach((camera, index) => {
            cameras.push(this.transformSingleCamera(camera, countryCode, state, county, index));
          });
      }
    }

    return cameras;
  }

  /**
   * Transform a single camera object
   */
  transformSingleCamera(camera, countryCode, state, county, index) {
    return {
      id: camera.id || `otcm_${countryCode}_${state}_${county}_${index}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      name: camera.description || camera.name || `Traffic Camera ${index + 1}`,
      location: {
        lat: parseFloat(camera.latitude),
        lng: parseFloat(camera.longitude)
      },
      source: 'OpenTrafficCamMap',
      urls: {
        // Map format to appropriate URL field
        image: camera.format === 'IMAGE_STREAM' ? camera.url : null,
        video: camera.format !== 'IMAGE_STREAM' ? camera.url : null
      },
      metadata: {
        direction: camera.direction || null,
        description: camera.description || '',
        country: countryCode,
        region: state,
        city: county,
        updateRate: camera.updateRate || 30000,
        provider: 'OpenTrafficCamMap',
        format: camera.format || 'Unknown',
        encoding: camera.encoding || 'Unknown',
        markedForReview: camera.markedForReview || false
      },
      status: 'active',
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Get cameras with optional filters
   */
  async getCameras(filters = {}) {
    // Refresh cache if needed
    if (!this.cameraData ||
        !this.lastUpdated ||
        Date.now() - this.lastUpdated > this.CACHE_DURATION) {
      await this.fetchCameraData();
    }

    let filteredCameras = [...(this.cameraData || [])];

    // Apply filters
    if (filters.region) {
      filteredCameras = filteredCameras.filter(
        cam => cam.metadata.region?.toLowerCase().includes(filters.region.toLowerCase())
      );
    }

    if (filters.country) {
      filteredCameras = filteredCameras.filter(
        cam => cam.metadata.country?.toLowerCase() === filters.country.toLowerCase()
      );
    }

    if (filters.city) {
      filteredCameras = filteredCameras.filter(
        cam => cam.metadata.city?.toLowerCase().includes(filters.city.toLowerCase())
      );
    }

    if (filters.hasVideo) {
      filteredCameras = filteredCameras.filter(cam => cam.urls.video);
    }

    if (filters.hasImage) {
      filteredCameras = filteredCameras.filter(cam => cam.urls.image);
    }

    return filteredCameras;
  }

  /**
   * Get camera by ID
   */
  async getCameraById(id) {
    await this.getCameras(); // Ensure data is loaded
    return this.cameraData?.find(cam => cam.id === id) || null;
  }

  /**
   * Get cameras within a bounding box
   */
  async getCamerasInBounds(minLat, minLng, maxLat, maxLng) {
    const cameras = await this.getCameras();

    return cameras.filter(camera => {
      const { lat, lng } = camera.location;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });
  }

  /**
   * Get cameras near a route (within specified distance)
   */
  async getCamerasNearRoute(routeCoordinates, maxDistanceMeters = 5000) {
    const cameras = await this.getCameras();
    const nearbyCameras = [];

    for (const camera of cameras) {
      const cameraLat = camera.location.lat;
      const cameraLng = camera.location.lng;

      // Check distance to each point on the route
      for (const point of routeCoordinates) {
        const distance = this.calculateDistance(
          cameraLat,
          cameraLng,
          point.lat,
          point.lng
        );

        if (distance <= maxDistanceMeters) {
          nearbyCameras.push({
            ...camera,
            distanceFromRoute: distance,
            nearestPoint: point
          });
          break; // Found nearby, no need to check other route points
        }
      }
    }

    // Sort by distance from route
    return nearbyCameras.sort((a, b) => a.distanceFromRoute - b.distanceFromRoute);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const cameras = await this.getCameras();
      return {
        healthy: true,
        totalCameras: cameras.length,
        lastUpdated: this.lastUpdated?.toISOString(),
        cacheAge: this.lastUpdated ? Date.now() - this.lastUpdated.getTime() : null
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Get statistics about available cameras
   */
  async getStats() {
    const cameras = await this.getCameras();

    const stats = {
      total: cameras.length,
      withImages: cameras.filter(c => c.urls.image).length,
      withVideo: cameras.filter(c => c.urls.video).length,
      byCountry: {},
      byRegion: {}
    };

    cameras.forEach(camera => {
      const country = camera.metadata.country;
      const region = camera.metadata.region;

      stats.byCountry[country] = (stats.byCountry[country] || 0) + 1;
      stats.byRegion[region] = (stats.byRegion[region] || 0) + 1;
    });

    return stats;
  }
}

module.exports = new OpenTrafficCamService();
