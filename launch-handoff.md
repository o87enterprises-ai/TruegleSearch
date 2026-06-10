# TruegleSearch Launch Handoff Document

**Last Updated:** 2026-06-10 (Session 10)
**Status:** DEPLOYED AND LIVE — DOMAIN MIGRATION (`truegle.info`) WIRED + SEARCH TIMEOUTS FIXED (LOCAL ONLY, NOT YET DEPLOYED — DEPLOY HELD UNTIL DNS RESOLVES)
**Frontend:** https://truegle-search.pages.dev (Cloudflare Pages) → new primary domain **truegle.info** (DNS pending)
**Backend:** https://backend-seven-khaki-60.vercel.app (Vercel)
**Database:** Neon PostgreSQL (us-east-1)

---

## SESSION 10 COMPLETED WORK — DOMAIN MIGRATION (truegle.info) + SEARCH RELIABILITY (2026-06-10)

### Domain migration — `truegle.info` is the new primary/canonical (code-side DONE)
User bought `truegle.info` via **IONOS**; keeping `trumpafi.online` as a secondary that also points at Truegle (goal: many owned domains → Truegle, one SEO canonical). Code changes:
- `apps/backend/server.js` — added `https://truegle.info` + `https://www.truegle.info` to CORS allowlist (kept both `trumpafi.online` entries). `/sitemap.xml` + `/robots.txt` fallback base URL → `truegle.info`.
- `apps/backend/routes/auth.js` — `FRONTEND_URL` fallback (OAuth redirects) → `truegle.info`.
- `apps/frontend/index.html` — canonical / OG / Twitter / JSON-LD URLs → `truegle.info`.
- `apps/frontend/public/sitemap.xml` + `robots.txt` → `truegle.info`.
- `DEPLOYMENT-INFRA.md` — rewrote §1 with exact IONOS → Cloudflare Pages DNS steps. **DECIDED: Option A — move nameservers to Cloudflare.** §1b covers keeping `trumpafi.online`.

### Search reliability — provider timeouts (code-side DONE)
- Verified the three stale handoff "bugs" (Weather 404, Brave init error, SerpAPI fallback) are **already resolved** in current code — see 🔍 Search Categories below for the per-item verdict.
- **Real bug found + fixed:** Google, Bing, News, and both YouTube axios calls in `apps/backend/services/SearchService.js` had **no timeout** → could hang the Vercel function and stall the SerpAPI fallback (which runs after `Promise.allSettled`). Added `timeout: 8000` to all four. Every provider call is now bounded (Google/Bing/Brave/News/YouTube/Unsplash 8s, SearXNG 4.5s, SerpAPI 10s). `node -c` clean.

### Git state at end of session
- 8 files modified on `main`. **Committed locally, push HELD** until DNS resolves (so frontend `truegle.info` canonical tags + backend deploy go live together against a resolving domain, and to avoid any Vercel git auto-deploy).

### ⏭️ NEXT SESSION — START HERE
1. **DNS (needs user + IONOS login)** — follow `DEPLOYMENT-INFRA.md` §1 Option A:
   a. Cloudflare dashboard → Add site `truegle.info` (Free) → copy the 2 nameservers.
   b. IONOS → `truegle.info` → nameserver settings → paste Cloudflare's nameservers.
   c. Cloudflare Pages → `truegle-search` project → Custom domains → add `truegle.info` + `www.truegle.info`.
   d. `trumpafi.online`: 301-redirect → `https://truegle.info` (keep as secondary).
2. **After DNS resolves:** set `FRONTEND_URL=https://truegle.info` on Vercel backend → **push** `main` → redeploy backend (`vercel deploy --prod --yes`) + frontend (`wrangler pages deploy dist --project-name=truegle-search --branch=main`).
3. **Verify live:** `https://truegle.info/` loads; search works (timeouts in effect); `truegle.info/ads.txt`, `/sitemap.xml`, `/robots.txt` reachable.
4. **Then:** Search Console + AdSense re-submit under `truegle.info` (these are sign-up steps → **deferred to last** per user).
5. **Still queued (code-side, no internet needed):** Shopping category wiring, OSINTMode redesign, BiasedResults purple-mode fix + category-modal audit (see ⭐ TRUEGLE EDITS).

