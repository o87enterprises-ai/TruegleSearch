-- AI answer feedback — thumbs up / down training signal for TrueGLE.
-- Every thumbs-DOWN carries a mandatory brief explanation (enforced at the API
-- layer and NOT NULL-guarded here via a CHECK). This is the raw signal we later
-- mine to fine-tune / correct the model, so we keep the rated answer + its query
-- context alongside the vote.
CREATE TABLE IF NOT EXISTS ai_feedback (
  id          SERIAL PRIMARY KEY,
  vote        TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  -- required for 'down', optional for 'up'
  reason      TEXT,
  answer      TEXT,                                   -- the rated answer (truncated)
  query       TEXT,                                   -- the question / context it answered
  mode        TEXT,                                   -- blue|green|red|purple|ocean or combined
  provider    TEXT,                                   -- which engine/provider served it
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A downvote with no explanation is not useful training signal — reject it.
  CONSTRAINT ai_feedback_down_needs_reason
    CHECK (vote <> 'down' OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_vote ON ai_feedback(vote);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at);
