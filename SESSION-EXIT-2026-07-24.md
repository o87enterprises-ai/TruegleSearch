# TrueGLE — Session Exit / Handoff — 2026-07-24

A complete, tool-agnostic snapshot so this project can be continued from anywhere
(this session, a new session, or a different assistant). No secrets are included —
only the names of where they live.

---

## 1. What TrueGLE is
- **truegle.info** — privacy-first, unbiased, multi-perspective search engine + AI chat. $0 budget, ad-revenue model.
- **Frontend:** React (Vite) `apps/frontend` → Cloudflare Pages.
- **Backend:** Express `apps/backend` → Vercel (`backend-seven-khaki-60.vercel.app`, auto-deploys from `main`).
- **DB:** Neon Postgres (prod) via `DATABASE_URL`. Local test PG: role/db `truegle` / `truegle_dev`, dir `/tmp/pgdata-truegle`.
- **AI engine:** "TrueGLE 1.3" — served on the **Groq free tier** (provider key/env still named `nephesh` internally). Null-Prime "vs" prompt applied at `UnifiedAIService`.
- **Git:** work branch `claude/landing-chat-redesign-next-rbla1r`; push there **and** fast-forward `main`.

## 2. Live config / credential pointers (values NOT stored here)
- `YOUTUBE_API_KEY` — set on Vercel backend; powers YouTube Data API (creator hub). Confirmed working.
- `DATABASE_URL` — Neon connection (Vercel backend env).
- `GROQ` keys (x3, rotate on 429) — AI engine.
- Adsterra: publisher API `X-Api-Key: 7e2cf50f506eda5d86ef4659a246ef58`, domain id `5880564`, base `api3.adsterratools.com/publisher`. Zone keys in `apps/frontend/src/config/ads.js`.
- Adsterra account-level **adult toggle is OFF** (owner-confirmed) — former adult zones (728x90/160x300/160x600) now general-use. MONITOR for adult creative; rollback = re-add `adultGated` at `UniversalSearch.jsx` call sites.

