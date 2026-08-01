# Truegle — Project Blueprint

> Living map of the codebase: what lives where, how it fits together, and how it
> ships. Pairs with `HANDOFF.md` (live state), `CLAUDE.md` (standing policy), and
> `.claude/memory/` (persistent facts/decisions). When structure changes
> materially, update this file.

- **Product:** Truegle — a privacy-first, unbiased search engine + multi-perspective AI at **https://truegle.info**
- **Company:** Truegle Co. · **Budget:** $0 (ad-revenue model) · **License:** MIT
- **AI engine (user-facing name):** **TrueGLE 1.3** (internal codename "nephesh" kept in filenames/env vars/provider keys to avoid breaking contracts)

---

## 1. Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 7, React Router, Tailwind CSS, framer-motion, lucide-react |
| Backend | Node ≥18, Express (`apps/backend/server.js`), Jest tests |
| Data | PostgreSQL (migrations + seeds), in-memory caches in services |
| AI / LLM | Multi-provider behind `UnifiedAIService`; **Groq is the live substrate** (branded TrueGLE) |
| Search | Brave / SerpApi / self-hosted SearXNG (private) behind `SearchService` |
| Build/deploy | Monorepo (npm workspaces); frontend → Vercel (prerendered SPA); backend → Vercel serverless (`backend-seven-khaki-60.vercel.app`) |

---

## 2. Monorepo layout (annotated)

```
TruegleSearch/
├── apps/
│   ├── frontend/            @truegle/frontend — React + Vite SPA
│   │   ├── src/             ~405 files (see §3)
│   │   ├── public/          static assets served at site root (_redirects, _headers, adframe.html)
│   │   ├── scripts/         prerender.mjs + SEO/localized snapshot generators
│   │   ├── functions/       Cloudflare Pages functions (edge)
│   │   ├── index.html · vite.config.js · tailwind.config.js · wrangler.toml
│   │   └── package.json     build = `vite build && node scripts/prerender.mjs`
│   │
│   └── backend/             @truegle/backend — Express API
│       ├── server.js        app entry (start = `node server.js`)
│       ├── routes/          26 route modules (see §4)
│       ├── services/        42 service modules (see §4)
│       ├── middleware/      auth, rate-limit, error handling
│       ├── prompts/         nepheshPrompts.js — the AI system prompts (SOURCE OF TRUTH)
│       ├── config/          ad_zones.json + runtime config
│       ├── migrations/ db/ seeds/ models/   PostgreSQL schema + data
│       ├── data/            static datasets
│       ├── __tests__/       Jest suites · scripts/ (ops: clear-prompt-cache.js, etc.)
│       └── vercel.json · .env.example
│
├── nephesh/                 Self-host kit for the TrueGLE model (Modelfile, finetune, eval, deploy)
├── docs/                    architecture / development / finance / marketing docs
├── drafts/                  review-before-live blog/content markdown
├── scripts/ · tools/        repo-level utilities
├── design-system.json       brand tokens (colors, motion, type) — see `design` skill
├── .claude/                 skills, memory graph, session hooks (auto-loaded policy)
├── CLAUDE.md · AGENTS.md    standing instructions / OpenSpec pointer
├── HANDOFF.md               live cross-session state + 🔴 permanent facts
├── DEPLOYMENT-INFRA.md · DEV-SETUP.md · SERVICE-ACTIVATION.md
├── railway.json · vercel-build (root package.json)
└── PROJECT-BLUEPRINT.md     ← this file
```

> **Housekeeping:** the old `*.backup / *.old / *.broken / *.bak / *.original.jsx` copies
> (38 files) and the stale root `railway.json` were pruned (commit follows). Live routes
> are wired in `App.jsx` (§3).

---

## 3. Frontend architecture (`apps/frontend/src`)

**Entry:** `main.jsx` → `App.jsx`. `App.jsx` nests all providers, then `AppContent`
renders global chrome **above `<Routes>`** (so it survives navigation) + the route table.

**Global chrome (siblings of `<Routes>`):** `BrandBar` (hamburger nav), `PageClock`
(persistent top-right clock), `MiniPlayer` (persistent pop-out media player),
`PreProductionBanner`, `SafeSearchLockModal`, `FreemiumTokenBar`.

