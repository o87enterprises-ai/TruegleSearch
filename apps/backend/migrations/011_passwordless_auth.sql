-- Access-code-only auth: OAuth and email/password are being removed entirely
-- in favor of a single passwordless "email me a code" sign-in flow.

-- No password concept remains -- register-direct already stores a throwaway
-- bcrypt hash here today; new code-only signups don't need one at all.
-- Some DBs never got this column via migration 001 at all -- they were
-- bootstrapped instead by models/User.js's legacy createTable(), which uses
-- a `password` column and predates password_hash entirely. Add it if
-- missing (nullable) before relaxing it, so this is safe either way.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- is_verified is read/written by routes/auth.js (confirm-premium) but was
-- never added by an actual migration -- it only ever existed via
-- models/User.js's createTable(), whose CREATE TABLE IF NOT EXISTS is a
-- no-op once migration 001 has already created the table. Add it for real.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- OAuth removed -- drop the column its login path used.
ALTER TABLE users DROP COLUMN IF EXISTS google_id;

-- One-time codes for the free, self-serve "email me a code" sign-in flow.
-- Distinct from premium_access_codes (single grant issued after a PayPal
-- capture) -- this is a repeatable, free login mechanism tied to an email
-- address rather than a user_id, since the account may not exist yet the
-- first time a code is requested.
CREATE TABLE IF NOT EXISTS login_codes (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code_hash   TEXT NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);
