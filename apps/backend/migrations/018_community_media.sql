-- Community-submitted playable media.
--
-- Sibling of community_reels (017), for the general case: any link the Truegle
-- player can host — a YouTube video, a Vimeo, a TikTok, a SoundCloud track, a
-- direct audio/video file — submitted by a signed-in person so that everyone
-- else can find and play it.
--
-- Why submissions exist at all: Truegle's search stack finds what the web
-- indexes, which is not the same as what our player can play. A track someone
-- knows the link to is invisible to search until somebody says "this plays".
-- This table is that.
--
-- As with reels, ONLY THE LINK is stored. Truegle never copies, re-hosts or
-- re-encodes anything: the media plays from its original platform's own embed
-- (or its own URL), so the creator keeps their views. There is no upload.
--
-- Submissions are attributed: submitted_by is NOT NULL. Anonymous writes to a
-- store every visitor can then play is an open door for spam, so the route
-- requires a signed-in account and this column enforces it at the schema.
CREATE TABLE IF NOT EXISTS community_media (
  id           BIGSERIAL PRIMARY KEY,
  url          TEXT        NOT NULL,
  -- Canonical form used for de-duplication (host + id, lowercased, no query).
  canonical    TEXT        NOT NULL UNIQUE,
  -- What the player will mount: youtube | vimeo | tiktok | soundcloud | video | audio
  kind         TEXT        NOT NULL,
  platform     TEXT        NOT NULL,
  title        TEXT,
  thumbnail    TEXT,
  submitted_by BIGINT      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  plays        INTEGER     NOT NULL DEFAULT 0,
  -- Soft moderation: enough reports drops it out of results without deleting
  -- the row, so a mistake is reversible.
  reports      INTEGER     NOT NULL DEFAULT 0,
  hidden       BOOLEAN     NOT NULL DEFAULT FALSE
);

-- "Newest playable things", the default listing.
CREATE INDEX IF NOT EXISTS idx_community_media_recent
  ON community_media (hidden, created_at DESC);

-- Search is by title OR by the link itself — people paste a URL they half
-- remember as often as they type a name. lower() indexes match the lower()
-- comparisons the service uses for prefix matches; the contains-search falls
-- back to a scan, which is correct at this table's size.
CREATE INDEX IF NOT EXISTS idx_community_media_title
  ON community_media (lower(title));
CREATE INDEX IF NOT EXISTS idx_community_media_canonical
  ON community_media (canonical);
CREATE INDEX IF NOT EXISTS idx_community_media_submitter
  ON community_media (submitted_by, created_at DESC);