---

## SESSION 9 COMPLETED WORK — SEARCH ALGORITHMS, OSINT, UI FIXES

### Mode Algorithm Definitions (canonical)
Each search page now has a clearly defined algorithm. This was the core architectural decision of this session:

| Mode | Algorithm |
|------|-----------|
| **Blue** | Standard relevance — Google/Brave/News as-is, most relevant first |
| **Green** | Identical to Blue, AI/summary features disabled |
| **Red** | Inverted mainstream — conspiracy → alternative → independent → neutral → center → unbiased → left → right → mainstream. Explicitly queries substack/rumble/odysee/thegrayzone/zerohedge/rt.com etc. |
| **Purple** | Strict perspective filter — user picks perspectives, ONLY matching results shown. Zero filler. |
| **Ocean** | OSINT pipeline only — no web search. Queries social profiles, domain intel, breach/paste sites. |

### Backend — `apps/backend/services/SearchService.js`
- **Removed** Unsplash from `category=all` (was polluting default web results). Now only fires for `category=images`.
- **Added new bias tiers**: `alternative`, `conspiracy`, `independent` with ~40 new domain mappings (zerohedge, rt.com, rumble, odysee, substack, thegrayzone, corbettreport, infowars, naturalnews, medium, etc.)
- **New `sortRedPill()`**: Sorts conspiracy/alternative to top, mainstream to bottom. Replaces old round-robin `diversifyByBias()`.
- **New `mapPerspectivesToBias()`**: Maps all 20+ UI perspective IDs (conservative, libertarian, progressive, spiritual, etc.) to internal bias tiers.
- **New `performOsintSearch()`**: Ocean mode bypasses web search entirely. Runs Google queries targeting LinkedIn, Twitter, GitHub, pastebin, haveibeenpwned, WHOIS/breach terms.
- **Purple strict filter**: When `mode=purple` + `filters.perspectives` present, only results matching mapped bias tiers are returned.
- **Red pill queries expanded**: Now explicitly targets `site:substack.com OR site:rumble.com OR site:odysee.com OR site:zerohedge.com OR site:rt.com` and `"censored" OR "suppressed" OR "they don't want you to know"` in addition to main query.

### Backend — `apps/backend/routes/search.js`
- Added `alternative`, `conspiracy`, `independent`, `neutral` to valid bias values.
- Added `perspectives` array passthrough in `validateFilters()` for purple mode.

### Backend — `apps/backend/routes/osint.js` (NEW ENDPOINTS — free, no key needed)
- `GET /api/osint/ip-lookup?ip=...` — ipinfo.io geolocation (free, no key)
- `GET /api/osint/dns-lookup?domain=...&type=A` — dns.google/resolve (free, no key). Supports A, AAAA, MX, TXT, NS, CNAME, SOA.
- `GET /api/osint/whois?domain=...` — rdap.org RDAP lookup (free, no key). Returns parsed registrar, dates, nameservers.
- `GET /api/osint/username-platforms?username=...` — generates 20 platform check URLs (GitHub, Twitter, Instagram, Reddit, LinkedIn, TikTok, YouTube, Twitch, Rumble, Odysee, Substack, etc.). No external API call.

### Frontend — `apps/frontend/src/pages/UniversalSearch.jsx`
- **Fixed same results bug**: Auto-search effect previously only fired when `searchResults.length === 0`, meaning navigating between queries never refreshed. Now tracks `lastSearchedQuery` and re-fires when URL query param changes.
- **Mode-aware backend mode string**: Now sends `blue-pill`, `red-pill`, `purple`, or `ocean` to backend correctly.
- **Purple perspectives passed**: `filters.perspectives = selectedPerspectives` sent to backend for strict filtering.

