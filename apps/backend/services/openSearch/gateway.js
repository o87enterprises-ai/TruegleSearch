/**
 * Client for the Hugging Face search-gateway Space (see gatewayServer.js).
 * INERT unless BOTH env vars are set, so merging this changes nothing until the
 * owner has created the Space:
 *   SEARCH_GATEWAY_URL    https://<user>-truegle-search-gateway.hf.space   (https only)
 *   SEARCH_GATEWAY_TOKEN  shared secret, also set as a Space secret
 * Names only here; values live in the platform stores (docs/SECRETS-MAP.md).
 */
const axios = require('axios');

const base = () => String(process.env.SEARCH_GATEWAY_URL || '').trim().replace(/\/+$/, '');
const token = () => String(process.env.SEARCH_GATEWAY_TOKEN || '').trim();
const HEADERS = { 'User-Agent': 'TruegleSearch/1.0 (+https://truegle.info)', 'Content-Type': 'application/json' };

const enabled = () => /^https:\/\/[^/\s]+/.test(base()) && !!token();

/** POST so the query never appears in a URL. Throws on any transport/HTTP error: the caller treats that as "no gateway". */
async function search(feature, q, { limit, safe, providers, timeoutMs }) {
  const { data } = await axios.post(`${base()}/search/${encodeURIComponent(feature)}`,
    { q, limit, safe, providers, deadlineMs: timeoutMs },
    { headers: { ...HEADERS, Authorization: `Bearer ${token()}` }, timeout: timeoutMs });
  return data;
}

/** Best-effort wake-up/keep-alive (free Spaces sleep after ~48h idle). Never throws. */
async function ping() {
  if (!enabled()) return false;
  try { await axios.get(`${base()}/health`, { timeout: 3000, headers: HEADERS }); return true; } catch { return false; }
}

module.exports = { enabled, search, ping };
