/*
 * UPSTREAM HEALTH — what each provider actually answered, per day, and which
 * ones failed for THIS request.
 *
 * WHY. The circuit breakers (utils/breaker.js) decide whether to spend a call;
 * nothing recorded what the providers said back. When a phone reports "the
 * search came back thin", the owner had to read raw Vercel logs to learn that
 * Brave's monthly quota or YouTube's daily one was spent. Two things fix that:
 *
 *   1. Per-provider, per-UTC-day counters of ok / 429 / 403 / timeout / error /
 *      skipped (the breaker was open), kept in memory and flushed to Postgres
 *      (table upstream_health_daily, migrations/027). Read it back with
 *      `node scripts/upstream-health.mjs`.
 *   2. A per-request `degraded` list ("brave", "youtube", ...) the search route
 *      returns, so the player's flight recorder (frontend utils/playerTrace.js)
 *      can say WHY a result list was short.
 *
 * PRIVACY (same rule as 025/026): a counter by provider and day. No query, no
 * user, no IP, no URL — nothing that could describe a visitor.
 *
 * BEST EFFORT, NEVER LOAD-BEARING. Serverless instances freeze after a
 * response, so the Postgres tally can undercount; the numbers are for
 * direction ("Brave is out", "YouTube 429s all day"), not billing. Nothing
 * here may throw into, or slow down, a search.
 *
 * Only builtins are required at load time (the DB is required lazily on flush),
 * so scripts and tests can load this without a database.
 */
const { AsyncLocalStorage } = require('node:async_hooks');

const PROVIDERS = new Set([
  'youtube', 'brave', 'google_cse', 'newsapi', 'tomtom', 'openrouter', 'searxng', 'serpapi',
]);
const OUTCOMES = new Set(['ok', '429', '403', 'timeout', 'error', 'skipped']);

const als = new AsyncLocalStorage();
const totals = new Map();   // "day|provider|outcome" -> count, this instance only
const pending = new Map();  // same keys -> delta not yet flushed to Postgres
const startedAt = Date.now();
const FLUSH_EVERY_MS = 15000;
const MAX_PENDING = 200;

let lastFlush = 0;
let flushing = false;
let tableReady = null;
let injectedFlush = null; // tests

const day = () => new Date().toISOString().slice(0, 10);

/** Keep the real HTTP status on an error whose message we rewrite for callers. */
function withStatus(err, status) { err.status = status; return err; }