### Frontend — `apps/frontend/src/components/ui/MultimediaInterface.jsx`
- **Videos**: Now extracts YouTube video ID from URL, uses `https://img.youtube.com/vi/{id}/hqdefault.jpg` for thumbnails. Lightbox now renders real YouTube `<iframe>` embed with autoplay + controls instead of a static image. Non-YouTube videos get a fallback card with "Watch Video" link.
- **Social (soc)**: Removed all picsum.photos mock images. Social posts now display as text-only cards with platform badge, author, title, snippet, and direct link. No fake engagement counts.
- **Mock data removed**: `mockImages`, `mockVideos`, `mockSocialPosts` replaced with empty arrays — no fake data shown when APIs return nothing.
- **Empty states added**: Proper "No results found" messages for vids and soc when API returns empty.

### NOT YET COMPLETED THIS SESSION
- **`OSINTMode.jsx` redesign** — interrupted before implementation. Needs:
  - Wire up new free OSINT endpoints (`/api/osint/ip-lookup`, `/api/osint/dns-lookup`, `/api/osint/whois`, `/api/osint/username-platforms`)
  - Wire existing auth endpoints (`/api/osint/email-finder`, `/api/shodan/ip/:ip`)
  - Replace guided mock animation with real API call results
  - **In-page iframe viewer** — when user clicks a result URL, opens an iframe panel for in-page verification. Needs X-Frame-Options fallback (show "This page can't be embedded — Open in new tab" if iframe is blocked).
  - Remove all `getMockResults()` and simulated step animations
  - Tool-specific input forms (IP field, domain field, username field, email field)

- **`BiasedResults.jsx` mode update** — still passes old `mode` logic. Should be updated to send `mode: 'purple'` and `filters.perspectives` to match new backend expectations.

- **Deploy**: Changes are local only. Need `wrangler pages deploy apps/frontend/dist` + `vercel --prod --yes` from `apps/backend` after testing.

---

## SESSION 8 COMPLETED WORK — STRIPE WEBHOOKS

### Stripe CLI Installed
- `brew install stripe/stripe-cli/stripe` — v1.42.1

### Webhook Body Parsing Bug Fixed
- Root cause: `express.json()` was consuming the raw body globally before Stripe's signature verifier could read it
- Fix: added `app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))` in `server.js` BEFORE `express.json()`
- Removed duplicate `express.raw()` from the route handler in `routes/payment.js`
- Verified locally: all events returning `200`

### Production Webhook Configured
- Deleted stale `TruegleWebHookEndpoint` (pointed to expired `truegle.info` domain)
- Created `TruegleVercelWebhook` → `https://backend-seven-khaki-60.vercel.app/api/payment/webhook`
- Listening to 8 events: payment_intent.succeeded/failed, customer.subscription.created/updated/deleted, invoice.payment_failed, charge.succeeded/updated
- Production `STRIPE_WEBHOOK_SECRET` updated on Vercel, backend redeployed

---

## SESSION 7 COMPLETED WORK — API KEY MIGRATION

### Google Search Engine (New CSE)
- Old account no longer accessible — created new CSE: `54cdc3626cf504531`
- "Search entire web" deprecated by Google — CSE searches configured domains only for now
- Plan: add SerpAPI as whole-web fallback (key already configured: `SERP_API_KEY`)
- Add ~50 broad domains to CSE when time allows

### Google OAuth Client Created
- Client ID: `1004953436750-0a1ni3p4mqaihh3593gvibq7tqsc5gma.apps.googleusercontent.com`
- Redirect URI: `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`
- JS Origin: `https://truegle-search.pages.dev`
- Note: OAuth consent screen still in "Testing" mode — add test users or publish before launch

### Database Migrated
- Switched to new Neon instance: `ep-spring-star-afnjwpg6-pooler.c-2.us-west-2.aws.neon.tech` (us-west-2)
- Migrations ran successfully — tables created fresh

