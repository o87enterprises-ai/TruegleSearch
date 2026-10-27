const { query } = require('../db/connection');
const logger = require('../utils/logger');

// Automatic player-health beacons. See migrations/025_player_health.sql for
// the privacy rule this follows (same as media_signals): no user, session,
// IP or raw User-Agent is ever accepted or stored — only enough to say "a
// clip of this kind, on this platform, failed this way".

const REASONS = new Set([
  'silent', 'dead_error', 'alive_override',
  // Added with the flight recorder (migrations/026_player_trace.sql):
  'unmute_rejected', 'autonext_empty', 'autonext_repeat', 'mode_fail',
]);
const DEVICES = new Set(['touch', 'desktop']);
const BROWSERS = new Set(['chrome', 'firefox', 'safari', 'samsung', 'other']);
const TRACE_CODES = new Set(['mode', 'src', 'embed', 'sound', 'next', 'tap', 'upstream', 'boot']);
const TRACE_MAX_EVENTS = 30;
const TRACE_MAX_BYTES = 2048;
const TOKEN = /^[a-z0-9_.:-]{1,24}$/i;
const KINDS = new Set(['youtube', 'vimeo', 'tiktok', 'soundcloud', 'file', 'audio', 'video', 'embed']);
const PLATFORMS = new Set(['ios', 'android', 'desktop', 'other']);

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const enumOrNull = (v, set) => (typeof v === 'string' && set.has(v) ? v : null);

// The trace comes from a public, anonymous endpoint, so it is rebuilt from
// scratch here: only known event codes, only numbers / booleans / short
// tokens as values, bounded count and size. Anything else is dropped, so a
// stale or hostile client cannot put text, ids or URLs into the table.
function cleanTrace(raw) {
  if (!Array.isArray(raw)) return null;
  let events = [];
  for (const ev of raw.slice(-TRACE_MAX_EVENTS)) {
    if (!ev || typeof ev !== 'object') continue;
    if (typeof ev.e !== 'string' || !TRACE_CODES.has(ev.e)) continue;
    const out = { t: Number.isFinite(ev.t) ? Math.round(ev.t * 100) / 100 : 0, e: ev.e };
    if (ev.d && typeof ev.d === 'object' && !Array.isArray(ev.d)) {
      const d = {};
      for (const [k, v] of Object.entries(ev.d).slice(0, 12)) {
        if (!TOKEN.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) d[k] = v;
        else if (typeof v === 'boolean') d[k] = v;
        else if (typeof v === 'string' && TOKEN.test(v)) d[k] = v;
      }
      if (Object.keys(d).length) out.d = d;
    }
    events.push(out);
  }
  while (events.length > 1 && JSON.stringify(events).length > TRACE_MAX_BYTES) events = events.slice(1);
  if (!events.length || JSON.stringify(events).length > TRACE_MAX_BYTES) return null;
  return events;
}

// The new columns are added lazily, once per instance, so beacons are never
// lost because migration 026 hasn't been run yet. If the ALTER is refused
// (permissions), record() falls back to the original 025 columns.
let columnsReady = null;
function ensureColumns() {
  if (!columnsReady) {
    columnsReady = query(
      `ALTER TABLE player_health_events
         ADD COLUMN IF NOT EXISTS trace JSONB,
         ADD COLUMN IF NOT EXISTS device TEXT,
         ADD COLUMN IF NOT EXISTS browser TEXT`,
    ).then(() => true).catch((err) => {
      logger.warn('Player health: could not add trace columns', { error: err && err.message });
      return false;
    });
  }
  return columnsReady;
}

