export const TRUEGLE_BRAND_COLORS = {
  primary: '#4e22ab',
  secondary: '#ef0700',
  accent: '#019734',
  highlight: '#fcce00',
  blue: '#00bcdd',
  orange: '#fd4000',
  purple: '#9d00ff',
  teal: '#00d4ff',
  red: '#ff0033',
  green: '#39ff14',
  dark: '#0a0a0a',
  light: '#ffffff',
};

export const MAP_STYLES = {
  standard: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
};

export const PROVIDERS = {
  MAPBOX: 'mapbox',
  RADAR: 'radar',
  TOMTOM: 'tomtom',
  LEAFLET: 'leaflet',
};

export const MARKER_CATEGORIES = {
  RESTAURANT: {
    icon: 'utensils',
    color: TRUEGLE_BRAND_COLORS.red,
    label: 'Restaurant',
  },
  HOTEL: {
    icon: 'bed',
    color: TRUEGLE_BRAND_COLORS.purple,
    label: 'Hotel',
  },
  SHOP: {
    icon: 'shopping-bag',
    color: TRUEGLE_BRAND_COLORS.blue,
    label: 'Shop',
  },
  ENTERTAINMENT: {
    icon: 'film',
    color: TRUEGLE_BRAND_COLORS.orange,
    label: 'Entertainment',
  },
  MEDICAL: {
    icon: 'plus-circle',
    color: TRUEGLE_BRAND_COLORS.green,
    label: 'Medical',
  },
  TRANSPORT: {
    icon: 'car',
    color: TRUEGLE_BRAND_COLORS.accent,
    label: 'Transport',
  },
  FINANCE: {
    icon: 'dollar-sign',
    color: TRUEGLE_BRAND_COLORS.highlight,
    label: 'Finance',
  },
  EDUCATION: {
    icon: 'graduation-cap',
    color: TRUEGLE_BRAND_COLORS.teal,
    label: 'Education',
  },
  PARK: {
    icon: 'tree',
    color: TRUEGLE_BRAND_COLORS.primary,
    label: 'Park',
  },
  TRAFFIC_CAMERA: {
    icon: 'camera',
    color: '#00d4ff',
    label: 'Traffic Camera',
  },
  CURRENT_LOCATION: {
    icon: 'map-pin',
    color: '#00ff00',
    label: 'Your Location',
  },
  DEFAULT: {
    icon: 'map-pin',
    color: TRUEGLE_BRAND_COLORS.blue,
    label: 'Location',
  },
};

export const CLUSTER_SIZES = {
  small: 40,
  medium: 50,
  large: 60,
};

export const FILTER_RANGES = {
  distance: [0.1, 10, 50, 100],
  priceLevel: [1, 2, 3, 4],
  rating: [3, 3.5, 4, 4.5, 5],
};

export const ROUTE_MODES = {
  driving: 'driving',
  walking: 'walking',
  cycling: 'cycling',
  transit: 'transit',
};

export const GEOCODING_MODES = {
  forward: 'forward',
  reverse: 'reverse',
};

export const SEARCH_LIMITS = {
  places: 20,
  suggestions: 10,
  results: 100,
};

export const DEFAULT_CENTER = {
  lat: 39.8283,
  lng: -98.5795,
  zoom: 4,
};

/**
 * Where the map settles when it has found you.
 *
 * There were three of these, hard-coded: 15 in TruegleMap's grant handler, 15
 * in MapViewWrapper's silent request, and 13 in MapViewWrapper's grant handler.
 * Whichever fired last won, so "zoom to my location" landed on a street or on a
 * whole city depending on which path got there first. One number, one result.
 */
export const USER_LOCATION_ZOOM = 15;

/** Standard geolocation options. The browser default timeout is Infinity: a
 *  request made without one never calls back at all if the user ignores the
 *  prompt, so the map waits forever with no way to know it is waiting. */
export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

export const MAP_VIEW_MODES = {
  STANDARD: 'standard',
  AZIMUTHAL_FLAT: 'azimuthal_flat',
  GLOBE_3D: 'globe_3d',
};

// The STANDARD street map, not the azimuthal projection.
//
// Opening on azimuthal meant a search for "coffee near me" landed on a polar
// projection of the northern hemisphere — beautiful, and useless for finding a
// coffee shop. The projection views are worth keeping and stay one press away
// on the function bar; they are just not what somebody asking a local question
// should be shown first.
export const DEFAULT_MAP_VIEW_MODE = MAP_VIEW_MODES.STANDARD;

export const US_BOUNDS = {
  north: 49.384358,
  south: 24.447663,
  west: -124.645326,
  east: -66.949895,
};

export const MAP_CONTROLS = {
  ZOOM: {
    min: 2,
    max: 20,
    step: 1,
  },
  PITCH: {
    min: 0,
    max: 60,
  },
  BEARING: {
    min: -180,
    max: 180,
  },
};

export const OVERLAY_Z_INDEXES = {
  background: 0,
  map: 1,
  markers: 2,
  clusters: 3,
  controls: 4,
  popup: 5,
  loading: 1000,
};

export const AZIMUTHAL_FLAT_CONFIG = {
  minZoom: 1,
  maxZoom: 6,
  transitionToMapZoom: 4.5,
  defaultRadius: 250,
  defaultCenter: { lat: 0, lng: 0 },
  gridSize: 10,
  showGrid: true,
  showGraticule: true,
  backgroundImage: '/src/assets/images/Azimuthal-satellite-view.png',
};

export const GLOBE_3D_CONFIG = {
  minZoom: 2,
  maxZoom: 6,
  rotationConstraints: {
    minPolarAngle: 45,
    maxPolarAngle: 135,
    minAzimuth: -180,
    maxAzimuth: 180,
  },
  centerPoint: { lat: 0, lng: 0 },
  globeRadius: 5,
};