### All API Keys Now Configured on Vercel Production

| Service | Env Var | Status |
|---------|---------|--------|
| Google Search | `GOOGLE_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID` | Live |
| Google OAuth | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Live |
| News API | `NEWS_API_KEY` | Live |
| OpenWeather | `OPENWEATHER_API_KEY` | Live |
| YouTube Data | `YOUTUBE_API_KEY` | Live |
| SERP API | `SERP_API_KEY` | Live |
| TomTom Maps | `TOMTOM_API_KEY` | Live |
| Mapbox | `MAPBOX_ACCESS_TOKEN` + `VITE_MAPBOX_TOKEN` (frontend) | Live |
| Unsplash | `UNSPLASH_ACCESS_KEY` + `UNSPLASH_SECRET_KEY` + `UNSPLASH_ACCOUNT_ID` | Live |
| Apify (social) | `APIFY_API_KEY` | Live |
| Hunter.io (OSINT) | `HUNTER_IO_API_KEY` | Live |
| Shodan (OSINT) | `SHODAN_API_KEY` | Live |
| PayPal | `PAYPAL_CLIENT_ID` + `PAYPAL_SECRET` | Live |
| Deepgram (voice) | `DEEPGRAM_API_KEY` | Live |
| Resend (email) | `RESEND_API_KEY` | Live |
| Brave Search | `BRAVE_API_KEY` | Live |
| Bright Data | `BRIGHT_DATA_API_KEY` | Live |
| Neon PostgreSQL | `DATABASE_URL` | Live |

### Health Check Status (post-deploy)
- 11/17 passing
- PASS: Health, Search, Search Health, Unsplash, Auth, OSINT, Shodan, PayPal, Tokens
- FAIL (expected): Weather route (404 — route wiring issue not key), Radar Geocode (no Radar key), Maps Geocode, Shopping/Social stubs

### config/env.js Updated
- Added Joi schema entries + config exports for: `RESEND_API_KEY`, `BRAVE_API_KEY`, `BRIGHT_DATA_API_KEY`, `DATABASE_URL`
- `config.email.resend`, `config.brave`, `config.brightData`, `config.database` now available to all services

---

## SESSION 6 COMPLETED WORK

### Bug Fixes (from Session 5 interrupted list)
- **Images category** — Added `performUnsplashSearch` to `SearchService.js`; fires when `category=images` or `category=all` (if `UNSPLASH_ACCESS_KEY` configured)
- **Social category** — Added Google scoped search (`site:reddit.com OR site:twitter.com OR site:facebook.com`) when `category=social`
- **Unsplash route hangs** — Added `timeout: 8000` to all 5 axios calls in `routes/unsplash.js`
- **Safe search** — Updated `performGoogleSearch` and `performBingSearch` to handle 3-state `safeSearch`: `'safe'` / `'blur'` / `'off'`

### Safe Search Toggle (SearchBar)
- New subtle 3-state icon toggle (Shield/Eye/EyeOff) in the controls row — low opacity, hover to full
- Cycles: Safe (locked) → Blur (filtered) → Off (unrestricted)
- Value passed via `filters.safeSearch` to backend
- Hidden on mobile (icon only), label visible on sm+

### Red Pill Warning — Repositioned
- Clicking the pill button now cycles modes instantly with no blocking modal
- Warning only appears when the user **executes a search** while in Red Pill mode (not on pill click)
- `pendingSearchRef` pattern: stores the search callback, fires it on confirm

### Tutorial Modal Updates
- Added **Biased Search** step (auth-gated note: requires free account)
- Added **OSINT Mode** step (auth-gated note: requires Premium)
- X button now just closes without saving preference (user will see it again)
- "Let's go" final button saves "don't show again"
- "Don't show again" link visible from step 2 onward

