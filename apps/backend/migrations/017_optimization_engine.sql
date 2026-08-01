-- Autonomous SEO/AEO/GEO citation engine.
-- Idempotent (auto-run by server.js autoMigrate on every boot).

-- Daily per-provider AI call counter so the autopilot engine yields free-tier
-- headroom to live user traffic (Postgres, not Redis — $0/zero-ops).
CREATE TABLE IF NOT EXISTS ai_quota_usage (
  provider   VARCHAR(40) NOT NULL,
  usage_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  calls      INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, usage_date)
);

-- Audit trail of what the engine published (also powers the GEO Pulse status
-- and dedup). No user data — only the public page it created.
CREATE TABLE IF NOT EXISTS citation_log (
  id         BIGSERIAL PRIMARY KEY,
  slug       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  topic      TEXT,
  source     VARCHAR(20) NOT NULL DEFAULT 'backlog', -- 'trending' | 'backlog'
  demand     INTEGER     NOT NULL DEFAULT 0,
  provider   VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_citation_log_created ON citation_log (created_at DESC);
