const express = require('express');
const router = express.Router();
const MapboxService = require('../services/MapboxService');
const TomTomService = require('../services/TomTomService');
const BusinessEnrichmentService = require('../services/BusinessEnrichmentService');
const PlacePanelService = require('../services/PlacePanelService');
const QueryInterpreter = require('../services/QueryInterpreter');
const OpenTrafficCamService = require('../services/OpenTrafficCamService');
const MultiStateCameraService = require('../services/MultiStateCameraService');

router.post('/geocode', async (req, res) => {
  try {
    const { query, options = {}, provider = 'mapbox' } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide an address or place name',
      });
    }

    let result;
    if (provider === 'mapbox') {
      result = await MapboxService.geocode(query, options);
    } else if (provider === 'tomtom') {
      result = await TomTomService.geocode(query, options);
    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be mapbox or tomtom',
      });
    }

    // Return in format expected by frontend
    res.json({
      success: true,
      data: result,
      provider,
    });
  } catch (error) {
    console.error('Maps geocode error:', error);
    res.status(500).json({
      error: 'Geocoding failed',
      message: error.message,
    });
  }
});

router.post('/reverse-geocode', async (req, res) => {
  try {
    const { latitude, longitude, options = {}, provider = 'mapbox' } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Coordinates required',
        message: 'Please provide latitude and longitude',
      });
    }

    let result;
    if (provider === 'mapbox') {
      result = await MapboxService.reverseGeocode(longitude, latitude, options);
    } else if (provider === 'tomtom') {
      result = await TomTomService.reverseGeocode(latitude, longitude);
    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be mapbox or tomtom',
      });
    }

    res.json({
      success: true,
      data: result,
      provider,
    });
  } catch (error) {
    console.error('Maps reverse geocode error:', error);
    res.status(500).json({
      error: 'Reverse geocoding failed',
      message: error.message,
    });
  }
});

router.post('/directions', async (req, res) => {
  try {
    const { origin, destination, options = {}, provider = 'mapbox' } = req.body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        error: 'Origin and destination required',
        message: 'Please provide valid coordinates for both origin and destination',
      });
    }

    let result;
    if (provider === 'mapbox') {
      // Mapbox expects coordinates as array of {lon, lat}
      const coordinates = [
        { lon: origin.lng, lat: origin.lat },
        { lon: destination.lng, lat: destination.lat },
      ];
      result = await MapboxService.getDirections(coordinates, options);
    } else if (provider === 'tomtom') {
      result = await TomTomService.getRoute(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        options
      );
    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be mapbox or tomtom',
      });
    }

    res.json({
      success: true,
      data: result,
      provider,
    });
  } catch (error) {
    console.error('Maps directions error:', error);
    res.status(500).json({
      error: 'Directions failed',
      message: error.message,
    });
  }
});

router.post('/places', async (req, res) => {
  try {
    const { near, options = {}, provider = 'mapbox' } = req.body;

    if (!near || !near.lat || !near.lng) {
      return res.status(400).json({
        error: 'Near coordinates required',
        message: 'Please provide lat and lng for search center',
      });
    }

    let result;
    if (provider === 'mapbox') {
      const searchOptions = {
        ...options,
        proximity: [near.lng, near.lat],
      };
      result = await MapboxService.searchPlaces(options.query || 'poi', searchOptions);
    } else if (provider === 'tomtom') {
      const searchOptions = {
        ...options,
        lat: near.lat,
        lon: near.lng,
      };
      result = await TomTomService.searchPlaces(options.query || 'poi', searchOptions);
    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be mapbox or tomtom',
      });
    }

    res.json({
      success: true,
      data: result,
      provider,
    });
  } catch (error) {
    console.error('Maps places search error:', error);
    res.status(500).json({
      error: 'Places search failed',
      message: error.message,
    });
  }
});

