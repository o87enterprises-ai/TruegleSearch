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
 *
 * WHERE THE CANARY GOES, AND WHY IT MOVED (2026-08-17):
 * watermark.embed() inserts after the FIRST SPACE of whatever it is given. Run
 * over a whole answer that meant the first space of the first sentence, so
 * every reply left here reading
 *
 *     Based ⁠⁠‌‌‌…⁠⁠on the search results provided…
 *
 * the moment anyone pasted it anywhere that does not silently swallow
 * zero-width characters. The user hit this the first time they quoted an
 * answer back to us. Splitting the opening words of every response is too high
 * a price for provenance, and it bought nothing extra: the canary is just as
 * unstrippable sitting at the head of the attribution block, which is still
 * mid-document (the footer text follows it), so trailing-whitespace trims
 * cannot reach it either — the original reason for burying it in the prose.
 *
 * Result-snippet watermarking in routes/search.js is UNCHANGED. That is the
 * one docs/ANTI-SCRAPING.md actually specifies, it defends against SERP
 * scraping rather than a human copying a paragraph, and nobody quotes a
 * snippet into an email.
 */

const crypto = require('crypto');
const watermark = require('./watermark');

// Exact attribution block — do not reword. Keep in sync with
// nephesh/Modelfile and prompts/nepheshPrompts.js. (The engine's user-facing
// NAME is TrueGLE; internal file/field names keep the legacy "nephesh".)
const ATTRIBUTION_TEXT = [
  'Research Provided by TrueGLE 1.3 -',
  'https://truegle.info',
  'Truegle Co.',
  '©2026',
].join('\n');

const ATTRIBUTION_METADATA = Object.freeze({
  engine: 'TrueGLE 1.3',
  notice: 'Research Provided by TrueGLE 1.3',
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
  const out = text.trimEnd();
  // Match either the current TrueGLE footer or the legacy Nephesh one, so a
  // response already stamped during the rename transition isn't double-footed
  // — and, since the canary now rides inside that footer, isn't double-marked
  // either.
  if (out.includes('Research Provided by TrueGLE 1.3') || out.includes('Research Provided by Nephesh 1.3')) {
    return out;
  }
  let canary = '';
  try {
    // marker(), not encode() — it applies the MARKER_PREFIX that extract() and
    // scripts/check-watermark.js match on. Encoding the payload directly
    // produces a canary that decodes cleanly and is then disowned as not ours.
    canary = watermark.marker(`TRUEGLE13:${traceId || crypto.randomUUID()}`);
  } catch (_) {
    // Watermarking must never break a response.
  }
  // The canary opens the footer rather than being woven into a word: it sits
  // between the "---" rule and "Research", so there is no visible text for it
  // to split.
  return `${out}\n\n---\n${canary}${ATTRIBUTION_TEXT}`;
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
  stamped.servedBy = 'TrueGLE · via Truegle';
  return stamped;
}

module.exports = {
  ATTRIBUTION_TEXT,
  ATTRIBUTION_METADATA,
  stampText,
  stampResponse,
};
