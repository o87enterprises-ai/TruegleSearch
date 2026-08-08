-- "This one doesn't play" — an anonymous counter, same shape as the 👍/👎 pool.
--
-- A search result can look perfectly playable and still be dead: the upload was
-- removed, embedding was disabled by the uploader, it is region-locked, or the
-- host quietly 404s inside the iframe. None of that is visible from the URL, so
-- getPlayable() cannot filter it and every visitor discovers it the same way —
-- by pressing play and getting nothing.
--
-- Once enough people (or the embed itself) report a key as dead, it stops being
-- offered to anybody. Like every other counter in this table there is no user,
-- session or IP column: what is stored is "this video is broken", not "who said
-- so".
--
-- Reversible on purpose: a region-locked video is dead for some viewers and
-- fine for others, and an upload can come back. The threshold is a lower bound
-- to clear, not a permanent ban, and `ups` counts against it — something people
-- have actually enjoyed needs more reports to disappear.

ALTER TABLE media_signals
  ADD COLUMN IF NOT EXISTS broken INTEGER NOT NULL DEFAULT 0;

-- The blocklist read is "give me everything currently considered dead", so it
-- wants its own partial index rather than a scan of the whole table.
CREATE INDEX IF NOT EXISTS idx_media_signals_broken
  ON media_signals (broken DESC)
  WHERE broken > 0;
