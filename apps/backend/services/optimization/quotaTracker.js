/**
 * Quota tracker — Postgres-backed daily per-provider call counter.
 *
 * Purpose (the plan's "free-tier maxing"): keep the autopilot engine from
 * eating the free-tier headroom that live user traffic needs. Before calling a
 * provider the router checks isExceeded(); after a call it records usage. State
 * lives in Postgres (NOT Redis — rejected as non-$0) so it's shared across the
 * serverless backend and the GitHub Action, and survives cold starts.
 *
 * Everything degrades to a safe no-op if the DB/table is unavailable (a fresh
 * deploy, or local runs without DATABASE_URL) — quota must never block the
 * engine, only throttle it.
 */

const log = require('./log');

let query = null;
try {
  ({ query } = require('../../db/connection'));
} catch (e) {
  log.warn('quotaTracker: DB connection unavailable, quota tracking disabled');
}

async function usedToday(provider) {
  if (!query) return 0;
  try {
    const { rows } = await query(
      'SELECT calls FROM ai_quota_usage WHERE provider = $1 AND usage_date = CURRENT_DATE',
      [provider]
    );
    return rows[0]?.calls || 0;
  } catch {
    return 0; // table missing / DB down → treat as unlimited, don't block
  }
}

async function isExceeded(provider, cap) {
  return (await usedToday(provider)) >= cap;
}

async function record(provider, n = 1) {
  if (!query) return;
  try {
    await query(
      `INSERT INTO ai_quota_usage (provider, usage_date, calls)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (provider, usage_date)
       DO UPDATE SET calls = ai_quota_usage.calls + EXCLUDED.calls`,
      [provider, n]
    );
  } catch {
    /* non-fatal */
  }
}

module.exports = { usedToday, isExceeded, record };
