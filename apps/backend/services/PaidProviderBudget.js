const logger = require('../utils/logger');

/**
 * A day's worth of permission to spend money.
 *
 * WHY THIS EXISTS. The owner started getting "your searches are exhausted"
 * emails from SerpApi while believing the self-hosted SearXNG served every
 * query. Both halves were true at once: SearXNG IS primary for web search, and
 * SerpApi was ALSO being called — automatically, on any query where the free
 * providers returned fewer than five web results, with no cap, no counter and
 * nothing on screen to show it had happened. On a metasearch instance that is
 * frequently cold, "fewer than five results" is not the rare case. It is most
 * of a bad afternoon.
 *
 * THE RULE THIS ENFORCES: holding an API key is not the same as authorising
 * spend. Under a $0 budget the presence of a credential must never by itself
 * open a paid tap — somebody has to say how much, in an environment variable,
 * on purpose. So the default limit is ZERO, and a configured key with no limit
 * set is simply never called.
 *
 * IN-MEMORY, AND THAT IS A REAL LIMIT WORTH KNOWING. Serverless means several
 * instances, each with its own counter, and a cold start resets one to zero. So
 * this is a BRAKE, not an accountant: it turns "unbounded" into "bounded by
 * roughly the limit times the number of warm instances". A true global counter
 * needs shared storage, and the honest version of that is a follow-up rather
 * than a claim made here.
 */

// provider -> { day, used }
const counters = new Map();

// Date.now() explicitly rather than `new Date()`: V8 reads the system clock
// directly for the no-arg constructor, so a test that patches Date.now cannot
// move this — and a day-rollover that cannot be tested is a day-rollover
// nobody has checked.
const today = () => new Date(Date.now()).toISOString().slice(0, 10);

function entry(provider) {
  const now = today();
  const held = counters.get(provider);
  if (!held || held.day !== now) {
    const fresh = { day: now, used: 0 };
    counters.set(provider, fresh);
    return fresh;
  }
  return held;
}

/**
 * May this provider be called right now?
 *
 * @param {string} provider  e.g. 'serpapi'
 * @param {number} limit     calls permitted per UTC day; 0 or less means never
 * @returns {{ok: boolean, used: number, limit: number, reason?: string}}
 */
function check(provider, limit) {
  const cap = Number(limit) || 0;
  if (cap <= 0) {
    return { ok: false, used: 0, limit: 0, reason: 'no daily budget configured' };
  }
  const state = entry(provider);
  if (state.used >= cap) {
    return { ok: false, used: state.used, limit: cap, reason: `daily budget spent (${state.used}/${cap})` };
  }
  return { ok: true, used: state.used, limit: cap };
}

/** Record that a call was actually made. Call this on the way OUT, not in. */
function spend(provider) {
  const state = entry(provider);
  state.used += 1;
  return state.used;
}

/**
 * check() and spend() together, for the common case.
 * @returns {{ok: boolean, used: number, limit: number, reason?: string}}
 */
function claim(provider, limit) {
  const verdict = check(provider, limit);
  if (!verdict.ok) return verdict;
  const used = spend(provider);
  // Logged at the boundary because this is the only line in the system that
  // corresponds to money leaving. A spend nobody can find in a log is how the
  // original problem went unnoticed until the vendor emailed about it.
  logger.info(`💸 paid provider call: ${provider} ${used}/${verdict.limit} today`);
  return { ...verdict, used };
}

/** What has been spent today, for /health and for the search trace. */
function report() {
  const now = today();
  const out = {};
  for (const [provider, state] of counters) {
    if (state.day === now) out[provider] = state.used;
  }
  return out;
}

/** Tests only. */
function _reset() { counters.clear(); }

module.exports = { check, spend, claim, report, _reset };
