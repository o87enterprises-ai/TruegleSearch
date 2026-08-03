-- Community-submitted reels.
--
-- Why this table exists: TikTok, Instagram Reels and Facebook Reels have no
-- free search API — discovery for those three is gated behind Meta/TikTok app
-- review, which Truegle does not have. YouTube Shorts can be discovered, the
-- other platforms cannot. So the aggregated reels feed is fed two ways:
-- discovered YouTube Shorts, plus reels people submit here.
--
-- Only the URL is stored. Truegle never copies or re-hosts the video — the
-- clip plays from the original platform's own embed, so the creator keeps
-- their views.
CREATE TABLE IF NOT EXISTS community_reels (
  id          BIGSERIAL PRIMARY KEY,
  url         TEXT        NOT NULL,
  -- Canonical form used for de-duplication (lowercased, query string dropped).
  canonical   TEXT        NOT NULL UNIQUE,
  platform    TEXT        NOT NULL,
  title       TEXT,
  thumbnail   TEXT,
  submitted_by BIGINT,                     -- NULL for anonymous submissions
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plays       INTEGER     NOT NULL DEFAULT 0,
  -- Soft moderation: a reel reported enough times drops out of the feed
  -- without deleting the row, so a mistake is reversible.
  reports     INTEGER     NOT NULL DEFAULT 0,
  hidden      BOOLEAN     NOT NULL DEFAULT FALSE
);

-- The feed reads "newest visible reels", optionally per platform.
CREATE INDEX IF NOT EXISTS idx_community_reels_feed
  ON community_reels (hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_reels_platform
  ON community_reels (platform, hidden, created_at DESC);
