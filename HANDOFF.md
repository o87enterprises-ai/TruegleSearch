# Session Handoff — Truegle Search

_Consolidated 2026-06-11. Supersedes the former `launch-handoff.md` and `HANDOFF-2026-05-28.md` (now removed). All "current state" claims below were re-verified against the live `main` branch on 2026-06-11._

---

## ⚡ CURRENT STATE (read this first)

- **Live frontend:** https://trumpafi.online (Cloudflare Pages project `truegle-search`)
  - New primary domain **`truegle.info`** is code-wired but **DNS not yet resolving** → still serving on `trumpafi.online`.
- **Live backend:** https://backend-seven-khaki-60.vercel.app (Vercel project `backend`)
- **Database:** Neon PostgreSQL (`ep-spring-star-afnjwpg6-pooler`, us-west-2) via `DATABASE_URL`
- **Repo:** `o87enterprises-ai/TruegleSearch`
- **Git:** `main` is **1 commit ahead of `origin/main`** — commit `50055ea` (truegle.info migration + search timeouts) is **committed locally, PUSH HELD** until DNS resolves, so the canonical-tag frontend and the backend redeploy go live together against a resolving domain (and to avoid a premature Vercel git auto-deploy). Working tree clean.

### ⛔ The one thing blocking deploy: DNS migration to `truegle.info`
User bought `truegle.info` via **IONOS**. Plan = move nameservers to Cloudflare (Option A in `DEPLOYMENT-INFRA.md` §1). `trumpafi.online` is kept as a secondary that also points at Truegle (many owned domains → one SEO canonical = `truegle.info`).

**Next-session start sequence:**
1. **DNS (needs user + IONOS login):**
   a. Cloudflare dashboard → Add site `truegle.info` (Free) → copy the 2 nameservers.
   b. IONOS → `truegle.info` → nameserver settings → paste Cloudflare's nameservers.
   c. Cloudflare Pages → `truegle-search` → Custom domains → add `truegle.info` + `www.truegle.info`.
   d. `trumpafi.online`: 301-redirect → `https://truegle.info` (keep as secondary).
2. **After DNS resolves:** set `FRONTEND_URL=https://truegle.info` on Vercel → **push `main`** → redeploy backend (`cd apps/backend && vercel deploy --prod --yes`) + frontend (build then `wrangler pages deploy dist --project-name=truegle-search --branch=main`).
3. **Verify live:** `https://truegle.info/` loads; search works; `/ads.txt`, `/sitemap.xml`, `/robots.txt` reachable.
4. **Then (deferred sign-up steps):** Search Console + AdSense re-submit under `truegle.info`.

---

## Deploy topology & commands (verified working)
- **Frontend** → Cloudflare Pages `truegle-search`, custom domain `trumpafi.online` (truegle.info pending).
  - Build (Windows): `cd apps/frontend && NODE_OPTIONS='--max-old-space-size=4096' node ../../node_modules/vite/dist/node/cli.js build`
    (the npm `build` script uses a bash env prefix that fails on Windows cmd).
  - Deploy: `wrangler pages deploy dist --project-name=truegle-search --branch=main`
- **Backend** → Vercel `backend`: `cd apps/backend && vercel deploy --prod --yes`
- CLIs authenticated: `wrangler` (o87enterprises@gmail.com), `vercel` (o87enterprises), `gh` (o87enterprises-ai).
- Health: `GET /api/health` → `{status:"OK"}`; `GET /api/search/health` → per-provider.
- Backend logs: `cd apps/backend && vercel logs backend-seven-khaki-60.vercel.app --json`.

---

## Project shape (orientation)
- Monorepo: `apps/frontend` (React 18 + Vite SPA, port 5173) and `apps/backend` (Node/Express API, port 3001).
- **The live search page is `apps/frontend/src/pages/UniversalSearch.jsx`** rendered at `/search`.
  Modes = `blue | red/purple | ocean | green` (set via `?mode=` and the pill toggle). Legacy routes
  (`/search-results`, `/search-portal`, `/results`, `/biased`, `/osint`) all `Navigate` to `/search`.
