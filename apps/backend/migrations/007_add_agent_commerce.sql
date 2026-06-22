-- Migration: Agent Commerce Network — scaffold for an AI-agent-facing product
-- marketplace (semantic product search + per-key quotas + 402 upgrade flow).
-- Created: 2026-06-22
--
-- Status: exploratory / unmerged scaffold. Nothing here is wired into the live
-- search product yet — see HANDOFF.md "AI Agent Commerce Network (scaffold)"
-- for what's stubbed and what a real launch still needs.
--
-- Design notes:
--   * agent_identities reuses the EXISTING human JWT/OAuth users table — an
--     "agent identity" is just a Truegle user opting in, not a parallel
--     account system. One identity per user_id (UNIQUE).
--   * agent_api_keys stores only a SHA-256 hash of the raw key (key_hash),
--     plus a short key_prefix for display/log purposes — the raw key is
--     never persisted, only returned once at issuance time.
--   * agent_products.embedding is a plain JSONB float array. This is fine at
--     catalog sizes in the hundreds/low-thousands; swap to pgvector + an ANN
--     index (ivfflat/hnsw) once the catalog or query volume justifies it.

CREATE TABLE IF NOT EXISTS agent_identities (
  did VARCHAR(80) PRIMARY KEY, -- e.g. did:truegle:<uuid>
  user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  display_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE, -- sha256 hex digest of the raw key
  key_prefix VARCHAR(16) NOT NULL, -- e.g. tgak_3f9a... for display/logging only
  agent_did VARCHAR(80) NOT NULL REFERENCES agent_identities(did),
  tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'pro'
  quota_limit INTEGER NOT NULL,
  quota_remaining INTEGER NOT NULL,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_products (
  id VARCHAR(64) PRIMARY KEY, -- uuid
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_amount NUMERIC(12, 2) NOT NULL,
  price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  category VARCHAR(100),
  merchant_did VARCHAR(80) NOT NULL REFERENCES agent_identities(did),
  embedding JSONB, -- float[] from AgentEmbeddingService.embed() — pgvector candidate later
  stock_proof JSONB, -- merchant-supplied availability/provenance claim, unverified
  attributes JSONB DEFAULT '{}',
  last_verified TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_transactions (
  id VARCHAR(64) PRIMARY KEY, -- uuid
  agent_did VARCHAR(80) NOT NULL REFERENCES agent_identities(did),
  cart JSONB NOT NULL, -- [{productId, quantity}, ...] snapshot at transact time
  status VARCHAR(20) NOT NULL DEFAULT 'created', -- 'created' | 'pending_payment' | 'fulfilled' | 'cancelled'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_did ON agent_api_keys(agent_did);
CREATE INDEX IF NOT EXISTS idx_agent_products_merchant_did ON agent_products(merchant_did);
CREATE INDEX IF NOT EXISTS idx_agent_products_category ON agent_products(category);
CREATE INDEX IF NOT EXISTS idx_agent_products_updated_at ON agent_products(updated_at);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_agent_did ON agent_transactions(agent_did);
