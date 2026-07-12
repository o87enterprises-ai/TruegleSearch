-- Shared threads — persistent, link-shareable chat conversations and OSINT
-- investigations. A user shares a link; the recipient opens the LIVE thread
-- (full messages + cited links/images/videos), not copy-pasted text.
--
-- Public by design (anyone with the link can view), so no user FK is required;
-- user_id is recorded only when the sharer was signed in, for future "my shares"
-- management. Payload is the whole thread as JSON. A TTL keeps the table bounded.
CREATE TABLE IF NOT EXISTS shared_threads (
  id          TEXT PRIMARY KEY,                        -- short url-safe id (see ShareService)
  kind        TEXT NOT NULL DEFAULT 'chat',            -- 'chat' | 'investigation'
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL,                          -- { mode(s), messages:[{role,content,citations}] }
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
);

CREATE INDEX IF NOT EXISTS idx_shared_threads_expires_at ON shared_threads(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_threads_user_id ON shared_threads(user_id);
