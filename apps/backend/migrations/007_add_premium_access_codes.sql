-- Premium access codes — generated after successful PayPal payment.
-- Each code is single-use and expires after 72 hours.
CREATE TABLE IF NOT EXISTS premium_access_codes (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash       TEXT NOT NULL,          -- bcrypt hash of the 8-char code
  used            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pac_user_id ON premium_access_codes(user_id);

-- Direct-registered users (email/phone, no password, no OAuth).
-- These accounts are activated once a valid access code is verified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_method TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
