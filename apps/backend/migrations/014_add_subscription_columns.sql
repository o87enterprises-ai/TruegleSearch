-- Same legacy-drift family as migrations 011-013. DBs bootstrapped via
-- models/User.js's createTable() got a `role` column but never
-- `subscription_tier`/`subscription_status` (those only exist in migration
-- 001's CREATE TABLE, which no-ops when the table already exists). But
-- TokenService.getBalance(), payment.js, and confirm-premium all read/write
-- subscription_tier -- so on those DBs every getBalance() call throws
-- "column subscription_tier does not exist", 500ing sign-in right after a
-- code matches.
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';

-- Back-fill premium tier for anyone still holding a legacy, unexpired
-- premium_until grant, so existing paid users aren't silently downgraded to
-- free. Guarded to DBs that actually have that legacy column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'premium_until'
  ) THEN
    UPDATE users
       SET subscription_tier = 'premium'
     WHERE subscription_tier = 'free'
       AND premium_until IS NOT NULL
       AND premium_until > NOW();
  END IF;
END $$;
