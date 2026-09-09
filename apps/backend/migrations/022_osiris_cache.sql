-- Live-intelligence feed bodies, cached where every instance can see them.
--
-- WHY THIS TABLE EXISTS AND AN IN-MEMORY MAP DOES NOT DO.
--
-- OsirisService caches each upstream feed so the map is fast and so the
-- upstream is called rarely. On a long-lived server a Map in process memory is
-- exactly right. This backend runs on Vercel, where every invocation may be a
-- fresh process — so that Map is empty most of the time and both of the things
-- it was there for quietly stop being true:
--
--   SPEED. The probe measured the heavy feeds (aircraft, satellites, vessels,
--   cameras) past 12 seconds. With a per-instance cache, a large share of map
--   loads pay that instead of a rare few.
--
--   PRIVACY, which is the one that actually matters. The whole reason these
--   feeds are proxied rather than fetched from the browser is that a direct
--   fetch would hand the upstream every visitor's IP and, through the bounding
--   box, a record of where they were looking. The cache is what collapses many
--   visitors into one upstream call — it IS the anonymity set. A cache that is
--   usually cold means close to one upstream call per visitor, which restores
--   the correlation the proxy was built to destroy. Not a leak of identity,
--   but a leak of RATE and TIMING, and a much weaker guarantee than the one
--   the code claims.
--
-- Shared storage fixes both at once: the first instance to fetch a feed serves
-- every instance after it, for as long as the entry is good.
--
-- WHAT IS IN HERE: public feed bodies, exactly as the upstream returned them.
-- Aircraft positions, earthquake epicentres, fire detections, vessel
-- positions. No user column, no session column, no IP column, and no
-- per-request row — the same discipline as feed_embeds (021). This table
-- cannot say who looked at what, only what the world looked like at a moment.
-- Anything that adds an identifiable column here is a policy change, not a
-- schema change.

CREATE TABLE IF NOT EXISTS osiris_cache (
  -- The layer id from OsirisService's LAYERS table: 'flights', 'earthquakes'…
  layer       TEXT PRIMARY KEY,
  -- The upstream body verbatim, normalised on read rather than on write, so a
  -- fix to the normaliser applies to already-cached data instead of needing
  -- the cache cleared to take effect.
  body        JSONB       NOT NULL,
  -- Where it came from, so a row cached from the public host is not silently
  -- served after the deployment is repointed at a self-hosted instance.
  source      TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The sweeper asks "what is old enough to drop".
CREATE INDEX IF NOT EXISTS idx_osiris_cache_fetched
  ON osiris_cache (fetched_at);
