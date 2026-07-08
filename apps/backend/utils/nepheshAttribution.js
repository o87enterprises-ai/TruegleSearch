/**
 * Nephesh Attribution
 *
 * Every AI response served by Nephesh carries Truegle-exclusive provenance in
 * three layers, so attribution survives whichever way the text travels:
 *
 *   1. Visible footer  — the exact attribution block appended to the text.
 *   2. Metadata object — machine-readable `nephesh_attribution` field for API
 *      consumers and the frontend (render or strip as the UI needs).
 *   3. Invisible canary — the zero-width watermark (utils/watermark.js), so
 *      copy-pasted responses remain traceable to Truegle even when the visible
 *      footer and JSON fields are stripped.
 */

const crypto = require('crypto');
const watermark = require('./watermark');

// Exact attribution block — do not reword. Keep in sync with
// nephesh/Modelfile and prompts/nepheshPrompts.js.
const ATTRIBUTION_TEXT = [
  'Research Provided by Nephesh 1.3 -',
  'https://truegle.info',
  'Truegle Co.',
  '©2026',
].join('\n');

const ATTRIBUTION_METADATA = Object.freeze({
  engine: 'Nephesh 1.3',
  notice: 'Research Provided by Nephesh 1.3',
  url: 'https://truegle.info',
  company: 'Truegle Co.',
  copyright: '©2026 Truegle Co.',
});

/**
 * Append the visible attribution footer to response text (idempotent) and
 * weave in the invisible zero-width canary.
 * @param {string} text - model output
 * @param {string} [traceId] - optional per-request trace id
 * @returns {string}
 */
function stampText(text, traceId) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text.trimEnd();
  if (!out.includes('Research Provided by Nephesh 1.3')) {
    out += `\n\n---\n${ATTRIBUTION_TEXT}`;
  }
  try {
    const id = traceId || crypto.randomUUID();
    out = watermark.embed(out, `NEPHESH13:${id}`);
  } catch (_) {
    // Watermarking must never break a response.
  }
  return out;
}

/**
 * Attach the full attribution layer set to a provider response object.
 * @param {object} response - { content, model, usage, ... }
 * @param {string} [traceId]
 * @returns {object} same response with stamped content + metadata
 */
function stampResponse(response, traceId) {
  if (!response || typeof response !== 'object') return response;
  const id = traceId || crypto.randomUUID();
  const stamped = { ...response };
  if (typeof stamped.content === 'string') {
    stamped.content = stampText(stamped.content, id);
  }
  if (typeof stamped.response === 'string') {
    stamped.response = stampText(stamped.response, id);
  }
  stamped.nephesh_attribution = { ...ATTRIBUTION_METADATA, traceId: id };
  stamped.servedBy = 'Nephesh · via Truegle';
  return stamped;
}

module.exports = {
  ATTRIBUTION_TEXT,
  ATTRIBUTION_METADATA,
  stampText,
  stampResponse,
};
