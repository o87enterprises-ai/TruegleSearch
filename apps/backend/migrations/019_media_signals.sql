-- Anonymous 👍/👎/play counters, keyed by the media itself.
--
-- This table is deliberately incapable of profiling anyone: there is no user
-- column, no session column, no IP column and no per-vote row. A vote is an
-- integer added to a counter and then it is gone. What survives is "this video
-- has 41 ups and 3 downs", which is exactly enough to give a brand-new visitor
-- something worth watching and no more.
--
-- Personal taste lives in the visitor's own browser (see
-- apps/frontend/src/utils/taste.js) and is never sent here.
--
-- media_key mirrors mediaKey() on the client and classifyMedia().canonical on
-- the server: platform + the platform's own id, so the same video counted from
-- a watch URL, a youtu.be link and an embed all land on one row.

CREATE TABLE IF NOT EXISTS media_signals (
  media_key   TEXT PRIMARY KEY,
  kind        TEXT,
  title       TEXT,
  page_url    TEXT,
  poster      TEXT,
  channel     TEXT,
  ups         INTEGER NOT NULL DEFAULT 0,
  downs       INTEGER NOT NULL DEFAULT 0,
  plays       INTEGER NOT NULL DEFAULT 0,
  -- Enough downs and it stops being recommended to anyone. Soft, and
  -- reversible, like community_media.hidden.
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ranking reads the whole table ordered by score, so keep the candidates cheap
-- to find: only rows that anyone has actually voted on are ever recommended.
CREATE INDEX IF NOT EXISTS idx_media_signals_rank
  ON media_signals (ups DESC, plays DESC)
  WHERE hidden = FALSE;

CREATE INDEX IF NOT EXISTS idx_media_signals_fresh
  ON media_signals (updated_at DESC)
  WHERE hidden = FALSE;
