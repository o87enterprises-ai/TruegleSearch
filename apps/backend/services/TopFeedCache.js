/**
 * Server-side cache for the "top posts" feed (the landing page's Top tab and
 * /feed Home). The live answer fans out across eleven networks and takes ten-plus
 * seconds; the posts "on top" do not change by the minute, so one build a day is
 * enough (owner, 2026-11-09: use the cache as much as possible, new cache once a
 * day at 9 AM Pacific).
 *
 * TWO LAYERS: this instance's memory, then Postgres (table feed_cache). Vercel
 * instances are short-lived and many, so memory alone would be a cold cache on
 * most requests; the database is what makes it shared and durable. Both are
 * FAIL-SOFT: no database, or a slow one, just means a miss — never an error.
 *
 * WHAT IS CACHED: only requests keyFor() accepts (social networks, empty query or
 * a fixed fallback seed; see config/topFeed.js). Only GOOD results are stored
 * (enough posts); a result where some network failed is stored too but lives two
 * hours, not a day, so a blip is not frozen in until tomorrow.
 *
 * SAFETY NET: if a live build comes back thin or throws and an OLDER copy exists,
 * the older copy is served. Yesterday's top posts beat an empty feed.
 */
const crypto = require('crypto');
const { TOP_NETWORKS, FALLBACK_SEEDS, PREWARM_REQUEST } = require('../config/topFeed');
const { epochId } = require('../utils/cacheEpoch');

const MIN_GOOD = 8;                      // posts needed before a result is worth keeping
const PARTIAL_TTL_MS = 2 * 60 * 60 * 1000;
const DB_TIMEOUT_MS = 2000;              // a slow database must not slow the feed
const MAX_MEMORY = 300;
const MAX_ROWS = 500;

const memory = new Map();                // key -> entry
const inflight = new Map();              // key -> Promise of a live build
let tableReady = null;

/** Stable key for a cacheable request, or null when the request must not be cached. */
function keyFor({ platforms, query, cursor, limit, adult }) {
  if (!Array.isArray(platforms) || !platforms.length || platforms.includes('all')) return null;
  if (!platforms.every((p) => TOP_NETWORKS.includes(p))) return null;
  const q = typeof query === 'string' ? query.trim() : '';
  if (q && !FALLBACK_SEEDS.includes(q)) return null; // a typed search is never cached
  const cur = cursor && typeof cursor === 'object' ? cursor : {};
  const curStr = JSON.stringify(Object.entries(cur).sort(([a], [b]) => (a < b ? -1 : 1)));
  if (curStr.length > 2000) return null;
  const raw = JSON.stringify({ p: [...new Set(platforms)].sort(), q, c: curStr, l: limit, a: !!adult });
  return crypto.createHash('sha1').update(raw).digest('hex');
}

const isGood = (payload) => !!payload && Array.isArray(payload.results) && payload.results.length >= MIN_GOOD;
// A network that failed for a TRANSIENT reason (timeout, rate limit, 5xx) makes a
// build partial: it lives two hours so the network gets another chance soon. A
// PERMANENT refusal (any other 4xx — e.g. an endpoint that now wants a login) will
// not recover in two hours, so it must not cut the whole day's cache short: it did,
// for every build, while Mastodon answered 422 (2026-11-09).
const PERMANENT = /status code (4(?!29)\d\d)\b/;
const isTransient = (err) => !!err && !PERMANENT.test(String(err));
const isPartial = (payload, platforms) => (platforms || []).some((p) => isTransient(payload?.errors?.[p]));
const isFresh = (e, now) => e.epoch === epochId(now) && (!e.partial || now - e.builtAt < PARTIAL_TTL_MS);

const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => { setTimeout(() => rej(new Error('db timeout')), DB_TIMEOUT_MS); })]);
const db = () => require('../db/connection').query;

async function ensureTable() {
  if (!tableReady) {
    tableReady = db()(
      `CREATE TABLE IF NOT EXISTS feed_cache (
         key TEXT PRIMARY KEY, epoch TEXT NOT NULL, partial BOOLEAN NOT NULL DEFAULT false,
         built_at TIMESTAMPTZ NOT NULL DEFAULT now(), payload JSONB NOT NULL)`,
    ).then(() => true).catch(() => { tableReady = null; return false; });
  }
  return tableReady;
}