const PlayerHealthService = {
  /**
   * Record one beacon. `reason` is required and must be one of REASONS —
   * anything else is a silent no-op rather than a thrown error, since this
   * runs off the back of a `sendBeacon`/`fetch(keepalive)` call that nobody
   * is waiting on and that must never surface as a problem to a visitor.
   *
   * Never throws: a lost beacon must not cost anybody a working player, and
   * a database hiccup here is not something the person playing a video
   * should ever see.
   */
  async record({ kind, reason, errorCode, heard, muted, platform, connection, trace, device, browser } = {}) {
    const r = enumOrNull(reason, REASONS);
    if (!r) return { ok: false };
    try {
      if (await ensureColumns()) {
        const cleaned = cleanTrace(trace);
        await query(
          `INSERT INTO player_health_events (kind, reason, error_code, heard, muted, platform, connection, trace, device, browser)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            enumOrNull(kind, KINDS),
            r,
            clean(errorCode, 20),
            bool(heard),
            bool(muted),
            enumOrNull(platform, PLATFORMS) || 'other',
            clean(connection, 10),
            cleaned ? JSON.stringify(cleaned) : null,
            enumOrNull(device, DEVICES),
            enumOrNull(browser, BROWSERS),
          ],
        );
        return { ok: true };
      }
      await query(
        `INSERT INTO player_health_events (kind, reason, error_code, heard, muted, platform, connection)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          enumOrNull(kind, KINDS),
          r,
          clean(errorCode, 20),
          bool(heard),
          bool(muted),
          enumOrNull(platform, PLATFORMS) || 'other',
          clean(connection, 10),
        ],
      );
      return { ok: true };
    } catch (err) {
      logger.warn('Player health beacon failed', { error: err && err.message });
      return { ok: false };
    }
  },

  /**
   * A summary for the owner's own periodic check (scripts/player-health.mjs),
   * never raw rows — counts by reason/kind/platform, and the error codes
   * actually seen, over the trailing `days`.
   */
  async summary({ days = 7, reason } = {}) {
    const window = Math.min(90, Math.max(1, Number(days) || 7));
    const wantReason = enumOrNull(reason, REASONS);
    await ensureColumns();
    const [byReason, byKind, byPlatform, byError, total, byBrowser, recent] = await Promise.all([
      query(
        `SELECT reason, COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval
         GROUP BY reason ORDER BY count DESC`,
        [window],
      ),
      query(
        `SELECT COALESCE(kind, 'unknown') AS kind, COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval
         GROUP BY kind ORDER BY count DESC`,
        [window],
      ),
      query(
        `SELECT platform, COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval
         GROUP BY platform ORDER BY count DESC`,
        [window],
      ),
      query(
        `SELECT error_code, COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval AND error_code IS NOT NULL
         GROUP BY error_code ORDER BY count DESC LIMIT 10`,
        [window],
      ),
      query(
        `SELECT COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval`,
        [window],
      ),
      query(
        `SELECT COALESCE(browser, 'unknown') AS browser, reason, COUNT(*)::int AS count FROM player_health_events
         WHERE created_at > now() - ($1 || ' days')::interval
         GROUP BY browser, reason ORDER BY count DESC`,
        [window],
      ),
      // The 20 newest traces for ONE reason (?reason=silent) — the part that
      // answers "why". Only when asked for, and never any identifying column.
      wantReason
        ? query(
          `SELECT created_at, kind, platform, device, browser, error_code, heard, muted, trace
           FROM player_health_events
           WHERE reason = $1 AND trace IS NOT NULL AND created_at > now() - ($2 || ' days')::interval
           ORDER BY created_at DESC LIMIT 20`,
          [wantReason, window],
        )
        : Promise.resolve({ rows: [] }),
    ]);
    return {
      days: window,
      total: total.rows[0]?.count || 0,
      byReason: byReason.rows,
      byKind: byKind.rows,
      byPlatform: byPlatform.rows,
      byErrorCode: byError.rows,
      byBrowserReason: byBrowser.rows,
      recentReason: wantReason,
      recentTraces: recent.rows,
    };
  },
};

module.exports = { PlayerHealthService, REASONS, KINDS, PLATFORMS, cleanTrace };
// Test hook: forget the once-per-instance column check.
module.exports._resetColumns = () => { columnsReady = null; };
