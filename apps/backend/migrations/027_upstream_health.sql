-- Per-provider, per-UTC-day tally of what each upstream answered (utils/upstreamStats.js).
-- PRIVACY (same rule as 025/026): provider + outcome + count. No query, user, IP or URL.
CREATE TABLE IF NOT EXISTS upstream_health_daily (
  day      DATE    NOT NULL,
  provider TEXT    NOT NULL,
  outcome  TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider, outcome)
);
