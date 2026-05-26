/**
 * Multi-State Traffic Camera Service
 *
 * Provides access to comprehensive traffic camera database covering multiple states
 * (Washington, Iowa, and growing) with 1500+ cameras.
 *
 * Data Source: SQLite database with normalized schema
 * Features: Full-text search, geospatial queries, state/road filtering
 */

const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

class MultiStateCameraService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../data/multi_state_cameras.db');
    this.isInitialized = false;

    // In-memory cache for performance
    this.cache = {
      allCameras: null,
      lastUpdate: null,
      stats: null
    };

    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Initialize database connection
   */
  initialize() {
    if (this.isInitialized) return;

    try {
      // Open database connection (we only perform SELECT queries, so it's safe)
      this.db = new Database(this.dbPath, {
        fileMustExist: true
      });

      // Enable WAL mode for better concurrent reads
      this.db.pragma('journal_mode = WAL');

      // Verify database structure
      const tableCheck = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cameras'"
      ).get();

      if (!tableCheck) {
        throw new Error('Database missing cameras table');
      }

      this.isInitialized = true;
      logger.info('MultiStateCameraService initialized successfully', {
        dbPath: this.dbPath
      });

    } catch (error) {
      logger.error('Failed to initialize MultiStateCameraService', {
        error: error.message,
        dbPath: this.dbPath
      });
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Get all cameras with optional filters
   */
  getCameras(filters = {}) {
    this.initialize();

    const {
      state,
      road,
      type,
      active = true,
      direction,
      limit = 500,
      offset = 0
    } = filters;

    let query = 'SELECT * FROM cameras WHERE 1=1';
    const params = [];

    // Apply filters (case-insensitive state matching)
    if (state) {
      query += ' AND UPPER(state) = UPPER(?)';
      params.push(state);
    }

    if (road) {
      query += ' AND road LIKE ?';
      params.push(`%${road}%`);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (active !== undefined) {
      query += ' AND is_active = ?';
      params.push(active ? 1 : 0);
    }

    if (direction) {
      query += ' AND direction = ?';
      params.push(direction.toUpperCase());
    }

    // Add ordering and pagination
    query += ' ORDER BY state, road, name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const stmt = this.db.prepare(query);
      const cameras = stmt.all(...params);

      return cameras.map(cam => this.transformCamera(cam));
    } catch (error) {
      logger.error('Error fetching cameras', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Get camera by ID
   */
  getCameraById(id) {
    this.initialize();

    try {
      const stmt = this.db.prepare('SELECT * FROM cameras WHERE id = ?');
      const camera = stmt.get(id);

      return camera ? this.transformCamera(camera) : null;
    } catch (error) {
      logger.error('Error fetching camera by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Full-text search across camera names, roads, and locations
   */
  searchCameras(searchTerm, limit = 50) {
    this.initialize();

    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    try {
      // Search in name, road, and direction
      const query = `
        SELECT * FROM cameras
        WHERE (
          name LIKE ? OR
          road LIKE ? OR
          CAST(latitude AS TEXT) LIKE ? OR
          CAST(longitude AS TEXT) LIKE ?
        ) AND is_active = 1
        ORDER BY
          CASE
            WHEN name LIKE ? THEN 1
            WHEN road LIKE ? THEN 2
            ELSE 3
          END,
          state, road
        LIMIT ?
      `;

      const searchPattern = `%${searchTerm}%`;
      const exactPattern = `${searchTerm}%`;

      const stmt = this.db.prepare(query);
      const cameras = stmt.all(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        exactPattern,
        exactPattern,
        limit
      );

      return cameras.map(cam => this.transformCamera(cam));
    } catch (error) {
      logger.error('Error searching cameras', { error: error.message, searchTerm });
      throw error;
    }
  }

  /**
   * Get cameras near a location (geospatial query)
   */
  getCamerasNearLocation(lat, lng, radiusMiles = 50, limit = 15) {
    this.initialize();

    try {
      // Use Haversine formula in SQLite
      // Note: This is approximate but fast. For production, consider spatial indexes.
      const query = `
        SELECT *,
          (
            3959 * acos(
              cos(radians(?)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(?)) +
              sin(radians(?)) * sin(radians(latitude))
            )
          ) AS distance
        FROM cameras
        WHERE is_active = 1
        ORDER BY distance
        LIMIT ?
      `;

      const stmt = this.db.prepare(query);
      const allCameras = stmt.all(lat, lng, lat, limit * 10); // Get more than needed

      // Filter by distance in JavaScript (more reliable than SQL HAVING)
      const cameras = allCameras
        .filter(cam => cam.distance <= radiusMiles)
        .slice(0, limit);

      return cameras.map(cam => ({
        ...this.transformCamera(cam),
        distance: cam.distance,
        formattedDistance: this.formatDistance(cam.distance)
      }));
    } catch (error) {
      logger.error('Error fetching cameras near location', {
        error: error.message,
        lat,
        lng
      });
      throw error;
    }
  }

  /**
   * Get cameras along a route (within specified distance)
   */
  getCamerasNearRoute(routeCoordinates, maxDistanceMeters = 5000, limit = 10) {
    this.initialize();

    if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return [];
    }

    try {
      // Get all active cameras first
      const allCameras = this.db.prepare(
        'SELECT * FROM cameras WHERE is_active = 1'
      ).all();

      const nearbyCameras = [];
      const maxDistanceMiles = maxDistanceMeters / 1609.34; // Convert to miles

      // Check each camera against each route point
      for (const camera of allCameras) {
        let minDistance = Infinity;
        let nearestPoint = null;

        for (const point of routeCoordinates) {
          const distance = this.calculateDistance(
            camera.latitude,
            camera.longitude,
            point.lat,
            point.lng
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = point;
          }
        }

        if (minDistance <= maxDistanceMiles) {
          nearbyCameras.push({
            ...this.transformCamera(camera),
            distanceFromRoute: minDistance * 1609.34, // Convert back to meters
            nearestPoint
          });
        }
      }

      // Sort by distance and limit
      return nearbyCameras
        .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error fetching cameras near route', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    this.initialize();

    // Check cache
    if (this.cache.stats &&
        this.cache.lastUpdate &&
        Date.now() - this.cache.lastUpdate < this.CACHE_DURATION) {
      return this.cache.stats;
    }

    try {
      const stats = {
        total: this.db.prepare('SELECT COUNT(*) as count FROM cameras').get().count,
        active: this.db.prepare('SELECT COUNT(*) as count FROM cameras WHERE is_active = 1').get().count,
        byState: {},
        byType: {},
        byRoad: {}
      };

      // Count by state
      const stateStats = this.db.prepare(`
        SELECT state, COUNT(*) as count
        FROM cameras
        WHERE is_active = 1
        GROUP BY state
        ORDER BY count DESC
      `).all();

      stateStats.forEach(row => {
        stats.byState[row.state] = row.count;
      });

      // Count by type
      const typeStats = this.db.prepare(`
        SELECT type, COUNT(*) as count
        FROM cameras
        WHERE is_active = 1
        GROUP BY type
        ORDER BY count DESC
      `).all();

      typeStats.forEach(row => {
        stats.byType[row.type] = row.count;
      });

      // Count by road (top 20)
      const roadStats = this.db.prepare(`
        SELECT road, COUNT(*) as count
        FROM cameras
        WHERE is_active = 1 AND road IS NOT NULL
        GROUP BY road
        ORDER BY count DESC
        LIMIT 20
      `).all();

      roadStats.forEach(row => {
        stats.byRoad[row.road] = row.count;
      });

      // Cache the stats
      this.cache.stats = stats;
      this.cache.lastUpdate = Date.now();

      return stats;
    } catch (error) {
      logger.error('Error fetching camera stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available states
   */
  getAvailableStates() {
    this.initialize();

    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT state, COUNT(*) as count
        FROM cameras
        WHERE is_active = 1
        GROUP BY state
        ORDER BY state
      `);

      return stmt.all();
    } catch (error) {
      logger.error('Error fetching available states', { error: error.message });
      throw error;
    }
  }

  /**
   * Transform database row to standardized camera format
   */
  transformCamera(dbRow) {
    return {
      id: dbRow.id,
      name: dbRow.name,
      location: {
        lat: dbRow.latitude,
        lng: dbRow.longitude
      },
      state: dbRow.state,
      road: dbRow.road,
      direction: dbRow.direction,
      type: dbRow.type || 'traffic',
      source: 'MultiStateDatabase',
      urls: {
        image: dbRow.image_url,
        video: dbRow.video_url || null
      },
      metadata: {
        imageWidth: dbRow.image_width,
        imageHeight: dbRow.image_height,
        provider: 'DOT',
        state: dbRow.state
      },
      status: dbRow.is_active ? 'active' : 'inactive',
      isActive: Boolean(dbRow.is_active),
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
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
  formatDistance(miles) {
    if (miles < 0.1) return 'nearby';
    if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
    return `${miles.toFixed(1)} mi`;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        this.initialize();
      }

      const count = this.db.prepare('SELECT COUNT(*) as count FROM cameras').get().count;

      return {
        healthy: true,
        totalCameras: count,
        database: 'connected',
        source: 'SQLite'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        database: 'disconnected'
      };
    }
  }

  /**
   * Close database connection (cleanup)
   */
  close() {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      logger.info('MultiStateCameraService database connection closed');
    }
  }
}

// Export singleton instance
module.exports = new MultiStateCameraService();
