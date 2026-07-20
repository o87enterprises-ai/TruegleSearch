-- Some DBs (bootstrapped via models/User.js's legacy createTable(), same
-- root cause as migration 011's password_hash issue) only ever got a `name`
-- column, never `username` -- but every raw SQL query in routes/auth.js and
-- models/User.js written since migration 001 assumes `username` exists.
-- Add it (nullable) so those queries stop failing, and back-fill it from
-- `name` where that legacy column is present so existing accounts aren't
-- left with a blank username.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    UPDATE users SET username = name WHERE username IS NULL AND name IS NOT NULL;
  END IF;
END $$;
