---
name: inference
description: Nephesh 1.3 — Truegle's self-hosted inference model. Governs how all AI responses (summaries, quick answers, perspective analysis, chat) are served, how Nephesh is trained/configured, and how API-key access to it is issued. Use for any AI/LLM feature work.
---

# Inference — Nephesh 1.3

**Nephesh 1.3** is Truegle's own self-hosted model and the designated engine
for **all AI responses** in the product: AI summaries on search results,
quick-answer cards, perspective/bias analysis per mode, the future Co-Founder
GPT, and licensed API access.

## Why self-hosted (mission constraints)

- **Privacy:** queries never leave Truegle infrastructure — no third-party AI provider sees user searches.
- **No censorship:** Nephesh is configured without topic refusals on lawful controversial subjects — it must summarize all perspectives (blue/red/purple/ocean) evenly, which commercial APIs won't reliably do.
- **$0 budget:** per-token API bills don't scale on ad revenue; self-hosting on owned compute does. (OpenAI is banned outright — user decision.)

## Target architecture

1. **Host:** Nephesh 1.3 served on Truegle-controlled compute (the AWS EC2 host alongside SearXNG, or a dedicated GPU box when available) behind an OpenAI-compatible endpoint (e.g. Ollama / vLLM / llama.cpp server) at an internal URL, fronted by the backend — never called directly from the browser.
2. **Backend integration:** one inference service module in `apps/backend/services/` that all AI features call. Config via env (`NEPHESH_URL`, `NEPHESH_API_KEY`, `NEPHESH_MODEL=nephesh-1.3`) in `apps/backend/config/env.js`, following the existing Joi-validated pattern. Missing config = graceful degradation (feature hides), never a crash — same rule as search providers.
3. **Fallback chain:** Nephesh first; existing free-tier providers only as explicit fallback while Nephesh capacity is limited; log which engine answered (label like search results: "Nephesh · via Truegle").

## Training & configuration duties

- **System prompts per mode:** each search mode gets a perspective-tuned prompt (mainstream / alternative / skeptical / OSINT) — stored in the repo, versioned, never hardcoded inline in route handlers.
- **Fine-tuning data:** collect from consenting usage only (no PII — same discipline as the `search_queries` table: query text + mode, nothing identifying). Curate examples of even-handed multi-perspective summaries as the core training objective.
- **Evaluation:** before promoting any new Nephesh version, run a fixed eval set: perspective balance (same query summarized under each mode), refusal rate on lawful controversial topics (target: 0), factual-citation quality, latency (< 3s p95 for summaries).
- **Version pinning:** the served model tag is pinned and recorded in `HANDOFF.md`; upgrades are a session log entry.

## API-key access (revenue product)

Nephesh + Truegle search as a licensed API (see `financial` skill rules 5–6):
- Key issuance requires license acceptance; keys are metered and rate-limited per tier.
- Free tier: minimal (discovery/demo quota). Paid tiers: priced against compute cost so every key is margin-positive.
- Every API response carries the attribution/licensing header block (reuse `apps/backend/middleware/attribution.js` pattern).
- Scraping around the API (bot traffic on `/api/search`) stays blocked — the API key IS the sanctioned path.

## Current state & next steps

Nephesh is the target; today's AI responses still run on the interim provider
mix in `apps/backend/config/env.js`. Standing next steps, in order:
1. Stand up the inference server on owned compute; benchmark Nephesh 1.3 latency/quality on search-summary prompts.
2. Add the backend inference service + env config; route one feature (AI summary) through it behind a flag.
3. Run the eval set; flip the flag; expand to quick answers and perspective analysis.
4. Wire metered API-key issuance.

Record all progress and the serving endpoint details in `HANDOFF.md` — never
commit the actual keys or internal URLs to the repo.
