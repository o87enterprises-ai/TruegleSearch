-- Migration: Self-reported "sign up via an affiliate offer, get 1 month of
-- Truegle Premium free" giveaway.
-- Created: 2026-06-21
--
-- premium_until is intentionally independent of subscription_tier: a paid
-- Stripe subscription (routes/payment.js grantPremium/revokePremium) never
-- touches this column, so nothing in this migration can ever downgrade a
-- paying customer. A user is premium if EITHER subscription_tier = 'premium'
-- OR premium_until is still in the future (see TokenService.getBalance).
--
-- There is no CJ (or other network) postback receiver in this codebase yet,
-- so claims are self-reported and grant Premium immediately on claim. Each
-- claim starts 'pending' so a future real conversion-verification hook can
-- flip it to 'confirmed' without a schema change (AffiliatePremiumService
-- .confirmClaim). Until that exists, AffiliatePremiumService.sweepExpiredClaims
-- claws back the granted days from any claim still 'pending' past its
-- confirm_by deadline, so self-reporting alone can't accumulate Premium time
-- indefinitely by stacking claims.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP;

CREATE TABLE IF NOT EXISTS affiliate_premium_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  offer_id VARCHAR(100) NOT NULL, -- AFFILIATE_OFFERS id, see frontend config/houseAds.js
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'expired' | 'revoked'
  granted_days INTEGER NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  confirm_by TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_claims_user ON affiliate_premium_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_claims_status ON affiliate_premium_claims(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_claims_confirm_by ON affiliate_premium_claims(confirm_by);
