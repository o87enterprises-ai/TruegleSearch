/**
 * Helper to build TomTom Satellite Tile URLs.
 * Requires a TomTom API key with satellite tile access.
 *
 * URL format (per TomTom docs):
 * https://api.tomtom.com/map/1/tile/sat/main/{zoom}/{x}/{y}.jpg?key={API_KEY}
 */

export function getTomTomSatelliteTileUrl({ zoom, x, y, apiKey }) {
  if (!apiKey) {
    throw new Error('TomTom API key is required for satellite tiles');
  }
  const base = 'https://api.tomtom.com/map/1/tile/sat/main';
  return `${base}/${zoom}/${x}/${y}.jpg?key=${apiKey}`;
}
