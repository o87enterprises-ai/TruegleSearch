# Truegle Company Skills — Standing Policy (applies every session, no need to invoke)

At the START of every session, before acting:
0. **Agent memory auto-loads.** The SessionStart hook prints the persistent
   memory digest (`node .claude/memory/mem.mjs digest`) into your context —
   PERMANENT FACTS, settled decisions, key entities, open threads. **Trust it;
   do NOT re-derive or re-ask anything it already states.** This exists so we
   stop having the same conversations every session and stop burning tokens
   re-reading the whole HANDOFF. Only open HANDOFF.md when you need detail the
   digest doesn't carry.
   **Keep it current** (this is the whole point — a stale memory is worse than none):
   - Settled a fact / made a durable decision? `node .claude/memory/mem.mjs add <fact|decision|entity|thread> <id> "label" "body"`
   - Finished an open thread? `node .claude/memory/mem.mjs done <id>`
   - Search it: `… query <term>` · list: `… list [type]`
   Commit `.claude/memory/graph.json` with your normal work so the next session inherits it.
1. Read `HANDOFF.md` (top) for live state + 🔴 PERMANENT FACTS.
   **Auto-loaded skills:** the SessionStart hook (`.claude/session-start.sh`)
   also injects `ponytail` + `executive-summary` in full every session, so their
   rules are active without being invoked. Edit that script to change what
   auto-loads (add/remove skills, trim for tokens).
2. These company skills in `.claude/skills/` are ALWAYS in force — apply them automatically, don't wait to be asked:
   - **ponytail** — engineering discipline (boot-don't-just-check, root cause, free-first).
   - **tech** — branch-per-session, privacy/no-tracking, security, secrets map, handoff hygiene.
   - **financial** — $0 budget; flag any spend; keep the ledger. **No revenue model as of 2026-08-24** (ads removed); treat costs as pure expense.
   - **design** — brand + motion continuity on any UI.
   - **marketing / inference / caveman / user-task-instructions / executive-summary** — invoke by name when relevant.
3. Default to terse: commands/instructions over prose unless asked. No re-deriving settled facts.

## 🔴 PERMANENT FACTS (do not re-derive, do not re-ask)
- **Nephesh host:** NO free self-host box available (AWS free tier = 1 GB, OOMs; Oracle always-free used up; no home hardware/power/internet). Nephesh therefore runs on the **Groq free tier as substrate** — the Null-Prime mode prompts + attribution are applied at the `UnifiedAIService` layer, so responses are Nephesh-branded regardless of engine. Self-hosting is a later privacy upgrade (deploy kit ready in `nephesh/`). The AWS `searxng` t3.micro still can't host a model; give it a 1 GB swapfile for stability.
- **EC2 access:** key is lost; use **EC2 Instance Connect** (browser) — no `.pem` recoverable. Box IP `44.236.219.63`, region **us-west-2 (Oregon)**, instance `i-0709a9d47e503384f`.
- **NO ADVERTISING (`docs/AD-POLICY.md`) — build-enforced via `npm run check:ads`:**
  Truegle carries **no third-party ads at all** as of 2026-08-24. Adsterra and every ad
  component, config, consent banner, and backend ad route were deleted. The project is no
  longer run on a profit/loss basis — it exists to offer an alternative to the search
  monopoly. The build fails if an ad network reappears. Do NOT propose ad monetization,
  re-add a network, or "just try" another one; that is a product decision, not a code change.
  Truegle now sets **zero cookies** — there is no cookie-consent banner because there is
  nothing to consent to.
- **Analytics:** Cloudflare Web Analytics only (`src/utils/analytics.js`) — cookieless, no
  fingerprinting, inert unless `VITE_CF_BEACON_TOKEN` is set, skipped on DNT/GPC. Search
  Console is the authoritative organic-search source (setup pending — needs a browser login).
  `/api/analytics` counters are process-local and reset on cold start; they are NOT traffic
  numbers and must never be quoted (they used to ship a fake 1500-search seed — removed).

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