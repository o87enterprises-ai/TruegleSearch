/**
 * GroqKeyPool — shared, tapered rotation across every Groq free-tier key.
 *
 * The old behaviour was sticky: key 0 served every request until it 429'd,
 * so one key burned its daily quota while the rest sat idle, and a
 * rate-limited key was retried on the very next request. This pool instead:
 *
 *   - hands out keys round-robin, so load is spread evenly (the "taper");
 *   - parks a 429'd key for exactly as long as Groq's retry-after says;
 *   - drops a 401/403 key out of rotation for the life of the process;
 *   - starts each process on a random key, because on Vercel every cold start
 *     is a fresh process and a fixed start would point them all at key 0.
 *
 * Text chat, vision and speech-to-text all share one instance, so the three
 * surfaces can't independently overload the same key.
 */
const config = require('../config/env');
const logger = require('../utils/logger');

const DEFAULT_COOLDOWN_MS = 60_000;
const MIN_COOLDOWN_MS = 1_000;
const MAX_COOLDOWN_MS = 60 * 60_000; // daily-limit retry-afters can be hours; cap at 1h

/** Groq sends retry-after in (possibly fractional) seconds; HTTP dates are also legal. */
function parseRetryAfter(header) {
  if (!header) return DEFAULT_COOLDOWN_MS;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms)) return DEFAULT_COOLDOWN_MS;
  return Math.min(Math.max(ms, MIN_COOLDOWN_MS), MAX_COOLDOWN_MS);
}

class GroqKeyPool {
  constructor(keys = []) {
    this.keys = keys;
    this.cursor = keys.length ? Math.floor(Math.random() * keys.length) : 0;
    this.cooldownUntil = keys.map(() => 0);
    this.disabled = keys.map(() => false);
  }

  get size() {
    return this.keys.length;
  }

  isAvailable() {
    return this.keys.some((_, i) => !this.disabled[i]);
  }

  /**
   * Next key in round-robin order that is neither disabled, cooling down, nor
   * already tried on this request. Returns { index, key } or null when the
   * pool has nothing left to offer — the caller should fail over to another
   * provider rather than eat a guaranteed 429.
   */
  acquire(tried = new Set()) {
    const now = Date.now();
    for (let n = 0; n < this.keys.length; n++) {
      const index = (this.cursor + n) % this.keys.length;
      if (tried.has(index) || this.disabled[index] || this.cooldownUntil[index] > now) continue;
      this.cursor = (index + 1) % this.keys.length;
      return { index, key: this.keys[index] };
    }
    return null;
  }

  /** 429 — park this key until Groq says it's ready. */
  cool(index, retryAfterHeader) {
    const ms = parseRetryAfter(retryAfterHeader);
    this.cooldownUntil[index] = Date.now() + ms;
    logger.warn(`Groq key[${index}] rate-limited, cooling for ${Math.round(ms / 1000)}s`);
  }

  /** 401/403 — the key is bad or revoked; stop spending requests on it. */
  disable(index, reason = 'rejected') {
    this.disabled[index] = true;
    logger.error(`Groq key[${index}] disabled (${reason}); ${this.stats().usable} key(s) still usable`);
  }

  /** Pool state for health checks — counts only, never key material. */
  stats() {
    const now = Date.now();
    return {
      total: this.keys.length,
      usable: this.keys.filter((_, i) => !this.disabled[i] && this.cooldownUntil[i] <= now).length,
      cooling: this.keys.filter((_, i) => !this.disabled[i] && this.cooldownUntil[i] > now).length,
      disabled: this.disabled.filter(Boolean).length,
    };
  }
}

module.exports = new GroqKeyPool(config.ai?.groq?.keys || []);
module.exports.GroqKeyPool = GroqKeyPool;