- **Mode algorithms (canonical):**
  | Mode | Algorithm |
  |------|-----------|
  | **Blue** | Standard relevance — Google/Brave/News as-is |
  | **Green** | Identical to Blue, AI/summary features off, **+ filters AI-content domains** (`aiContentDomains.js`, subdomain-aware, expandable via `AI_CONTENT_DOMAINS` env) |
  | **Red** | Inverted mainstream — conspiracy→alternative→independent→neutral→…→mainstream; explicitly queries substack/rumble/odysee/zerohedge/rt.com etc. (`sortRedPill()`) |
  | **Purple** | Strict perspective filter — only results matching user-picked perspectives (`mapPerspectivesToBias()`) |
  | **Ocean** | OSINT pipeline only, no web search (`performOsintSearch()`) |
- **Dead/legacy files (do NOT use, safe to delete later):** `pages/SearchResults.jsx*`, `pages/SearchPortal*`,
  `pages/BiasedResults.jsx`, `pages/OSINTMode.jsx`, `pages/OSINTTools.jsx`, `components/ResultsPage.jsx`,
  `components/SearchResults.jsx`, `components/ui/SearchResultsContainer.jsx`. Imports already removed from `App.jsx`.

### ⚠️ Gotchas (hard-won)
- **`services/WeatherService.js` exports a SINGLETON** (`module.exports = new WeatherService()`), not the class.
  `require` and use directly — do NOT `new` it (doing so crashed the backend with `FUNCTION_INVOCATION_FAILED`).
- **Stale-bundle traps:** the old "safe-mode toggle broken" and "don't-show-again modal" bugs were stale-bundle
  artifacts — current code is correct; a redeploy fixes. If a fix "doesn't work live," suspect a stale build first.
- **`.env*` is gitignored and absent on the build machine** — that's why prod once shipped with `VITE_BACKEND_URL`
  defaulting to `localhost:3001` (0-results outage). `vite.config.js` now hardcodes the live Vercel backend as the
  production-mode default so fresh clones build correctly.

---

## Remaining work (deduped, code-side unless noted)

### Search categories / providers
- **Verify all ~21 categories** in prod: web, images, news, videos, maps, shopping, social, smart, osint, academic, code, finance, health, legal, local, music, podcasts, recipes, sports, travel, weather.
- **More quick-results** — still open: sports scores, business/locations/phone, calendar/events, history, news/breaking (extend `detectQueryType` + `buildInstantAnswer` + add cards). Calculation, weather, **definition, unit/temperature conversion, currency, and world-clock** already shipped (see 2026-06-11 session).
- **Categories logic** — images/social/video via Apify + search APIs (image/social/video tabs).
- ✅ Already resolved/verified in current code (do NOT re-chase): **Shopping** (fully wired end-to-end via `AsSeenOn`→`/api/shopping/search`→`ShoppingService`→`SerpApiService.shoppingSearch`; the old "stub" note was stale — just verify live with `SERP_API_KEY`), Weather route, Brave inline `performBraveSearch`, SerpAPI whole-web fallback (fires when web < 5, dedupes by URL), provider timeouts (all bounded).

### OSINT
- ✅ **Free OSINT tools DONE (2026-06-11):** `OSINTToolsPanel.jsx` in Ocean mode wires the 4 free endpoints (`ip-lookup`/`dns-lookup`/`whois`/`username-platforms`) with per-tool forms + in-page iframe verify panel. The live OSINT path is **Ocean mode in `UniversalSearch`**, NOT the dead `OSINTMode.jsx`.
- **Remaining:** wire the 2 auth endpoints (`/email-finder` Hunter.io, `/shodan/ip/:ip`) as extra tools behind the existing `TokenGate` (need auth header + keys). Delete dead `OSINTMode.jsx`.
- **Python service** — fix Python 3.14 dep incompat in `OSINT-Harassment-Detector/requirements.txt`; deploy Flask service to a persistent host (Railway/Render/VPS); set `OSINT_SERVICE_URL` on Vercel (backend proxies via `osint-proxy.js`).

