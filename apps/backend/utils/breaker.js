/*
 * Circuit breakers for upstream providers that run out of quota.
 *
 * WHY. Runtime logs (7 days, 2026-10-27) show ~29,000 failed YouTube Data API
 * calls, ~29,000 Google CSE 403s, ~28,000 Brave 429s and ~26,000 NewsAPI 429s —
 * the same dead answer, over and over, each one costing a real round trip
 * (up to 8 s) before the page could fall back. A breaker remembers "this
 * provider just said it is out" and skips the call for a while, then lets one
 * through again automatically, so a key that recovers (new day, plan upgraded,
 * API enabled) is used again with no deploy.
 *
 * NOTHING IS REMOVED. Every key stays configured; the breaker only decides
 * whether to spend a request on it right now.
 *
 * PROCESS-LOCAL, ON PURPOSE (same trade-off as utils/ttlCache.js): on
 * serverless each warm instance learns for itself, so the worst case is one
 * wasted call per cold instance instead of one per search.
 *
 * No requires — usable from scripts/verify-*.mjs before npm install.
 */

const state = new Map(); // name -> { until, reason, trips }

function createBreakers({ now = () => Date.now() } = {}) {
  return {
    /** True while the provider is cooling down. */
    isOpen(name) {
      const s = state.get(name);
      if (!s) return false;
      if (now() >= s.until) return false; // cooled down: allow a probe
      return true;
    },
    /** Open the breaker for `ms` (a provider told us it is out). */
    trip(name, ms, reason = '') {
      const prev = state.get(name);
      state.set(name, { until: now() + Math.max(1000, ms), reason: String(reason).slice(0, 120), trips: (prev?.trips || 0) + 1 });
    },
    /** A call worked: forget the failure. */
    ok(name) { state.delete(name); },
    /** For the admin/health view: who is cooling down, until when, why. */
    status() {
      const t = now();
      const out = {};
      for (const [name, s] of state) {
        if (t < s.until) out[name] = { reopensInMs: s.until - t, reason: s.reason, trips: s.trips };
      }
      return out;
    },
    reset() { state.clear(); },
  };
}

/** ms from `from` until the next midnight in America/Los_Angeles (YouTube's
 *  quota day). Uses Intl so it follows daylight saving; capped to 26 h. */
function msUntilPacificMidnight(from = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(from));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0) % 24;
    const sinceMidnight = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000;
    return Math.min(26 * 3600 * 1000, Math.max(60 * 1000, 24 * 3600 * 1000 - sinceMidnight));
  } catch {
    return 6 * 3600 * 1000;
  }
}

const breakers = createBreakers();

module.exports = { createBreakers, breakers, msUntilPacificMidnight };
