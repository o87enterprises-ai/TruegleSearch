-- Migration: Rewards Program — switch from view/click crediting to OFFER-BASED
-- (CPA conversion) crediting.
-- Created: 2026-07-28
--
-- Adsterra (and every performance network) pays the publisher on CONVERSIONS —
-- a completed offer: an install, a sign-up, a purchase — not on ad views or
-- clicks. The old loop rewarded honestly-measured views/clicks, which inflated
-- CTR while earning ~$0 and risked invalid-traffic flags (that's why the route
-- was disabled). This reworks rewards to pay users a revenue-share of REAL,
-- network-confirmed offer conversions attributed to them via a per-user opaque
-- referral id (rewards_ref) carried through the offer link as a SubID and
-- returned by Adsterra's server-to-server postback.
--
-- Additive and idempotent (IF NOT EXISTS): the money columns (micros) and the
-- ledger/payout tables from migrations 005/010 are reused unchanged.

-- Per-user opaque attribution id, passed as the offer-link SubID. Not the
-- sequential user id, so the offer URL leaks nothing about the account.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rewards_ref VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_rewards_ref ON users(rewards_ref) WHERE rewards_ref IS NOT NULL;

-- Every network-confirmed conversion, credited once. conversion_id is the
-- network's unique id for the event, so a replayed postback can't double-credit.
CREATE TABLE IF NOT EXISTS reward_conversions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  conversion_id VARCHAR(255) NOT NULL UNIQUE,
  offer_name VARCHAR(255),
  country VARCHAR(8),
  payout_micros BIGINT NOT NULL,       -- network payout for the conversion
  user_share_micros BIGINT NOT NULL,   -- what we credited the user
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'reversed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reward_conversions_user ON reward_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_conversions_created ON reward_conversions(created_at);
