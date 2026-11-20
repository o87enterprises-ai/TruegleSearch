-- Store-and-forward mailbox for Nearby internet messages (routes/mailbox.js).
-- Each row is ONE end-to-end encrypted envelope (see frontend mesh/seal.js). The server cannot read
-- the text, the sender or even who it is from: only the recipient handle (needed to deliver) and
-- the opaque blob are stored. Rows are deleted when the recipient acknowledges them, and
-- unconditionally after 7 days.
-- PRIVACY: no sender, IP, account or device information is stored.
CREATE TABLE IF NOT EXISTS mailbox (
  id         BIGSERIAL   PRIMARY KEY,
  recipient  TEXT        NOT NULL,
  msg_id     TEXT        NOT NULL,
  blob       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recipient, msg_id)
);
CREATE INDEX IF NOT EXISTS mailbox_recipient_idx ON mailbox (recipient, id);
CREATE INDEX IF NOT EXISTS mailbox_created_at_idx ON mailbox (created_at);
