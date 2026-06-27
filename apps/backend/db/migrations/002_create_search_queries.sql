CREATE TABLE IF NOT EXISTS search_queries (
  id          BIGSERIAL PRIMARY KEY,
  query       TEXT        NOT NULL,
  mode        VARCHAR(20) NOT NULL DEFAULT 'blue-pill',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the trending aggregation (last 24 h, grouped by query)
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_query      ON search_queries (query);
