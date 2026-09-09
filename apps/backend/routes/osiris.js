/**
 * OSIRIS live-intelligence layers for the map.
 *
 * Thin: everything with judgement in it lives in services/OsirisService.js —
 * including WHY this is proxied rather than fetched from the browser (short
 * version: a browser fetch would hand a third party every visitor's IP and a
 * running record of where they were looking).
 *
 *   GET /api/osiris/layers          the catalogue the layer switcher is built from
 *   GET /api/osiris/:layer          one layer as GeoJSON
 *     ?bbox=w,s,e,n                 only what the map can actually see
 *     ?limit=n                      hard cap on features (default 2000, max 5000)
 *
 * No auth: these are public feeds and the map is a public surface. No user
 * column, no logging of who asked for what — same discipline as the rest of
 * the map routes.
 */
const express = require('express');
const logger = require('../utils/logger');
const osiris = require('../services/OsirisService');

const router = express.Router();

router.get('/layers', (req, res) => {
  res.json({ layers: osiris.listLayers(), source: osiris.BASE_URL });
});

router.get('/:layer', async (req, res) => {
  const { layer } = req.params;
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 2000, 1), 5000);
    const collection = await osiris.getLayer(layer, { bbox: req.query.bbox, limit });
    // Let the CDN hold it for a fraction of the layer's own TTL. The upstream
    // call is already cached in-process; this stops a burst of map loads on
    // cold lambdas from each making their own.
    const ttlSeconds = Math.round((osiris.LAYERS[layer]?.ttl || 30_000) / 1000);
    res.set('Cache-Control', `public, max-age=${Math.max(15, ttlSeconds)}`);
    return res.json(collection);
  } catch (error) {
    if (error.code === 'UNKNOWN_LAYER') {
      return res.status(404).json({
        error: 'Unknown layer',
        message: `No such map layer: ${layer}`,
        available: osiris.listLayers().map((l) => l.id),
      });
    }

    // THE SHAPE CHANGED, AND THAT IS A REPORTABLE EVENT.
    //
    // Not a 500 and not an empty FeatureCollection. An empty collection would
    // draw a map with nothing on it and no way to tell "no aircraft near you"
    // from "we stopped being able to read the aircraft feed" — the exact
    // unreportable failure the feed's own error panel exists to prevent. The
    // sample of keys actually seen goes to the logs, where the fix (one more
    // candidate in LAT_KEYS/ROWS_KEYS) can be read straight off it.
    if (error.code === 'UNRECOGNISED_SHAPE') {
      logger.error('OSIRIS layer shape unrecognised', {
        layer, message: error.message, sample: error.sample,
      });
      return res.status(502).json({
        error: 'Upstream shape changed',
        code: 'unrecognised_shape',
        message: `The ${layer} feed answered in a shape Truegle could not read. This layer is unavailable until it is remapped.`,
      });
    }

    logger.error('OSIRIS layer fetch failed', { layer, message: error.message });
    return res.status(502).json({
      error: 'Upstream unavailable',
      code: 'upstream_unavailable',
      message: `The ${layer} feed could not be reached. The rest of the map is unaffected.`,
    });
  }
});

module.exports = router;