/** Classify a thrown error (or HTTP-ish object) into an outcome; null = not worth counting. */
function outcomeOf(err) {
  const status = err && (err.response && err.response.status || err.status || err.statusCode);
  if (status === 429) return '429';
  if (status === 403 || status === 401) return '403';
  const msg = String(err && err.message || err || '');
  if (/not configured/i.test(msg)) return null;
  if (/paused|cooling down/i.test(msg)) return 'skipped';
  if (/429|rate limit|too ?many|quota/i.test(msg)) return '429';
  if (/403|forbidden|invalid|not enabled|permission/i.test(msg)) return '403';
  if (/timeout|timed out|ETIMEDOUT|ECONNABORTED|aborted/i.test(msg)) return 'timeout';
  if (err && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')) return 'timeout';
  return 'error';
}

function markDegraded(provider) {
  const store = als.getStore();
  if (store && PROVIDERS.has(provider)) store.degraded.add(provider);
}

function bump(map, key) { map.set(key, (map.get(key) || 0) + 1); }

/** Count one answer from `provider`. Never throws. */
function record(provider, outcome) {
  try {
    if (!PROVIDERS.has(provider) || !OUTCOMES.has(outcome)) return;
    const key = `${day()}|${provider}|${outcome}`;
    bump(totals, key);
    if (pending.size < MAX_PENDING || pending.has(key)) bump(pending, key);
    if (outcome !== 'ok') markDegraded(provider);
    maybeFlush();
  } catch { /* counting must never cost a search */ }
}

/** Wrap an async provider method so every call is counted. */
function track(provider, fn) {
  return async function tracked(...args) {
    try {
      const out = await fn.apply(this, args);
      record(provider, 'ok');
      return out;
    } catch (err) {
      record(provider, outcomeOf(err));
      throw err;
    }
  };
}

/** Start collecting `degraded` for the rest of this request's async chain. */
function beginRequest() {
  try { als.enterWith({ degraded: new Set() }); } catch { /* ALS unavailable — degraded stays [] */ }
}

function degraded() {
  const store = als.getStore();
  return store ? [...store.degraded].sort() : [];
}

// ── Postgres (lazy, throttled, best effort) ─────────────────────────────────
function maybeFlush() {
  if (!pending.size || flushing) return;
  if (Date.now() - lastFlush < FLUSH_EVERY_MS) return;
  flush().catch(() => {});
}

async function flush() {
  if (!pending.size || flushing) return false;
  const run = injectedFlush || (process.env.NODE_ENV === 'test' ? null : defaultFlush);
  if (!run) return false;
  flushing = true;
  lastFlush = Date.now();
  const batch = new Map(pending);
  pending.clear();
  try {
    await run([...batch].map(([key, count]) => {
      const [d, provider, outcome] = key.split('|');
      return { day: d, provider, outcome, count };
    }));
    return true;
  } catch {
    // Put the deltas back (bounded) so a DB hiccup doesn't lose them.
    for (const [k, v] of batch) if (pending.size < MAX_PENDING || pending.has(k)) pending.set(k, (pending.get(k) || 0) + v);
    return false;
  } finally {
    flushing = false;
  }
}

async function ensureTable(query) {
  if (!tableReady) {
    tableReady = query(
      `CREATE TABLE IF NOT EXISTS upstream_health_daily (
         day DATE NOT NULL, provider TEXT NOT NULL, outcome TEXT NOT NULL,
         count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, provider, outcome))`,
    ).then(() => true).catch(() => { tableReady = null; return false; });
  }
  return tableReady;
}

async function defaultFlush(rows) {
  const { query } = require('../db/connection');
  if (!(await ensureTable(query))) throw new Error('upstream_health_daily unavailable');
  for (const r of rows) {
    await query(
      `INSERT INTO upstream_health_daily (day, provider, outcome, count) VALUES ($1, $2, $3, $4)
       ON CONFLICT (day, provider, outcome) DO UPDATE SET count = upstream_health_daily.count + EXCLUDED.count`,
      [r.day, r.provider, r.outcome, r.count],
    );
  }
}

/** Last `days` of persisted counts, plus this instance's unflushed tally. */
async function history(days = 7) {
  const window = Math.min(60, Math.max(1, Number(days) || 7));
  const { query } = require('../db/connection');
  await ensureTable(query);
  const r = await query(
    `SELECT day::text AS day, provider, outcome, count FROM upstream_health_daily
     WHERE day > (now() AT TIME ZONE 'utc')::date - $1::int ORDER BY day DESC, provider, outcome`,
    [window],
  );
  return r.rows;
}

/** This warm instance's counters (since it started) — available even with no database. */
function snapshot() {
  const out = {};
  for (const [key, count] of totals) {
    const [d, provider, outcome] = key.split('|');
    ((out[d] = out[d] || {})[provider] = out[d][provider] || {})[outcome] = count;
  }
  return { sinceMs: Date.now() - startedAt, counts: out };
}

module.exports = {
  PROVIDERS, OUTCOMES, outcomeOf, withStatus, record, track, beginRequest, degraded, markDegraded,
  flush, history, snapshot,
  // test hooks
  _setFlush(fn) { injectedFlush = fn; lastFlush = 0; },
  _reset() { totals.clear(); pending.clear(); lastFlush = 0; flushing = false; tableReady = null; injectedFlush = null; },
};
