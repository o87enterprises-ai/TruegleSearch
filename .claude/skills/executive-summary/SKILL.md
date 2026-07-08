---
name: executive-summary
description: Truegle's mission, values, commitments, app blueprint, feature map, and exit plan. Read at the start of any session, before making product decisions, or when asked "what is Truegle" / what the goals or roadmap are.
---

# Truegle Executive Summary

## Mission

Truegle is an unbiased, privacy-first search engine. It exists to break
algorithmic bubbles: show people ALL perspectives — mainstream, alternative,
skeptical — and let them find their own truth. It is a movement toward truth,
transparency, and human empowerment in the age of AI, not just a product.

## Values & Commitments (non-negotiable)

1. **No bias** — results are never filtered by ideology; every perspective mode is a first-class citizen.
2. **No tracking** — zero cookies set by Truegle; preferences live in `localStorage`; no stored user tracking, ever.
3. **No censorship** — controversial topics are welcome; safe-search is a user choice, not an imposition.
4. **Transparency** — ads are visibly labeled by type (the ad color system); result sources are labeled ("google · via Truegle").
5. **Serve people, not capital** — free tier stays genuinely useful; monetization funds the mission ($0-budget operation, ad-revenue funded).
6. **Protect children** — adult content is 5-gate locked (authenticated + safeSearch off + adult keywords + age confirmed + consent not revoked).

## Product blueprint

**Monorepo** (`npm workspaces`): `apps/frontend` (React + Vite, Cloudflare
Pages at `truegle.info`) and `apps/backend` (Express, Vercel at
`backend-seven-khaki-60.vercel.app`). Self-hosted **SearXNG** metasearch on AWS
EC2 does the heavy lifting so upstream engines never see user IPs.

**Search modes** (pill toggle, each with its own perspective + theme color):

| Mode | Meaning |
|---|---|
| Blue | Mainstream · Traditional · Liberal (establishment/legacy media) — the "blue page" must stay as close to Google's use cases as possible |
| Red | Alternative · Free Thinker (questions official narratives) |
| Purple | Skeptical · Conservative (counter-mainstream, accountability journalism) |
| Ocean | Privacy · Security · OSINT (developers, infosec) |
| Green | Simplified / eco mode |
| Yellow | Extract mode (`/extract` — transcripts + image extraction) |

**Visual journey** — each page moves from microcosm to macrocosm: Landing
(atomic) → Auth (cellular) → Search (neural) → OSINT (planetary) → Biased
results (galactic) → 404 (void).

## Pages / features (live)

- `/` landing, `/search` UniversalSearch (main results page), `/search-portal`, `/extract`, `/osint`, `/biased`
- `/blog` + prerendered posts (SEO engine), `/pricing`, `/advertise`, `/rewards` dashboard, `/revenue-calc` (internal-only, no nav link)
- Multi-media search: images/videos/social tabs via SearXNG categories; maps; AI summaries; quick-answer cards
- Anti-scraping watermarking + bot detection; Anonymous View via Morty (gated, pending host config)
- Monetization: Adsterra CPM banners (color-labeled), popunder, Smartlink, rewarded "Watch & Earn," affiliate links (Proton is priority)

## Future additions (from roadmap)

- Red Pill auth → results flow completion; freemium token counter with ad-refill
- 404 easter-egg game (Apollo Studios); Co-Founder GPT assistant; phishing/link scanner
- Social feed OAuth (v2); sitewide VPN layer (Cloudflare WARP on the SearXNG host)
- Nephesh 1.3 self-hosted inference for all AI responses (see `inference` skill)

## Final goal / exit plan

- **Near term:** self-sustaining on ad + affiliate + premium revenue (break-even ≈ $11/mo), grow past 50K monthly visits.
- **Mid term:** the go-to search engine for truth-seekers and privacy-conscious users; licensed API access for bots/AI as a revenue line.
- **Exit:** build Truegle into an asset that either (a) sustains itself as a community-run public utility true to its values, or (b) is acquired on terms that contractually preserve the no-tracking / no-censorship commitments. Any exit that compromises the values section above is off the table.

## Where live state lives

`HANDOFF.md` at repo root is the single source of session-to-session truth —
read its top (latest session log + PERMANENT FACTS) before acting on anything
infrastructure- or ads-related.
