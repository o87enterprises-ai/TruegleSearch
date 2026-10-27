-- Player flight-recorder traces on the health beacons.
--
-- A beacon that says "silent, android, youtube" tells the owner THAT a clip
-- went quiet, not WHY. The frontend now keeps a ring buffer of the player's
-- last decisions (apps/frontend/src/utils/playerTrace.js) and attaches the
-- newest 30 to each beacon, so the cause can be read off the trace.
--
-- SAME PRIVACY RULE AS 025: no user, session, IP or raw User-Agent. A trace is
-- event codes and small numbers only — the service re-sanitizes it server-side
-- (never trusting the client): no ids, titles, URLs or free text, hard-capped
-- at 2 KB. `device` and `browser` are coarse buckets, not the User-Agent.
--
-- PlayerHealthService also applies these ALTERs itself on first use, so a
-- deploy never loses beacons because this file has not been run yet.

ALTER TABLE player_health_events
  ADD COLUMN IF NOT EXISTS trace   JSONB,
  ADD COLUMN IF NOT EXISTS device  TEXT,   -- 'touch' | 'desktop'
  ADD COLUMN IF NOT EXISTS browser TEXT;   -- 'chrome' | 'firefox' | 'safari' | 'samsung' | 'other'

CREATE INDEX IF NOT EXISTS idx_player_health_events_browser_reason
  ON player_health_events (browser, reason);