### Features requested
- ✅ **Open-in-app iframe viewer** — DONE (exists on result cards with X-Frame fallback).
- ✅ **Inline video player** — DONE (2026-06-11): YouTube/Vimeo result links play inline via `getVideoEmbed` + ResultCard "▶ Play here".
- ✅ **Privacy hardening** — DONE (2026-06-11): `saveHistory` toggle, clear-history, full wipe wired into Settings; no server-side query storage confirmed.
- **Multi-input search bar** — audio / files / images end-to-end. (Still open.)
- **Maps/globe** rendering refine (hardware-limited bg rendering; `useDeviceTier` hook already downgrades on low-end).
- **SearXNG → primary** — provider-order flip is now **implemented behind a flag** (see 2026-06-11 session): set `SEARXNG_PRIMARY=true` (+ optional `SEARXNG_PRIMARY_MIN`, default 5) on the backend once SearXNG runs on a persistent host. Default off = unchanged parallel behavior. Currently `SEARXNG_URL` points at a dead ngrok tunnel → 404 (caught/non-fatal, 4.5s timeout; Brave covers). Reconfigure on a persistent host, then flip the flag.
- **"Watch Ad for +5 Tokens"** — wire BiasedResults paywall button to a real rewarded ad; server-verified ad-session earning already exists (`/api/tokens/ad-session` + `/earn/ad`, 25s min, 6/hr cap).

### Auth / payments / ads (mostly browser-dashboard, deferred to last per user)
- **Google OAuth** consent screen still in "Testing" — publish or add test users (Client ID `1004953436750-0a1ni3p4mqaihh3593gvibq7tqsc5gma...`; callback `…/api/auth/google/callback`). Test end-to-end; redirect user back to originating page after callback.
- **Gmail / email OAuth** — activate scopes/consent, verify delivery (Resend `RESEND_API_KEY` configured).
- **Google Custom Search JSON API** — was logging `403 PERMISSION_DENIED`; enable Custom Search API in the Cloud project owning `GOOGLE_API_KEY` (no redeploy). Brave covers meanwhile. Also add ~50 broad domains to CSE `54cdc3626cf504531`.
- **AdSense** — `ads.txt` valid (pub-9542137900411519); request review once `truegle.info` is live; ensure Privacy/Terms/About pages exist.
- **Search Console + Bing Webmaster** — add/verify `truegle.info`, submit `/sitemap.xml`, request indexing for `/` and `/search`.
- **Stripe** — test keys live now; webhook `TruegleVercelWebhook` → `…/api/payment/webhook` (8 events). Swap to live keys + complete account verification before charging.

### Known pre-existing issues (follow-up candidates)
- SPA is client-only → weak crawl/index; real SEO win is prerender/SSG (react-snap / vite-plugin-ssr / Next).
- ✅ Build warnings FIXED (2026-06-11): `@import` order, `--tw-shadow-color` leak, and code-splitting all resolved (main chunk 4.86 MB → 489 KB). Remaining: `mapbox`/`vendor` chunks are inherently >900 KB (expected); `authService.js` static+dynamic import notice (minor).
- Several pages exceed 800 lines (BiasedResults ~1150, UniversalSearch ~1000) — extract sub-components.
- Dead/unwired code worth deleting: `pages/OSINTMode.jsx` (not routed — live OSINT is Ocean mode in `UniversalSearch`); `apps/backend/routes/analytics.js` `logSearch`/`logFailedSearch` (defined, never called); `*.backup-*` files under `components/ui/`.

---

## Session archive (condensed, newest first)

