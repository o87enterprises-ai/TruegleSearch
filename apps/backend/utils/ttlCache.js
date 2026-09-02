/*
 * A tiny process-local TTL cache: Map + { at, value } + expiry check on read +
 * FIFO eviction at a cap.
 *
 * WHY THIS EXISTS. That exact idiom is copy-pasted, by hand, in roughly eight
 * places already (services/OembedService.js, routes/news.js, routes/creators.js
 * and others) — each with its own Map, its own `Date.now() - at > ttl` check,
 * its own oldest-first eviction loop. Every copy is a place the "undefined vs
 * cached-null" distinction (see below) or the eviction logic can silently
 * drift out of sync with the others. This module is the one place to get it
 * right. It does NOT replace those eight call sites — touching working,
 * tested cache code for its own sake is not worth the risk. This exists so
 * NEW code (starting with the feed's embed-resolution cache) stops
 * copy-pasting the idiom a ninth time.
 *
 * PROCESS-LOCAL, ON PURPOSE. This cache lives in one server instance's
 * memory. On Vercel/serverless, every instance gets its own — a cold instance
 * starts empty and a warm one's cache is invisible to its siblings. That is
 * fine here: the TTLs this module backs exist to stay comfortably inside a
 * free tier's rate limit, not to guarantee a single shared answer, and an
 * extra upstream call from a freshly-spun instance is not the thing that
 * would blow a rate limit. If a workload ever needs a cache that is
 * consistent across instances, that is a job for the database or a real
 * cache service, not this file.
 *
 * NO EXTERNAL REQUIRES. Node builtins only (in fact, no requires at all) —
 * this must be `require`-able from scripts/verify-*.mjs, which runs against
 * this repo BEFORE `npm install` has necessarily completed. Do not add a
 * dependency here without moving those verify scripts too.
 */

/**
 * @template V
 * @param {object} [opts]
 * @param {number} opts.ttlMs        how long a value stays fresh, in ms
 * @param {number} [opts.max=500]    max entries before oldest-first eviction
 * @param {() => number} [opts.now]  clock injection, so tests can drive
 *                                   expiry without real waiting
 * @returns {{
 *   get: (key: string) => V | undefined,
 *   set: (key: string, value: V) => V,
 *   has: (key: string) => boolean,
 *   delete: (key: string) => boolean,
 *   clear: () => void,
 *   readonly size: number,
 *   stale: (key: string) => V | undefined,
 *   wrap: (key: string, produce: () => Promise<V>) => Promise<V>,
 * }}
 */
function createTtlCache({ ttlMs, max = 500, now = () => Date.now() } = {}) {
  if (!(ttlMs > 0)) throw new Error('createTtlCache: ttlMs must be a positive number');

  const store = new Map(); // key -> { at, value }

  // In-flight `produce()` promises, keyed the same as `store`. This is what
  // makes wrap() single-flight: while a promise is here, every caller for
  // that key gets handed the SAME promise instead of starting a second,
  // third, fourth... identical fetch. See wrap() below.
  const inFlight = new Map();

  /**
   * undefined = never cached (or expired since). Anything else, including
   * `null` or `false`, is a real cached answer.
   *
   * This distinction is load-bearing (OembedService.js:63 spells out why):
   * collapsing "never looked up" and "looked up and the answer was falsy"
   * into one signal means a legitimate negative result (a 404, an empty
   * list) gets re-fetched on every single read instead of being remembered.
   * The cache would then do the least good on exactly the requests it exists
   * to protect against — the ones that keep failing.
   *
   * Unlike the OembedService copy this idiom is lifted from, an expired hit
   * is NOT deleted here — it is only ignored. That is deliberate: the usual
   * caller-side pattern is "get(), and if that's undefined because the
   * upstream call failed, fall back to stale()". Deleting on read would mean
   * the very act of noticing an entry is stale destroys the fallback stale()
   * exists to serve. Expired entries are cleaned up naturally — overwritten
   * by the next successful set() for that key, or aged out by the FIFO cap.
   */
  function get(key) {
    const hit = store.get(key);
    if (!hit) return undefined;
    if (now() - hit.at > ttlMs) return undefined; // expired, but NOT deleted — see stale() below
    return hit.value;
  }

  function set(key, value) {
    // Oldest-first eviction. Map preserves insertion order, so the first key
    // yielded by an iterator is the oldest — no timestamps to sort, no extra
    // bookkeeping. Re-setting an existing key below moves it to the back of
    // that order (delete-then-add), which is what we want: a refreshed entry
    // should read as freshly inserted, not as the next eviction victim.
    if (!store.has(key) && store.size >= max) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    if (store.has(key)) store.delete(key); // re-insert so it lands at the end
    store.set(key, { at: now(), value });
    return value;
  }

  function has(key) {
    return get(key) !== undefined;
  }

  function del(key) {
    return store.delete(key);
  }

  function clear() {
    store.clear();
    inFlight.clear();
  }

  /**
   * Read a value while ignoring expiry entirely. For the "serve stale rather
   * than nothing when the upstream is down" path — a stale answer beats an
   * empty response. Returns undefined only when the key was never set (or
   * has since been explicitly deleted/cleared), never because of TTL.
   */
  function stale(key) {
    const hit = store.get(key);
    return hit ? hit.value : undefined;
  }

  /**
   * Return the cached value for `key`, or await `produce()` once, cache it,
   * and return that.
   *
   * SINGLE-FLIGHT: if N callers ask for the same missing key at once, only
   * the first actually invokes `produce()`. The rest are handed the same
   * in-flight promise and resolve together with the one real result. Without
   * this, a burst of concurrent requests for a cold key (e.g. N tabs opening
   * the same feed at once) would each kick off their own identical, and
   * possibly rate-limited, upstream call before any of them had a chance to
   * populate the cache for the others.
   *
   * A REJECTED produce() is never cached: the in-flight entry is removed
   * before the rejection propagates, so the very next call gets to try
   * again instead of being stuck replaying a stored failure until it expires.
   */
  async function wrap(key, produce) {
    const cached = get(key);
    if (cached !== undefined) return cached;

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await produce();
        set(key, value);
        return value;
      } finally {
        // Whether produce() resolved or rejected, this key is no longer
        // in-flight. On success the real value is already in `store` above;
        // on failure, deliberately nothing is cached, so the next call
        // retries instead of replaying the same error for a full TTL.
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, promise);
    return promise;
  }

  return {
    get,
    set,
    has,
    delete: del,
    clear,
    get size() { return store.size; },
    stale,
    wrap,
  };
}

module.exports = { createTtlCache };
