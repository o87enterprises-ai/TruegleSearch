-- Server-side cache of the "top posts" feed (services/TopFeedCache.js), so the
-- first visitor of the day is not the one who waits for the scrape, and the
-- cache survives serverless cold starts.
-- PRIVACY (same rule as 025-027): public posts only, keyed by platform set,
-- a fixed seed word and a cursor. No user, IP, session or typed query.
CREATE TABLE IF NOT EXISTS feed_cache (
  key       TEXT        PRIMARY KEY,
  epoch     TEXT        NOT NULL,                 -- Pacific 9 AM day this was built for
  partial   BOOLEAN     NOT NULL DEFAULT false,   -- some network failed: short life
  built_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload   JSONB       NOT NULL
);
CREATE INDEX IF NOT EXISTS feed_cache_built_at_idx ON feed_cache (built_at);