**2026-06-11 — search quick-wins (UNCOMMITTED — holding per "no commit until services active")**
Code-side work that can't be live-verified until the final deploy; syntax-checked + frontend build passes + pure-compute logic unit-tested (15/15).
- **Quick-result cards (new):** `definition` (free no-key dictionaryapi.dev), `conversion` (unit + temperature = pure local compute; currency via free no-key open.er-api.com, graceful null on failure), `time` (world clock via curated city→IANA map + `Intl`). Added `detectQueryType` rules (precedence-tested: `weather in paris`/`5 to 10`/`Barack Obama` correctly excluded), `buildInstantAnswer` handlers + helper tables in `apps/backend/routes/search.js`; new `ConversionCard`/`TimeCard`/`DefinitionCard` in `apps/frontend/src/components/ui/QuickResultCard.jsx`.
- **SearXNG provider-order flip:** `SEARXNG_PRIMARY` / `SEARXNG_PRIMARY_MIN` (Joi schema + `config.searxng` in `env.js`); `SearchService.performSearch` queries SearXNG first and skips the paid API providers when it returns ≥ min results, else falls back. Off by default = byte-identical to before. Not used for red-pill (needs Brave).
- **Shopping finding (no code):** the shopping pipeline was **already fully wired** (`AsSeenOn`→`/api/shopping/search`→`ShoppingService`→`SerpApiService.shoppingSearch`); the handoff's "stub" was stale. A parallel `SearchService` shopping path was prototyped then reverted to avoid duplicate/unreachable code.
- **Build cleanup:** fixed `@import` order (`src/index.css`), the `--tw-shadow-color` leak (SearchBar dynamic `shadow-[…]` → inline `style` boxShadow — shadows now actually render), and added `manualChunks` in `vite.config.js` (main bundle **4.86 MB → 489 KB**; mapbox/three/vendor/framer/icons split out). Build is warning-clean (bar inherent big-vendor size notices).
- **Viewers + privacy:** inline **video player** for YouTube/Vimeo result links (`getVideoEmbed` + ResultCard "▶ Play here" embed; generic in-app iframe viewer already existed). Privacy: new `saveHistory` setting (honored by `SearchBar`), fixed `SessionWipe` server call to use `VITE_BACKEND_URL` (was a relative path → 404 cross-origin), and wired a **Privacy & Data** section into `SettingsPage` (history toggle, clear-history, full device/server wipe via the previously-dead `NuclearOptionButton`). Audit confirmed **no server-side query storage** (both `logSearch` fns are never called; queries go via POST body; tracking tables removed in migration 004).
- **OSINT overhaul (live Ocean path):** new `components/ui/OSINTToolsPanel.jsx` rendered in `mode === 'ocean'` — per-tool forms wired to the 4 free public endpoints (`/api/osint/ip-lookup`, `/dns-lookup`, `/whois`, `/username-platforms`) with real result rendering + an in-page iframe verification panel (X-Frame fallback). `OSINTMode.jsx` confirmed dead (not routed) — left for deletion. **Deferred:** the 2 auth endpoints (`email-finder` Hunter.io, `shodan`) — add behind the existing `TokenGate` with the auth header + keys.
- Files touched (this round, all UNCOMMITTED): `apps/backend/routes/search.js`, `apps/backend/services/SearchService.js`, `apps/backend/config/env.js`, `apps/frontend/vite.config.js`, `apps/frontend/src/index.css`, `apps/frontend/src/context/SettingsContext.jsx`, `apps/frontend/src/components/SettingsPage.jsx`, `apps/frontend/src/components/ui/{QuickResultCard,SearchBar,SessionWipe,OSINTToolsPanel}.jsx`, `apps/frontend/src/pages/UniversalSearch.jsx`.

**S10 — 2026-06-10 · domain migration + search reliability** (commit `50055ea`, push held)
truegle.info wired into CORS (`server.js`), OAuth `FRONTEND_URL` fallback (`auth.js`), canonical/OG/Twitter/JSON-LD (`index.html`), sitemap/robots. `DEPLOYMENT-INFRA.md` §1 rewritten with IONOS→Cloudflare DNS steps (Option A chosen). **Real bug fixed:** Google/Bing/News/2×YouTube axios calls had no timeout → could hang the Vercel function and stall the SerpAPI fallback; added `timeout: 8000`. All provider calls now bounded.

