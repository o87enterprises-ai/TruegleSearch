# Secrets Map

**Names and locations only. Never values — not here, not in chat, not in a commit.**

This exists so no agent has to ask the user for a key twice. If you need a
secret, look up its NAME here and the STORE it lives in; the user sets the
value in that store directly. An agent should never see, echo, or transcribe a
key value.

## How to hand a new key to an agent

1. **Set it yourself in the platform store** (Vercel → Project → Settings →
   Environment Variables, or `vercel env add <NAME> production` which reads the
   value from stdin and never touches shell history).
2. **Tell the agent only the NAME and how many** — e.g. "GROQ_API_KEY_6 through
   _12 are set". That is all the code needs.
3. **Add the NAME to this file** in the same session.
4. Redeploy: Vercel only picks up env changes on a new build.

Never paste a value into a chat transcript, an issue, a PR body, a commit, a
log line, or a `.env` file that is tracked by git. Transcripts persist and
containers are snapshotted; a pasted key must be treated as burned and rotated.

If a key does leak: revoke it at the provider first, then remove it from the
store, then rotate. Revoke before cleanup — cleanup is not containment.

## Stores

| Store | What lives there | Who sets it |
|---|---|---|
| **Vercel** (project env vars) | Every backend secret in the table below | User, via dashboard or `vercel env add` |
| **Cloudflare Pages** (env vars) | `VITE_*` frontend build vars | User, via dashboard |
| **EC2 env file** (`44.236.219.63`, us-west-2) | SearXNG instance config | User, via EC2 Instance Connect |
| **Hardcoded, public by nature** | Ad zone keys in `apps/frontend/src/config/ads.js` | In git — these are not secrets |

Validation and read paths: backend `apps/backend/config/env.js` (Joi schema);
frontend `import.meta.env.VITE_*` via `apps/frontend/src/config/env.js`.

## Groq (primary AI substrate)

Groq free-tier limits are **per key**, so more keys = more headroom. The pool
is tapered round-robin by `apps/backend/services/GroqKeyPool.js`; a key that
429s is parked for its `retry-after` window instead of being retried.

| Name | Store | Purpose |
|---|---|---|
| `GROQ_API_KEYS` | Vercel | **Preferred for bulk.** Whole pool in one variable, comma/newline separated. No count limit. |
| `GROQ_API_KEY` | Vercel | Original single key. Still honoured. |
| `GROQ_API_KEY_2` … `GROQ_API_KEY_50` | Vercel | Numbered slots. Was capped at 5; now scans to 50. |
| `GROQ_MODEL`, `GROQ_VISION_MODEL` | Vercel | Model ids — not secrets. |

All three sources are additive and de-duplicated, so mixing them is safe.
Text chat, vision and speech-to-text share the one pool.

## Other backend secrets (all in Vercel)

**AI providers:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`NVIDIA_API_KEY`, `HUGGINGFACE_API_KEY`, `DEEPSEEK_API_KEY` (deprecated —
do not use), `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2` … `_6`,
`OPENROUTER_API_KEY_UNLIMITED`, `NEPHESH_BASE_URL`, `NEPHESH_AUTH_TOKEN`,
`NEPHESH_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_AUTH_TOKEN`, `OLLAMA_MODEL`.

**Search:** `GOOGLE_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`, `BING_API_KEY`,
`BRAVE_API_KEY`, `SERP_API_KEY`, `SERP_DAILY_LIMIT`, `NEWS_API_KEY`,
`YOUTUBE_API_KEY`, `SEARXNG_URL`, `SEARXNG_PRIMARY`, `SEARXNG_PRIMARY_MIN`,
`SEARXNG_RESULT_PROXY_URL`, `SEARXNG_RESULT_PROXY_KEY`.

**Speech / media:** `STT_BASE_URL`, `STT_MODEL`, `STT_API_KEY` (only for a
self-hosted Whisper — on Groq it uses the pool above), `DEEPGRAM_API_KEY`,
`UNSPLASH_ACCESS_KEY`, `UNSPLASH_SECRET_KEY`, `UNSPLASH_ACCOUNT_ID`,
`TRANSCRIPT_PROXY_URL`, `TRANSCRIPT_INVIDIOUS_INSTANCES`.

**Data / OSINT:** `SHODAN_API_KEY`, `HUNTER_IO_API_KEY`, `APIFY_API_KEY`,
`BRIGHT_DATA_API_KEY`, `ENSEMBLE_SOCIAL_API_KEY`, `REDDIT_CLIENT_ID`,
`REDDIT_CLIENT_SECRET`.

**Maps / weather:** `RADAR_LIVE_SECRET_KEY`, `RADAR_LIVE_PUBLISHABLE_KEY`,
`RADAR_TEST_SECRET_KEY`, `RADAR_TEST_PUBLISHABLE_KEY`, `MAPBOX_ACCESS_TOKEN`,
`TOMTOM_API_KEY`, `OPENWEATHER_API_KEY`, `OPENWEATHER_API_KEY_2`.

**Core / infra:** `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, `REDIS_URL`,
`SENTRY_DSN`, `FRONTEND_URL`, `PORT`, `NODE_ENV`, `RATE_LIMIT_WINDOW_MS`,
`RATE_LIMIT_MAX_REQUESTS`, `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`.

**Mail:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`.

**Money / ads:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`,
`ADSENSE_PUBLISHER_ID`, `ADMOB_API_KEY`, `ADMOB_APP_ID`.

## Frontend build vars (Cloudflare Pages)

These ship to the browser — **nothing genuinely secret belongs here**:
`VITE_BACKEND_URL`, `VITE_AD_DOMAIN`, `VITE_SOURCEMAP`,
`VITE_GOOGLE_SEARCH_ENGINE_ID`, `VITE_GOOGLE_SHOPPING_ENGINE_ID`,
`VITE_MAPBOX_ACCESS_TOKEN`, `VITE_PAYPAL_CLIENT_ID`, and the ad-network
toggles (`VITE_HILLTOPADS_*`, `VITE_PROPELLERADS_*`, `VITE_MEDIANET_*`,
`VITE_ETHICALADS_*`, `VITE_GHOST_*`, `VITE_SMARTLINK_URL`).
