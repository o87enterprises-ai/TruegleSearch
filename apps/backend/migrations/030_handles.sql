-- Anonymous handles for Nearby / relay messaging (routes/handles.js).
-- A handle is a screen name the DEVICE picked (e.g. "calm-otter-4821"). It is bound only to two
-- PUBLIC keys: ecdh_pub (others encrypt to it) and sign_pub (proves a request came from the owner).
-- PRIVACY: no email, user id, IP, device id or account is stored. Private keys never leave the device.
-- `searchable` is OFF by default: a handle is found by typing it exactly or scanning its QR code;
-- only people who opt in appear in prefix search.
CREATE TABLE IF NOT EXISTS handles (
  handle     TEXT        PRIMARY KEY,
  ecdh_pub   TEXT        NOT NULL,
  sign_pub   TEXT        NOT NULL,
  searchable BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS handles_searchable_idx ON handles (handle text_pattern_ops) WHERE searchable;
CREATE INDEX IF NOT EXISTS handles_last_seen_idx ON handles (last_seen);
