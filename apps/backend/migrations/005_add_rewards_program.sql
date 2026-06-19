-- Migration: Add opt-in Rewards Program (cash rewards for honestly-viewed ads)
-- Created: 2026-06-19
--
-- Strictly opt-in and additive to the existing house-ad system: users who do not
-- opt in are completely unaffected, and no new tracking happens for them. See
-- RewardsService.js for the server-authoritative anti-fraud verification this
-- schema supports (real elapsed visible time, never client-reported alone).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rewards_opted_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rewards_opted_in_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rewards_balance_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rewards_lifetime_earned_cents INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_rewards_opted_in ON users(rewards_opted_in);

-- Audit trail of every server-verified rewarded ad impression
CREATE TABLE IF NOT EXISTS reward_impressions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  ad_id VARCHAR(255),
  zone VARCHAR(100),
  visible_ms INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_impressions_user ON reward_impressions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_impressions_created ON reward_impressions(created_at);

-- Ledger of every balance-affecting event, for audit/support/dispute resolution
CREATE TABLE IF NOT EXISTS reward_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  entry_type VARCHAR(50) NOT NULL, -- 'earn_impression' | 'payout_request' | 'payout_paid' | 'payout_rejected' | 'adjustment'
  description TEXT,
  balance_after_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON reward_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_type ON reward_ledger(entry_type);

-- Cash-out requests. Real payouts require a funded payout method (e.g. Stripe
-- Connect) to be configured by the business; until then requests queue here
-- with status 'pending' for manual processing instead of silently failing or
-- (worse) pretending money moved when it didn't.
CREATE TABLE IF NOT EXISTS reward_payout_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  method VARCHAR(50) NOT NULL DEFAULT 'manual_review',
  destination VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'rejected'
  notes TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reward_payout_requests_user ON reward_payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_payout_requests_status ON reward_payout_requests(status);
