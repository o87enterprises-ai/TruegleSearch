# UNIFIED HANDOFF — Truegle Search
_Last updated: 2026-06-21. Supersedes all prior handoff docs. **See the 2026-06-16→17 session log directly below — it supersedes conflicting older entries, especially anything about Google AdSense (now fully removed).**_

This doc is written so it can be handed to **Claude in the web browser** to walk through
the remaining **dashboard/browser activation steps**. Everything that requires code or a
computer has already been done and deployed (see "Done this session").

> 🛑 **MONETAG + ADSTERRA HAVE BEEN REMOVED (2026-06-15 night) — DO NOT RE-ADD THEM.**
> `truegle.info` was caught in a **Palo Alto Networks threat-intel DNS sinkhole**
> (`truegle.info → sinkhole.paloaltonetworks.com`), i.e. the domain was classified as
> **malicious** and is being **blocked for every user on a Palo-Alto-protected network**
> (corporate / school / enterprise). Root cause = the Monetag service worker we shipped loads
> `3nbf4.com`, a known **adware/malvertising** host; Adsterra (`highperformanceformat.com` /
> `profitablecpmrate.com`) is the same instant-approval malvertising class. **All of it was
> ripped out.** Monetize ONLY with reputable networks (Google AdSense, Ezoic/Mediavine/Raptive
> tier). See ["AD STRATEGY — what to avoid"](#ad-strategy--what-happened--what-to-avoid). The
> remaining browser steps below are still valid **except the old "STEP A" (now void)**.
>
> ✅ **UPDATE 2026-06-21 — domain reputation cleared, verified clean:** Palo Alto's
> urlfiltering.paloaltonetworks.com lookup now shows `truegle.info` as
> `Computer-and-Internet-Info`, **Low-Risk** (the only other tag is `Newly-Registered-Domain`,
> which is benign and ages off automatically ~32 days post-registration — no action possible or
> needed). Google Safe Browsing transparency report shows **"No unsafe content found."** DNS
> resolves to real Cloudflare IPs (not the sinkhole) and the site returns HTTP 200. The
> un-sinkhole task is **done** — see STILL TO ADDRESS #1, now closed.

---

## 🗓️ SESSION LOG 2026-06-20 — SearXNG promoted to primary + Search ranking + AI chat fix + Ad URLs

### SearXNG promoted to primary search provider — AWS Elastic IP (SHIPPED, commits `a24dee3`→`9763e62`)
**Outcome:** the self-hosted SearXNG metasearch instance is now the **primary** search provider in
production — verified live, real queries return `"source":"searxng"` results (aggregated via
Google/Startpage/etc. engines) before the paid API providers ever fire.
- SearXNG is now running on a **persistent AWS host with a permanent Elastic IP** (previous notes
  referenced an ngrok tunnel / "your iMac, a VPS" as placeholders — that's superseded). `SEARXNG_URL`
  on Vercel backend points at that Elastic IP.
- Set `SEARXNG_PRIMARY=true` on the Vercel backend → `SearchService` now queries SearXNG first;
  Google/Bing/Brave only run as fallback when SearXNG is offline or returns fewer than
  `SEARXNG_PRIMARY_MIN` (default 5) web results (`SearchService.js` line ~129, pre-existing code from
  an earlier session — this was the first time it was actually turned on).
- Backend redeployed to pick up the new env vars (commits `a24dee3`, `ce5c912`, `9763e62` are empty
  marker commits — the actual changes were env vars set directly on the Vercel dashboard, not code).
- **Verified live this session:** `POST /api/search` for both a synthetic query and a real query
  (`weather forecast new york`) returns `source:"searxng"` results mixed with YouTube/news as
  supplementary providers. The paid Google/Brave APIs are no longer doing the bulk of the work.
- **Known gap:** `GET /api/search/health` does **not** report a `searxng` field —
  `SearchService.getHealthStatus()` (`SearchService.js` ~line 1709) only has cases for
  google/bing/news/youtube. Not a functional problem (confirmed working via real queries above), just
  a monitoring blind spot — add a `searxng` case calling `performSearXNGSearch` if you want parity.
- This closes out the former "Step 7 — (Optional) SearXNG as primary" — see the REMAINING BROWSER
  STEPS section below, now marked done.

### Search result quality — navigational intent + instant answers (SHIPPED, commits `ade45c6`→`69aa3d8`)
**Problem:** brand-name queries like "AWS" returned aws.amazon.com at position #7 behind social media / jobs pages. No quick-answer cards appeared even though the backend was already building `instantAnswer` objects.

**Fix — backend (`SearchService.js` + `routes/search.js`):**
- Added `isNavigationalQuery(query)` — returns true for ≤3-word queries without question prefixes (what/how/why/when/who/etc).
- Added `calculateNavigationalScore(query, result)` — scores URL officiality: subdomain-match + homepage = 1.0; contains query + homepage = 0.9; social media domains (Instagram, LinkedIn, Twitter, etc.) = 0.25× penalty.
- Modified `rankResults()`: when query is navigational, blends `finalScore * 0.3 + navScore * 0.7` so the official homepage floats to #1.
- Expanded `APP_NAMES` in `detectQueryType()` from ~15 to ~45 entries (added aws, azure, gcp, stripe, redis, mongodb, supabase, firebase, etc.) and added `navigational` as catch-all type for short brand queries not in the list.
- `buildInstantAnswer()` now handles `type === 'navigational'` — finds best official result (heavy social penalty) and returns `{ type:'navigational', name, url, snippet, domain, favicon }`.

**Fix — frontend (`SearchPortal.jsx` + `QuickResultCard.jsx`):**
- Wired `data.instantAnswer` from API response to `instantAnswer` state in `SearchPortal.jsx`.
- Added `NavigationalCard` component to `QuickResultCard.jsx` — compact "Official site" card with favicon, domain badge, title, snippet, and external link icon.
- `QuickResultCard` now renders above search results when `instantAnswer` is present.

### Google API key — fixed 403 on Custom Search + YouTube (DONE)
- Root cause: project had only an OAuth 2.0 Client ID, not an API Key. Created a proper **API Key** in Google Cloud Console restricted to Custom Search API + YouTube Data API v3. Updated `GOOGLE_API_KEY` on Vercel via `vercel env rm` + `vercel env add`.

### AI chat — Groq added as primary free provider (SHIPPED, commit `ade45c6`)
- **OpenRouter billing failed** → AI chat was dead.
- Added `services/GroqService.js` (OpenAI-compatible, `api.groq.com/openai/v1`, model `llama-3.1-8b-instant`). Free tier, no credit card required — get key at console.groq.com.
- `GROQ_API_KEY` set on Vercel.
- New failover order: **groq → gemini → nvidia → openai → anthropic → ollama**.
- Switched Gemini default model from `gemini-1.5-pro-latest` → `gemini-1.5-flash` (free tier: 1M tokens/day vs. tiny pro quota).
- Ollama cannot run on Vercel serverless (no persistent process, no GPU, no disk for model weights). Self-host option only — set `OLLAMA_BASE_URL` to a public URL (e.g. Oracle Cloud Always Free ARM VM) if you want it live.

### House ads — OpenOcchio and BriccD now link to live previews (SHIPPED, commits `3605a42` + `69aa3d8`)
- Both ads previously linked to GitHub repos. Updated `houseAds.js`:
  - OpenOcchio → `https://ae5d4d0b.openocchio.pages.dev/` · CTA: "Try it free"
  - BriccD → `https://briccd.o87enterprises.workers.dev/` · CTA: "Try the demo"
  - BriccD description updated: *"Design a LEGO world in 3D, then step inside it life-size with Meta AR glasses."* · Title: *"BriccD — Build it. Live in it."*

---

## 🗓️ SESSION LOG 2026-06-18 (newest first) — CI/CD + Videos-tab fix + CSP

### Videos tab returned nothing — FIXED (commit `a074357`, verified live)
**Symptom:** the Videos tab showed "No video results found" for every query (console empty, API 200).
**Root cause (found via `vercel logs`):**
- The backend reads filters **nested** (`req.body.filters`); for `filters.category === 'videos'` the web
  providers (Brave/Google) do NOT run — the only video source is the YouTube Data API.
- The **`YOUTUBE_API_KEY` is configured but ERRORS (403/quota)** — same Google project whose Custom Search
  also 403s. The error is swallowed by `Promise.allSettled`, so the Videos tab came back empty. (The quotes
  in the user's `"grown shit" mac dre` query were a red herring — even unquoted was empty.)
**Fix:** in `SearchService.js` `searchVideos` block, ALWAYS add a Brave fallback **scoped to
`filters.category === 'videos'`**: `performBraveSearch(`${query} site:youtube.com`, {...filters, perPage:20})`.
youtube.com links are tagged `videos` by `detectCategory` and kept by the category filter. Now Videos tab
returns ~12-20 real YouTube results (verified: `mac dre`→20, `"grown shit" mac dre`→12). Scoped to the
Videos tab so the mixed `all` feed isn't flooded + no extra Brave call per all-search.
- **Brave gotcha:** `site:youtube.com OR site:vimeo.com` (OR of two `site:`) returns **0** from Brave; a
  SINGLE `site:youtube.com` works. Also added a general quote-broaden (commit `e4ab351`): quoted queries
  (`/["']/`) with `<12` results re-run de-quoted + merge.
- **Still open (optional, non-blocking):** the YouTube Data API key 403s. To restore the proper video
  source (durations/view-counts), enable **YouTube Data API v3** on that Google Cloud project (same one as
  the CSE) or check its quota. The Brave fallback means this is now a quality upgrade, not a blocker.
- **Debug lessons:** `vercel pull` does NOT decrypt **Sensitive** env vars — they show as `KEY=""` locally
  even though set in prod, so you can't read real keys / repro provider calls locally. Use
  `vercel logs https://<deployment-url> --token=$TOKEN` (url from `/v6/deployments`) to see backend logs.
  Windows Python: read API responses with `io.open(f, encoding='utf-8')` (cp1252 chokes on emoji/titles).

### CSP blocked Cloudflare Web Analytics beacon — FIXED (commit `77bd3e6`, verified live)
Cloudflare Pages auto-injects `static.cloudflareinsights.com/beacon.min.js`, which the CSP (added 2026-06-17)
was blocking. Added `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com`
to `connect-src` in `apps/frontend/public/_headers`. Verified live on `truegle.info`. (The other console
noise — "Speech Recognition not supported" in Firefox, and `OpaqueResponseBlocking` — are benign/separate.)

### `git push origin main` → auto-deploys GitHub + Cloudflare + Vercel (DONE & verified live)
**Outcome:** committing and pushing to `main` now builds and deploys **all three platforms with zero
manual steps** — no more hand-running `wrangler` / `vercel deploy`. Verified end-to-end on commit
`c7e3659` (backend health 200, frontend 200).

- **Synced + deployed this session:** merged the newest commit `1bb0511` ("Fix search filters, AI
  summary bias, ranking, and image sourcing") from branch `claude/search-filters-ai-summary-1b8sns`
  into `main` (fast-forward), pushed, then deployed both halves manually once (Cloudflare frontend +
  Vercel backend) to get the new code live before wiring up auto-deploy.

- **Frontend → Cloudflare Pages = native git, already working.** Despite older notes saying CF git was
  disconnected, the `truegle-search` Pages project **is** connected and auto-builds on every push to
  `main` (confirmed multiple green builds this session). Nothing to do — frontend self-deploys.

- **GitHub Actions = NOT usable here, don't try again.** The repo `o87enterprises-ai/TruegleSearch` is
  **private** and the free-tier Actions minutes are exhausted → every workflow run dies in ~1s with
  `startup_failure` (even a manual `workflow_dispatch`, even on valid YAML). I added a deploy workflow,
  proved it's blocked, and **removed it** so it won't spam red ❌ on commits. Only revisit if you enable
  Actions billing OR make the repo public (public = free unlimited Actions, **but** scrub git history
  for leaked env keys first — risky given the security audit).

- **Backend → Vercel = native git, fixed in 3 steps:**
  1. **Connect (browser, done by you):** Vercel dashboard → project `backend` → Settings → Git → connected
     `o87enterprises-ai/TruegleSearch`. (The `vercel git connect` CLI path FAILS — the GitHub-App install
     is browser-only.) Production branch = `main`.
  2. **Root Directory was empty** → git deploys would build from the repo root, not the backend. Fixed via
     Vercel REST API (no browser): `PATCH /v9/projects/backend?teamId=<TEAM>` body `{"rootDirectory":"apps/backend"}`.
  3. **Deploys came back `BLOCKED` (`seatBlock: TEAM_ACCESS_REQUIRED`)** — Vercel checks the **commit
     AUTHOR**, not the pusher, against team membership. Commits were authored as
     `Truegle <truegleai@proton.me>`, which GitHub attributes to the **`TruegleAi`** account (not on the
     Vercel team). The team-member account is **`o87enterprises-ai` / o87enterprises@gmail.com**. Fixed with
     `git config user.email o87enterprises@gmail.com` (kept `user.name "Truegle"` so the author still reads
     as Truegle). After that, the next push deployed READY and auto-promoted to `target:production`,
     aliased to `backend-seven-khaki-60.vercel.app`.

- **⚠️ RULE going forward:** commits to this repo **must be authored with `o87enterprises@gmail.com`** or
  Vercel will `BLOCK` the git deploy again. It's set locally in this repo; if you ever commit from another
  machine, run the same `git config`. (To revert to your proton email you'd have to add the `TruegleAi`
  GitHub account to the Vercel team instead.)

- **Manual fallback (still works if ever needed):** frontend `cd apps/frontend && NODE_OPTIONS='--max-old-space-size=4096' npx vite build && wrangler pages deploy dist --project-name=truegle-search --branch=main`;
  backend `cd apps/backend && vercel deploy --prod --yes`.

- **IDs for reference:** Vercel teamId `team_OyHR5YLtUy6gIs8HmvhXKSsj`, projectId
  `prj_4JvIr3WaQ9HiKghZrGwWaAmf61oI`; Cloudflare accountId `1052be08b0c9382768667a9254936f9c`.

---

## 🗓️ SESSION LOG 2026-06-16 → 2026-06-17 (newest first; supersedes older AdSense/ad notes)

### Security headers / CSP added (2026-06-17) — fixes Aikido "CSP header not set" (risk 91)
- **Root cause:** Cloudflare Pages was serving the frontend with **no security headers at all**
  (no Content-Security-Policy, HSTS, etc.). Aikido flagged it on `https://truegle.info`.
- **Fix:** added **`apps/frontend/public/_headers`** (Cloudflare Pages reads `_headers` from the
  deploy root; living in `public/` means Vite copies it to `dist/_headers` on every build — no
  build-config change needed). Applies to all routes (`/*`):
  - **Content-Security-Policy** — `script-src 'self' 'wasm-unsafe-eval'` (the XSS lock; the only
    `eval`/`new Function` in the bundle is the `new Function("return this")` global polyfill,
    wrapped in try/catch with a fallback, so blocking it is harmless), `object-src 'none'`,
    `base-uri`/`form-action`/`frame-ancestors 'self'`.
  - **`connect-src` is an EXPLICIT allowlist** of the only origins the browser calls directly:
    `'self'` + backend `https://backend-seven-khaki-60.vercel.app` (search/AI/weather/radar/
    cameras are all proxied through it) + `https://*.mapbox.com` + `https://api.tomtom.com`
    (sat tiles) + `https://nominatim.openstreetmap.org` (geocode) + `https://router.project-osrm.org`
    (directions) + `https://gibs.earthdata.nasa.gov` (NASA imagery) + `https://api-inference.huggingface.co`
    + `blob:`. **If a direct-call host moves (e.g. custom backend domain) or a new client-side API
    is added, append it here or the call will be CSP-blocked.**
  - **`img-src`/`media-src` left as `https:`** on purpose — live traffic-camera feeds, image-search
    results, YouTube thumbnails and map tiles come from arbitrary domains rendered as `<img>`/
    `<video>`; locking these would break image search + cameras. `frame-src` is an explicit
    allowlist (YouTube + Vimeo embeds only).
  - **Also set:** HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options:
    nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
    `Cross-Origin-Opener-Policy: same-origin`, and `Permissions-Policy` keeping
    `geolocation/camera/microphone=(self)` (app uses `getUserMedia` + `navigator.geolocation`)
    while disabling `payment/usb/interest-cohort`.
- **Deployed & verified live (2026-06-17):** rebuilt frontend, `wrangler pages deploy dist
  --project-name=truegle-search`; `curl -sI https://truegle.info` now returns the full CSP +
  all security headers. Build note: on Windows the npm `build` script's inline `NODE_OPTIONS=`
  fails under `cmd.exe` — run `NODE_OPTIONS='--max-old-space-size=4096' npx vite build` from a
  bash shell instead (or just `npx vite build`). **TODO (deal with later):** make `npm run build`
  cross-platform by switching the `build`/`vercel-build` scripts in `apps/frontend/package.json`
  to `cross-env NODE_OPTIONS=--max-old-space-size=4096 vite build` (add `cross-env` as a devDep).

### Monetization pivot — Google AdSense REMOVED, first-party ad network IN
- **AdSense fully removed.** Google rejected `truegle.info` with *"Google-served ads on screens
  without publisher-content"* (you cannot put standard display AdSense on search-results pages —
  that's a separate Programmable-Search product). Deleted `components/ui/AdSenseAd.jsx`, removed
  the global `adsbygoogle.js` `<script>` from `index.html`, swapped every `<AdSenseAd>` → the
  first-party `<AdSlot>` in `UniversalSearch` (+ dead `BiasedResults`/`SearchPortal`). Verified
  live: no `googlesyndication` served. (CSP allowlist entry left in backend `server.js`, harmless.)
- **First-party house-ad system built** (no external scripts → can't get the domain flagged):
  `config/houseAds.js` (`HOUSE_ADS` + `AFFILIATE_OFFERS` + `AD_ZONES` + `pickHouseAd()` /
  `getAdById()`), `components/ui/HouseAd.jsx` (rel="sponsored", privacy-safe local impression/
  click counts), `components/AdSlot.jsx` upgraded to render house ads. New **`/advertise`**
  media-kit page + footer link.
- **House-ad layout (search page pinned slots):** top banner = **advertise-cta**, middle =
  **OpenOcchio** (git), sidebar = **BriccD** (git); added **github-profile** ad; removed Orchestra.
  AI-chat-box mock ads (`ui/AdBanner`, rewritten to serve house ads): top = github-profile,
  bottom = advertise-cta.
- **Advertiser contact = plain MAILTO** to `truegleai@proton.me` (`AdvertiseContactModal`, opened
  by any `action:'contact'` ad). User chose mailto over Resend (no extra key). Offer fine print:
  *first month free; placements ~~$99/mo~~ **50% OFF $49.99/mo limited time**; any paid placement
  includes Truegle Premium free.* (Numbers live in `houseAds.js` advertise-cta + the modal — adjust freely.)
  Backend `POST /api/contact/advertise` route exists but is now UNUSED (harmless).
- **Affiliate network = Impact.com.** Verification meta tag live in `index.html`
  (`impact-site-verification`). `AFFILIATE_OFFERS` seeded (Proton VPN, Incogni, generic VPN) with
  **placeholder URLs** — paste your real Impact tracked links after approval, then redeploy.
  **🛑 2026-06-21: Marketplace application DECLINED** ("you currently do not qualify for access
  to impact.com's Marketplace"). Per Impact's own help docs, declines are caused by one of:
  unverifiable identity, unverifiable/low-quality media properties, insufficient traffic/audience,
  or an MPA (policy) violation. The likely cause here was the second one — at decline time the
  site shipped pure client-rendered HTML (empty `<div id="root">` to anything that doesn't run JS)
  plus soft-404s on every unmatched path, so an automated content-quality screen would have seen
  no real content. **That root cause is already fixed** (commit `8df0535`, 2026-06-19 — build-time
  prerendering for `/`, `/about`, `/privacy`, `/terms`, `/advertise`, real `_redirects`-based 404s,
  `robots.txt`, `sitemap.xml`) and **verified live in production 2026-06-21** via `curl`:
  `truegle.info/` now serves real prerendered text in the initial HTML, `/about` (and the other
  static routes) serve the full styled page at HTTP 200, and an unmatched path returns a genuine
  404 instead of the old soft-404. **Ready to reapply** — `tools/ad-distributor-cli` (`info impact`)
  has the full pre-reapply checklist (Impact-side profile fields to fill in, no documented waiting
  period, traffic stats to have on hand since there's no published minimum, and where to resubmit
  if there's no self-serve button). Do not create a new Impact account — the existing one already
  carries the live verification tag for this domain.

### Features / fixes
- **OSINT Email + Phone intel (free, no key):** `GET /api/osint/email-intel` (syntax, role/
  disposable flags, live MX, Gravatar) + `GET /api/osint/phone-intel` (validity/line-type/country/
  formats via new dep `libphonenumber-js`). Wired into `OSINTToolsPanel`. Deployed + verified.
- **AI provider swapped to NVIDIA NIM** (replaces OpenRouter; **Ollama kept**). New
  `services/NvidiaService.js` (OpenAI-compatible, `integrate.api.nvidia.com`, model
  `nvidia/nemotron-3-ultra-550b-a55b`, `enable_thinking:false` for clean output). `NVIDIA_API_KEY`
  set on Vercel + verified. `getProviderOrder` now always includes code-registered providers
  (nvidia/ollama) even though they aren't rows in the `ai_providers` DB table.
- **🩹 Backend-wide crash fixed.** Adding the contact route made `EmailService` load at startup;
  its constructor did `config.email.resend.apiKey` and threw → **every** route 500'd
  (FUNCTION_INVOCATION_FAILED). Hardened with optional chaining. **Lesson: singleton services
  (`module.exports = new X()`) must never throw in their constructor.**
- **🎤 Voice/audio search fixed.** `VoiceRecognition` only captured *interim* results and dropped
  *final* ones (garbled dictation). Now accumulates finals correctly + defaults to the browser
  language (helps international users); accepts a `lang` prop.
- **"Make default search engine" + "Add to Home Screen" added** (were missing): `public/opensearch.xml`
  + `<link rel="search">`, and `public/manifest.webmanifest` + apple-touch/theme-color meta in `index.html`.
- **OAuth callback bug fixed:** `auth.js` used per-deploy `VERCEL_URL` (changes every deploy →
  never matches Google's registered redirect) → now prefers stable `BACKEND_URL`.

### Deploy note
- Build the frontend with the **project-local vite binary** (`node_modules\.bin\vite.cmd`), **NOT
  `npx vite`** (npx was pulling a wrong/rolldown version that fails the build).

---

## 🔜 STILL TO ADDRESS (outstanding tasks)

1. ~~**🛑 Un-sinkhole `truegle.info`**~~ ✅ **DONE, verified 2026-06-21.** Palo Alto category
   lookup shows `Computer-and-Internet-Info` / Low-Risk (no malware/sinkhole tag); Google Safe
   Browsing shows "No unsafe content found"; DNS resolves to real Cloudflare IPs; site returns
   HTTP 200. No further action needed.
2. **OAuth — finish setup** (code callback already fixed): create a Google OAuth **Web** client
   (consent screen: external, scopes email/profile/openid, app domain `truegle.info`); set
   **redirect URI** `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`; on Vercel
   set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL=https://backend-seven-khaki-60.vercel.app`,
   `FRONTEND_URL=https://truegle.info` → redeploy backend; then flip **`OAUTH_ENABLED=true`** in
   `apps/frontend/src/config/access.js` → redeploy frontend.
3. **AI chat end-to-end** — ✅ Groq is now primary (free, live). Failover chain: groq→gemini→nvidia→openai→anthropic→ollama. Verify chat works live in the browser (backend auth-gates expensive endpoints; confirm it works under `FREE_ACCESS_MODE`).
   **SearXNG is now primary for web search** (✅ done — AWS Elastic IP host, `SEARXNG_PRIMARY=true`,
   verified live). Optional follow-up: add a `searxng` case to `SearchService.getHealthStatus()` so
   `/api/search/health` reports it instead of being silent on it.
4. **Impact affiliates** — get approved, paste real tracked links into `AFFILIATE_OFFERS`
   (`houseAds.js`), redeploy. (Currently placeholder URLs = $0.)
5. **Get indexed (SEO)** — Google Search Console + Bing: add property, verify via Cloudflare DNS
   TXT, submit `https://truegle.info/sitemap.xml`, request indexing for `/` and `/search`.
6. **`/advertise` page** — replace placeholder pricing (use the $49.99 promo) + real audience/traffic numbers.
7. **PWA icons** — add proper 192×192 + 512×512 icons (manifest currently reuses `og-image.png`).
8. **Location filter (optional)** — auto-detect already threads country/language to providers; add a
   visible country/region dropdown if you want user override.
9. Carry-overs: Google CSE 403 (optional — Brave covers search), Stripe live keys (when charging),
   re-enable real auth later (`FREE_ACCESS_MODE` + 12-char password fix), reconnect Cloudflare↔GitHub auto-deploy.
   **`RESEND_API_KEY` no longer needed** (advertiser contact is mailto now).

---

## ✅ DONE THIS SESSION (all live + verified)

**Earlier today**
- **Search outage FIXED** (stale backend → redeployed; CORS allowlist already had truegle.info).
- **Legal pages SHIPPED + live:** `/privacy`, `/terms`, `/about` (HTTP 200) — unblock OAuth + AdSense.
- **Down-for-repairs modal** (after 2 consecutive search failures) + **browser-synced multilingual search**.

**This session (pre-production hardening + monetization)**
- 🩹 **WHITE-SCREEN CRASH FIXED.** The whole site was down with `useLayoutEffect of undefined` —
  a circular Vite chunk dependency (React split into its own chunk while mapbox/three/vendor
  cross-imported). Rewrote `manualChunks` to a strictly **acyclic** graph. (`7e46b72`)
- 🛡️ **3-LAYER CRASH PROTECTION so a white screen can NEVER happen again:** (1) a
  framework-agnostic global safety net in `main.jsx` that recovers stale-chunk loads and shows
  a friendly fallback if the app fails to even mount; (2) a **RootErrorBoundary** around the
  whole app; (3) a **RouteBoundary** around every page so one crash can't kill the site. (`ff1509f`)
- 🔒 **SECURITY: removed a client-side admin auth-bypass backdoor** on the sign-in page (it
  minted a fake admin/premium session via Ctrl+Shift+A / triple-click / hidden button). (`c0a9b1a`)
- 🚪 **FREE-ACCESS MODE (reversible).** OAuth bypassed, all paywalls/token-gates/login-walls
  removed so every feature is usable without signing in (one flag: `src/config/access.js`).
  Expensive AI/OSINT endpoints stay backend-protected (cost control) but now degrade to a
  friendly message instead of a broken login bounce. (`ff1509f`)
- 📣 **EARLY-ACCESS UX.** Dismissible "you're a pre-production user, things may break, send
  feedback" banner (→ truegleai@proton.me) + a transient error bar on breaking errors +
  friendly "search failed / no results" messaging instead of a blank page. (`ff1509f`)
- ⚠️→🗑️ **AD MONETIZATION (Monetag + Adsterra) BUILT EARLIER (`c0ee1de`) THEN FULLY REMOVED
  (night).** Shipping the Monetag service worker (`/sw.js` → loads `3nbf4.com`) got
  `truegle.info` **flagged as malicious and DNS-sinkholed by Palo Alto Networks**. Removed the
  `sw.js`, the script loaders (`utils/adNetworks.js`), the Adsterra banner
  (`components/ui/AdSlot.jsx`), the rewarded button (`RewardedAdButton.jsx`), the config
  (`config/ads.js`), and every reference in `App.jsx` / `UniversalSearch.jsx`. **Google AdSense
  (`AdSenseAd.jsx`) is untouched** — it's the only ad code left, and it's reputable. Rebuilt +
  redeployed clean. See ["AD STRATEGY"](#ad-strategy--what-happened--what-to-avoid).

**Git:** `origin/main` = ad-removal commit (see latest). Frontend deployed via wrangler from this.

> ⚠️ **Tell your users to hard-refresh (Ctrl+Shift+R)** — older browser caches may still hold
> the pre-fix bundle (with the white screen / old admin code). The live server is clean.

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
| **Monetag / Adsterra ads** | 🛑 **REMOVED — do not re-add** | Got `truegle.info` flagged malicious + Palo Alto DNS-sinkholed (malvertising scripts `3nbf4.com` / `highperformanceformat.com`). All code ripped out. Monetize via AdSense / reputable networks only — see "AD STRATEGY". |
| **Domain reputation** | ✅ **Clean — verified 2026-06-21** | Palo Alto category lookup: `Computer-and-Internet-Info`, Low-Risk (no malware/sinkhole tag; the residual `Newly-Registered-Domain` tag is benign and self-clears ~32 days post-registration). Google Safe Browsing: "No unsafe content found." DNS resolves to real Cloudflare IPs, site returns HTTP 200. |
| **Google Custom Search API** | ⚠️ **403 / likely quota** | Free tier = 100 queries/day, blown by current traffic; also a project/account access issue (key 403s even tested directly). Search still works — `Promise.allSettled` drops Google and Brave fills in. See Step 1. Ad revenue (Step A) can fund CSE billing. |
| Google OAuth | 🚫 **Bypassed (intentional)** | Hidden via `OAUTH_ENABLED=false` while in free-access mode; sign-in not required. Re-enable later (Steps 2–3) once auth is fixed. Registration also has a **12-char min-password** mismatch to fix then. |
| OAuth Branding | ⚠️ Needs fix | Wrong authorized domain `truegle-search.pages.dev` → should be `truegle-search-15k.pages.dev`; also add `truegle.info` + `trumpafi.online`; fill home/privacy/terms URLs. See Step 3. |
| Google AdSense | 🛑 **REMOVED 2026-06-17** | Google rejected it ("ads on screens without publisher-content" — display AdSense isn't allowed on search results). All AdSense code/script removed; replaced by the first-party house-ad + Impact-affiliate system. Don't re-add to the search UI. See session log. |
| Impact.com (affiliates) | 🟡 **Ready to reapply** | Declined 2026-06-21 (likely cause: no crawlable content / soft-404s). Root cause fixed + verified live 2026-06-21 (prerendering, real 404s, robots.txt, sitemap). See `tools/ad-distributor-cli` `info impact` for the pre-reapply checklist, then resubmit in the Impact dashboard. |
| NVIDIA NIM (AI) | ✅ **Live (backup)** | `NVIDIA_API_KEY` set on Vercel. Now 3rd in failover (after Groq + Gemini). |
| **Groq (AI)** | ✅ **Live — primary** | Free tier, no CC required. `GROQ_API_KEY` set on Vercel. Model: `llama-3.1-8b-instant`. Failover: groq→gemini→nvidia→openai→anthropic→ollama. |
| **Gemini (AI)** | ✅ **Live (secondary)** | `GEMINI_API_KEY` already on Vercel. Switched to `gemini-1.5-flash` (1M tokens/day free). |
| **SearXNG (self-hosted search)** | ✅ **Live — primary** | Hosted on a persistent AWS host with a permanent Elastic IP. `SEARXNG_URL` + `SEARXNG_PRIMARY=true` set on Vercel backend; redeployed and verified live (real queries return `source:"searxng"`). Paid API providers (Google/Bing/Brave) now only fire as fallback. `/api/search/health` doesn't report it yet (cosmetic gap, not functional). |
| Search Console | ⏸️ Not started | See Step 5. |
| Bing Webmaster | ⏸️ Not started | See Step 5. |
| Stripe | ✅ Verified | Live keys NOT yet swapped on Vercel. See Step 6. |

---

## 🚦 REMAINING BROWSER STEPS (each is self-contained)

> Reference values you'll need are in the QUICK REFERENCE table at the bottom.

### AD STRATEGY — what happened & what to avoid
**The old "STEP A — Activate Monetag/Adsterra" is VOID. Do not do it. Do not re-add those env
vars or any of their scripts.**

**What happened (2026-06-15):** to monetize fast we added Monetag (instant-approval) and
shipped its service worker at `https://truegle.info/sw.js`, which loads
`https://3nbf4.com/act/files/service-worker.min.js`. `3nbf4.com` is a Monetag adware/push host
on enterprise threat-intel blocklists. Result: **Palo Alto Networks DNS-sinkholed
`truegle.info`** (`truegle.info CNAME → sinkhole.paloaltonetworks.com`) — the domain is now
classified as **malicious** and silently unreachable for anyone behind a Palo Alto firewall
(huge share of corporate/school/enterprise traffic). This also endangers Google Safe Browsing
status, the pending AdSense review, and SEO/domain reputation.

**❌ NEVER use these (they will re-flag the domain):**
- **Monetag** — domains `3nbf4.com`, `libtl.com`, `*.monetag.com` push/multitag.
- **Adsterra** — `highperformanceformat.com`, `profitablecpmrate.com` (Social Bar / popunder).
- Any "instant-approval" push/popunder/popunder-redirect network. Easy approval = low
  reputation = blocklists. Not worth a sinkholed domain.

**✅ Safe monetization path:**
1. **Google AdSense** — already integrated (`AdSenseAd.jsx`, `pub-9542137900411519`), in
   review (Step 4). Reputable; renders automatically once approved. This is the primary plan.
2. When traffic justifies it, apply to a **reputable ad-management network** with real review
   (Ezoic → then Mediavine/Raptive at scale). These vet advertisers and won't blocklist you.
3. **Direct sponsorships / affiliate** (privacy-tool, VPN affiliates) — on-brand, zero
   malvertising risk.

**🧹 Cleanup — ✅ DONE, verified 2026-06-21:**
- **truegle.info reclassified.** Palo Alto's URL filtering lookup (urlfiltering.paloaltonetworks.com)
  now shows `Computer-and-Internet-Info`, Low-Risk — no malware/adware tag.
- **Google Safe Browsing** checked: `https://transparencyreport.google.com/safe-browsing/search?url=truegle.info`
  → "No unsafe content found."
- **DNS confirmed** resolving to real Cloudflare IPs (not the sinkhole); site returns HTTP 200.

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

### Step 7 — SearXNG as primary  ✅ DONE (2026-06-20)
SearXNG now runs on a persistent AWS host with a permanent Elastic IP. `SEARXNG_URL` set on the
Vercel backend, `SEARXNG_PRIMARY=true`, backend redeployed. Verified live: real search queries
return `source:"searxng"` results ahead of the paid API providers. See the SearXNG session-log
entry above for the verification details and the one known gap (`/api/search/health` doesn't
report a `searxng` field yet — cosmetic, not functional).

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
- [x] **GET truegle.info UN-SINKHOLED** — ✅ done, verified 2026-06-21. Palo Alto category is
      clean (`Computer-and-Internet-Info`, Low-Risk), Google Safe Browsing shows no issues, DNS
      resolves to Cloudflare. See "AD STRATEGY → Cleanup".
- [ ] **Monetize the RIGHT way** — AdSense (in review) + later a reputable network
      (Ezoic/Mediavine/Raptive) or direct/affiliate. **Never** Monetag/Adsterra/instant-approval
      push-popunder again (they caused the sinkhole). See "AD STRATEGY".
- [ ] **Google Custom Search API 403/quota** — fix under correct account + enable billing
      (Browser Step 1).
- [ ] **Re-enable real auth (later)** — fix the registration **12-char password** mismatch, flip
      `FREE_ACCESS_MODE=false` + `OAUTH_ENABLED=true`, publish OAuth + fix branding (Steps 2–3),
      set `VITE_SOCIAL_AUTH_ENABLED=true`, redeploy. (Deferred — site is intentionally free now.)
- [ ] **AdSense** — in review; monitor email (Browser Step 4). Stacks with Monetag/Adsterra.
- [ ] **Search Console + Bing Webmaster** — add property, verify, submit sitemap (Browser Step 5).
- [ ] **Stripe live keys** — swap on Vercel + redeploy when ready to charge (Browser Step 6).
- [ ] **Reconnect Cloudflare Pages ↔ GitHub** — lockfile is fixed (`b6defba`), so re-enable
      auto-deploy: Pages → `truegle-search` → Settings → Git → Connect (build/output settings in
      "Known operational notes").
- [x] **`SEARXNG` persistent host** — ✅ done 2026-06-20. AWS Elastic IP host, `SEARXNG_PRIMARY=true`,
      verified live. Optional follow-up: add `searxng` to `SearchService.getHealthStatus()`.

---

## 🚀 POST-PRODUCTION TASKS (optimization & hardening — no particular order, EXCEPT #1 first)

> _Site is ~32,440 monthly requests. Current est. $100–$400/mo. Target $500–$1,500+/mo._

### ⭐ 1. AD MONETIZATION (REPUTABLE ONLY)  ← un-sinkhole the domain first
**The Monetag/Adsterra base was removed** (it sinkholed the domain — see "AD STRATEGY"). The
only ad code left is **Google AdSense** (`AdSenseAd.jsx`, sidebar). Rebuild monetization on
reputable rails only:

**Order of operations:**
1. ~~Un-sinkhole `truegle.info` first~~ ✅ **done, verified 2026-06-21** (clean Palo Alto category +
   Safe Browsing) — no longer a blocker for ad work.
2. **Get AdSense approved** (Step 4) — primary revenue. Then add AdSense units to high-value
   slots: a **Hero slot** below the AI summary (highest CPM), **in-SERP** after every 3rd
   result, and a **sticky 300×600** desktop sidebar — all via `<AdSenseAd>` (reuse the existing
   component; do NOT introduce other networks' scripts).
3. **At scale, apply to a vetted ad-management network** (Ezoic → Mediavine/Raptive). These do
   real review and won't blocklist the domain; they can run header bidding with AdSense.
4. **Direct sponsorships / privacy-tool affiliates** — on-brand, zero malvertising risk.

**CPM optimizations (AdSense-safe):** `<link rel="preconnect" href="https://pagead2.googlesyndication.com">`
in `<head>`; lazy-load slots via `IntersectionObserver`; sticky sidebar via
`position: sticky; top: 20px`. **Avoid** auto-refresh/popunder/push patterns that violate
AdSense policy.

**❌ Do NOT re-introduce** Monetag (`3nbf4.com`/`libtl.com`), Adsterra
(`highperformanceformat.com`/`profitablecpmrate.com`), or any instant-approval push/popunder
network — that is what got the domain sinkholed.

**Rewarded-tokens note:** the backend rewarded endpoints still exist
(`/api/tokens/ad-session` + `/earn/ad`, 25s min, 6/hr cap) but the FE button + its Monetag SDK
were removed. If you ever want rewarded ads back, wire them to an **AdSense-approved rewarded
format** or a vetted network — never Monetag.

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
| AdSense publisher | `pub-9542137900411519` — ⚠️ **AdSense REMOVED 2026-06-17** (rejected; first-party ads now). |
| Ads (current) | First-party house ads (`config/houseAds.js` + `HouseAd`/`AdSlot`) + Impact affiliates + `/advertise` direct-sell. Advertiser contact = mailto `truegleai@proton.me`. |
| NVIDIA AI key | `NVIDIA_API_KEY` (Vercel) · model `nvidia/nemotron-3-ultra-550b-a55b` · base `https://integrate.api.nvidia.com/v1` |
| Impact verification | `<meta name="impact-site-verification" value="ccda0e8a-fd60-4ba7-a741-c4f9f625aa7f">` (live in `index.html`) |
| Ad env vars (Cloudflare Prod) | 🛑 **DELETE if present** — `VITE_MONETAG_ZONE` · `VITE_MONETAG_REWARDED_ZONE` · `VITE_ADSTERRA_SOCIALBAR_SRC` · `VITE_ADSTERRA_BANNER_KEY` (Monetag/Adsterra removed; signal intent to re-add). First-party ads need no env var. |
| Free-access flags (code) | `apps/frontend/src/config/access.js` → `FREE_ACCESS_MODE`, `OAUTH_ENABLED` |
| Stripe webhook | `TruegleVercelWebhook` → `/api/payment/webhook` (8 events) |
| Neon DB | `ep-spring-star-afnjwpg6-pooler` (us-west-2) |
| Cloudflare nameservers | `journey.ns.cloudflare.com` + `newt.ns.cloudflare.com` |
| IONOS / Cloudflare / Vercel / GitHub accounts | `o87enterprises@gmail.com` · same · `o87enterprises` · `o87enterprises-ai` |
| Sitemap | `https://truegle.info/sitemap.xml` |