router.post('/distance', async (req, res) => {
  try {
    const { origin, destination, options = {}, provider = 'mapbox' } = req.body;

    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        error: 'Origin and destination required',
        message: 'Please provide valid coordinates for both origin and destination',
      });
    }

    let result;
    if (provider === 'mapbox') {
      const coordinates = [
        { lon: origin.lng, lat: origin.lat },
        { lon: destination.lng, lat: destination.lat },
      ];
      const directions = await MapboxService.getDirections(coordinates, options);
      // Extract just distance and duration from first route
      result = directions && directions[0] ? {
        distance: directions[0].distance,
        duration: directions[0].duration,
      } : null;
    } else if (provider === 'tomtom') {
      const route = await TomTomService.getRoute(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        options
      );
      result = route ? {
        distance: route.distance,
        duration: route.duration,
      } : null;
    } else {
      return res.status(400).json({
        error: 'Invalid provider',
        message: 'Provider must be mapbox or tomtom',
      });
    }

    res.json({
      success: true,
      data: result,
      provider,
    });
  } catch (error) {
    console.error('Maps distance error:', error);
    res.status(500).json({
      error: 'Distance calculation failed',
      message: error.message,
    });
  }
});

router.post('/business-details', async (req, res) => {
  try {
    const { name, address, lat, lng, category } = req.body;

    if (!name || !lat || !lng) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide name, lat, and lng',
      });
    }

    // Enrich location with contact data from multiple sources
    const enrichedData = await BusinessEnrichmentService.enrichLocation(
      name,
      address || '',
      lat,
      lng,
      category || 'DEFAULT'
    );

    res.json({
      success: true,
      data: enrichedData,
    });
  } catch (error) {
    console.error('Business enrichment error:', error);
    // Return partial data on error (graceful degradation)
    res.json({
      success: true,
      data: {
        name: req.body.name,
        address: req.body.address,
        lat: req.body.lat,
        lng: req.body.lng,
        category: req.body.category,
        enriched: false,
        error: 'Unable to fetch additional details',
      },
    });
  }
});

/**
 * POST /api/maps/place-panel  { query, lat?, lng? }
 *
 * The local panel for a search page: given the query someone actually typed,
 * either one real business with something you can act on, or null.
 *
 * Always 200s with `panel: null` rather than erroring — a missing panel must
 * degrade to the ordinary results page, never to an error state on a search
 * that otherwise worked fine.
 *
 * The cheap gate runs FIRST so the overwhelming majority of searches, which
 * are not about places, never reach a provider at all.
 */
router.post('/place-panel', async (req, res) => {
  const { query, lat, lng } = req.body || {};
  const q = typeof query === 'string' ? query.trim() : '';
  if (!q) return res.json({ success: true, panel: null, reason: 'no_query' });
  if (!QueryInterpreter.looksLikePlaceQuery(q)) {
    return res.json({ success: true, panel: null, reason: 'not_a_place_query' });
  }
  try {
    const panel = await PlacePanelService.resolve(q, {
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    });
    return res.json({ success: true, panel, reason: panel ? 'ok' : 'no_place' });
  } catch (error) {
    console.error('Place panel error:', error.message);
    return res.json({ success: true, panel: null, reason: 'error' });
  }
});

