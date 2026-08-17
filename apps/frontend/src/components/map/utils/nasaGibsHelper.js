/**
 * NASA GIBS (Global Imagery Browse Services) Tile Helper
 *
 * Provides free, high-quality satellite imagery from NASA's Earth Observing System.
 * No API key required - publicly accessible.
 *
 * Documentation: https://nasa-gibs.github.io/gibs-api-docs/
 *
 * Available Imagery Layers:
 * - Blue Marble: Natural color Earth imagery
 * - VIIRS: Visible Infrared Imaging Radiometer Suite (day/night band)
 * - MODIS: Moderate Resolution Imaging Spectroradiometer
 *
 * Projections Supported:
 * - EPSG:4326 (Geographic) - Global coverage
 * - EPSG:3857 (Web Mercator) - Google Maps compatible
 * - EPSG:3413 (Arctic Polar Stereographic)
 * - EPSG:3031 (Antarctic Polar Stereographic)
 */

const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';
// The WMS endpoint, which can return an arbitrary bbox at an arbitrary size —
// the only way to get a whole-world equirectangular image out of GIBS.
const GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/**
 * Available NASA GIBS imagery layers
 */
export const GIBS_LAYERS = {
  // Natural Earth imagery (no date required - static)
  BLUE_MARBLE: {
    id: 'BlueMarble_ShadedRelief_Bathymetry',
    format: 'jpeg',
    resolution: '500m',
    description: 'Natural color Earth imagery with shaded relief and bathymetry',
    requiresDate: false
  },

  // VIIRS True Color (daily updates)
  VIIRS_TRUE_COLOR: {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    format: 'jpeg',
    resolution: '250m',
    description: 'Daily true color imagery from VIIRS',
    requiresDate: true
  },

  // MODIS Terra True Color (daily updates)
  MODIS_TERRA: {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'jpeg',
    resolution: '250m',
    description: 'Daily true color imagery from MODIS Terra',
    requiresDate: true
  },

  // MODIS Aqua True Color (daily updates)
  MODIS_AQUA: {
    id: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    format: 'jpeg',
    resolution: '250m',
    description: 'Daily true color imagery from MODIS Aqua',
    requiresDate: true
  }
};

/**
 * Get the current date in YYYY-MM-DD format
 * (GIBS requires dates for dynamic layers, defaults to yesterday to ensure data availability)
 */
function getCurrentDate() {
  const now = new Date();
  // Use yesterday's date to ensure imagery is available
  now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
}

/**
 * Build a NASA GIBS tile URL for static Blue Marble imagery
 *
 * @param {Object} params - Tile parameters
 * @param {number} params.zoom - Zoom level (0-9 for GIBS)
 * @param {number} params.x - Tile X coordinate
 * @param {number} params.y - Tile Y coordinate
 * @returns {string} Complete tile URL
 *
 * @example
 * const url = getNASABlueMarbleTileUrl({ zoom: 3, x: 4, y: 2 });
 * // Returns: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/{date}/500m/3/2/4.jpeg
 */
export function getNASABlueMarbleTileUrl({ zoom, x, y }) {
  const layer = GIBS_LAYERS.BLUE_MARBLE;
  const date = getCurrentDate(); // Blue Marble doesn't strictly need date, but GIBS URL format requires it

  // GIBS URL format: {base}/{layer}/default/{date}/{resolution}/{zoom}/{y}/{x}.{format}
  // Note: GIBS uses Y/X order (row/col), not X/Y
  return `${GIBS_BASE_URL}/${layer.id}/default/${date}/${layer.resolution}/${zoom}/${y}/${x}.${layer.format}`;
}

/**
 * Build a NASA GIBS tile URL for daily VIIRS True Color imagery
 *
 * @param {Object} params - Tile parameters
 * @param {number} params.zoom - Zoom level (0-9 for GIBS)
 * @param {number} params.x - Tile X coordinate
 * @param {number} params.y - Tile Y coordinate
 * @param {string} [params.date] - Date in YYYY-MM-DD format (defaults to yesterday)
 * @returns {string} Complete tile URL
 */
export function getNASAVIIRSTileUrl({ zoom, x, y, date = null }) {
  const layer = GIBS_LAYERS.VIIRS_TRUE_COLOR;
  const imageDate = date || getCurrentDate();

  return `${GIBS_BASE_URL}/${layer.id}/default/${imageDate}/${layer.resolution}/${zoom}/${y}/${x}.${layer.format}`;
}

/**
 * Build a NASA GIBS tile URL for daily MODIS Terra True Color imagery
 *
 * @param {Object} params - Tile parameters
 * @param {number} params.zoom - Zoom level (0-9 for GIBS)
 * @param {number} params.x - Tile X coordinate
 * @param {number} params.y - Tile Y coordinate
 * @param {string} [params.date] - Date in YYYY-MM-DD format (defaults to yesterday)
 * @returns {string} Complete tile URL
 */
export function getNASAMODISTileUrl({ zoom, x, y, date = null }) {
  const layer = GIBS_LAYERS.MODIS_TERRA;
  const imageDate = date || getCurrentDate();

  return `${GIBS_BASE_URL}/${layer.id}/default/${imageDate}/${layer.resolution}/${zoom}/${y}/${x}.${layer.format}`;
}

/**
 * Get a full Earth texture URL from NASA GIBS (single image, not tiled)
 * Useful for 3D globe rendering
 *
 * @param {string} [layerType='BLUE_MARBLE'] - Layer type from GIBS_LAYERS
 * @returns {string} Direct image URL
 */
export function getNASAEarthTextureUrl(layerType = 'BLUE_MARBLE') {
  const layer = GIBS_LAYERS[layerType];
  const date = getCurrentDate();

  // WMS GetMap OVER THE WHOLE WORLD — not a WMTS tile.
  //
  // This used to request tile 0/0/0 and call it "the entire world in one
  // tile". It is not: the EPSG:4326 tile grid is 2x1 at level zero, so that
  // URL returns the WESTERN HEMISPHERE — half an Earth, at a 1:1 aspect,
  // wrapped around a sphere as if it were a full map. A globe textured with
  // it is wrong everywhere.
  //
  // A sphere needs an EQUIRECTANGULAR image: the full -180..180 by -90..90
  // extent at a 2:1 aspect, which is exactly what a WMS GetMap over that bbox
  // returns. Keyless, like the rest of GIBS.
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer.id,
    CRS: 'EPSG:4326',
    BBOX: '-90,-180,90,180',
    WIDTH: '2048',
    HEIGHT: '1024',
    FORMAT: `image/${layer.format}`,
    ...(layer.requiresDate ? { TIME: date } : {}),
  });
  return `${GIBS_WMS_URL}?${params}`;
}

/**
 * Attribution text required by NASA GIBS
 */
export const GIBS_ATTRIBUTION =
  'We acknowledge the use of imagery provided by services from NASA\'s Global Imagery Browse Services (GIBS), ' +
  'part of NASA\'s Earth Science Data and Information System (ESDIS).';

/**
 * Check if NASA GIBS is available
 * @returns {Promise<boolean>}
 */
export async function checkGIBSAvailability() {
  try {
    const testUrl = getNASABlueMarbleTileUrl({ zoom: 0, x: 0, y: 0 });
    const response = await fetch(testUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn('NASA GIBS availability check failed:', error);
    return false;
  }
}

export default {
  getNASABlueMarbleTileUrl,
  getNASAVIIRSTileUrl,
  getNASAMODISTileUrl,
  getNASAEarthTextureUrl,
  checkGIBSAvailability,
  GIBS_LAYERS,
  GIBS_ATTRIBUTION
};
