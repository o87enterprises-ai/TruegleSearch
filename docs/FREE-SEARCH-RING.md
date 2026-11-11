# The free search ring

**Why.** The keyed providers are out of quota. One week of logs (2026-10-27, see
`apps/backend/utils/breaker.js`) showed ~28,000 Brave 429s, ~29,000 Google CSE 403s,
~29,000 YouTube failures and ~26,000 NewsAPI 429s; SearXNG alone still falls short on
niche queries because the engines behind it rate-limit it. Budget is $0, so the answer is
more free sources used carefully — `services/FreeSearchRing.js`.

**How it works.** When a search comes back with fewer than `RING_MIN_WEB` (8) ordinary web
pages, the ring runs:

1. the **key-free** providers beside each other (Wikipedia, Marginalia);
2. the **keyed** providers one after another in a **rotating** order, until one returns at
   least 3 results (at most 3 tried). A provider that is out of budget, cooling down or failing
   is skipped and the next one takes the request.

Each provider has a **daily call budget** (below its free allowance ÷ 30) and a **breaker**:
429/402 opens it until the next UTC midnight, 401/403 for 6 hours, the shared Marginalia key's
per-minute limit for 2 minutes. Answers are cached 30 minutes in memory. All of it is
process-local on serverless: a brake, not an accountant.

**Privacy.** Server to server: the vendor sees the query text and our server's address, never a
visitor's IP, account or cookie. Nothing is stored.

**Not used, on purpose:** the anonymous keyless vendor endpoints (Firecrawl keyless, Parallel's
anonymous MCP, Exa/Keenable free rings): unclear production terms, per-IP caps shared with other
Vercel tenants. Owner's call, 2026-11-11.

## Providers (free allowances from the vendors' own 2026 roundups — they disagree in places; check each pricing page when you sign up)

| Provider | Env var | Free allowance | Default daily budget | Card? |
|---|---|---|---|---|
| Tavily | `TAVILY_API_KEY` | 1,000 credits/month | 30 | no |
| Firecrawl | `FIRECRAWL_API_KEY` | 1,000 credits/month (search = 2 per 10 results), 10 searches/min | 15 | no |
| Linkup | `LINKUP_API_KEY` | ~€5 credit/month | 100 | no |
| Exa | `EXA_API_KEY` | monthly credit | 25 | no |
| Serper | `SERPER_API_KEY` | 2,500 queries, **one-time** | 40 | no |
| Marginalia | `MARGINALIA_API_KEY` (optional) | the shared `public` key is rate-limited per minute for everyone; a free personal key (email the author) has its own | 300 | no |
| Wikipedia | — | generous; REST search | 500 | no |

Only sign up for tiers that do **not** ask for a card. Set `RING_<NAME>_DAILY` (e.g. `RING_TAVILY_DAILY=20`) to change a budget; `0` turns that provider off. Add the keys in Vercel
(Project → Settings → Environment Variables → Production), then redeploy.

## Checking it
`GET /api/search/health` now includes `freeRing`: each provider, whether it is on, its budget, what
it has spent today on that instance, and whether it is cooling down. The search log prints
`Free ring [tavily,wikipedia] added 12`. `node scripts/upstream-health.mjs` counts ok/429/403/timeout per provider
per day (the ring's providers are in the same table).

## Known limits
- Wikipedia's main API rate-limits shared server addresses hard; the ring uses the **REST** search, which
  worked when paced (verified 2026-11-11). It may still answer 429 now and then; the breaker handles that.
- Marginalia moved (`api2.marginalia-search.com`, key in the `API-Key` header). The response shape was not
  verifiable from the build sandbox (the shared key was rate-limited); the parser reads
  `results[].url/title/description` and fails soft.
- Tavily, Firecrawl, Linkup, Exa and Serper were written from their public docs and tested with mocks only —
  none was called live (no keys). Expect to adjust a field name on the first real call.
- Safe search: Exa gets `moderation`, Serper gets `safe: active` when safe search is on; the other tiers have
  no such switch.
- This does not fix YouTube, Google CSE, Brave or NewsAPI. Check each dashboard for quota or billing.
