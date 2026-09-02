-- Resolved feed embed URLs, cached.
--
-- Turning a video/post link into something the player can actually embed
-- costs an outbound request — an oEmbed call or a scrape of the page — every
-- single time it happens. The feed shows the same popular clips to many
-- visitors, so paying that cost once per link and recalling it for free on
-- every later render is the difference between a handful of upstream calls a
-- day and one per pageview. This table is that recall: the resolved embed
-- form, keyed by the media itself, refreshed on a TTL rather than looked up
-- again from scratch.
--
-- Only the URL and public display metadata are stored - the title, channel
-- name, poster image URL and the resolved embed src. Truegle never copies or
-- re-hosts the video: the clip still plays from the original platform's own
-- embed, so the creator keeps their views (see 017_community_reels.sql).
--
-- media_key mirrors mediaKey() on the client and classifyMedia().canonical on
-- the server: platform + the platform's own id, so a watch URL, a shortlink
-- and an embed URL for the same video all land on one row.
--
-- No user column, no session column, no IP column, and no per-request row -
-- this table cannot say who watched what, only that a given piece of media
-- was resolved and what its embed looks like. Truegle sets zero cookies and
-- any PR that adds identifiable logging gets rejected on sight, so there is
-- nothing here to log against a person even by accident.

CREATE TABLE IF NOT EXISTS feed_embeds (
  media_key   TEXT PRIMARY KEY,
  kind        TEXT,
  -- The resolved embed/iframe URL - what the player actually points at.
  src         TEXT,
  -- The original watch/post page, kept for "open on original site" links.
  page_url    TEXT,
  title       TEXT,
  channel     TEXT,
  poster      TEXT,
  -- 9:16 portrait media (YouTube Shorts, TikTok) gets a different card shape
  -- in the feed, so this is resolved once here rather than re-derived from
  -- the URL on every render.
  vertical    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The feed's refresh path asks "what did we resolve most recently", to
-- decide what is due for another look versus still comfortably within TTL.
CREATE INDEX IF NOT EXISTS idx_feed_embeds_updated
  ON feed_embeds (updated_at DESC);
