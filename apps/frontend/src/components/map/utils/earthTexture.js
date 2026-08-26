/* An equirectangular Earth, built from the tiles the 2D map already draws.
 *
 * WHY THIS EXISTS. The globe used to texture its sphere from NASA GIBS, with
 * the bundled Azimuthal-satellite-view.png as its fallback. When GIBS was slow
 * or unreachable — and it is a public science service with no uptime promise —
 * the fallback took over, and that file is exactly what its name says: an
 * AZIMUTHAL projection. Wrapping a polar disc onto a lat/lon sphere puts every
 * continent in the wrong place at the wrong shape, and because the disc is
 * mostly pale, the result was a featureless white ball. That is the whole of
 * "the globe doesn't render": it rendered, with a texture that isn't a map.
 *
 * WHAT THIS DOES INSTEAD. Esri's World Imagery is already the `satellite`
 * basemap in config/basemap.js — keyless, free with credit, and proven to load
 * because the flat map draws it. This composites the same tiles into a whole
 * world image, so the globe depends on nothing the rest of the map does not
 * already depend on.
 *
 * THE REPROJECTION IS THE POINT, and skipping it is the bug this file exists
 * to avoid. Web Mercator tiles are NOT equirectangular: Mercator stretches
 * latitude towards the poles, so pasting a tile grid straight onto a sphere's
 * UV space drags Greenland over the Arctic and squashes the tropics. Each
 * output row is therefore sampled from the Mercator row that holds that
 * latitude — the inverse Mercator, one row at a time.
 *
 * Mercator also cannot reach the poles at all (it runs to ±85.05°). Those caps
 * are filled with the nearest real row rather than left transparent, so the
 * sphere has no holes at top and bottom.
 */

// z=2 is 4x4 tiles = 16 requests for a 1024x1024 source. Enough detail to read
// continents on a globe that is a few hundred pixels across, and small enough
// that the whole thing arrives quickly. z=3 would be 64 requests for detail
// nobody can see at this size.
const ZOOM = 2;
const TILE = 256;
const TILES = 2 ** ZOOM;              // 4
const SRC_SIZE = TILE * TILES;        // 1024, the Mercator square
const OUT_W = 1024;
const OUT_H = 512;                    // 2:1 — the equirectangular aspect

// Esri World Imagery. Note {z}/{y}/{x} — Esri orders the path row-before-column,
// which is the reverse of the usual {z}/{x}/{y} and an easy thing to get wrong.
const esriTile = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export const EARTH_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics';

/** The latitude Web Mercator stops at. */
const MAX_LAT = 85.05112878;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required or the canvas is tainted and WebGL refuses the texture. Esri
    // sends Access-Control-Allow-Origin on these tiles.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`tile failed: ${url}`));
    img.src = url;
  });
}

/**
 * Build the world as one equirectangular canvas.
 *
 * @returns {Promise<HTMLCanvasElement>}
 * @throws if too few tiles arrive to make a usable image — the caller is
 *   expected to fall back rather than show a half-drawn Earth.
 */
export async function buildEquirectangularEarth() {
  if (typeof document === 'undefined') throw new Error('no DOM');

  const mercator = document.createElement('canvas');
  mercator.width = SRC_SIZE;
  mercator.height = SRC_SIZE;
  const mctx = mercator.getContext('2d', { willReadFrequently: true });
  if (!mctx) throw new Error('no 2d context');

  // Ocean underneath, so a missing tile reads as sea rather than as a hole.
  mctx.fillStyle = '#0b1d33';
  mctx.fillRect(0, 0, SRC_SIZE, SRC_SIZE);

  const jobs = [];
  for (let x = 0; x < TILES; x++) {
    for (let y = 0; y < TILES; y++) {
      jobs.push(
        loadImage(esriTile(ZOOM, x, y))
          .then((img) => { mctx.drawImage(img, x * TILE, y * TILE, TILE, TILE); return true; })
          .catch(() => false),
      );
    }
  }
  const landed = (await Promise.all(jobs)).filter(Boolean).length;
  // A couple of gaps are survivable; a mostly-empty grid is not an Earth, and
  // showing it would repeat the original bug in a new costume.
  if (landed < jobs.length * 0.75) {
    throw new Error(`only ${landed}/${jobs.length} tiles loaded`);
  }

  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('no 2d context');

  // ── Mercator → equirectangular, one output row at a time ──────────────────
  // Row `j` of the output is latitude `lat`; find the Mercator y that holds
  // that latitude and copy that single source row across.
  let firstRealRow = null;
  let lastRealRow = null;
  for (let j = 0; j < OUT_H; j++) {
    const lat = 90 - (j + 0.5) * (180 / OUT_H);
    if (Math.abs(lat) > MAX_LAT) continue;          // polar cap, filled below

    // Inverse of the Mercator projection, normalised to the tile square.
    const rad = (lat * Math.PI) / 180;
    const merc = Math.log(Math.tan(Math.PI / 4 + rad / 2));
    const srcY = (SRC_SIZE / 2) * (1 - merc / Math.PI);

    octx.drawImage(
      mercator,
      0, Math.max(0, Math.min(SRC_SIZE - 1, Math.floor(srcY))), SRC_SIZE, 1,
      0, j, OUT_W, 1,
    );
    if (firstRealRow === null) firstRealRow = j;
    lastRealRow = j;
  }

  // The caps Mercator cannot describe: extend the nearest real row upward and
  // downward. Ice and ocean at those latitudes, so a smear is honest enough
  // and far better than a transparent band at each pole.
  if (firstRealRow !== null) {
    for (let j = 0; j < firstRealRow; j++) {
      octx.drawImage(out, 0, firstRealRow, OUT_W, 1, 0, j, OUT_W, 1);
    }
    for (let j = lastRealRow + 1; j < OUT_H; j++) {
      octx.drawImage(out, 0, lastRealRow, OUT_W, 1, 0, j, OUT_W, 1);
    }
  }

  return out;
}

export default buildEquirectangularEarth;
