-- Anonymous community submissions.
--
-- THIS REVERSES A DELIBERATE DECISION, SO IT SAYS WHY.
--
-- Migration 018 made community_media.submitted_by NOT NULL on purpose, and
-- wrote down the reason: "Anonymous writes to a store every visitor can then
-- play is an open door for spam, so the route requires a signed-in account and
-- this column enforces it at the schema."
--
-- That reasoning was right and is not being dismissed. What changed is the
-- product: pasting a link into the feed and having it become a post is meant
-- to be frictionless, and a sign-in wall in front of a paste is the whole
-- friction. So the requirement moves rather than disappears — the protection
-- that used to come from attribution now comes from CONSTRAINING WHAT AN
-- ANONYMOUS SUBMISSION CAN BE:
--
--   · Platform links only. classifyMedia() already throws for anything off the
--     allowlist, and anonymous submissions are further restricted to the
--     hosted platforms (YouTube, Vimeo, TikTok, SoundCloud, Reddit) — NOT the
--     direct .mp4/.mp3 file case that classifyMedia also accepts. A raw file
--     URL is arbitrary media on someone's own server with no platform
--     moderation behind it and nobody to hold responsible; that combination is
--     the one this table must not accept from a stranger.
--   · No submitter-supplied text. A title is read from the platform's own
--     oEmbed, never from the request body, so a submission cannot carry a
--     payload of its own. Free text is the actual spam surface — the link is
--     just a pointer at something a platform is already moderating.
--   · Deduplicated. canonical is UNIQUE, so re-posting the same link is a
--     no-op rather than a way to flood the feed with one video.
--   · Rate limited at the route, and still reportable: `reports`/`hidden`
--     already soft-moderate every row, attributed or not.
--
-- Signed-in submissions are unchanged and keep every capability they had,
-- including direct file links and their own titles.
--
-- NULL here means "nobody claimed this", which is different from a deleted
-- account, and both are different from a real submitter. Anything reading this
-- column must treat NULL as anonymous rather than as missing data.
ALTER TABLE community_media
  ALTER COLUMN submitted_by DROP NOT NULL;

-- "How many anonymous rows arrived recently" — the question a flood makes you
-- ask, and one that would otherwise be a sequential scan over the whole table.
-- Partial, because attributed rows are not what this index is for.
CREATE INDEX IF NOT EXISTS idx_community_media_anon_recent
  ON community_media (created_at DESC)
  WHERE submitted_by IS NULL;