async function dbRead(key) {
  try {
    if (!(await withTimeout(ensureTable()))) return null;
    const r = await withTimeout(db()('SELECT epoch, partial, built_at, payload FROM feed_cache WHERE key = $1', [key]));
    const row = r?.rows?.[0];
    if (!row) return null;
    return { epoch: row.epoch, partial: !!row.partial, builtAt: Date.parse(row.built_at) || 0, payload: row.payload };
  } catch { return null; }
}

async function dbWrite(key, e) {
  try {
    if (!(await withTimeout(ensureTable()))) return false;
    await withTimeout(db()(
      `INSERT INTO feed_cache (key, epoch, partial, built_at, payload) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5::jsonb)
       ON CONFLICT (key) DO UPDATE SET epoch = EXCLUDED.epoch, partial = EXCLUDED.partial, built_at = EXCLUDED.built_at, payload = EXCLUDED.payload`,
      [key, e.epoch, e.partial, e.builtAt, JSON.stringify(e.payload)],
    ));
    return true;
  } catch { return false; }
}

function remember(key, e) {
  if (memory.size >= MAX_MEMORY && !memory.has(key)) memory.delete(memory.keys().next().value);
  memory.set(key, e);
}

/** The entry for `key` (memory, then database) with `fresh` set, or null. */
async function read(key, now = Date.now()) {
  const mem = memory.get(key);
  if (mem && isFresh(mem, now)) return { ...mem, fresh: true };
  // Not fresh in memory: another instance may have rebuilt it since.
  const stored = await dbRead(key);
  const best = [mem, stored].filter(Boolean).sort((a, b) => b.builtAt - a.builtAt)[0];
  if (!best) return null;
  remember(key, best);
  return { ...best, fresh: isFresh(best, now) };
}

async function write(key, payload, { partial = false, now = Date.now() } = {}) {
  const e = { epoch: epochId(now), partial, builtAt: now, payload };
  remember(key, e);
  await dbWrite(key, e);
  return e;
}

/**
 * Answer a request through the cache.
 * @returns {{ payload: object, cache: 'hit'|'miss'|'stale'|'thin'|'bypass' }}
 */
async function serve(key, build, { platforms = [], now = Date.now() } = {}) {
  if (!key) return { payload: await build(), cache: 'bypass' };
  const hit = await read(key, now);
  if (hit && hit.fresh) return { payload: hit.payload, cache: 'hit' };

  // One live build per key per instance at a time; concurrent askers share it.
  let live = inflight.get(key);
  if (!live) { live = Promise.resolve().then(build).finally(() => inflight.delete(key)); inflight.set(key, live); }
  let payload; let failure;
  try { payload = await live; } catch (err) { failure = err; }

  if (isGood(payload)) {
    await write(key, payload, { partial: isPartial(payload, platforms), now });
    return { payload, cache: 'miss' };
  }
  if (hit) return { payload: hit.payload, cache: 'stale' }; // yesterday's posts beat an empty feed
  if (failure) throw failure;
  return { payload, cache: 'thin' };
}

/** Rebuild the main landing entry for the current epoch unless it is already fresh. */
async function refreshTop(build, { force = false, now = Date.now() } = {}) {
  const key = keyFor(PREWARM_REQUEST);
  if (!force) {
    const hit = await read(key, now);
    if (hit && hit.fresh) return { status: 'fresh', epoch: hit.epoch };
  }
  const payload = await build();
  if (!isGood(payload)) return { status: 'thin', results: payload?.results?.length || 0 };
  await write(key, payload, { partial: isPartial(payload, PREWARM_REQUEST.platforms), now });
  return { status: 'refreshed', epoch: epochId(now), results: payload.results.length };
}

/** Drop old rows: anything older than three days, and anything past the row cap. */
async function prune() {
  try {
    if (!(await withTimeout(ensureTable()))) return false;
    await withTimeout(db()("DELETE FROM feed_cache WHERE built_at < now() - interval '3 days'"));
    await withTimeout(db()('DELETE FROM feed_cache WHERE key IN (SELECT key FROM feed_cache ORDER BY built_at DESC OFFSET $1)', [MAX_ROWS]));
    return true;
  } catch { return false; }
}

module.exports = {
  keyFor, serve, read, write, refreshTop, prune, isGood, isPartial, MIN_GOOD, PARTIAL_TTL_MS,
  __memory: memory, __inflight: inflight, __resetTable: () => { tableReady = null; },
};
