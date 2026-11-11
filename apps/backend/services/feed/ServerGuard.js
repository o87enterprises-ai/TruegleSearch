/**
 * One guard in front of every individual feed SERVER (Mastodon, Bluesky, Lemmy,
 * Reddit, Hacker News, GitHub, news, and each SearXNG-backed network:
 * Instagram, Facebook, TikTok, X, Truth, Rumble, Pinterest).
 *
 * Owner, 2026-11-10: "add a stricter caching for the individual feed servers".
 * Before this, only the finished top-posts page was cached; every other request
 * (a pill click, page two, a search) went straight to the upstream, a failing
 * upstream was asked again on every request, and one that was rate-limiting us
 * got hammered until it stopped answering at all (Mastodon's 422, 2026-11-09;
 * Reddit's 403 asked four hosts per request, all day).
 *
 * WHAT run() DOES, in order:
 *   1. FRESH   — an answer younger than `ttlMs` is returned without any call.
 *   2. NEGATIVE — a key that failed for good (403, 404, 422, a config error) is
 *      not asked again for 5 minutes.
 *   3. COOL-DOWN — a server that failed TRANSIENTLY (429, 5xx, timeout, refused)
 *      is left alone: 1 minute, doubling per consecutive failure to 15 minutes.
 *      Any call to it in that window never leaves this process.
 *   4. SINGLE-FLIGHT — N readers asking for the same key share one upstream call.
 *   5. STALE-IF-ERROR — when the call (or the cool-down) means no fresh answer,
 *      the last good one is served if it is under `staleMs` old (6 h). Yesterday's
 *      posts are not worth serving past that: a day-old "top" would then be cached
 *      by TopFeedCache as if it were today's.
 *
 * PROCESS-LOCAL, ON PURPOSE. Like utils/ttlCache.js, this lives in one server
 * instance's memory. Typed searches go through it too, which is why nothing here
 * is ever written to the database: the shared, durable layer is TopFeedCache,
 * and it refuses typed queries (privacy). Keys are never logged.
 *
 * NO EXTERNAL REQUIRES beyond the logger — see utils/ttlCache.js for why.
 */
const logger = require('../../utils/logger');

const BASE_COOLDOWN_MS = 60 * 1000;
const MAX_COOLDOWN_MS = 15 * 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_EMPTY_TTL_MS = 2 * 60 * 1000; // an empty page is believed only briefly
const MAX_ENTRIES = 800;

const TRANSIENT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ERR_NETWORK']);

/** Will this failure probably clear up on its own? (429, 5xx, timeouts, refused.) */
function isTransient(err) {
  const status = err?.response?.status;
  if (status) return status === 429 || status === 408 || status >= 500;
  if (err?.cooling) return true;
  return TRANSIENT_CODES.has(err?.code) || /timeout|timed out/i.test(String(err?.message || ''));
}

function createServerGuard({ now = () => Date.now() } = {}) {
  const entries = new Map();   // `${server}\0${key}` -> { good?: {at, value, empty}, bad?: {at, error} }
  const servers = new Map();   // server -> { failures, openUntil }
  const inflight = new Map();  // entry key -> Promise

  const serverState = (server) => {
    let s = servers.get(server);
    if (!s) { s = { failures: 0, openUntil: 0 }; servers.set(server, s); }
    return s;
  };

  function entryFor(k) {
    let e = entries.get(k);
    if (!e) {
      if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
      e = {};
      entries.set(k, e);
    }
    return e;
  }

  /** run `produce` for (server, key) through the guard. See the header. */
  async function run(server, key, produce, opts = {}) {
    const { ttlMs, staleMs = DEFAULT_STALE_MS, emptyTtlMs = DEFAULT_EMPTY_TTL_MS, isEmpty } = opts;
    if (!(ttlMs > 0)) throw new Error('ServerGuard.run: ttlMs must be a positive number');
    const k = `${server}\0${key}`;
    const t = now();
    const e = entries.get(k);

    const serveStaleOr = (err) => {
      const g = entryFor(k).good;
      if (g && now() - g.at <= staleMs) return g.value;
      throw err;
    };

    // 1. fresh
    if (e?.good) {
      const life = e.good.empty ? Math.min(emptyTtlMs, ttlMs) : ttlMs;
      if (t - e.good.at < life) return e.good.value;
    }
    // 2. a recent permanent failure for this exact key
    if (e?.bad && t - e.bad.at < NEGATIVE_TTL_MS) return serveStaleOr(e.bad.error);
    // 3. the whole server is cooling down
    const srv = serverState(server);
    if (srv.openUntil > t) {
      const err = new Error(`${server} is cooling down after repeated failures (retrying in about ${Math.ceil((srv.openUntil - t) / 1000)}s)`);
      err.cooling = true;
      return serveStaleOr(err);
    }
    // 4. one upstream call per key at a time. The outcome is booked HERE, once,
    // however many readers are sharing the call.
    let pending = inflight.get(k);
    if (!pending) {
      pending = (async () => {
        try {
          const value = await produce();
          const entry = entryFor(k);
          entry.good = { at: now(), value, empty: typeof isEmpty === 'function' ? !!isEmpty(value) : false };
          delete entry.bad;
          srv.failures = 0; srv.openUntil = 0;
          return value;
        } catch (err) {
          const at = now();
          if (isTransient(err)) {
            srv.failures += 1;
            const wait = Math.min(BASE_COOLDOWN_MS * 2 ** (srv.failures - 1), MAX_COOLDOWN_MS);
            srv.openUntil = at + wait;
            logger.warn(`feed server ${server} failing (${err?.response?.status || err?.code || err?.message}); leaving it alone for ${Math.round(wait / 1000)}s`);
          } else {
            entryFor(k).bad = { at, error: err };
          }
          throw err;
        } finally {
          inflight.delete(k);
        }
      })();
      inflight.set(k, pending);
    }
    try {
      return await pending;
    } catch (err) {
      // 5. the last good answer beats an error
      return serveStaleOr(err);
    }
  }

  /** What is cooling down right now — for diagnostics only. */
  function status() {
    const t = now();
    const out = {};
    for (const [server, s] of servers) out[server] = { failures: s.failures, cooling: s.openUntil > t, retryInMs: Math.max(0, s.openUntil - t) };
    return out;
  }

  function reset() { entries.clear(); servers.clear(); inflight.clear(); }

  return { run, status, reset, get size() { return entries.size; } };
}

// The one the routes share.
const shared = createServerGuard();

module.exports = {
  createServerGuard, shared, isTransient,
  BASE_COOLDOWN_MS, MAX_COOLDOWN_MS, NEGATIVE_TTL_MS, DEFAULT_STALE_MS, DEFAULT_EMPTY_TTL_MS,
};
