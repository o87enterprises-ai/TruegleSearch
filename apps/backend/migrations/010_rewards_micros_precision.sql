-- Migration: Rewards Program — switch money columns from integer cents to
-- integer micros (millionths of a dollar; 1,000,000 micros = $1).
-- Created: 2026-07-19
--
-- Real Adsterra revenue is sub-cent per impression ($0.000137 observed —
-- see RewardsService.js for the calibration), so integer cents can't
-- represent it without rounding every earn to $0.00. Existing cent values
-- are preserved, just rescaled (×10000).
--
-- Also adds `kind` to reward_impressions so a rewarded event can be recorded
-- as 'impression' (small trickle) or 'click' (real click-through bonus,
-- detected via a window-blur-while-hovering-the-ad heuristic — see
-- RewardAdSlot.jsx). One event per shown ad, click replaces the trickle
-- rather than stacking, matching how Adsterra revenue is actually earned.

ALTER TABLE users RENAME COLUMN rewards_balance_cents TO rewards_balance_micros;
ALTER TABLE users ALTER COLUMN rewards_balance_micros TYPE BIGINT USING rewards_balance_micros::BIGINT * 10000;
ALTER TABLE users ALTER COLUMN rewards_balance_micros SET DEFAULT 0;

ALTER TABLE users RENAME COLUMN rewards_lifetime_earned_cents TO rewards_lifetime_earned_micros;
ALTER TABLE users ALTER COLUMN rewards_lifetime_earned_micros TYPE BIGINT USING rewards_lifetime_earned_micros::BIGINT * 10000;
ALTER TABLE users ALTER COLUMN rewards_lifetime_earned_micros SET DEFAULT 0;

ALTER TABLE reward_impressions RENAME COLUMN amount_cents TO amount_micros;
ALTER TABLE reward_impressions ALTER COLUMN amount_micros TYPE BIGINT USING amount_micros::BIGINT * 10000;
ALTER TABLE reward_impressions ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'impression';

ALTER TABLE reward_ledger RENAME COLUMN amount_cents TO amount_micros;
ALTER TABLE reward_ledger ALTER COLUMN amount_micros TYPE BIGINT USING amount_micros::BIGINT * 10000;
ALTER TABLE reward_ledger RENAME COLUMN balance_after_cents TO balance_after_micros;
ALTER TABLE reward_ledger ALTER COLUMN balance_after_micros TYPE BIGINT USING balance_after_micros::BIGINT * 10000;

ALTER TABLE reward_payout_requests RENAME COLUMN amount_cents TO amount_micros;
ALTER TABLE reward_payout_requests ALTER COLUMN amount_micros TYPE BIGINT USING amount_micros::BIGINT * 10000;