### Landing Page Pill — Toast Notification
- `pillMode` state upgraded from boolean `isRedPillMode` to proper 3-string state (`'blue'` / `'green'` / `'red'`)
- Clicking pill cycles instantly (no modal)
- Brief toast overlay (2.2s) appears above search bar showing mode name + description
- Navigation uses `pillMode` string: blue → no `mode=` param, green → `mode=green`, red → `mode=red`

---

## SESSION 5 COMPLETED WORK

### CORS Fix — Wrong Backend URL
- `apps/frontend/.env.production` had stale Railway URL (`joyful-stillness-production-788b.up.railway.app`)
- Fixed to correct Vercel backend: `https://backend-seven-khaki-60.vercel.app`
- Frontend rebuilt and redeployed to Cloudflare Pages

### VoiceRecognition Spam Fix
- `VoiceRecognition.jsx` useEffect had `transcript` in its dependency array
- Caused re-initialization (and repeated console warnings) on every transcript update
- Fixed: effect runs once on mount only, callbacks stored in refs

### API Health Check Results (2026-05-29)
| Service | Status | Notes |
|---------|--------|-------|
| YouTube | Key configured, health check passes | Possibly hitting daily quota (10k units/day, 100 per search) |
| Google | **Unhealthy** | Key invalid or quota exceeded — check Google Cloud Console |
| News API | **Unhealthy** | Key invalid or quota exceeded — check newsapi.org dashboard |
| Bing | Not configured | No key (known, skipped) |
| Unsplash | Configured but **timing out** | Axios call has no timeout; Vercel kills at 10s |

### Known Code Bugs — NOT YET FIXED (interrupted)
1. **`images` category always returns 0** — `SearchService.performSearch` has no images handler; sends zero API requests when `category=images`. Fix: add Unsplash call when `category=images` or `category=all`.
2. **`social` category always returns 0** — Same issue, no social handler in `SearchService`. Social route exists at `/api/social/search` (uses Apify) but is never called from `performSearch`.
3. **Unsplash route hangs** — `apps/backend/routes/unsplash.js` makes axios calls with no timeout, causing Vercel 10s kill. Fix: add `timeout: 8000` to all axios calls in that file.

### Partially Applied Fix (in progress at interrupt)
- Added `this.unsplashAccessKey` to `SearchService` constructor — still need to add the `images`/`social` branch to `performSearch`, Unsplash formatter, and `detectSource`.

---

## SESSION 4 COMPLETED WORK (LAUNCH DAY)

### Database Setup
- Connected Neon PostgreSQL, ran all 3 migrations (001-003)
- Created migration 004: removed tracking tables (search_history, api_usage, ad_analytics)
- Core principle: **No bias, No tracking, No censorship**

### API Services Configured
- Google Search, News API, YouTube — all working
- Bing skipped (no key available)
- Stripe test keys configured
- Mapbox configured on frontend

### OSINT Service Updated
- Swapped Ollama → Gemini free API in `content_agent.py`
- Python deps not yet installable (Python 3.14 compat issues)

### Red Pill Mode Implemented
- Frontend sends `mode` (blue-pill/red-pill) to backend
- Backend runs extra searches with alternative perspective queries
- Results diversified via round-robin bias interleaving
- Bias labels (Left-Leaning, Right-Leaning, Center, Fact-Based, etc.) on every result in red-pill mode

### CORS Fixed
- Moved CORS middleware before Helmet in server.js
- Added localhost:3000, .pages.dev, .vercel.app to allowed origins

### Vercel Deployment Fixes
- `bcrypt` → `bcryptjs` in safe-queries.js
- `better-sqlite3` wrapped in try/catch
- `SquareProvider` import wrapped in try/catch
- `NODE_ENV` validator relaxed for Vercel compatibility
- Router basename changed from `/apps/truegle` to `/`

### Production Deployment
- Frontend deployed to Cloudflare Pages: https://truegle-search.pages.dev
- Backend deployed to Vercel: https://backend-seven-khaki-60.vercel.app
- All env vars set on Vercel via CLI
- Health check passing, search working end-to-end

---

