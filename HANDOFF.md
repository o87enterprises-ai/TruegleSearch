# UNIFIED HANDOFF — Truegle Search
_Last updated: 2026-06-15 (evening). Supersedes all prior handoff docs._

This doc is written so it can be handed to **Claude in the web browser** to walk through
the remaining **dashboard/browser activation steps**. Everything that requires code or a
computer has already been done and deployed (see "Done this session").

---

## ✅ DONE THIS SESSION (all live + verified)

- **Search outage FIXED.** Search on `truegle.info` was returning nothing due to a stale
  backend (CORS allowlist already included truegle.info in code, but the deployed Vercel
  backend predated it). Redeployed backend → verified preflight `204` + real search returns
  results from the `truegle.info` origin.
- **Legal pages SHIPPED + live:** `/privacy`, `/terms`, `/about`
  (`https://truegle.info/privacy` etc. → HTTP 200). These **unblock OAuth publishing AND
  AdSense review**.
- **Down-for-repairs modal SHIPPED.** After **2 consecutive search failures** (network/CORS/
  5xx outage) a friendly maintenance modal appears so global users aren't left with a silent
  empty page. Auto-clears on the next successful search.
- **Browser-synced multilingual search SHIPPED.** The engine now detects the visitor's
  browser language/region and localizes **search results** (Google `lr/hl/gl`, Brave
  `search_lang/country`, NewsAPI language). A language dropdown sits under the search bar.
  UI chrome stays English for now.

**Git:** `origin/main` = `8d05a13`. Frontend + backend both manually deployed from this.

---

## ⚡ CURRENT STATE

### Infrastructure
| Item | Status | Notes |
|------|--------|-------|
| `truegle.info` / `www.truegle.info` | ✅ Live + SSL | Cloudflare Pages custom domains |
| `trumpafi.online` | ✅ Live | 301 → `truegle.info` |
| `truegle-search-15k.pages.dev` | ✅ Live | Pages default domain |
| Backend | ✅ Live | `https://backend-seven-khaki-60.vercel.app` |
| Search on truegle.info | ✅ Working | Fixed this session |
| DNS | ✅ Complete | Cloudflare nameservers active on IONOS |

### Known operational notes
- **package-lock.json is out of sync** with package.json (missing passport + related deps).
  Cloudflare Pages **GitHub auto-build is therefore disconnected** — deploys are **manual**
  via wrangler for now. Fix = `npm install` from repo root, commit the updated lock file,
  push; then reconnect the Pages Git integration.
- **Vercel CLI token** expired once this session; re-auth via `vercel login` device flow
  (can be approved from a phone already logged into Vercel).

---

## 🗂️ THIRD-PARTY SERVICE STATUS