**2026-06-09 — search outage fix + green filter + quick results** (PR #4, `3b100e4`, deployed+verified)
Prod returned 0 results: frontend built with no `.env` → `VITE_BACKEND_URL` fell back to `localhost:3001` baked into the bundle. Fixed in `vite.config.js` (committed default → live Vercel backend in prod mode). SearXNG timeout 12s→4.5s + error→warn. Green mode now filters AI-content domains FE→BE (`aiContentDomains.js` NEW). `buildInstantAnswer` async; added `calculation` (safe arithmetic, no API) + `weather` (live OpenWeather singleton); new `WeatherCard`/`CalculationCard`. Verified live: real Brave results, safe-search differential works, calc/weather/green all good.

**PR #1 / #2 — search UI, safe-search, SEO, trust-proxy, OG** (merged + deployed + verified)
Mode-matched container colors; mounted missing `SettingsProvider` + tri-state safe/blur/off safe-search; bias pills on all results; visible source URL + open-link/open-in-app; real YouTube video duration/views via `videos.list` + `formatBingResults`; locked `/green` route; `useDeviceTier` perf hook; `robots.txt`/`ads.txt`/`sitemap.xml` + JSON-LD/canonical/OG/Twitter meta. PR #2: `app.set('trust proxy', 1)` (fixed `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` on every request); added 1200×630 branded `og-image.png` (was 404).

**S8 — Stripe webhooks**
Fixed raw-body parsing (`express.raw()` for `/api/payment/webhook` BEFORE `express.json()`); created prod webhook `TruegleVercelWebhook` (8 events); `STRIPE_WEBHOOK_SECRET` set on Vercel.

**S7 — API-key migration**
New Google CSE `54cdc3626cf504531`; new Google OAuth client; migrated to new Neon (us-west-2). All keys configured on Vercel: Google Search/OAuth, News, OpenWeather, YouTube, SerpAPI, TomTom, Mapbox, Unsplash, Apify, Hunter.io, Shodan, PayPal, Deepgram, Resend, Brave, Bright Data, Neon. `config/env.js` Joi schema extended.

**S9 — search algorithms / OSINT / UI** (the canonical mode-algorithm table above)
Removed Unsplash from `category=all`; added alternative/conspiracy/independent bias tiers (~40 domains); `sortRedPill()`, `mapPerspectivesToBias()`, `performOsintSearch()`; purple strict filter. New free OSINT endpoints (ip-lookup/dns-lookup/whois/username-platforms). Fixed same-results bug (track `lastSearchedQuery`). MultimediaInterface: real YouTube thumbnails + iframe lightbox, removed all mock images/data, empty states.

**S6 — category fixes**
`performUnsplashSearch` for `category=images`; Google scoped social search; `timeout: 8000` on `unsplash.js`; 3-state safe-search in Google/Bing; SearchBar safe-search toggle; red-pill warning moved to search-execute; tutorial modal steps.

**S5 — CORS + voice fix**
Fixed stale Railway URL in `.env.production` → Vercel backend; fixed `VoiceRecognition.jsx` re-init spam (removed `transcript` from deps).

**S4 — launch day**
Neon connected + migrations 001-004 (004 removed tracking tables — *no bias, no tracking, no censorship*); red-pill backend; CORS before Helmet; Vercel fixes (`bcryptjs`, `better-sqlite3` try/catch, router basename `/`).

**S3 — security**
JWT revocation denylist (`tokenDenylist.js`); COOP→`same-origin-allow-popups`, CORP→`cross-origin`; server-verified ad-token earning; `searchAPI.js` thin-proxy refactor; payment FE wiring; OSINT Flask gunicorn/limiter config.

**2026-05-28 — brand + modes + tokens**
Removed all user-facing "AI" wording → "Smart"/"Search"; 3-way pill (Blue→Red→Green); green AI-free mode + `LetterGlitch` bg; search-summary thin banner (sessionStorage); first-search modal; `TutorialModal` (5-step, once/device); BiasedResults 10-token/session freemium + paywall; SignIn/SignUp redirect fix.

---

## Quick reference
| Item | Location |
|------|----------|
| Search route (BE) | `apps/backend/routes/search.js` |
| Search service (BE) | `apps/backend/services/SearchService.js` |
| AI-content blocklist | `apps/backend/data/aiContentDomains.js` |
| Weather (singleton!) | `apps/backend/services/WeatherService.js` |
| OSINT free endpoints | `apps/backend/routes/osint.js` · proxy `osint-proxy.js` |
| Auth middleware / denylist | `apps/backend/middleware/auth.js` · `services/tokenDenylist.js` |
| Token earning | `apps/backend/routes/tokens.js` |
| Security headers | `apps/backend/middleware/security.js` |
| Live search page (FE) | `apps/frontend/src/pages/UniversalSearch.jsx` |
| Search API proxy (FE) | `apps/frontend/src/services/searchAPI.js` |
| Payment service (FE) | `apps/frontend/src/services/paymentService.js` |
| Infra / DNS steps | `DEPLOYMENT-INFRA.md` |
| Health check | `node apps/backend/scripts/healthcheck.js http://localhost:3001` |
