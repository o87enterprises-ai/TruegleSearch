# Truegle — Deployment & Infrastructure Guide

This document covers the steps that **cannot be done in code** — they require access to your
domain registrar, DNS host, Google Search Console, and Google AdSense dashboards.

The canonical production domain referenced throughout the app is **`trumpafi.online`**
(CORS allowlist in `apps/backend/server.js`, OAuth redirect default in `apps/backend/routes/auth.js`,
canonical/OG/JSON-LD tags in `apps/frontend/index.html`).

---

## 1. DNS — pointing `trumpafi.online` at the deployed app

The app ships with both a Vercel config (`apps/backend/vercel.json`) and a Railway config
(`railway.json`). Pick whichever platform hosts the **frontend** (the public site).

1. Deploy the frontend (`apps/frontend`) to your platform (Vercel recommended for a static SPA).
2. In the platform dashboard, add the custom domain `trumpafi.online` (and `www.trumpafi.online`).
3. At your **DNS host** create the records the platform tells you to, typically:
   - Apex `@`: `A` / `ALIAS` record → the platform's IP/host (Vercel: `76.76.21.21` or the ALIAS it gives you).
   - `www`: `CNAME` → `cname.vercel-dns.com` (or your platform's CNAME target).
4. Wait for DNS propagation + automatic TLS certificate issuance.
5. Set the backend env var `FRONTEND_URL=https://trumpafi.online` so OAuth redirects and the
   sitemap/robots routes use the right base URL.

### ⚠️ Important clarification about "truegle search → trumpafi.online"
There is **no DNS setting** that makes a *search-engine query* for "truegle search" jump to your
site. DNS only resolves a domain you already typed. Getting your site to appear (and rank) when
people **search** "truegle search" on Google/Bing is an **SEO + Search Console** task — see §2.

---

## 2. Search visibility (SEO / AEO / GEO) & indexing

Code already shipped in this repo:
- `apps/frontend/public/robots.txt` (+ backend `/robots.txt` route)
- `apps/frontend/public/sitemap.xml` (+ backend `/sitemap.xml` route)
- Canonical, Open Graph, Twitter, and JSON-LD (`Organization` + `WebSite`/`SearchAction`) in `index.html`

Manual steps:
1. **Google Search Console** (search.google.com/search-console):
   - Add property `https://trumpafi.online`.
   - Verify ownership (DNS TXT record, or upload the HTML verification file to `apps/frontend/public/`).
   - Submit `https://trumpafi.online/sitemap.xml`.
   - Use **URL Inspection → Request Indexing** for `/` and `/search`.
2. **Bing Webmaster Tools** (bing.com/webmasters): add + verify the site, import from Search Console, submit sitemap.
3. **Brand ranking for "truegle search":** this builds over time once the site is indexed and the
   brand name appears in the title/OG/JSON-LD (already done). It is not instant.
4. **Add an OG image:** drop a 1200×630 PNG at `apps/frontend/public/og-image.png`
   (referenced by the meta + JSON-LD).

### SPA indexing caveat
The frontend is a **pure client-side SPA**, which crawlers index poorly (content only appears after
JS runs). For meaningful organic ranking, consider a follow-up to add **prerendering / SSG**
(`vite-plugin-ssr`, `react-snap`, or migrating to Next.js). Tracked as a future enhancement.

---

## 3. Ads / AdSense distributor approval

Code already shipped:
- `apps/frontend/public/ads.txt` →
  `google.com, pub-9542137900411519, DIRECT, f08c47fec0942fa0`
- AdSense loader is in `index.html`; real ad units render via `components/ui/AdSenseAd.jsx`.
  (`components/AdSlot.jsx` and `components/AdBanner.jsx` are placeholders.)

Manual steps:
1. Confirm `https://trumpafi.online/ads.txt` is reachable after deploy (required for serving/approval).
2. In the **AdSense dashboard**, ensure the site `trumpafi.online` is added and "Ready"/under review.
3. Replace any placeholder `AdSlot`/`AdBanner` instances with real `AdSenseAd` units (valid `adSlot` IDs)
   before requesting review — AdSense rejects sites with non-functional/placeholder ad boxes.
4. Ensure required pages exist for approval: Privacy Policy, Terms, About/Contact, and real content.
5. Verify the publisher ID in `ads.txt` and `index.html` match your AdSense account
   (`ca-pub-9542137900411519`). Update both if the account differs.

---

## 4. API health check

Run the backend and verify:
- `GET /api/health` → `{ status: "OK" }`
- `GET /api/search/health` → per-provider search health

Provider keys are configured in `apps/backend/config/env.js` (env vars). Confirm which of these are set
in production: Google CSE, Bing, Brave, SerpAPI, YouTube, News API, the AI providers, and payment
(Stripe/Square/PayPal). Missing keys degrade the corresponding feature gracefully but should be filled
for full functionality.
