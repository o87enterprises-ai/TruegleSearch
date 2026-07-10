# Truegle Company Skills — Standing Policy (applies every session, no need to invoke)

At the START of every session, before acting:
1. Read `HANDOFF.md` (top) for live state + 🔴 PERMANENT FACTS.
2. These company skills in `.claude/skills/` are ALWAYS in force — apply them automatically, don't wait to be asked:
   - **ponytail** — engineering discipline (boot-don't-just-check, root cause, free-first).
   - **tech** — branch-per-session, privacy/no-tracking, security, secrets map, handoff hygiene.
   - **financial** — $0 budget; flag any spend; keep the ledger.
   - **design** — brand + motion continuity on any UI.
   - **marketing / inference / caveman / user-task-instructions / executive-summary** — invoke by name when relevant.
3. Default to terse: commands/instructions over prose unless asked. No re-deriving settled facts.

## 🔴 PERMANENT FACTS (do not re-derive, do not re-ask)
- **Nephesh host:** NO free self-host box available (AWS free tier = 1 GB, OOMs; Oracle always-free used up; no home hardware/power/internet). Nephesh therefore runs on the **Groq free tier as substrate** — the Null-Prime mode prompts + attribution are applied at the `UnifiedAIService` layer, so responses are Nephesh-branded regardless of engine. Self-hosting is a later privacy upgrade (deploy kit ready in `nephesh/`). The AWS `searxng` t3.micro still can't host a model; give it a 1 GB swapfile for stability.
- **EC2 access:** key is lost; use **EC2 Instance Connect** (browser) — no `.pem` recoverable. Box IP `44.236.219.63`, region **us-west-2 (Oregon)**, instance `i-0709a9d47e503384f`.
- Adsterra API is dashboard-only; banner anti-adblock codes don't exist in this account; the adult toggle can't be disabled once on; Impact.com is closed until 50K/mo traffic. (Full detail in HANDOFF.md.)

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->