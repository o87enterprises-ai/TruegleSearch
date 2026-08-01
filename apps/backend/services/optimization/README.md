# Citation Engine — automated SEO / AEO / GEO

Publishes **one high-value, evergreen answer page per day on autopilot** so
Truegle earns organic citations from search engines (**SEO**), answer boxes /
voice (**AEO**), and generative engines like ChatGPT / Perplexity / Gemini
(**GEO**). Users stay 100% anonymous; the user-facing AI modes, prompts, and
attribution are never touched.

## How it works (the loop)

```
anonymous demand (search_queries trending, personal queries filtered)
        │  ranks →
vetted keyword universe  ──►  pick next uncovered topic
        │
SEO scaffold (target phrase, slug, internal links)
        │
draft via fallback router  (Groq → Gemini → NVIDIA, free-tier, circuit-broken)
        │
AEO shaping (direct answer + FAQ)  +  GEO assembly (structured body + llms line)
        │
quality gate  (≥650 words, phrase in first 15 words, real FAQ,
        │        no fabricated citations, no personal data, valid slug)
        │  pass ↓            fail → retry ×3 → skip today (publish nothing)
publish → blogPosts.jsx + sitemap.xml + llms.txt
        │
GitHub Action commits → opens a PR → you review & merge → Cloudflare rebuilds
        │
GPTBot / PerplexityBot / Google-Extended crawl (already allow-listed) → citations
```

**Why a git loop, not a live service:** every citable page is a static file
built at Cloudflare Pages deploy time, and production is Vercel *serverless*
(no persistent process). So the engine runs in **GitHub Actions**
(`.github/workflows/citation-engine.yml`) — scheduler + compute + git write,
all $0 — and "publishing" means committing the three source files.

## Files

| File | Role |
|---|---|
| `orchestrator.js` | Runs one full cycle → returns a gate-passed post |
| `topicSource.js` | Anonymous demand → ranks the keyword universe |
| `keywordUniverse.js` | The evergreen backlog (from drafts/content-scaffold) |
| `fallbackRouter.js` | Provider priority + circuit breaker + quota (free-tier maxing) |
| `quotaTracker.js` | Postgres daily per-provider counter (yields headroom to live traffic) |
| `agents/seoAgent.js` | Target phrase, slug, internal links |
| `agents/aeoAgent.js` | Direct answer + FAQ (answer-engine layer) |
| `agents/geoAgent.js` | Structured body + Truegle/link section (generative-engine layer) |
| `prompts.js` | The engine's **own** authoring prompts (not nepheshPrompts.js) |
| `qualityGate.js` | The reputation guard — nothing thin/fabricated/unsafe ships |
| `serializer.js` | Structured post → build-safe blogPosts.jsx / sitemap / llms |
| `publisher.js` | Writes the three static files |
| `citationLog.js` / `pulse.js` | Audit trail + GEO Pulse status |
| `run.js` | CLI entrypoint |

## Run it

```bash
# Preview only — no writes, prints the generated entry (needs an AI key):
node apps/backend/services/optimization/run.js generate --dry-run

# Real run (writes the 3 files locally):
node apps/backend/services/optimization/run.js generate

# Status:
node apps/backend/services/optimization/run.js pulse
# or GET /api/optimization/pulse
```

## Required GitHub repo secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Where to get it (free) | Needed |
|---|---|---|
| `GROQ_API_KEY` | console.groq.com (no card) | **Yes** |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey | Recommended (fallback) |
| `DATABASE_URL` | Neon connection string (a **read-only** role is ideal) | For demand-seeding |
| `GROQ_API_KEY_2..5` | extra free Groq accounts | Optional (more headroom) |

No other setup — the workflow supplies throwaway values for the unrelated
`config/env.js` required vars, and uses no paid services.

## Cadence & publish mode

- **Cadence:** 1 page/day (`cron: '0 9 * * *'`). Change the cron to adjust.
- **Publish mode:** currently **PR + manual merge** — every run opens a PR you
  review before it goes live. Once you've watched a few land clean, flip to
  hands-off by adding this after the `gh pr create` step:
  ```yaml
  gh pr merge "$BRANCH" --squash --auto
  ```
  (needs branch protection with the JSX-validation check required, so a bad
  page still can't auto-merge).

## Guarantees

- **$0** — free AI tiers, GitHub Actions free tier, Cloudflare free build.
- **Anonymous** — topics come from the vetted universe; a raw/personal query is
  never published; the demand signal only *reorders* what to write next.
- **AI untouched** — the engine has its own prompts; `nepheshPrompts.js` and the
  attribution utilities are never imported or modified.
- **Reputation-safe** — strict quality gate + JSX compile-check before any PR; a
  failing day publishes nothing rather than shipping thin/fabricated content.
