const { query } = require('../db/connection');
const logger = require('../utils/logger');

// Automatic player-health beacons. See migrations/025_player_health.sql for
// the privacy rule this follows (same as media_signals): no user, session,
// IP or raw User-Agent is ever accepted or stored — only enough to say "a
// clip of this kind, on this platform, failed this way".

const REASONS = new Set(['silent', 'dead_error', 'alive_override']);
const KINDS = new Set(['youtube', 'vimeo', 'tiktok', 'soundcloud', 'file', 'audio', 'video', 'embed']);
const PLATFORMS = new Set(['ios', 'android', 'desktop', 'other']);

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const bool = (v) => (typeof v === 'boolean' ? v : null);
const enumOrNull = (v, set) => (typeof v === 'string' && set.has(v) ? v : null);

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
  async record({ kind, reason, errorCode, heard, muted, platform, connection } = {}) {
    const r = enumOrNull(reason, REASONS);
    if (!r) return { ok: false };
    try {
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
  async summary({ days = 7 } = {}) {
    const window = Math.min(90, Math.max(1, Number(days) || 7));
    const [byReason, byKind, byPlatform, byError, total] = await Promise.all([
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
    ]);
    return {
      days: window,
      total: total.rows[0]?.count || 0,
      byReason: byReason.rows,
      byKind: byKind.rows,
      byPlatform: byPlatform.rows,
      byErrorCode: byError.rows,
    };
  },
};

module.exports = { PlayerHealthService, REASONS, KINDS, PLATFORMS };