**Providers (context/, 8):**
`AuthContext` · `TokenContext` · `RewardsContext` · `AdGeoContext` (server geo for ads)
· `SearchModeContext` (blue/red pill) · `SettingsContext` · `TutorialContext` ·
`PlayerContext` (mini-player queue/current/history — reducer-based).

**Key routes (`App.jsx`):**

| Path | Page | Purpose |
|---|---|---|
| `/` `/de` `/es` `/fr` `/nl` `/pt` | `LandingPage` | hero + localized SEO snapshots |
| `/search` | `UniversalSearch` | main results (modes via `?mode=`) |
| `/chat` | `TruegleChat` | chat-first AI with lens modes + mini-player pop-out |
| `/s/:id` | `SharedThread` | read-only shared chat/OSINT thread |
| `/green` | `UniversalSearch lockedGreen` | AI-free simplified mode |
| `/extract` | `ExtractPage` | content extraction |
| `/creator/:slug` | `CreatorPage` | featured-creator video pages |
| `/blog` `/blog/:slug` | `Blog` / `BlogPost` | SEO/editorial content |
| `/privacy-resource-hub` | pillar content page |
| `/advertise` `/revenue-calc` | monetization/publisher pages |
| `/privacy` `/terms` `/about` | legal/info (required for ad networks) |
| `/settings` `/onboarding` `/auth/*` | account flows |

**Components (`components/`, 275 files) by subdir:** `ui/` (79 — SearchBar, MiniPlayer,
PageClock, Citations, SponsoredAd host, modals…) · `backgrounds/` (77 animated
backgrounds) · `map/` (40 — map UI + services) · `landing/` · `search/` · `ads/` ·
`permissions/` · `LaserFlow` `Prism` (visual FX).

**Supporting:** `config/` (modeTheme, adNetworks, access) · `utils/` (18 — videoEmbed,
formatTime, …) · `hooks/` (10) · `services/api.js` (axios API client) · `styles/` ·
`content/` (creators, fallback data).

---

## 4. Backend architecture (`apps/backend`)

**Entry:** `server.js` mounts middleware + the 26 route modules. Services hold the
logic; routes stay thin.

**Routes (`routes/`):** `ai` `search` `shopping` `osint` `osint-proxy` `extract`
`share` `auth` `session` `tokens` `rewards` `payment` `paypal` `ads` `analytics`
`prompts` `admin` `contact` `creators` `maps` `radar` `weather` `shodan` `social`
`unsplash` `voice`.

**Services (`services/`, 42) grouped:**
- **AI / LLM:** `UnifiedAIService` (the layer that applies TrueGLE branding + prompts),
  `NepheshService`, `DeepResearchService`, `PromptService` (prompt cache + DB),
  `QueryInterpreter`, plus provider adapters: `GroqService` (**live**), `AnthropicService`,
  `OpenAIService`, `GeminiService`, `OpenRouterService`, `NvidiaService`, `OllamaService`,
  `AIService`.
- **Search:** `SearchService`, `BraveSearchService`, `SerpApiService`,
  `PrivateSearchService` (SearXNG), `ShoppingService`.
- **OSINT / intel:** `OsintInvestigationService`, `OsintGraphService`, `OsintLookups`,
  `BusinessEnrichmentService`, `MultiStateCameraService`, `OpenTrafficCamService`.
- **Maps / geo / weather:** `MapboxService`, `TomTomService`, `RadarService`,
  `WeatherService`, `GeoAdService` (server-side IP geo for ad targeting).
- **Voice / media:** `SpeechToTextService`, `TranscriptService`, `UnsplashService`.
- **Monetization:** `GeoAdService`, `RewardsService`, `TokenService`, `tokenDenylist`,
  `payment/` (`PaymentProvider` + `StripeProvider` / `SquareProvider` + `index`).
- **Core:** `EmailService`, `FeedbackService`, `ShareService`.

**Data:** `migrations/` (17) + `db/` + `seeds/` + `models/` → PostgreSQL. Local dev DB
in `HANDOFF.md`/memory (role `truegle`, db `truegle_dev`).

---

## 5. AI engine — TrueGLE 1.3 (the differentiator)

- **Prompts live in `apps/backend/prompts/nepheshPrompts.js`** — single source of truth
  (also baked into `nephesh/Modelfile` for the self-hosted model). Bump `PROMPT_VERSION`
  on every edit (prompts are cached; `scripts/clear-prompt-cache.js`).
