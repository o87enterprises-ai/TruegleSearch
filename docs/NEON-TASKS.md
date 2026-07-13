# Neon / Production DB — Tasks Checklist

> Keep this file. It's the standalone record of the production database tasks so
> they never have to be dug out of a chat log again.
>
> **When:** deferred on purpose until **pre-ship** (final testing + security
> hardening), NOT during ongoing dev. Dev uses an isolated Neon `dev` branch or
> local Postgres (see `DEV-SETUP.md`). No secrets are stored in this file.

---

## ☐ Task 1 — Apply pending migrations (008 + 009)

Two tables must exist in prod before share links and the thumbs feedback work,
or those routes 500: `shared_threads` (008) and `ai_feedback` (009).

**Easiest path (no local setup, works from a phone):** Neon Console → your
project → **SQL Editor** → paste and **Run**:

```sql
CREATE TABLE IF NOT EXISTS shared_threads (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'chat',
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL,
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days')
);
CREATE INDEX IF NOT EXISTS idx_shared_threads_expires_at ON shared_threads(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_threads_user_id ON shared_threads(user_id);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id          SERIAL PRIMARY KEY,
  vote        TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  reason      TEXT,
  answer      TEXT,
  query       TEXT,
  mode        TEXT,
  provider    TEXT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_feedback_down_needs_reason
    CHECK (vote <> 'down' OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_vote ON ai_feedback(vote);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO schema_migrations (filename) VALUES
  ('008_add_shared_threads.sql'),
  ('009_add_ai_feedback.sql')
ON CONFLICT DO NOTHING;
```

Everything is `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` — safe to re-run, can't
duplicate or overwrite. The last block marks these applied so a future
`npm run migrate` (from a real computer) skips them.

**Alternative (from a laptop/desktop, NOT Termux — native modules fail on
Android):**
```bash
cd apps/backend
DATABASE_URL="<prod-connection-string>" npm run migrate
```

### ☐ Verify
Run as a second query:
```sql
SELECT to_regclass('public.shared_threads') AS shared_threads,
       to_regclass('public.ai_feedback')    AS ai_feedback;
```
Both columns must show the table name, not `null`.

---

## ☐ Task 2 — Rotate the DB password (SECURITY)

The `neondb_owner` password was pasted into chat during setup — treat it as
compromised and rotate before real launch.

1. Neon Console → project → **Roles** → `neondb_owner` → **Reset password**
   (this invalidates the old password immediately).
2. Copy the new connection string.
3. Vercel → backend project → **Settings → Environment Variables** → update
   `DATABASE_URL` with the new string.
4. **Redeploy** the backend so it picks up the new value.
5. If you made a Neon `dev` branch, its password may differ — update your local
   `apps/backend/.env` too if needed.

---

## ☐ Task 3 — Production env vars (set ONCE at launch)

Full annotated list: `apps/backend/.env.example` (committed manifest). At launch,
set these in Vercel (backend) and Cloudflare Pages (frontend). Minimum to boot:
`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_API_KEY`,
`GOOGLE_SEARCH_ENGINE_ID`. Recommended for AI quality: `GROQ_API_KEY(_2.._5)`,
`GROQ_MODEL=llama-3.3-70b-versatile`, and `GEMINI_API_KEY` (gives refusal
failover a second provider).

---

_Generated for Truegle. Dev workflow that avoids re-doing prod env vars every
iteration: see `DEV-SETUP.md`._
