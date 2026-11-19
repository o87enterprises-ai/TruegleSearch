-- "Move my lists" short links (routes/moveLists.js). The browser encrypts the
-- saved-lists code with a random key that lives only in the link's #fragment, so
-- this table holds ciphertext the server cannot read. Rows live 24 hours at most
-- and are deleted once the receiving device imports them.
-- PRIVACY: no user, IP, session or account is stored — just id, blob, created_at.
CREATE TABLE IF NOT EXISTS move_links (
  id         TEXT        PRIMARY KEY,
  blob       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS move_links_created_at_idx ON move_links (created_at);