## SESSION 3 COMPLETED WORK

### MEDIUM-1: JWT Revocation on Logout ✅
- Created `apps/backend/services/tokenDenylist.js` — in-memory denylist with TTL auto-cleanup
- Updated `apps/backend/middleware/auth.js` — checks denylist in `authenticate` and `optionalAuth`
- Updated `apps/backend/routes/auth.js` — logout endpoint now adds token to denylist, validate endpoint checks denylist

### MEDIUM-4: CORP/COOP Headers Fix ✅
- Updated `apps/backend/middleware/security.js:31-32`
- Changed COOP from `same-origin` → `same-origin-allow-popups` (allows Stripe/PayPal popups)
- Changed CORP from `same-origin` → `cross-origin` (allows Mapbox/AdSense resources)

### MEDIUM-5: Server-Verified Token Earning ✅
- Updated `apps/backend/routes/tokens.js`
- Added server-side ad session tracking: `/api/tokens/ad-session` creates a session, `/api/tokens/earn/ad` verifies elapsed time server-side
- Added rate limiting: max 6 ad rewards per hour per user
- Minimum 25s must elapse server-side before ad reward is granted
- Sessions are single-use and auto-expire after 2 minutes

### Frontend searchAPI.js Refactor ✅
- Rewrote `apps/frontend/src/services/searchAPI.js` — now a thin proxy to backend `/api/search`
- Removed all direct API calls (Google, Bing, News, YouTube, SerpAPI)
- `realSearchData.js` still provides fallback to mock data if backend is unreachable

### Payment Frontend Wiring ✅
- Created `apps/frontend/src/services/paymentService.js` — full payment flow (getConfig, createIntent, complete, startPremiumCheckout)
- Updated `apps/frontend/src/pages/OSINTMode.jsx` — "Upgrade Now" button calls real payment flow (with auth redirect)
- Updated `apps/frontend/src/pages/PricingPage.jsx` — `handleSubscribe` uses real payment service

### OSINT Flask Production Readiness ✅
- Added `gunicorn==21.2.0` and `flask-limiter==3.5.0` to OSINT requirements.txt
- Created `gunicorn.conf.py` — multi-worker config (4 workers, 120s timeout)
- Updated `web_interface.py` — added flask-limiter (10 req/min on analysis endpoints, 60/hr global)

---

## REMAINING ITEMS

### ⭐ TRUEGLE EDITS (requested 2026-06-10)

> **⏳ Sign-ups are deferred to LAST.** The user will do all account sign-ups/verifications on their own time (limited internet). Do all code/config-side prep first; leave the actual sign-up clicks for the user at the end.

#### Custom domains — DNS (IONOS) — DO FIRST (code/config side)
> **Code-side DONE 2026-06-10** (CORS + SEO canonical/OG/JSON-LD + sitemap/robots + OAuth `FRONTEND_URL` all → `truegle.info`). **Decisions:** DNS approach = **move nameservers to Cloudflare** (Option A in `DEPLOYMENT-INFRA.md` §1); frontend/backend **deploy held until DNS resolves**. Remaining steps are user-driven (IONOS login).

| Item | Notes |
|------|-------|
| `truegle.info` (NEW primary domain) | Bought & paid for via **IONOS** (user has login). Plan: add `truegle.info` to a Cloudflare account → switch IONOS nameservers to Cloudflare's → add `truegle.info` + `www` as custom domains in the CF Pages `truegle-search` project. Then set Vercel `FRONTEND_URL=https://truegle.info` + redeploy both. |
| `trumpafi.online` (keep) | Keep this domain pointing at the Truegle page too. More owned domains → Truegle = better. Same DNS pattern (IONOS or current registrar) → Cloudflare Pages. |
| CORS allowlist | Add `https://truegle.info`, `https://www.truegle.info`, `https://trumpafi.online`, `https://www.trumpafi.online` to allowed origins in `apps/backend/server.js`. |
| Backend redirect URIs | Update Google OAuth + any callback/redirect URIs and `FRONTEND_URL`/origin config once the custom domain is live. |
| AdSense / Search Console | Re-submit under `truegle.info` once DNS resolves (sign-up step — deferred to last). |

