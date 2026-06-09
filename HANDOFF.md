# Session Handoff — Truegle Search

_Last updated: 2026-06-09_

## Session 2026-06-09 — search outage fix, green-mode AI filter, quick results

**TL;DR:** Production search was returning **0 results**. Root cause was **not CORS** — the
frontend was being built with no `.env` file, so `VITE_BACKEND_URL` fell back to
`http://localhost:3001` and got baked into the live bundle; every search from `trumpafi.online`
tried to reach the user's local machine. Fixed permanently, plus shipped green-mode AI filtering
and two quick-result widgets. All changes verified live and deployed (frontend → Cloudflare Pages,
backend → Vercel prod).

### What shipped (all live + verified)
| Area | Change | Key files |
|---|---|---|
| **Search no-results FIX** | `vite.config.js` now defaults `VITE_BACKEND_URL` to the live Vercel backend in production mode (committed → survives fresh clones, since `.env*` is gitignored and absent on the build machine). Recreated `.env.production`/`.env.development`. | `apps/frontend/vite.config.js`, `apps/frontend/.env.*` (gitignored) |
| **Offline-machine resilience** | SearXNG call timeout 12s→4.5s and `console.error`→`console.warn`. Search already uses `Promise.allSettled`, so a down self-hosted SearXNG never breaks search or adds latency. | `apps/backend/services/SearchService.js` |
| **Green mode = 0 AI results** | `mode:'green'` now sent FE→BE and handled in `performSearch`: same retrieval as blue, then filters results whose domain is in a blocklist (subdomain-aware; expandable via `AI_CONTENT_DOMAINS` env). | `SearchService.js`, `apps/backend/data/aiContentDomains.js` (NEW), `pages/UniversalSearch.jsx` |
| **Quick results** | `buildInstantAnswer` is now async; added `calculation` (safe arithmetic eval, no API) and `weather` (live OpenWeather via WeatherService singleton). New `WeatherCard`/`CalculationCard`. | `apps/backend/routes/search.js`, `apps/frontend/src/components/ui/QuickResultCard.jsx` |

### Verified live (curl against prod backend)
- Search: real Brave results; CORS header correct for `trumpafi.online` ✓
- Safe search differential: `off`→explicit sites, `safe`→clean (gov/edu/imdb) — **toggle works**, was a stale bundle ✓
- Calculation: `2+2`→4, `15% of 200`→30 ✓ · Weather: `weather in Paris`→14°C overcast ✓ · Green: 29 results ✓

### Notes / gotchas
- **Safe-mode toggle** and **"don't show again" modal** were both **stale-bundle bugs** — current code is correct; the redeploy shipped the fixes. Modal still needs a human eyeball on the live site to confirm.
- **`services/WeatherService.js` exports a SINGLETON instance**, not the class. `require` and use directly — do NOT `new` it (doing so crashed the backend with `FUNCTION_INVOCATION_FAILED`; caught via `vercel logs` and fixed).
- The old "weather route 404" (Session 9 list) is sidestepped — quick-results call the WeatherService directly and it works.

