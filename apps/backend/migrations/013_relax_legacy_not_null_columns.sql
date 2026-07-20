-- Same drift as migrations 011/012: DBs bootstrapped via models/User.js's
-- legacy createTable() have `password` and `name` columns defined NOT NULL
-- with no default (from back when every account required a password and a
-- display name at creation time). Passwordless signups supply neither, so
-- relax both constraints -- but only on DBs where these legacy columns
-- actually exist; migration-001-based schemas never had `password`/`name`
-- at all and shouldn't have them invented here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
  END IF;
END $$;
