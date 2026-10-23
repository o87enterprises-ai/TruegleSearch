-- Automatic player-health beacons — a private log, not a bug-report mailbox.
--
-- Owner, 2026-10-23, right after the player's mailto Report button shipped:
-- a button still needs someone to notice something is wrong AND choose to
-- send it. This is the automatic version — the player tells this table the
-- moment it detects trouble, with nothing for anyone to tap, and the owner
-- checks it on their own schedule (scripts/player-health.mjs) instead of
-- waiting on a stranger's goodwill.
--
-- SAME RULE AS media_signals (019_media_signals.sql): "deliberately incapable
-- of profiling anyone: there is no user column, no session column, no IP
-- column." What is stored here is "a clip of this kind, on this platform,
-- failed this way" — never anything that could be traced back to a visitor.
-- `platform` is a short bucket (ios/android/desktop/other) derived from the
-- User-Agent and thrown away server-side; the raw User-Agent string itself is
-- never written, because on its own it is specific enough to help re-identify
-- a visitor across requests, which is exactly what this table exists to avoid.

CREATE TABLE IF NOT EXISTS player_health_events (
  id          SERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind        TEXT,               -- 'youtube' | 'vimeo' | 'tiktok' | …
  reason      TEXT NOT NULL,      -- 'silent' | 'dead_error' | 'alive_override'
  error_code  TEXT,               -- a real platform error code, when there was one
  heard       BOOLEAN,            -- did the embed ever say anything at all
  muted       BOOLEAN,
  platform    TEXT,               -- 'ios' | 'android' | 'desktop' | 'other'
  connection  TEXT                -- navigator.connection?.effectiveType ('4g', …), or null
);

-- The health query groups by recency and reason — never by anything that
-- would let a single row be picked back out as "this one visitor".
CREATE INDEX IF NOT EXISTS idx_player_health_events_created_at
  ON player_health_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_health_events_reason
  ON player_health_events (reason);
