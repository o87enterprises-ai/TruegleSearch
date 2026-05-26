import { MARKER_CATEGORIES, CLUSTER_SIZES } from '../config/constants';
import { TRUEGLE_BRAND_COLORS } from '../config/truegleTheme';

export const getMarkerColor = (category) => {
  return MARKER_CATEGORIES[category]?.color || MARKER_CATEGORIES.DEFAULT.color;
};

export const getMarkerIcon = (category) => {
  return MARKER_CATEGORIES[category]?.icon || MARKER_CATEGORIES.DEFAULT.icon;
};

export const getClusterSize = (count) => {
  if (count < 10) return CLUSTER_SIZES.small;
  if (count < 50) return CLUSTER_SIZES.medium;
  return CLUSTER_SIZES.large;
};

export const getClusterColor = (count) => {
  if (count < 10) return TRUEGLE_BRAND_COLORS.green;
  if (count < 50) return TRUEGLE_BRAND_COLORS.highlight;
  return TRUEGLE_BRAND_COLORS.red;
};

export const formatAddress = (address) => {
  if (typeof address === 'string') return address;
  if (address?.formatted) return address.formatted;
  if (address?.street) {
    const parts = [address.street, address.city, address.state, address.country];
    return parts.filter(Boolean).join(', ');
  }
  return 'Unknown location';
};

export const formatDistance = (meters, units = 'metric') => {
  if (units === 'imperial') {
    const miles = meters * 0.000621371;
    return miles < 1 
      ? `${Math.round(miles * 5280)} ft`
      : `${miles.toFixed(1)} mi`;
  } else {
    const km = meters / 1000;
    return km < 1 
      ? `${Math.round(meters)} m`
      : `${km.toFixed(1)} km`;
  }
};

export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }
};

export const formatPrice = (priceLevel) => {
  if (!priceLevel) return 'N/A';
  const symbols = '₩₲₴₵₳₪₸₫₺₦₼₴₦₽₩₴₱₹';
  return symbols.slice(0, Math.min(priceLevel, 4));
};

export const formatRating = (rating) => {
  if (!rating) return 'N/A';
  const stars = Math.round(rating);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
};

export const isValidCoordinate = (lat, lng) => {
  return !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
};

export const calculateBounds = (markers) => {
  if (!markers || markers.length === 0) {
    return null;
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  markers.forEach(marker => {
    if (isValidCoordinate(marker.lat, marker.lng)) {
      minLat = Math.min(minLat, marker.lat);
      maxLat = Math.max(maxLat, marker.lat);
      minLng = Math.min(minLng, marker.lng);
      maxLng = Math.max(maxLng, marker.lng);
    }
  });

  if (minLat === Infinity) {
    return null;
  }

  return {
    north: maxLat,
    south: minLat,
    west: minLng,
    east: maxLng,
    center: {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    },
  };
};

export const calculateZoomForBounds = (bounds, mapWidth, mapHeight) => {
  if (!bounds || !mapWidth || !mapHeight) return 10;

  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  const maxDiff = Math.max(latDiff, lngDiff);

  const zoomLat = Math.log2(360 / latDiff) + 1;
  const zoomLng = Math.log2(360 / lngDiff) + 1;
  const zoom = Math.min(zoomLat, zoomLng);

  return Math.max(2, Math.min(15, Math.floor(zoom)));
};

export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

export const generateMarkerId = () => {
  return `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const generateRouteId = () => {
  return `route-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const parseCoordinates = (coords) => {
  if (!coords) return null;
  
  if (Array.isArray(coords)) {
    if (coords.length === 2) {
      return { lat: coords[0], lng: coords[1] };
    }
    if (coords.length === 4) {
      return {
        south: coords[0],
        west: coords[1],
        north: coords[2],
        east: coords[3],
      };
    }
  }
  
  if (typeof coords === 'object') {
    if (coords.lat !== undefined && coords.lng !== undefined) {
      return { lat: coords.lat, lng: coords.lng };
    }
    if (coords.latitude !== undefined && coords.longitude !== undefined) {
      return { lat: coords.latitude, lng: coords.longitude };
    }
  }
  
  return null;
};

export const toGeoJSON = (markers) => {
  return {
    type: 'FeatureCollection',
    features: markers.map(marker => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [marker.lng, marker.lat],
      },
      properties: {
        id: marker.id,
        name: marker.name,
        category: marker.category,
        address: marker.address,
      },
    })),
  };
};

export const detectCategoryFromText = (text) => {
  const lowerText = text.toLowerCase();
  
  const categoryKeywords = {
    RESTAURANT: ['restaurant', 'food', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'bar', 'pub', 'bakery', 'fast food'],
    HOTEL: ['hotel', 'motel', 'hostel', 'inn', 'lodge', 'resort', 'bed & breakfast'],
    SHOP: ['shop', 'store', 'mall', 'market', 'boutique', 'supermarket', 'grocery'],
    ENTERTAINMENT: ['cinema', 'movie', 'theater', 'nightclub', 'casino', 'amusement park', 'museum'],
    MEDICAL: ['hospital', 'clinic', 'pharmacy', 'doctor', 'medical center', 'urgent care'],
    TRANSPORT: ['airport', 'train station', 'bus station', 'subway', 'metro', 'taxi'],
    FINANCE: ['bank', 'atm', 'credit union', 'insurance'],
    EDUCATION: ['school', 'university', 'college', 'library'],
    PARK: ['park', 'garden', 'beach', 'forest', 'nature reserve'],
  };
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category;
    }
  }
  
  return 'DEFAULT';
};