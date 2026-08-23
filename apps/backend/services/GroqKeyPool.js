/**
 * GroqKeyPool — tapered rotation across Groq orgs, not just keys.
 *
 * Groq meters rate limits **per organization**, so every key inside one org
 * draws on the same RPM/RPD/TPM/TPD bucket. That drives the whole design:
 *
 *   - requests taper round-robin across ORGS, so N orgs is N× the headroom
 *     (spreading across keys within one org would buy nothing);
 *   - a 429 parks the entire org for its retry-after window, because the
 *     sibling keys are limited too and trying them is a wasted round-trip;
 *   - a 401/403 disables just that one key — a revoked key says nothing about
 *     its org-mates, so the next request falls to a sibling;
 *   - each process starts on a random org, because on Vercel every cold start
 *     is a fresh process and a fixed start would point every concurrent lambda
 *     at org 0.
 *
 * Text chat, vision and speech-to-text share one instance, so the three
 * surfaces can't independently drain the same org.
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
  /**
   * @param {Array<{label: string, keys: string[]}>} orgs — one entry per Groq
   *   organization. Config builds these; an ungrouped key becomes its own org.
   */
  constructor(orgs = []) {
    this.orgs = orgs
      .filter(org => org.keys?.length)
      .map(org => ({
        label: org.label,
        keys: org.keys,
        cursor: 0,
        cooldownUntil: 0,
        disabled: org.keys.map(() => false),
      }));
    this.cursor = this.orgs.length ? Math.floor(Math.random() * this.orgs.length) : 0;
  }

  get size() {
    return this.orgs.reduce((n, org) => n + org.keys.length, 0);
  }

  get orgCount() {
    return this.orgs.length;
  }

  isAvailable() {
    return this.orgs.some(org => org.disabled.some(d => !d));
  }

  /**
   * Next key from the next usable org, round-robin. `triedOrgs` holds orgs
   * already rate-limited on this request — a 429 rules out the whole org, so
   * we never come back to it. Returns { org, index, key } or null when nothing
   * is leasable, in which case the caller should fail over to another provider
   * rather than eat a guaranteed 429.
   */
  acquire(triedOrgs = new Set()) {
    const now = Date.now();
    for (let n = 0; n < this.orgs.length; n++) {
      const orgIndex = (this.cursor + n) % this.orgs.length;
      const org = this.orgs[orgIndex];
      if (triedOrgs.has(orgIndex) || org.cooldownUntil > now) continue;

      // Within the org any live key is equivalent (shared bucket); rotate
      // anyway so a single key isn't the only one ever exercised.
      for (let k = 0; k < org.keys.length; k++) {
        const index = (org.cursor + k) % org.keys.length;
        if (org.disabled[index]) continue;
        org.cursor = (index + 1) % org.keys.length;
        this.cursor = (orgIndex + 1) % this.orgs.length;
        return { org: orgIndex, index, key: org.keys[index] };
      }
    }
    return null;
  }

  /** 429 — park the whole org; its other keys share the exhausted bucket. */
  cool(orgIndex, retryAfterHeader) {
    const org = this.orgs[orgIndex];
    if (!org) return;
    const ms = parseRetryAfter(retryAfterHeader);
    org.cooldownUntil = Date.now() + ms;
    logger.warn(`Groq org[${org.label}] rate-limited, cooling all ${org.keys.length} key(s) for ${Math.round(ms / 1000)}s`);
  }

  /** 401/403 — that one key is bad or revoked; its org-mates are unaffected. */
  disable(orgIndex, keyIndex, reason = 'rejected') {
    const org = this.orgs[orgIndex];
    if (!org) return;
    org.disabled[keyIndex] = true;
    const left = org.disabled.filter(d => !d).length;
    logger.error(`Groq org[${org.label}] key[${keyIndex}] disabled (${reason}); ${left} key(s) left in this org`);
  }

  /** Pool state for health checks — counts only, never key material. */
  stats() {
    const now = Date.now();
    const live = org => org.disabled.some(d => !d);
    return {
      orgs: this.orgs.length,
      keys: this.size,
      usableOrgs: this.orgs.filter(o => live(o) && o.cooldownUntil <= now).length,
      coolingOrgs: this.orgs.filter(o => live(o) && o.cooldownUntil > now).length,
      disabledKeys: this.orgs.reduce((n, o) => n + o.disabled.filter(Boolean).length, 0),
    };
  }
}

module.exports = new GroqKeyPool(config.ai?.groq?.orgs || []);
module.exports.GroqKeyPool = GroqKeyPool;