- **Identity:** `BASE_IDENTITY` carries the mandates every mode inherits —
  **Mandate A** (no opinions / unbiased indifference), **Mandate B** (100% honesty, no
  fabrication of sources *or* calculation inputs), **Mandate C** (no rigid frameworks, no
  circular validation, "an equation is not its own proof," apply new premises, stress-test
  any theory).
- **Modes (`MODE_PROMPTS`):** blue (Mainstream) · red (Alternative/Free-Thinker) · purple
  (Skeptical) · ocean (OSINT) · green (Simplified). Multi-select blends lenses; the
  frontend mirrors these top+bottom of the chat.
- **"vs" mode (`CONTESTED_CLAIM_PROTOCOL`):** the Null-Prime dual-audit engine — layered on
  by `getModePrompt()` when `nepheshMode` is true; forbids buried/fabricated numbers.
- **Serving path:** chat builds the system prompt via `getModePrompt()` and passes it as
  `systemOverride` → `UnifiedAIService` → provider (Groq live). Responses are
  TrueGLE-branded regardless of engine.

---

## 6. Monetization system

- **Live format:** Adsterra **native banner** only. Social Bar + Popunder were **removed**
  (scareware); **PropellerAds service worker rejected** (privacy/brand). See memory.
- **Frontend:** `SponsoredAd` (orange-outlined, self-collapses when unfilled) rendered via
  `public/adframe.html`; `config/adNetworks.js` = multi-network scaffold
  (Adsterra native, HilltopAds, Ghost, Media.net, EthicalAds).
- **Backend:** `GeoAdService` + `config/ad_zones.json` — highest-CPM zone selection with
  server-side IP geo-targeting (cf-ipcountry / x-vercel-ip-country / ip-api fallback).
- **Rewards:** offer/conversion-based (no Adsterra S2S postback → manual admin credit via
  `routes/admin.js`). Rewards UI currently disabled.
- **Tokens:** freemium metering (`TokenService` + `TokenContext` + `FreemiumTokenBar`).

---

## 7. Build, deploy & environments

- **Frontend build:** `npm run build:frontend` = `vite build && node scripts/prerender.mjs`
  → static SPA in `dist/` with prerendered route HTML (SEO) + localized snapshots.
  SPA route rule: a new client route needs both `public/_redirects` and `public/_headers`.
- **Backend:** `node server.js` (Express); `apps/backend/vercel.json` for serverless; root
  `railway.json` also present.
- **Deploy targets:** frontend → **Vercel** (triggered on `main`); backend → **Vercel**
  serverless (`backend-seven-khaki-60.vercel.app`, config `apps/backend/vercel.json`).
  Railway is not used (its root config was removed). Private search (SearXNG) on an AWS
  EC2 t3.micro (`44.236.219.63`, us-west-2).
- **Prompt changes** ship with the backend deploy (in-memory prompt cache clears on fresh
  serverless instances — no manual clear needed on Vercel).
- **Secrets:** `.env.example` documents keys (LLM providers, search APIs, maps, payments,
  `ADMIN_API_KEY`, DB). Never commit real values.

---

## 8. Conventions & workflow

- **Branch-per-session:** develop on the session branch, push to it, **and fast-forward
  `main`** (see CLAUDE.md / current branch `claude/ad-revenue-optimization-cck6xp`).
- **Standing skills (auto-applied):** `ponytail` (laziest working solution), `tech`
  (privacy/security/handoff), `financial` ($0 budget gate), `design` (brand/motion). Others
  invoked by name.
- **Agent memory:** `node .claude/memory/mem.mjs add|done|query|list`; commit
  `.claude/memory/graph.json` with your work.
- **Privacy/no-tracking** and **no fabricated data** are non-negotiable brand rules.

---

## 9. Roadmap / open threads (see HANDOFF.md + memory for detail)

- **Multi-source media player (in progress):** source-agnostic embed-adapter layer atop the
  existing `PlayerContext`/`MiniPlayer` — Phase 1 = YouTube + SoundCloud (free full control)
  + direct audio; embed-only adapters (Bandcamp, Deezer, Tidal, Spotify) as fast-follows;
  Apple Music deferred ($99/yr). No OAuth (privacy). Artist-friendly sources surfaced first.
- **Ad-network onboarding:** Ghost (private beta — signup flaky), Media.net, EthicalAds.
- **Nephesh self-host:** kit ready in `nephesh/`; blocked on a free host (runs on Groq
  substrate meanwhile).
