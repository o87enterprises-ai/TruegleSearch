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

**Alternative (from a laptop/desktop — on Termux, `npm run migrate` needs a
scratch install of `dotenv`+`pg` copied into `apps/backend/node_modules`,
because the workspace root pulls `better-sqlite3` and that needs the Android
NDK):**
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

## ☐ Task 1b — Apply migration 019 (media_signals)

Needed for the 👍/👎 platform pool in True Tube. **Nothing breaks without it:**
`MediaService.signal`/`.trending` swallow their own errors and the routes always
return 200, so thumbs still work (the personal taste profile is localStorage,
never server-side) — only the shared pool that cold-starts recommendations sits
empty.

**Phone path — Neon Console → your project → SQL Editor → paste → Run.** No
connection string required, which matters because *Vercel no longer reveals
stored environment variable values* — you cannot read `DATABASE_URL` back out
of the dashboard, only overwrite it.

```sql
CREATE TABLE IF NOT EXISTS media_signals (
  media_key   TEXT PRIMARY KEY,
  kind        TEXT,
  title       TEXT,
  page_url    TEXT,
  poster      TEXT,
  channel     TEXT,
  ups         INTEGER NOT NULL DEFAULT 0,
  downs       INTEGER NOT NULL DEFAULT 0,
  plays       INTEGER NOT NULL DEFAULT 0,
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_signals_rank
  ON media_signals (ups DESC, plays DESC) WHERE hidden = FALSE;
CREATE INDEX IF NOT EXISTS idx_media_signals_fresh
  ON media_signals (updated_at DESC) WHERE hidden = FALSE;

-- The runner normally creates this; guarded so the block stands alone.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO schema_migrations (filename) VALUES ('019_media_signals.sql')
ON CONFLICT DO NOTHING;
```

Same rules as Task 1: everything is `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`,
so it is safe to re-run, and the last statement marks it applied so a future
`npm run migrate` from a real computer skips it.

There is no user, session or IP column in that table, and that is deliberate —
see the migration file's header. Personal taste never leaves the browser.

### ☐ Verify
```sql
SELECT to_regclass('public.media_signals') AS media_signals;
```
Must show `media_signals`, not `null`.

---

## ☐ Task 1c — Apply migration 020 (media_signals.broken)

Adds the "this doesn't play" counter behind the player's error-review loop.
Same rules as 1b: paste into Neon Console → SQL Editor, safe to re-run, and
nothing breaks without it (the report just doesn't stick platform-wide; the
reporter's own browser still filters it).

```sql
ALTER TABLE media_signals
  ADD COLUMN IF NOT EXISTS broken INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_media_signals_broken
  ON media_signals (broken DESC)
  WHERE broken > 0;

INSERT INTO schema_migrations (filename) VALUES ('020_media_broken.sql')
ON CONFLICT DO NOTHING;
```

### ☐ Verify
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'media_signals' AND column_name = 'broken';
```
Must return one row.

---

## 🔴 Where the connection string actually lives

**Not Vercel.** Vercel stores environment variables write-only — the dashboard
will not show you an existing value. Sources, in order of preference:

1. **Neon Console → your project → Dashboard → Connection string** (pick the
   branch, database and role, then reveal the password). This is the source of
   truth; Vercel only holds a copy.
2. **`npx vercel env pull .env`** from a laptop, if you're logged into the CLI
   and the variable was not marked Sensitive.
3. **Reset it** — Neon Console → Roles → `neondb_owner` → Reset password. ⚠️
   This invalidates the old password *immediately*, so production goes down
   until you paste the new string into Vercel and redeploy. Last resort, and
   see Task 2, which you have to do eventually anyway.

Simplest rule: **use the SQL Editor and you never need the string at all.**

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