router.post('/local-businesses', async (req, res) => {
  try {
    const { location, radius = 5000, categories = [], limit = 20, query = '' } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        error: 'Location required',
        message: 'Please provide lat and lng coordinates',
      });
    }

    const RadarService = require('../services/RadarService');

    // RadarService.searchPlaces(near, options) takes TWO arguments. This used
    // to call it with a single { near, options } object, so `near.latitude`
    // was undefined and every request went out as "near=undefined,undefined".
    // It also read the `{ success, places, meta }` return as if it were an
    // array, so `results.length` was undefined and even a good response was
    // discarded as empty. Local businesses could not have worked with a Radar
    // key configured, which is why the caller was eventually commented out
    // rather than debugged.
    const near = { latitude: location.lat, longitude: location.lng };
    const baseOptions = { radius, limit: limit * 2 };

    const collect = async (options) => {
      const result = await RadarService.searchPlaces(near, options);
      return result?.success ? (result.places || []) : [];
    };

    let allResults = [];
    if (categories.length > 0) {
      for (const category of categories) {
        allResults = [...allResults, ...await collect({ ...baseOptions, categories: [category] })];
      }
    } else {
      // `query` is what the person actually typed — "coffee", "hardware
      // store". Searching a fixed list of categories instead is how "coffee
      // near me" came back as a scatter of restaurants.
      allResults = await collect({ ...baseOptions, ...(query ? { query } : {}) });
    }

    if (!allResults || allResults.length === 0) {
      return res.json({
        success: true,
        data: {
          businesses: [],
          total: 0,
        },
      });
    }

    // Calculate distance and enrich each business
    const enrichedBusinesses = await Promise.all(
      allResults.slice(0, limit).map(async (place) => {
        // Calculate distance from user location
        const distance = calculateDistance(
          location.lat,
          location.lng,
          place.location?.coordinates?.[1] || place.latitude,
          place.location?.coordinates?.[0] || place.longitude
        );

        // Enrich with additional details
        const enriched = await BusinessEnrichmentService.enrichLocation(
          place.name,
          place.formattedAddress || place.address || '',
          place.location?.coordinates?.[1] || place.latitude,
          place.location?.coordinates?.[0] || place.longitude,
          place.category || place.categories?.[0] || 'BUSINESS'
        );

        return {
          id: place._id || place.id || `place-${place.name}-${distance}`,
          ...enriched,
          distance,
          formattedDistance: formatDistance(distance),
        };
      })
    );

    // Sort by distance and rating
    enrichedBusinesses.sort((a, b) => {
      // Prioritize rated businesses
      if (a.rating && !b.rating) return -1;
      if (!a.rating && b.rating) return 1;

      // Then sort by distance
      return a.distance - b.distance;
    });

    res.json({
      success: true,
      data: {
        businesses: enrichedBusinesses,
        total: enrichedBusinesses.length,
        location,
        radius,
      },
    });
  } catch (error) {
    console.error('Local businesses search error:', error);
    res.status(500).json({
      error: 'Local businesses search failed',
      message: error.message,
    });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
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

// Helper function to format distance
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

// OpenTrafficCamMap Routes - Public traffic camera data (no API keys needed)

// GET all traffic cameras with optional filters
router.get('/traffic-cameras', async (req, res) => {
  try {
    const { region, country, city, hasVideo, hasImage, limit = 500, page = 1 } = req.query;

    const filters = {
      region,
      country,
      city,
      hasVideo: hasVideo === 'true',
      hasImage: hasImage === 'true'
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const cameras = await OpenTrafficCamService.getCameras(filters);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedCameras = cameras.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedCameras,
      pagination: {
        total: cameras.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(cameras.length / limit)
      },
      lastUpdated: OpenTrafficCamService.lastUpdated?.toISOString(),
      source: 'OpenTrafficCamMap'
    });

  } catch (error) {
    console.error('❌ Traffic cameras error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch traffic cameras',
      message: error.message
    });
  }
});

// GET single camera by ID
router.get('/traffic-cameras/:id', async (req, res) => {
  try {
    const camera = await OpenTrafficCamService.getCameraById(req.params.id);

    if (!camera) {
      return res.status(404).json({
        success: false,
        error: 'Camera not found'
      });
    }

    res.json({
      success: true,
      data: camera
    });

  } catch (error) {
    console.error('❌ Camera fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch camera',
      message: error.message
    });
  }
});

// GET cameras within bounding box (for map views)
router.get('/traffic-cameras/bbox/:minLat/:minLng/:maxLat/:maxLng', async (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng } = req.params;

    const cameras = await OpenTrafficCamService.getCamerasInBounds(
      parseFloat(minLat),
      parseFloat(minLng),
      parseFloat(maxLat),
      parseFloat(maxLng)
    );

    res.json({
      success: true,
      data: cameras,
      count: cameras.length
    });

  } catch (error) {
    console.error('❌ Cameras bbox error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cameras in bounds',
      message: error.message
    });
  }
});

// POST - Get cameras near a route
router.post('/traffic-cameras/near-route', async (req, res) => {
  try {
    const { routeCoordinates, maxDistance = 5000 } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid route coordinates',
        message: 'Please provide an array of {lat, lng} coordinates'
      });
    }

    const cameras = await OpenTrafficCamService.getCamerasNearRoute(
      routeCoordinates,
      parseInt(maxDistance)
    );

    res.json({
      success: true,
      data: cameras,
      count: cameras.length,
      maxDistance: parseInt(maxDistance)
    });

  } catch (error) {
    console.error('❌ Cameras near route error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cameras near route',
      message: error.message
    });
  }
});

// GET camera statistics
router.get('/traffic-cameras-stats', async (req, res) => {
  try {
    const stats = await OpenTrafficCamService.getStats();

    res.json({
      success: true,
      data: stats,
      lastUpdated: OpenTrafficCamService.lastUpdated?.toISOString()
    });

  } catch (error) {
    console.error('❌ Camera stats error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch camera statistics',
      message: error.message
    });
  }
});

// ========================================
// Multi-State Traffic Camera Routes (SQLite Database)
// ========================================

