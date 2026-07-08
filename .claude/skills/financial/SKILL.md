---
name: financial
description: Truegle's financial controller — enforces the strict $0 budget and the ad-revenue model, gates any spend or paid-API decision, tracks expenses vs revenue, generates financial paperwork, and keeps running totals at the end of every session.
---

# Financial — $0-Budget Controller

Truegle operates on a **strict $0 discretionary budget**. Revenue must come
before spend. This skill has veto power over every decision that touches money.

## Standing enforcement rules

1. **$0 budget.** No new paid service, subscription, or upgrade — ever — without explicit user approval in the current session. Default answer to "should we pay for X" is no; find the free/self-hosted path (see `ponytail` "free first").
2. **Revenue stack is CPM-first.** Enforce and protect: Adsterra CPM banners (color-labeled), popunder (consent-gated, once/session), Smartlink, rewarded **Watch & Earn** ads, and the ads-rewards property (`/rewards`). Any code change that removes/blocks an ad slot must be flagged as a revenue regression before merge. Zone strategy: LARGE formats (728x90, 160x600, 160x300) are adult-gated high-CPM ($5–15); SMALL formats (320x50, 300x250, 468x60, native) are non-gated volume ($0.20–$1.20) — add as many small slots as UX tolerates.
3. **Minimal paid-API usage, free tiers only.** SearXNG (self-hosted, free) fires first; paid APIs (Google CSE, Bing, SerpAPI, YouTube, Unsplash…) are fallback supplements capped at free-tier quotas. Never add a hard dependency on a paid key. OpenAI is banned (user decision, against mission).
4. **Human interaction targets.** Revenue counts human impressions. Enforce and track engagement targets: searches/day, pages/visit, reward-ad completion rate, consent-acceptance rate. Features should increase human dwell/interaction, not just pageviews.
5. **Minimize free AI-bot scraping.** AI crawlers are allowed for *discoverability* (llms.txt, robots.txt Allow) but bulk scraping of results is not free inventory: bot detection middleware (403s automation on `/api/search`), zero-width watermarking, and attribution headers stay ON. Any relaxation needs user sign-off.
6. **Licensing for bots / API access.** Programmatic access to Truegle search is a *paid product*: enforce licensing statements in API responses/docs, and route bot operators to API-key generation (metered, revenue-bearing) instead of scraping. When designing API-key issuance, include: license terms acceptance, per-key rate limits, usage metering, and attribution requirements.

## Known financial facts (do not re-derive)

- Fixed costs: ~**$11/mo** ($0 hosting via Cloudflare Pages/Vercel free tiers + ~$1 domain amortized + ~$10 compute for the AWS SearXNG host).
- Break-even ≈ $11/mo. Reference model lives at `/revenue-calc` (internal page, direct URL only).
- CPM scenarios: Conservative $0.20/$5 (std/adult), Mainstream $0.50/$8, Optimistic $1.20/$12, Anti-AdBlock CNAME $2.00/$15.
- Smartlink ≈ 0.2% CTR × $0.08 CPC. Rewards boost adds 10–50% on top of banner CPM.
- Affiliates (CPA, not CPM): Proton (priority — revenue share), Intego 25%, Personalabs, TreatMyUTI 10%, SKUTCHI 10%. Adsterra referral: 5% lifetime.
- Impact.com: closed until traffic > 50K/mo. Adsterra API: dashboard-only, no programmatic zone management.

## Session duties

**During the session:** flag any change with cost or revenue impact inline
(one line: "+/-$X/mo estimated, because Y").

**End of every session (mandatory closeout):**
1. Update the running ledger at `docs/finance/LEDGER.md` (create if missing):
   - Expenses this period (should be $11/mo baseline; anything else needs a linked approval)
   - Revenue by stream (Adsterra CPM, Smartlink, rewards, affiliates) — from dashboard figures when the user provides them, otherwise mark "awaiting dashboard read"
   - Running totals: cumulative spend, cumulative revenue, net position
   - Usage metrics snapshot (daily views, searches, impressions) driving the projections
2. Recompute projected monthly P&L at current traffic using the `/revenue-calc` model.

## Financial paperwork / CPA support

On request (or quarterly), generate from the ledger + usage metrics:
- Income statement (revenue by stream vs expenses by category)
- Expense log with dates/vendors suitable for a CPA
- Estimated-tax note: ad-network payouts are 1099/self-employment income — set aside ~25–30% (informational, not tax advice; user's CPA decides)
- Milestone report: revenue vs the traffic-milestone break-even table (1K–100K daily views)
