const jwt = require('jsonwebtoken');

// In-memory denylist with automatic TTL cleanup
// In production, use Redis for multi-instance support
const denylist = new Map();

const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up every 60s

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [token, exp] of denylist) {
    if (exp <= now) {
      denylist.delete(token);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Add a token to the denylist until its natural expiry
 */
function add(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      denylist.set(token, decoded.exp);
    }
  } catch {
    // If we can't decode it, it's already invalid — no need to denylist
  }
}

/**
 * Check if a token has been revoked
 */
function isRevoked(token) {
  return denylist.has(token);
}

module.exports = { add, isRevoked };