### Next session — TODO (from user's launch list)
1. **More quick-results:** sports scores, business/locations/phone/shopping, calendar/events, history, news/breaking (extend `detectQueryType` + `buildInstantAnswer` + add cards).
2. **Categories logic:** images/social/profiles via Apify + general search APIs (image/social/video tabs).
3. **OSINT Investigation Agent:** default-flow ("what investigation would you like?" + suggestions), iframe verification panel, install free OSINT frameworks; wire the free endpoints in `OSINTMode.jsx`.
4. **Multi-input search bar:** audio / files / images end-to-end.
5. **Privacy hardening:** audit cache/history clearing + no-storage guarantees ("absolute privacy").
6. **Maps/globe** rendering refine; hardware-limited background rendering.
7. **SearXNG → primary** with APIs as graceful fallback (user's iMac; flip provider order in `performSearch`).
8. **Deferred — needs user logins/dashboards:** DNS for `truegle.info`, ads distribution, Google/email OAuth, Search Console, distributor signups. (Google CSE still needs Custom Search API enabled — see below.)

---

## TL;DR
The search-UI / safe-search / green-mode / video / SEO batch **plus** a backend trust-proxy fix
and a branded OG image are now **merged to `main`, deployed, and verified live in production**.
Search is fully functional (Brave/News/YouTube). The only remaining work is **browser-dashboard
validation** (Google Custom Search API enable, AdSense review, Search Console / Bing verification).

- **Live frontend:** https://trumpafi.online (Cloudflare Pages project `truegle-search`)
- **Live backend:** https://backend-seven-khaki-60.vercel.app (Vercel project `backend`)
- **Repo:** `o87enterprises-ai/TruegleSearch` · `main` is in sync with production
- **Merged this session:** PR #1 (search UI/SEO) and PR #2 (trust proxy + OG image)
- **Infra/manual steps:** `DEPLOYMENT-INFRA.md` (this repo root)

---

## Deploy topology & commands (verified working 2026-06-07)
- **Frontend** → Cloudflare Pages project `truegle-search`, custom domain `trumpafi.online` (attached).
  - Build (Windows): `cd apps/frontend && NODE_OPTIONS='--max-old-space-size=4096' node ../../node_modules/vite/dist/node/cli.js build`
    (the npm `build` script uses a bash env prefix that fails on Windows cmd).
  - Deploy: `wrangler pages deploy dist --project-name=truegle-search --branch=main`
- **Backend** → Vercel project `backend` (`backend-seven-khaki-60.vercel.app`).
  - Deploy: `cd apps/backend && vercel deploy --prod --yes`
- CLIs authenticated: `wrangler` (o87enterprises@gmail.com), `vercel` (o87enterprises), `gh` (o87enterprises-ai).
- Health: `GET /api/health` → `{status:"OK"}`; `GET /api/search/health` → per-provider.
- Read backend runtime logs: `cd apps/backend && vercel logs backend-seven-khaki-60.vercel.app --json`.

---

## Project shape (orientation)
- Monorepo: `apps/frontend` (React 18 + Vite SPA) and `apps/backend` (Node/Express API).
- **The live search page is `apps/frontend/src/pages/UniversalSearch.jsx`** rendered at `/search`.
  "Modes" = `blue | red | purple | ocean | green` (set via `?mode=` and the pill toggle).
  Legacy routes (`/search-results`, `/search-portal`, `/results`, `/biased`, `/osint`) all
  `Navigate` to `/search`.
- **Dead/legacy files (do NOT use, safe to delete later):** `pages/SearchResults.jsx*`,
  `pages/SearchPortal*`, `pages/BiasedResults.jsx`, `pages/OSINTMode.jsx`, `pages/OSINTTools.jsx`,
  `components/ResultsPage.jsx`, `components/SearchResults.jsx`, `components/ui/SearchResultsContainer.jsx`.
  Their imports were removed from `App.jsx`.
- Canonical production domain: **`trumpafi.online`**.

---

## What shipped & was verified live this session

### PR #1 — search UI, safe-search, green mode, video details, SEO (merged → deployed)
| Area | Change | Key files |
|---|---|---|
| Container colors | Result cards match active mode via `MODE_ACCENT` map (was hardcoded cyan) | `pages/UniversalSearch.jsx` |
| Safe Search | Mounted missing `SettingsProvider`; tri-state safe/blur/off wired Settings ↔ SearchBar ↔ `/api/search`; thumbnails blur on "blur" | `App.jsx`, `context/SettingsContext.jsx`, `components/SettingsPage.jsx`, `pages/UniversalSearch.jsx`, `routes/search.js` |
| Bias pills | Shown on **all** results (was red/purple only); purple defaults to neutral | `pages/UniversalSearch.jsx` |
| Result links | Visible source URL + "Open link" / "Open in app" (iframe) controls | `pages/UniversalSearch.jsx` |
| Video details | Real duration/views/channel via YouTube `videos.list`; added `formatBingResults` | `services/SearchService.js`, `components/ui/MultimediaInterface.jsx` |
| Locked green | `/green` route → no mode/nav switching, AI off, higher-contrast greens | `App.jsx`, `pages/UniversalSearch.jsx` |
| Performance | `useDeviceTier` hook → lightweight CSS bg on low-end / reduced-motion | `hooks/useDeviceTier.js`, `pages/UniversalSearch.jsx` |
| SEO/Ads | `robots.txt`, `ads.txt` (pub-9542137900411519), `sitemap.xml` (+ backend routes), JSON-LD + canonical/OG/Twitter meta | `public/*`, `server.js`, `index.html` |

### PR #2 — trust proxy + OG image (merged → deployed)
| Change | Key files |
|---|---|
| `app.set('trust proxy', 1)` so express-rate-limit reads the real client IP from `X-Forwarded-For` behind Vercel's proxy (was throwing `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` on every request) | `apps/backend/server.js` |
| Added 1200×630 branded `og-image.png` (was 404 → SPA fallback, breaking link previews) | `apps/frontend/public/og-image.png`, `apps/frontend/scripts/gen-og-image.mjs` (generator, needs `sharp`) |

### Verified live (curl + vercel logs)
- `trumpafi.online/ads.txt` → `text/plain`, correct pub ID ✓
- `trumpafi.online/sitemap.xml` → `application/xml`, valid ✓
- `trumpafi.online/robots.txt` ✓ ; `index.html` has JSON-LD + canonical + OG ✓
- `trumpafi.online/og-image.png` → `image/png` (143 KB) ✓
- Backend `/api/health` → `OK`; live search returns 29 results; **0 `X-Forwarded-For` errors** post-deploy ✓

---

## Outstanding / next steps (browser-dashboard only — no code left)
1. **Enable Google Custom Search JSON API** — search currently logs
   `403 PERMISSION_DENIED – "This project does not have the access to Custom Search JSON API."`
   Fix: Google Cloud Console → the project owning `GOOGLE_API_KEY` → APIs & Services → Library →
   enable **Custom Search API**. No redeploy needed. (Brave covers search meanwhile — not user-facing broken.)
2. **AdSense** — `ads.txt` is valid now; request review in the AdSense dashboard. Ensure Privacy/Terms/About pages exist.
3. **Search Console** — add `https://trumpafi.online`, verify (DNS TXT or drop the HTML verify file in
   `apps/frontend/public/` + redeploy), submit `/sitemap.xml`, URL-Inspect → Request Indexing for `/` and `/search`.
4. **Bing Webmaster** — add + verify, import from Search Console.

## Deferred by decision
- **SearXNG** — `SEARXNG_URL` on Vercel points to a dead ngrok tunnel → 404 on every search
  (caught/non-fatal; Brave covers). User chose to leave it and reconfigure later on a persistent host.
  Optional cleanup when revisited: downgrade `console.error('SearXNG error...')` to warn in `SearchService.js`.

## Known pre-existing issues (not addressed, follow-up candidates)
- SPA is client-only → poor crawl/indexing; the real SEO win is prerender/SSG (vite-plugin-ssr / react-snap / Next.js).
- Build warnings: CSS `@import` order in `src/index.css`; a `--tw-shadow-color: ${...}` template literal landing in CSS;
  one ~4.8 MB JS chunk (no code-splitting).

## Original feature requests still open (from user)
- "Add perspectives labels to all search results" — partly done (bias pills on all results); confirm intent
  vs. the purple multi-perspective selector.
- Stripe test → live keys when ready to charge; complete Stripe account verification.
