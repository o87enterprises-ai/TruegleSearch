// The tiles the map is actually made of — and the reason it draws at all.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// The map never rendered, and the reason was the token.
//
// TruegleMap set `mapboxgl.accessToken` from VITE_MAPBOX_ACCESS_TOKEN, which
// is blank in .env.example and unset in the deployment. Every style it asked
// for was a `mapbox://` URL, and mapbox-gl throws "An API access token is
// required to use Mapbox GL" the moment it tries to resolve one. Nothing
// painted, so what showed through was the page background — a starfield in one
// screenshot, a bare dark panel in the others.
//
// (The stylesheet was fine: index.html pulled mapbox-gl.css from Mapbox's CDN.
// That <link> is gone now — the renderer imports its own stylesheet as a
// module, so it ships in the bundle instead of being fetched on every page.)
//
// ── WHY MAPLIBRE, AND WHY RASTER ────────────────────────────────────────────
//
// Getting a Mapbox token is possible but it is a metered account with a card
// behind it, and this project runs at $0 (see CLAUDE.md). More to the point,
// Mapbox GL JS v2+ is licensed for use WITH MAPBOX SERVICES — pointing it at
// somebody else's tiles to dodge the token would be a licence violation, not
// a clever workaround. MapLibre GL is the BSD-3 fork of the last open version
// and carries no such condition, which is what makes keyless tiles legitimate.
//
// So every style here is a hand-built RASTER style over public tile endpoints.
// Raster rather than vector because a raster style is four lines of JSON whose
// only external dependency is a `{z}/{x}/{y}` URL — no hosted style document
// that can 404 and take the whole map down with it, which is the exact failure
// mode being fixed.
//
// ATTRIBUTION IS NOT OPTIONAL. Each source carries the credit its provider
// requires, and TruegleMap mounts the attribution control that shows it. Every
// endpoint below is free to use with that credit; none of them takes a key.
//
// If a Mapbox token is ever configured, `hasMapboxToken` is the single switch
// to read — nothing else in the map needs to know.

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
export const hasMapboxToken = !!MAPBOX_TOKEN;

const OSM_CREDIT = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** A complete MapLibre style document for one raster tile set. */
function rasterStyle({ tiles, attribution, maxzoom = 19, tileSize = 256, background = '#0a0a0a' }) {
  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles, tileSize, maxzoom, attribution },
    },
    layers: [
      // A ground colour under the tiles. Without it the gap between "the map
      // is mounted" and "the first tile arrived" is transparent, and the page
      // behind shows through — which is what made a slow load look identical
      // to a broken one.
      { id: 'background', type: 'background', paint: { 'background-color': background } },
      { id: 'basemap', type: 'raster', source: 'basemap', minzoom: 0, maxzoom: 22 },
    ],
  };
}

// Subdomain-sharded hosts are written out rather than using the `{s}` token:
// MapLibre has no such placeholder, and an array of URLs is how it shards.
const carto = (variant) => ['a', 'b', 'c', 'd'].map(
  (s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`,
);

export const BASEMAP_STYLES = {
  standard: rasterStyle({
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: OSM_CREDIT,
    maxzoom: 19,
  }),
  light: rasterStyle({
    tiles: carto('light_all'),
    attribution: `${OSM_CREDIT}, © <a href="https://carto.com/attributions">CARTO</a>`,
    maxzoom: 20,
    background: '#f5f5f3',
  }),
  dark: rasterStyle({
    tiles: carto('dark_all'),
    attribution: `${OSM_CREDIT}, © <a href="https://carto.com/attributions">CARTO</a>`,
    maxzoom: 20,
  }),
  satellite: rasterStyle({
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    // Esri's imagery service is free to use with this credit line.
    attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxzoom: 19,
  }),
};

/** The order the style toggle walks. Satellite leads because it is the
 *  default (see TruegleMap's `style` prop), so the first press of the toggle
 *  moves AWAY from what is on screen rather than appearing to do nothing. */
export const BASEMAP_ORDER = ['satellite', 'standard', 'dark', 'light'];

export const getBasemapStyle = (name) => BASEMAP_STYLES[name] || BASEMAP_STYLES.standard;

// Mapbox's traffic tiles are a `mapbox://` vector source, so they need the
// token like any other Mapbox service. There is no keyless equivalent — TomTom
// and HERE both meter traffic — so the toggle is honest about it rather than
// adding a layer that silently fails to load. See TruegleMap's traffic effect.
export const TRAFFIC_AVAILABLE = hasMapboxToken;
