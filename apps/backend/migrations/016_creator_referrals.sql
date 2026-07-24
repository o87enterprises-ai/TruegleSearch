-- Creator referral attribution (for the featured-creator weekly rotation +
-- future revenue-share). One row per creator ref_code per day, incremented on
-- each attributed visit. Bounded row count; the featured pick is a 7-day SUM.
CREATE TABLE IF NOT EXISTS creator_ref_daily (
  ref_code TEXT    NOT NULL,
  day      DATE    NOT NULL DEFAULT CURRENT_DATE,
  hits     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ref_code, day)
);

CREATE INDEX IF NOT EXISTS idx_creator_ref_day ON creator_ref_daily (day);
