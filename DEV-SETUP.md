# Truegle — Secure Dev Environment (until launch)

The goal: **develop and test safely without ever touching production**, and
**never re-derive env vars again**. Two committed manifests
(`apps/backend/.env.example`, `apps/frontend/.env.example`) are the single
source of truth for every variable; you fill a real `.env` **once**.

Timeline reality: soft launch to family & friends first; official launch later.
Nothing here spends money — it all runs on free tiers or locally.

---

## One-time setup (do this once, then forget it)

```bash
# From the repo root
cp apps/backend/.env.example  apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Then open `apps/backend/.env` and fill **only the 5 REQUIRED-TO-BOOT keys** to
start (everything else degrades gracefully when blank):

| Key | Dev value |
|-----|-----------|
| `DATABASE_URL` | your dev DB (see below) |
| `JWT_SECRET` | any long random string — `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | exactly 32 chars |
| `GOOGLE_API_KEY` | your Google Programmable Search key |
| `GOOGLE_SEARCH_ENGINE_ID` | your search engine id |

Add AI keys (`GROQ_API_KEY`, …) when you want live AI locally; without them the
AI features simply hide. **`.env` is gitignored — it never gets committed.**

---

## Dev database — pick ONE (both keep prod untouched)

### Option A — Neon dev branch  ✅ recommended
Neon's free tier includes **database branching**. A branch is a full, isolated
copy of prod's schema with its own connection string — you can wreck it freely
and prod is never affected.

1. Neon console → your project → **Branches** → **New branch** → name it `dev`.
2. Copy the `dev` branch connection string into `apps/backend/.env` as
   `DATABASE_URL`.
3. Apply the schema to it once (from a real computer, not the phone):
   `cd apps/backend && npm run migrate`

Because it mirrors prod exactly, what works on `dev` works on prod — no
"works locally, breaks in prod" surprises.

### Option B — Local Postgres  (fully offline, zero cloud)
```bash
# one-time
initdb -U truegle /tmp/pgdata-truegle
pg_ctl -D /tmp/pgdata-truegle -l /tmp/pgdata-truegle/server.log start
createdb -U truegle truegle_dev
# .env: DATABASE_URL=postgresql://truegle@localhost:5432/truegle_dev?sslmode=disable
cd apps/backend && npm run migrate
```

---

## Run it locally

```bash
npm install                    # repo root (workspaces)
npm run dev --workspace apps/backend    # http://localhost:3001
npm run dev --workspace apps/frontend   # http://localhost:5173
```
Frontend talks to the backend via `VITE_BACKEND_URL` (already set to localhost
in the example). No console errors = you're good (ponytail: verify in browser).

---

## Soft-launch to family & friends (when ready)

Keep prod (`main` → Vercel + Cloudflare Pages) sacred. For the friends-&-family
round, use an **isolated preview**, not prod:

- **Backend:** a Vercel **preview deployment** off a `staging` branch, with its
  env pointing `DATABASE_URL` at the Neon **`dev` branch** (Option A). Vercel
  gives every branch its own URL automatically.
- **Frontend:** a Cloudflare Pages preview (also per-branch) with
  `VITE_BACKEND_URL` = the preview backend URL.
- Share the preview URLs with testers. Prod stays clean; you promote to prod
  only when you're ready.

This means **production env vars get set exactly once** (at real launch),
instead of being re-entered every iteration — dev iterates on the dev branch.

---

## Production go-live checklist

Production DB migrations + secret rotation are **deferred until pre-ship**
(final testing + security hardening). The exact steps live in
`docs/NEON-TASKS.md` (also delivered as a downloadable checklist) so they don't
have to be reconstructed from chat.
