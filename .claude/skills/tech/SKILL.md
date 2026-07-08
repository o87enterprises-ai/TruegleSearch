---
name: tech
description: Truegle technical operations — session branching workflow, blue-page Google parity, privacy/no-tracking/no-censorship enforcement, pentesting new additions, secrets storage for agents, app structure, third-party provider list, and mandatory session-log/handoff/memory updates.
---

# Tech — Truegle Technical Operations

## Session workflow

1. **New branch per session.** Never develop on `main`. Branch name: `claude/<topic>-<suffix>` (or the branch the harness designates). Push with `git push -u origin <branch>`; PRs merge to `main`, which auto-deploys (Cloudflare Pages frontend, Vercel backend).
2. **Start of session:** read the top of `HANDOFF.md` — latest session log, 🔴 PERMANENT FACTS, and 🔜 NEXT SESSION items. These override anything you'd otherwise re-derive.
3. **End of session (mandatory):**
   - Prepend a dated session-log entry to `HANDOFF.md`: what shipped, root causes found, pending items, user actions needed. Mark dead ends as PERMANENT FACTS so no future agent retries them.
   - Update agent memory: refresh `.claude/skills/*` files if any company fact changed (providers, keys' locations, architecture); update `CLAUDE.md` only for durable workflow rules.
   - Run the `financial` skill closeout (running totals).

## Product guardrails

- **Blue page = Google parity.** The Blue (mainstream) mode must track Google's use cases as closely as possible: instant answers, maps, images/videos/social tabs, weather/business cards, minimal clutter, mobile-first. When in doubt on blue-page UX, ask "what does Google do here?" and match it.
- **Privacy — enforced in code, not policy:** Truegle sets ZERO cookies (preferences in `localStorage` only); no stored user tracking; the `search_queries` trending table stores query+mode+timestamp, never PII; SearXNG proxying means upstream engines see only our AWS Elastic IP. Any PR that adds a cookie, fingerprinting, or identifiable logging is rejected.
- **No censorship:** never add topic-based filtering beyond the user-controlled safe-search and the 5-gate adult system (authenticated + safeSearch off + adult keyword + age confirmed + consent not revoked).

## Security duties

- **Pentest every new addition** before it merges: new routes get checked for injection/SSRF/auth bypass (result-proxy endpoints are SSRF-prone — the Morty HMAC design exists for this reason); new third-party scripts get CSP-scoped; new inputs get validated (Joi on backend). Use the `security-review` skill on the branch diff each session that touches backend routes, auth, or proxies.
- **Patch known vulnerabilities:** `npm audit` on both workspaces each session; keep the anti-scraping stack intact (attribution headers, zero-width watermarks, `botDetection.js` — toggle `BOT_DETECTION_DISABLED` only for debugging).
- **Secrets storage — never repeat keys in chat:** secrets live in platform env stores (Cloudflare Pages env, Vercel env, EC2 env files), validated in `apps/backend/config/env.js` / read via `import.meta.env.VITE_*`. For agents: maintain `docs/SECRETS-MAP.md` (create if missing) listing every variable NAME, where it's set, and what it's for — **names and locations only, never values**. When a new key is needed, add it to the map so no agent has to ask the user twice. Ad zone keys are the one exception: they're public-by-nature and hardcoded in `apps/frontend/src/config/ads.js`.

## App structure (orientation map)

- `apps/frontend` — React 18 + Vite + Tailwind, Cloudflare Pages. Key files: `src/pages/UniversalSearch.jsx` (THE live results page — `components/SearchResults.jsx` is dead code), `src/pages/LandingPage.jsx`, `src/config/ads.js` (zone keys), `src/config/env.js`, `public/_headers` (CSP) + `public/_redirects` (SPA routes only — never prerendered ones), `scripts/prerender.mjs` (blog SSG).
- `apps/backend` — Express on Vercel serverless. `services/SearchService.js` (provider orchestration + SearXNG), `services/TranscriptService.js`, `routes/` (search, social, auth), `middleware/` (attribution, botDetection), `config/env.js` (Joi-validated env), `models/` + Postgres migrations.
- Infra: SearXNG + Morty on AWS EC2 (Elastic IP 44.236.219.63; Revive adserver also there at :9090); DNS at Cloudflare (domain registered at IONOS).

## Third-party providers / services (canonical list)

| Service | Role |
|---|---|
| Cloudflare Pages + DNS | Frontend hosting, `truegle.info`, CSP/headers, analytics |
| Vercel | Backend hosting (`backend-seven-khaki-60.vercel.app`) + Postgres |
| AWS EC2 | Self-hosted SearXNG, Morty proxy, Revive adserver |
| IONOS | Domain registrar (`truegle.info`; secondary `trumpafi.online`) |
| SearXNG | Primary metasearch (free, fires first) |
| Google CSE / Bing / Brave / SerpAPI / YouTube / News API / Unsplash | Fallback search providers (free-tier caps) |
| Adsterra | Primary ad network (CPM banners, popunder, Smartlink) — API is dashboard-only |
| CJ + Proton Partners | Affiliate programs |
| Google Search Console / Bing Webmaster | Indexing |
| Stripe / Square / PayPal | Payment config present (premium, pending) |

## Handoff hygiene

`HANDOFF.md` is append-at-top, dated, and supersedes prior docs. Keep entries
factual and terse; promote anything future-agents must never retry into the
PERMANENT FACTS block. If `HANDOFF.md` exceeds usefulness, archive old logs to
`docs/handoff-archive/` rather than deleting.