## 3. Shipped this session (all on `main`)
1. **Chat ads** → payer zones: `nativeBanner` above citations, `banner728x90` below answer (was the two $0 zones). Labeled "Sponsored".
2. **"vs. TrueGLE" (Null-Prime) engine** enhanced: inline evidence-tier tags `[FIRSTHAND]/[INSTRUMENT]/[TESTIMONIAL]/[CONTESTED]`, qualitative confidence label (Robust/Probable/Open/Weak — no numeric scores), split-verdict rule, "Sources to check" pointers; truncation fixed (maxTokens 4000 when nepheshMode). `prompts/nepheshPrompts.js` + `routes/ai.js` + `UnifiedAIService.js`.
3. **Rewards program paused/removed:** backend `/api/rewards` mount commented in `server.js`; frontend RewardsCTA off landing, "Rewards" off BrandBar nav, orange pill off PillModeRow cycle. (Reason: Adsterra pays **CPM (impressions), not clicks**; the reward loop's inflated CTR was getting CPM zeroed as invalid traffic.)
4. **Ad-zone rebalance** (per 30d Adsterra per-zone data): `rectangle`→`nativeBanner`, default fallback→`nativeBanner`; `AdSlot` sizes → 728x90/native/160x600 (off dead 300x250/468x60).
5. **Creator hub** (YouTuber ambassador program):
   - `/creator/:slug` pages (`CreatorPage.jsx`), roster `content/creators.js` (10 creators, resolved UC IDs).
   - Backend `routes/creators.js`: `GET /:channelId/videos` — **YouTube Data API** (uploads playlist `UU`+id.slice(2)) preferred when `YOUTUBE_API_KEY` set, RSS fallback (browser UA). YouTube RSS is unreliable from datacenter IPs; Data API fixes it.
   - Landing **Featured Creator** slot (`FeaturedCreator.jsx`), rotates weekly by traffic.
   - **`?ref` attribution + rotation:** `recordRef()`/`RefCapture.jsx`; `POST /api/creators/ref/:code`, `GET /api/creators/featured` (top ref by 7-day SUM). **Migration 016** (`creator_ref_daily`) applied on Neon.
   - Fallback snapshot `content/creatorVideosFallback.js` (+ `scripts/seed-creator-videos.mjs`).
6. **Logo debloat:** 1024² PNGs → WebP q92 (truegle 1.6MB→139KB, chat 1.1MB→145KB); bundled logo weight ~2.77MB→290KB. Vibe preserved.
7. **Login/auth** (earlier): passwordless email + reusable account access code (migrations 011/015).

## 4. The 10 creators (roster + page links)
| Creator | slug | channelId |
|---|---|---|
| Dark Waters 9 (featured) | dark-waters-9 | UCZw8SuiTYSvPKmnMe8LDtpA |
| True Story | true-story | UCQT9VG5hpLKp8of41fvDdtw |
| Bass Forge | bass-forge | UCdcfgAjgP1OvNIFTWkbPV8Q |
| Wright 7x | wright-7x | UC-ocTFTWBWI0b-wjYoCKuPg |
| Bryce Is Right | bryce-is-right | UCmxXPdAg3iQaepCBO2JHjVA |
| Jon Levi | jon-levi | UCCVP1ck3ucAgLJFJNlPWamw |
| Mind Unveiled | mind-unveiled | UCQVBGSq7vdLanRbowiu163w |
| Xevi | xevi | UC0UpxtDnri_fa5fB_PoAYhw |
| Stolen Timelines | stolen-timelines | UCB9LqQNtyPPdW1prv0h8_5Q |
| Adam Mockler | adam-mockler | UC8DA4o0SyaGfyVaBLbF5EXg |

Page = `truegle.info/creator/<slug>`. Traffic attribution: visiting a creator page counts for them; `?ref=<slug>` on any page also counts.

## 5. Traffic / revenue reality
- Cloudflare Web Analytics: **~2.73k unique visitors / 30 days** (325 on 7/23, trending up).
- Adsterra: pays **CPM**, ~$0.03 over 30d at current volume; 30d per-zone CPM: 728x90 $0.441 (top), Popunder $0.335, NativeBanner $0.151, 320x50 $0.10; dead: 300x250 $0.003, 468x60 $0. Geo: US ~90% of traffic but low CPM $0.056 (quality-discounted); DE spiked $2.34 (noise). **Lever = more real tier-1 human volume + clean traffic.**
- **72h ad-revenue checkpoint** scheduled (trigger fires ~2026-07-27) to compare revenue/CPM/CTR post-changes.

## 6. NDAA/IDF test — verified facts (for the record)
Owner ran a claim ("House passed 2027 NDAA; US military & IDF officially merge") through TrueGLE in all non-vs modes. Verified via web search:
- House passed **FY2027 NDAA ~July 22–23 2026, 216–212**, party-line. ~$750M US–Israel cooperative programs.
- **Section 219**: directs a Pentagon "executive agent" to accelerate bilateral defense **R&D/industrial integration**; Massie–Khanna strip amendment failed.
- Sources: Al Jazeera, Times of Israel, Military.com, The Intercept, Antiwar.com, AIPAC.
- Model behavior noted: ungrounded (no search context passed in the raw API test) → correct conceptual analysis but **hallucinated specific dates/vote counts** (Blue/Ocean/Green gave wrong 2023/2024 dates; Red/Purple honestly hedged). The live `/chat` passes fetched citations as grounding, which corrects specifics — re-run grounded for apples-to-apples. **Finding: grounding is required for time-sensitive facts.**

## 7. Open threads
- DM/email outreach fallback drafts (metric-folded) — ready to generate on request.
- Creator outreach: 10 comment drafts prepared (value-first, ~2.7k metric). Owner starting with comment approach.
- Optional: cron to refresh `creatorVideosFallback.js`; landing featured slot is live and rotating.
- Tier-1 SEO content to drive real volume (the true revenue lever).
- vs-engine: optional split-verdict wording tightening; ground-truth re-run of the NDAA query.

## 8. How to continue
- Read this file + `HANDOFF.md` (top) + agent memory: `node .claude/memory/mem.mjs digest`.
- Company skills auto-apply (ponytail/tech/financial/design). Branch-per-session; push branch + ff `main`.
- Everything above is deployed; give Cloudflare/Vercel a few minutes after any push.
