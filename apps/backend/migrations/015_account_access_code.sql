-- Reusable per-account access code. Passwordless sign-in issues a one-time
-- emailed code (login_codes), but users on private browsers (no persisted
-- session) would have to email themselves a code every single visit. This
-- gives each account a durable, reusable code they can save and type on any
-- device to sign in instantly — bcrypt-hashed here, rotatable, never stored
-- in plaintext. Generated once on first sign-in and shown to the user then.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_code_hash TEXT;