#### Sign up & verify with ALL distributors  *(⏳ DEFERRED — do last, user-driven)*
| Item | Notes |
|------|-------|
| OAuth providers | Sign up + verify each OAuth distributor (Google, plus any others). See 🔐 Auth below. |
| Ads | Sign up + verify ad networks (AdSense, etc.). Cross-ref AdSense approval in 🚀 Other. |
| Databases | Confirm DB provider accounts signed up + verified (Neon, etc.). |
| Google Cloud Console Indexing | Sign up / enable + verify the Indexing API in Google Cloud Console (submit/verify site indexing). NEW — not previously tracked. |
| Other distributors | Enumerate remaining distributors (maps, search, social, email, payments) and verify each account is signed up + verified. |

#### Test the important category modals
| Item | Notes |
|------|-------|
| Local | Test the Local category modal end-to-end. |
| Shopping | Test the Shopping category modal (currently a stub — see 🔍 Search Categories). |
| Social | Test the Social category modal. |
| Images | Test the Images category modal. |
| Vids | Test the Videos category modal. |
| Maps | Test the Maps category modal. |

#### Activate OAuth: Gmail + emails
| Item | Notes |
|------|-------|
| Gmail OAuth | Activate OAuth for Gmail (scopes/consent), test sign-in + token flow. NEW — not previously tracked. |
| Email OAuth | Activate OAuth for email accounts/sending; verify email delivery (cross-ref Resend `RESEND_API_KEY`). |

### Still Needed — NEXT SESSION PRIORITIES

#### 🔐 Auth
| Item | Notes |
|------|-------|
| Google OAuth finish | Consent screen in "Testing" mode — publish it or add test users in Google Cloud Console. Flow: `GET /api/auth/google` → callback → JWT. Test end-to-end sign-in. |
| OAuth redirect after login | After Google callback, redirect user back to the page they came from (currently may land on `/`) |

#### 🔍 Search Categories
| Item | Notes |
|------|-------|
| Verify all 21 categories | Test each one: web, images, news, videos, maps, shopping, social, ai/smart, osint, academic, code, finance, health, legal, local, music, podcasts, recipes, sports, travel, weather |
| Images category | Unsplash wired in Session 6 — confirm it works in production |
| Social category | Google scoped search added — test reddit/twitter/facebook results |
| Shopping category | Currently a stub — needs real wiring (Google Shopping or SerpAPI shopping tab) |
| Videos category | Should return YouTube results — verify `YOUTUBE_API_KEY` quota |
| Weather category | ✅ RESOLVED (verified 2026-06-10) — route `POST /api/weather/current` + `/forecast` wired correctly, `WeatherService` singleton + methods match. The old "404" was a stale earlier deploy; weather already works live (instant-answer path confirmed Paris→14°C on 2026-06-09). Just confirm in prod after next deploy. |
| BraveSearch fallback | ✅ RESOLVED (verified 2026-06-10) — `SearchService` uses its own inline `performBraveSearch` with `config.brave.apiKey` (correctly mapped from `BRAVE_API_KEY` in `env.js`), not the standalone `BraveSearchService` class. No undefined error in current code. Standalone class is only used by `BusinessEnrichmentService` (null-guarded). |
| SerpAPI whole-web fallback | ✅ ALREADY WIRED (verified 2026-06-10) — `SearchService.performSearch` fires `performSerpSearch` when web results < 5 (`SERP_API_KEY`→`config.serp.apiKey`). Dedupes by URL. No action needed beyond confirming the key is set on Vercel. |
| Provider timeouts | ✅ FIXED 2026-06-10 — added `timeout: 8000` to Google, Bing, News, and both YouTube axios calls in `SearchService.js` (previously unbounded → could hang the Vercel function and stall the SerpAPI fallback). All provider calls now bounded. **Needs redeploy to take effect.** |