// GET all cameras from multi-state database with filters
router.get('/cameras/multi-state', async (req, res) => {
  try {
    const {
      state,
      road,
      type,
      active,
      direction,
      limit = 500,
      offset = 0
    } = req.query;

    const filters = {
      state,
      road,
      type,
      active: active !== undefined ? active === 'true' : true,
      direction,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key =>
      filters[key] === undefined && delete filters[key]
    );

    const cameras = MultiStateCameraService.getCameras(filters);

    res.json({
      success: true,
      data: cameras,
      count: cameras.length,
      filters,
      source: 'MultiStateDatabase'
    });

  } catch (error) {
    console.error('❌ Multi-state cameras error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cameras from multi-state database',
      message: error.message
    });
  }
});

// GET single camera by ID from multi-state database
router.get('/cameras/multi-state/:id', async (req, res) => {
  try {
    const camera = MultiStateCameraService.getCameraById(req.params.id);

    if (!camera) {
      return res.status(404).json({
        success: false,
        error: 'Camera not found in multi-state database'
      });
    }

    res.json({
      success: true,
      data: camera
    });

  } catch (error) {
    console.error('❌ Multi-state camera fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch camera',
      message: error.message
    });
  }
});

// GET cameras near location (geospatial search)
router.get('/cameras/multi-state/near/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { radius = 50, limit = 15 } = req.query;

    const cameras = MultiStateCameraService.getCamerasNearLocation(
      parseFloat(lat),
      parseFloat(lng),
      parseFloat(radius),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: cameras,
      count: cameras.length,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseFloat(radius)
    });

  } catch (error) {
    console.error('❌ Multi-state cameras near location error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cameras near location',
      message: error.message
    });
  }
});

// POST - Search cameras (full-text search)
router.post('/cameras/multi-state/search', async (req, res) => {
  try {
    const { query, limit = 50 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query required',
        message: 'Please provide a search term'
      });
    }

    const cameras = MultiStateCameraService.searchCameras(
      query.trim(),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: cameras,
      count: cameras.length,
      query
    });

  } catch (error) {
    console.error('❌ Multi-state camera search error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// POST - Get cameras along a route
router.post('/cameras/multi-state/near-route', async (req, res) => {
  try {
    const { routeCoordinates, maxDistance = 5000, limit = 10 } = req.body;

    if (!routeCoordinates || !Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid route coordinates',
        message: 'Please provide an array of {lat, lng} coordinates'
      });
    }

    const cameras = MultiStateCameraService.getCamerasNearRoute(
      routeCoordinates,
      parseInt(maxDistance),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: cameras,
      count: cameras.length,
      maxDistance: parseInt(maxDistance)
    });

  } catch (error) {
    console.error('❌ Multi-state cameras near route error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cameras near route',
      message: error.message
    });
  }
});

// GET statistics from multi-state database
router.get('/cameras/multi-state-stats', async (req, res) => {
  try {
    const stats = MultiStateCameraService.getStats();

    res.json({
      success: true,
      data: stats,
      source: 'MultiStateDatabase'
    });

  } catch (error) {
    console.error('❌ Multi-state camera stats error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch camera statistics',
      message: error.message
    });
  }
});

// GET available states
router.get('/cameras/multi-state-states', async (req, res) => {
  try {
    const states = MultiStateCameraService.getAvailableStates();

    res.json({
      success: true,
      data: states
    });

  } catch (error) {
    console.error('❌ Multi-state available states error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available states',
      message: error.message
    });
  }
});

// ========================================
// Health Check
// ========================================

router.get('/health', async (req, res) => {
  try {
    const mapboxHealth = await MapboxService.healthCheck();
    const tomtomHealth = await TomTomService.healthCheck();
    const trafficCamHealth = await OpenTrafficCamService.healthCheck();
    const multiStateCamHealth = await MultiStateCameraService.healthCheck();

    const allHealthy = mapboxHealth.healthy &&
                       tomtomHealth.healthy &&
                       trafficCamHealth.healthy &&
                       multiStateCamHealth.healthy;

    res.json({
      status: allHealthy ? 'OK' : 'Degraded',
      service: 'Maps Service',
      providers: {
        mapbox: mapboxHealth,
        tomtom: tomtomHealth,
        trafficCameras: trafficCamHealth,
        multiStateCameras: multiStateCamHealth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'Degraded',
      error: 'Maps service unhealthy',
      message: error.message,
    });
  }
});

module.exports = router;