| Service | Status | Notes |
|---------|--------|-------|
| Cloudflare DNS | ✅ Complete | `truegle.info` zone active |
| 301 Redirect | ✅ Active | trumpafi.online → truegle.info |
| Legal pages (/privacy /terms /about) | ✅ Live | Prereq for OAuth + AdSense — now satisfied |
| **Google Custom Search API** | ⚠️ **403** | See Step 1. Testing the real key DIRECTLY in a browser still 403s → it's a **project/account** issue, NOT a Vercel key mismatch. Likely the "API Enabled" screen was viewed under the WRONG Google account (multiple accounts). Brave covers search meanwhile. |
| Google OAuth | ⚠️ Testing mode | Publish now unblocked (legal pages exist). See Step 2. |
| OAuth Branding | ⚠️ Needs fix | Wrong authorized domain `truegle-search.pages.dev` → should be `truegle-search-15k.pages.dev`; also add `truegle.info` + `trumpafi.online`; fill home/privacy/terms URLs. See Step 3. |
| AdSense | 🔄 **In review** | Ownership **VERIFIED 2026-06-15** (both ads.txt + the AdSense `<head>` snippet are live & crawlable). Site status = "Getting ready / Review requested" → awaiting Google **content review** (days–2 wk, email when done). Risk: may land on "Low value content" like the other sites → remedy = content hub + SPA prerender (Post-Prod #5). |
| Search Console | ⏸️ Not started | See Step 5. |
| Bing Webmaster | ⏸️ Not started | See Step 5. |
| Stripe | ✅ Verified | Live keys NOT yet swapped on Vercel. See Step 6. |

---

## 🚦 REMAINING BROWSER STEPS (do in this order — each is self-contained)

> Reference values you'll need are in the QUICK REFERENCE table at the bottom.

### Step 1 — Fix Google Custom Search API 403  ✅ no redeploy needed
The key itself is being rejected with *"This project does not have access to Custom Search
JSON API."* — even when tested directly. The usual cause with multiple Google accounts is
that the API was enabled in the wrong account/project.
1. Go to **console.cloud.google.com**. In the **top-right avatar**, confirm you are signed
   into the account that owns project **`truegle-search` (project number `1004953436750`)**.
2. Top-left project picker → select **`truegle-search`** (confirm the number `1004953436750`).
3. **APIs & Services → Enabled APIs & services** → look for **"Custom Search API"**.
   - If it's NOT listed: **+ Enable APIs and Services** → search **"Custom Search API"** →
     **Enable**.
   - If it IS listed as enabled but search still 403s, wait ~5 min for propagation, then retest.
4. **Test it** (any browser), replacing `THE_KEY` with the value from
   **APIs & Services → Credentials → `Truegle Custom Search API Key` → Show key**:
   ```
   https://www.googleapis.com/customsearch/v1?key=THE_KEY&cx=54cdc3626cf504531&q=test
   ```
   - JSON with `"items": [...]` → fixed. (No redeploy needed; backend uses the same key.)
   - Still 403 → you're still in the wrong account/project, or it hasn't propagated.
5. (Optional) **programmablesearchengine.google.com** → engine `54cdc3626cf504531` → turn on
   **"Search the entire web"** for broader coverage.

### Step 2 — Publish Google OAuth consent screen
Legal pages now exist, so this is unblocked.
1. **console.cloud.google.com** → project `truegle-search` → **APIs & Services → OAuth
   consent screen**.
2. Under **Audience** (or **Publishing status**) → **Publish App** → confirm. Keep basic
   scopes (email, profile, openid) and **no logo** to avoid Google's verification review.
3. (Optional) Or, if you'd rather stay in Testing, add tester emails under **Test users**.

### Step 3 — Fix OAuth Branding
Same OAuth consent screen → **Branding**:
- ❌ Remove `truegle-search.pages.dev` (wrong).
- ✅ Add authorized domains: `truegle-search-15k.pages.dev`, `truegle.info`, `trumpafi.online`.
- Fill: **Home page** `https://truegle.info`, **Privacy** `https://truegle.info/privacy`,
  **Terms** `https://truegle.info/terms`.
- **Credentials → OAuth client `Truegle Search`** → confirm **Authorized redirect URI**
  `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`; add **JavaScript
  origins** `https://truegle.info` and `https://trumpafi.online`. Save.
- NOTE: the Google sign-in button stays hidden in the app until the frontend env
  `VITE_SOCIAL_AUTH_ENABLED=true` is set and the frontend is redeployed (ask Claude Code to
  do that once OAuth is published).

### Step 4 — AdSense review  ✅ ownership verified, ⏳ now in content review
DONE 2026-06-15: ownership verified (ads.txt + `<head>` snippet both live), **review
requested** — site shows "Getting ready". Nothing to do but **wait for Google's email**
(days–2 wk). Do NOT re-request repeatedly. If it later flips to "Low value content," that's a
content/crawlability problem → see Post-Prod #5 (content hub + SPA prerender), not ads.txt.

### Step 5 — Search Console + Bing Webmaster
**Google Search Console** (search.google.com/search-console):
1. **Add property** → `https://truegle.info`.
2. Verify via **DNS TXT** — add the TXT record in **Cloudflare → truegle.info → DNS**.
3. **Submit sitemap:** `https://truegle.info/sitemap.xml`.
4. **URL Inspection** → Request indexing for `/` and `/search`.

**Bing Webmaster** (bing.com/webmasters):
1. **Add site** → `truegle.info` → **Import from Google Search Console** (one click) or verify
   via DNS TXT.
2. Submit sitemap `https://truegle.info/sitemap.xml`.

### Step 6 — Swap Stripe to live keys (only when ready to charge real users)
**Vercel → project `backend` → Settings → Environment Variables:**
- `STRIPE_SECRET_KEY` → `sk_live_...` (Stripe → Developers → API Keys)
- `STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- `STRIPE_WEBHOOK_SECRET` → `whsec_...` (Stripe → Webhooks → `TruegleVercelWebhook`)
- Then **redeploy backend** (ask Claude Code, or `cd apps/backend && vercel deploy --prod --yes`).

### Step 7 — (Optional) SearXNG as primary
Once SearXNG runs on a persistent host, set on Vercel backend: `SEARXNG_URL=https://<host>` +
`SEARXNG_PRIMARY=true` (optional `SEARXNG_PRIMARY_MIN=5`), then redeploy backend.

---

## 🛠️ DEPLOY TOPOLOGY & COMMANDS (for Claude Code / a computer)

**Frontend (Cloudflare Pages, project `truegle-search`):**
```
cd apps/frontend
NODE_OPTIONS='--max-old-space-size=4096' node ../../node_modules/vite/dist/node/cli.js build
wrangler pages deploy dist --project-name=truegle-search --branch=main --commit-dirty=true
```
**Backend (Vercel, project `backend`):**
```
cd apps/backend && vercel deploy --prod --yes
```
**Verify:**
```
curl https://truegle.info/            # 200
curl https://truegle.info/ads.txt     # valid
curl https://backend-seven-khaki-60.vercel.app/api/health          # {"status":"OK"}
curl https://backend-seven-khaki-60.vercel.app/api/search/health   # per-provider
```
CLIs authenticated: wrangler (o87enterprises@gmail.com), vercel (o87enterprises),
gh (o87enterprises-ai).

---

## 🏗️ PROJECT SHAPE & GOTCHAS

- **Monorepo:** `apps/frontend` (React 18 + Vite SPA, port 5173) + `apps/backend`
  (Node/Express, port 3001). DB: Neon PostgreSQL (`ep-spring-star-afnjwpg6-pooler`, us-west-2).
- **Live search page:** `apps/frontend/src/pages/UniversalSearch.jsx` (`/search`). Modes:
  Blue (standard), Green (Blue + AI-content-domain filter), Red (inverted mainstream),
  Purple (strict perspective filter), Ocean (OSINT only).
- **Language plumbing:** FE `SettingsContext` (`detectBrowserLanguage/Country`) →
  `filters.language/country` in the search POST → backend `validateFilters` →
  `performGoogleSearch` (lr/hl/gl) / `performBraveSearch` (search_lang/country) / News.
- **Repairs modal:** `components/ui/RepairsModal.jsx`, driven by `consecutiveFailuresRef`
  in `UniversalSearch.handleSearch` (threshold 2).
- **Gotchas:**
  - `services/WeatherService.js` exports a **singleton** — never `new` it.
  - If a fix "doesn't work live," suspect a **stale deploy** first; redeploy.
  - `.env*` is gitignored; `vite.config.js` hardcodes the live Vercel backend as the prod
    default so fresh clones build correctly.
  - Correct Pages domain is `truegle-search-15k.pages.dev` (NOT `truegle-search.pages.dev`).
  - Dead/legacy files safe to delete: `OSINTMode.jsx`, `SearchResults.jsx`, `SearchPortal*`,
    `BiasedResults.jsx`, `ResultsPage.jsx`, `components/SearchResults.jsx`,
    `components/ui/SearchResultsContainer.jsx`.

---

## 🏭 PRODUCTION TASKS (launch-critical — no particular order)
_Things needed to be fully "launched." Most are the browser steps above; a couple are code._
- [ ] **Google Custom Search API 403** — fix under the correct Google account (Browser Step 1).
- [ ] **Publish Google OAuth + fix branding** (Browser Steps 2–3), then **flip
      `VITE_SOCIAL_AUTH_ENABLED=true`** + redeploy frontend so the Google sign-in button shows.
- [ ] **AdSense** — in review; monitor email (Browser Step 4).
- [ ] **Search Console + Bing Webmaster** — add property, verify, submit sitemap (Browser Step 5).
- [ ] **Stripe live keys** — swap on Vercel + redeploy when ready to charge (Browser Step 6).
- [ ] **Reconnect Cloudflare Pages ↔ GitHub** — lockfile is fixed (`b6defba`), so re-enable
      auto-deploy: Pages → `truegle-search` → Settings → Git → Connect (build/output settings in
      "Known operational notes").
- [ ] **`SEARXNG` persistent host** (optional) — then `SEARXNG_PRIMARY=true` + redeploy.

---

## 🚀 POST-PRODUCTION TASKS (optimization & hardening — no particular order, EXCEPT #1 first)

> _Site is ~32,440 monthly requests. Current est. $100–$400/mo. Target $500–$1,500+/mo._

### ⭐ 1. AD MONETIZATION / CPM OPTIMIZATION  ← do this first
The strategy for monetizing in a way that **significantly increases CPM** (header-bidding
competition + high-value placements + lazy/refresh impressions):

**Container audit (where ads go):**
| Container | Status | Revenue Potential |
|-----------|--------|-------------------|
| Hero slot — below AI summary | Empty | ⭐⭐⭐⭐⭐ Highest |
| In-SERP — after every 3rd result | Empty | ⭐⭐⭐⭐ Very High |
| Rewarded ad — freemium unlock | Planned | ⭐⭐⭐⭐ High |
| Sidebar/Footer | None | ⭐ Low — avoid |

**Network waterfall (competition = higher CPM):**
| Network | Role | CPM Range |
|---------|------|-----------|
| **Monetag** | Base/floor (~75% fill) | $2–$8 |
| **Google AdSense** | Primary high-CPM (~25%) | $5–$15 US/NL |
| **Adsterra** | Rewarded + popunder | $10–$25 Tier 1 |

**Implementation:**
- **Pre-connect** in `<head>`: `<link rel="preconnect" href="https://pagead2.googlesyndication.com">`
  and `<link rel="preconnect" href="https://cdn.monetag.com">`.
- **Lazy-load** ad slots via `IntersectionObserver` (inject `data-ad-code` on first intersect).
- **Auto-refresh** in-SERP slots on re-intersection (`googletag.pubads().refresh()` / Monetag
  refresh) for 2–3× impressions.
- **Sticky 300×600 sidebar** (desktop only) via `position: sticky; top: 20px`.
- **Rewarded ad** — wire the "Watch Ad for +5 Tokens" button to the existing backend
  (`/api/tokens/ad-session` + `/earn/ad`, 25s min, 6/hr cap); only the FE button is missing.

**Rollout order:** (1) fill Hero slot → +40% immediate · (2) lazy-load + refresh in-SERP →
2–3× impressions · (3) wire rewarded ad → new revenue stream · (4) sticky sidebar → +15–25% ·
(5) header bidding (Monetag + AdSense) → maximize CPM competition.

### 2. SECURITY AUDIT
Full defensive review before/with real users. Scope: authn/authz (JWT issuance + the
`tokenDenylist` revocation, session handling), input validation on all `/api/*` routes,
injection (SQL via Neon queries, SSRF in OSINT/proxy + `osint-proxy.js`, command/eval in the
`calculation` instant-answer), rate limiting, CORS/Helmet/CSP headers (`middleware/security.js`),
secrets handling (all keys are Vercel env — confirm none leak to the client bundle), payment
webhook signature verification, and dependency CVEs (`npm audit`). Produce a findings list +
severity, then patch.

### 3. THOROUGH CODE REVIEW
End-to-end quality pass (separate from security). Hotspots: oversized pages
(`UniversalSearch` ~1k lines, `BiasedResults` ~1.15k) → extract sub-components; error handling
+ retries in `SearchService` provider calls; dead/legacy file deletion; consistent env config;
test coverage for the search pipeline + token/payment flows. Consider running `/code-review`
(or `/code-review ultra`) on the branch.

### 4. PENETRATION TESTING (own agents) + patch vulnerabilities
Authorized pentest of the live stack with your own agents — probe auth bypass, token/freemium
abuse (earning tokens without watching ads, replaying ad-sessions), OSINT endpoint abuse/SSRF,
IDOR on account/payment routes, rate-limit evasion, XSS via search results/AI summary
rendering, and the Stripe webhook. Triage findings with #2, then patch any unnoticed vulns.

### 5. ADSENSE APPROVAL-READINESS — content + crawlability
If/when the review returns "Low value content": (a) **Content hub "The Bias Report"**
(`/bias-report`) — original case studies of search-engine bias (on-brand, AI-citation bait);
(b) **SPA prerendering** (react-snap / vite-plugin-ssg) for `/`, `/search`, `/privacy`,
`/terms`, `/about` so crawlers see real text, not an empty `<div id="root">`.

### 6. SEO / AEO / GEO
`WebSite` + `SearchAction` JSON-LD on home; `FAQPage` schema wrapping the quick-result cards;
prerender (shared with #5). Goal = eligibility for AI Overviews / AI citation.

### 7. FEATURE BACKLOG (post-launch, abridged)
Listings modal (clickable phone/email/hours) · turn-by-turn nav · podcasts category ·
multi-country/auto-translate result cards · "Take a tour" onboarding · set-as-default-search /
homepage · Share-for-Premium (24 hr access) · AI-summary follow-up input · social category
expansion (YT/FB/TikTok/IG in-app viewer) · remember-me auth · neutral-tier collapsed by
default. (Full list in prior email handoff.)

### 8. CLEANUP
Delete dead files (`OSINTMode.jsx`, `SearchResults.jsx`, `SearchPortal*`, `BiasedResults.jsx`,
`ResultsPage.jsx`, `components/SearchResults.jsx`, `components/ui/SearchResultsContainer.jsx`);
resolve `npm audit` advisories.

---

## 📋 QUICK REFERENCE
| Item | Value |
|------|-------|
| Frontend URL | `https://truegle.info` |
| Backend URL | `https://backend-seven-khaki-60.vercel.app` |
| Cloudflare Pages project | `truegle-search` |
| Pages default domain | `truegle-search-15k.pages.dev` |
| GitHub repo | `o87enterprises-ai/TruegleSearch` |
| Google Cloud project | `truegle-search` (number `1004953436750`) |
| Google OAuth client | `Truegle Search`, ID starts `1004953436750-0a1ni3p4...` |
| OAuth callback | `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback` |
| Custom Search Engine ID (cx) | `54cdc3626cf504531` |
| GCP API key name | `Truegle Custom Search API Key` |
| AdSense publisher | `pub-9542137900411519` |
| Stripe webhook | `TruegleVercelWebhook` → `/api/payment/webhook` (8 events) |
| Neon DB | `ep-spring-star-afnjwpg6-pooler` (us-west-2) |
| Cloudflare nameservers | `journey.ns.cloudflare.com` + `newt.ns.cloudflare.com` |
| IONOS / Cloudflare / Vercel / GitHub accounts | `o87enterprises@gmail.com` · same · `o87enterprises` · `o87enterprises-ai` |
| Sitemap | `https://truegle.info/sitemap.xml` |
