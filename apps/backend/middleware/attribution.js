/**
 * Attribution Middleware
 * Watermarks every API response with a Truegle attribution tag so that any
 * content scraped from Truegle carries a visible "where this came from" marker.
 *
 * Two layers are applied:
 *   1. An `X-Truegle-Attribution` response header on EVERY response (JSON,
 *      HTML, XML, etc.) — survives even when the body is binary or static.
 *   2. An `attribution` block injected into every JSON object response body,
 *      including a per-request `traceId`. The traceId acts as a canary: if it
 *      ever resurfaces in someone else's index/dataset, it ties the data back
 *      to a specific Truegle request.
 *
 * Note: this is attribution + deterrence, NOT prevention. A determined scraper
 * can strip a visible tag. The value is provenance and traceability.
 */

const crypto = require('crypto');

const ATTRIBUTION_TEXT = 'Scraped from Truegle — https://truegle.info';
const ATTRIBUTION_SOURCE = 'Truegle';

/**
 * Build the attribution block stamped into JSON bodies.
 */
function buildAttribution(traceId) {
  return {
    source: ATTRIBUTION_SOURCE,
    notice: ATTRIBUTION_TEXT,
    url: 'https://truegle.info',
    traceId,
  };
}

/**
 * Express middleware that watermarks responses with Truegle attribution.
 */
const attributionMiddleware = (req, res, next) => {
  // Per-request canary token. Short, URL-safe, and unique enough to trace.
  const traceId = crypto.randomBytes(8).toString('hex');
  req.truegleTraceId = traceId;

  // Layer 1: header on every response, regardless of body type.
  res.setHeader('X-Truegle-Attribution', ATTRIBUTION_TEXT);
  res.setHeader('X-Truegle-Trace-Id', traceId);

  // Layer 2: inject an attribution block into JSON object bodies.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only stamp plain objects — leave arrays/primitives untouched so we don't
    // change the shape of responses that clients iterate over directly.
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      // Don't clobber an attribution field a route may have set deliberately.
      if (!body.attribution) {
        body.attribution = buildAttribution(traceId);
      }
    }
    return originalJson(body);
  };

  next();
};

module.exports = {
  attributionMiddleware,
  ATTRIBUTION_TEXT,
  ATTRIBUTION_SOURCE,
  buildAttribution,
};