#### 🤖 AI Chatbots
| Item | Notes |
|------|-------|
| Search summary banner | Currently session-only "none" choice — confirm OpenRouter AI summarization works in prod |
| AI chat in results | Verify the chat widget calls `/api/ai` and gets responses (OpenRouter + Gemini both configured) |
| Token gate on AI chat | 10 tokens/session — confirm paywall modal triggers correctly at 0 tokens |

#### 🕵️ OSINT Page
| Item | Notes |
|------|-------|
| Python service deps | Fix Python 3.14 incompatibility in `OSINT-Harassment-Detector/requirements.txt` — bump package versions |
| Deploy OSINT Flask service | Deploy to a persistent host (Railway, Render, or VPS) — backend proxies to it via `osint-proxy.js` |
| OSINT page UI | Review `OSINTMode.jsx` — confirm premium gate works, all 6 OSINT agents display correctly |
| Hunter.io + Shodan | Keys configured — verify the OSINT routes return real data |

#### 🖼️ New Features Requested
| Item | Notes |
|------|-------|
| **Open in App iframe viewer** | When user clicks a search result, open it in an in-app iframe panel instead of new tab. Add "Open in Viewer" button on each result card. Handle X-Frame-Options blocked sites gracefully (show fallback). |
| **Video link viewer** | Embedded video player for YouTube/video results — detect video URLs and render inline player instead of opening YouTube. |

#### 💳 Payments
| Item | Notes |
|------|-------|
| Stripe test → live keys | Swap `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` to live keys when ready to charge real users |
| Stripe account review | Dashboard shows "Review in progress" — monitor and complete verification |

#### 🚀 Other
| Item | Notes |
|------|-------|
| CSE domain list | Add ~50 broad domains to Google CSE `54cdc3626cf504531` for better web coverage |
| SerpAPI whole-web fallback | Wire into `performSearch` as fallback when Google CSE returns < 5 results |
| AdSense approval | Submit domain once custom domain is live |
| Custom domain | Update CORS in `server.js` + Cloudflare Pages custom domain settings |
| Bing key | Optional — skipped, current providers cover it |

## QUICK START

```bash
# Backend
cd apps/backend && cp .env.example .env
# Fill in API keys, then:
npm start

# Frontend
cd apps/frontend && cp .env.example .env
# Set VITE_BACKEND_URL and VITE_MAPBOX_TOKEN, then:
npm run dev

# OSINT (production)
cd /path/to/OSINT-Harassment-Detector
pip install -r requirements.txt
FLASK_ENV=production gunicorn -c gunicorn.conf.py web_interface:app

# Health check
node apps/backend/scripts/healthcheck.js http://localhost:3001
```

---

## QUICK REFERENCE

| Item | Location |
|------|----------|
| Frontend | `apps/frontend/` (React 18 + Vite, port 5173) |
| Backend | `apps/backend/` (Express.js, port 3001) |
| Database | PostgreSQL via Neon (`DATABASE_URL`) |
| Auth middleware | `apps/backend/middleware/auth.js` |
| Token denylist | `apps/backend/services/tokenDenylist.js` |
| Rate limiting | `apps/backend/middleware/rateLimit.js` |
| Payment service (FE) | `apps/frontend/src/services/paymentService.js` |
| Payment routes (BE) | `apps/backend/routes/payment.js` |
| Search API (FE) | `apps/frontend/src/services/searchAPI.js` → proxies to backend |
| Search route (BE) | `apps/backend/routes/search.js` |
| OSINT proxy | `apps/backend/routes/osint-proxy.js` |
| Token earning | `apps/backend/routes/tokens.js` (server-verified ad sessions) |
| Security headers | `apps/backend/middleware/security.js` |
| Health check | `node apps/backend/scripts/healthcheck.js` |
| OSINT service | OSINT-Harassment-Detector project (port 5000) |
