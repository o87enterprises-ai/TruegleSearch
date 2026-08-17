/**
 * Invisible Canary Watermark
 *
 * Encodes a short payload (e.g. "TRUEGLE:<traceId>") into a run of zero-width
 * Unicode characters that can be embedded inside visible text. The marker is:
 *   - Invisible to humans (zero-width glyphs render as nothing)
 *   - Survives copy/paste and most text extraction
 *   - Not a separate JSON field, so it can't be stripped by deleting a key
 *
 * This is a provenance/attribution tool. A determined adversary who knows the
 * scheme can still strip it, but unlike a visible tag it survives naive copying
 * and lets us prove that a given block of text originated from Truegle.
 *
 * Encoding scheme
 *   START sentinel : ⁠⁠   (word joiner x2)
 *   bit 0          : ​         (zero-width space)
 *   bit 1          : ‌         (zero-width non-joiner)
 *   END sentinel   : ⁠⁠
 * The payload is encoded as UTF-8 bytes, MSB first.
 */

const START = '⁠⁠';
const END = '⁠⁠';
const BIT_0 = '​';
const BIT_1 = '‌';

const ZERO_WIDTH_RE = /[⁠​‌]/g;
const MARKER_PREFIX = 'TRUEGLE';

/**
 * Encode a string payload into a zero-width character sequence.
 * @param {string} payload
 * @returns {string} zero-width encoded marker (visually empty)
 */
function encode(payload) {
  const bytes = Buffer.from(String(payload), 'utf8');
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  const body = bits
    .split('')
    .map((b) => (b === '1' ? BIT_1 : BIT_0))
    .join('');
  return START + body + END;
}

/**
 * Decode the first zero-width marker found in a string back to its payload.
 * @param {string} text
 * @returns {string|null} the decoded payload, or null if no valid marker
 */
function decode(text) {
  if (typeof text !== 'string') return null;
  const startIdx = text.indexOf(START);
  if (startIdx === -1) return null;
  // The END sentinel is identical to START, so search after the START marker.
  const endIdx = text.indexOf(END, startIdx + START.length);
  if (endIdx === -1) return null;

  const body = text.slice(startIdx + START.length, endIdx);
  let bits = '';
  for (const ch of body) {
    if (ch === BIT_0) bits += '0';
    else if (ch === BIT_1) bits += '1';
    // ignore any stray characters
  }
  if (bits.length < 8) return null;

  const byteCount = Math.floor(bits.length / 8);
  const bytes = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push(parseInt(bits.slice(i * 8, i * 8 + 8), 2));
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * The encoded canary on its own, for callers that need to place it themselves.
 *
 * embed() inserts after the first space of the text it is given, which is the
 * right call for a result snippet and the wrong one for a whole answer (it
 * lands inside the opening sentence — see nepheshAttribution.js). Callers that
 * know a better spot build the marker here and position it.
 *
 * The MARKER_PREFIX is applied here rather than by the caller, because
 * extract() and scripts/check-watermark.js both require it — a marker encoded
 * without it decodes fine and is then rejected as "not ours".
 *
 * @param {string} traceId
 * @returns {string} zero-width encoded marker
 */
function marker(traceId) {
  return encode(`${MARKER_PREFIX}:${traceId}`);
}

/**
 * Embed an invisible "TRUEGLE:<traceId>" canary into a piece of visible text.
 * The marker is inserted after the first space so it sits inside the text
 * rather than dangling at the very end (where trailing-whitespace trims could
 * catch it). Falls back to appending if there's no space.
 *
 * @param {string} text   the visible text to watermark
 * @param {string} traceId per-request trace token
 * @returns {string} watermarked text (visually identical to the input)
 */
function embed(text, traceId) {
  if (typeof text !== 'string' || text.length === 0) return text;
  // Don't double-watermark.
  if (ZERO_WIDTH_RE.test(text)) {
    ZERO_WIDTH_RE.lastIndex = 0;
    return text;
  }
  const canary = marker(traceId);
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx === -1) return text + canary;
  return text.slice(0, spaceIdx + 1) + canary + text.slice(spaceIdx + 1);
}

/**
 * Extract a Truegle canary payload from text, if present.
 * @param {string} text
 * @returns {{ marker: string, traceId: string|null }|null}
 */
function extract(text) {
  const payload = decode(text);
  if (!payload || !payload.startsWith(`${MARKER_PREFIX}:`)) return null;
  return {
    marker: payload,
    traceId: payload.slice(MARKER_PREFIX.length + 1) || null,
  };
}

/**
 * Strip any zero-width watermark characters from text (for display/debug).
 * @param {string} text
 * @returns {string}
 */
function strip(text) {
  if (typeof text !== 'string') return text;
  return text.replace(ZERO_WIDTH_RE, '');
}

module.exports = {
  embed,
  marker,
  extract,
  encode,
  decode,
  strip,
  MARKER_PREFIX,
};
