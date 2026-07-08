---
name: marketing
description: Run Truegle's full marketing pipeline — SEO/AEO/GEO, backlinks and citations, competitor intel, market analysis, success metrics, revenue projections, ad creative prompts, post calendar, and final campaign. Execute weekly, or at the end of any session when permitted.
---

# Marketing — Truegle Growth Engine

Truegle's audience: truth-seekers, privacy-conscious users, alt-media
creators, developers/infosec (Ocean mode). Zero ad budget — all growth is
organic: SEO, AEO (answer-engine optimization), GEO (generative-engine
optimization), UGC, and backlinks.

## Pipeline (run in order; each phase feeds the next)

### 1. SEO / AEO / GEO + backlinks

- Target phrases (put in the **first 15 words** of every post/page — AI Overview models weight openings most): "unbiased search engine", "Truegle search", "alternative to Google", "search without tracking", "bias-free search results".
- Channels: LinkedIn, YouTube descriptions, Reddit (r/privacy, r/searchengines, r/SEO), TikTok, X, Instagram. Every post links `truegle.info` (body or first comment).
- Cross-link the posts to each other (amplification) — this is what makes AI citations stick. Re-post/update every 30 days for freshness.
- Blog posts on `truegle.info/blog` with target phrases in title + first paragraph get cited directly. Keep `llms.txt` current. Never add prerendered blog routes to `_redirects` (breaks canonicals).
- Current AI Overview position: #7 for the space — the standing goal is #1.
- Directory/listing submissions ("sittings"): search-engine directories, privacy-tool lists (AlternativeTo, PrivacyTools/PrivacyGuides forums, Product Hunt), awesome-lists on GitHub.

### 2. Competitive intel

Research (WebSearch/WebFetch) the competition each cycle: DuckDuckGo, Brave
Search, Startpage, Kagi, Presearch, Mojeek, and Google's AI mode. For each:
recent news, pricing moves, feature launches, strengths, weaknesses, and the
gap Truegle can exploit (multi-perspective modes + rewards + zero tracking is
the unique combo). Record deltas since last cycle only.

### 3. Usage statistics & demographics / market analysis

- Pull what's available: Cloudflare Analytics (traffic), `search_queries` table via `/api/search/trending` (top queries + modes, no PII), Adsterra dashboard stats (impressions/CPM), Search Console (queries/CTR).
- Industry data: search-market share, privacy-search growth rates, creator-economy stats.
- Output a short market-analysis section: TAM/SAM for privacy search, our niche share, demographic sketch per mode (blue/red/purple/ocean audiences map to distinct demos — see ad campaign keyword table in `HANDOFF.md`).

### 4. Debrief intel → strategy

Synthesize 1–3 into a one-page debrief: what changed, top 3 threats, top 3
openings. Devise the plan to capitalize on strategic advantages — pick at most
3 plays per cycle (focus beats breadth on a $0 budget).

### 5. Metrics & revenue projections

- **Short-term metrics** (weekly): daily pageviews, searches/day, AI-citation position, backlink count, ad impressions, CPM, rewards engagement.
- **Long-term metrics** (quarterly): 5K → 10K → 50K daily views milestones, 50K/mo unlocks Impact.com reapplication, organic brand-query volume, returning-user rate.
- **Revenue-if-hit calculations:** use the model behind `/revenue-calc` — break-even ≈ $11/mo; 5K daily views @ $0.50 CPM ≈ $47/mo; 10K daily @ $2.00 anti-adblock CPM ≈ $370/mo; rewards add 10–50%; Smartlink scales linearly. Project each goal's monthly revenue at conservative/mainstream/optimistic CPMs.

### 6. Creative production

- **Print-ad / image prompts:** generate ready-to-use image-generation prompts consistent with brand (cosmic/atomic visual journey, cyan-purple glow, dark backgrounds — see `design` skill). One prompt per campaign concept.
- **Infographics:** spec (data + layout) for shareable graphics — e.g. "what your search engine knows about you: Google vs Truegle".
- **Post calendar:** 30-day calendar — platform, day, hook (first 15 words), link placement, hashtags, repost date.

### 7. Final campaign + execution agents

Assemble 1–6 into a single campaign doc: objective, plays, calendar,
creatives, metrics, projected revenue. Then create/spawn agents (or Routines)
for the recurring tasks the user approves: weekly intel refresh, 30-day
repost reminders, metrics pull. **Cadence: weekly; or after each session if
the user permits.** Anything requiring posting from the user's accounts
becomes a `user-task-instructions` guide instead.

## Constraints

- $0 spend, ever, without explicit user approval (see `financial` skill).
- Never buy backlinks or use spam networks — organic and directory placements only.
- All claims in creative must be true (zero cookies, no tracking, all perspectives) — the brand IS trust.
- Store each cycle's campaign under `docs/marketing/` (create it) with the date, so cycles diff against the last one.
