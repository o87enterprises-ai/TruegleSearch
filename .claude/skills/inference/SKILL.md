---
name: inference
description: TrueGLE 1.3 — Truegle's self-hosted inference model (internal codename "Nephesh", kept in filenames/env vars — see rename note). Governs how all AI responses (summaries, quick answers, perspective analysis, chat) are served, how TrueGLE is trained/configured, and how API-key access to it is issued. Use for any AI/LLM feature work.
---

# Inference — TrueGLE 1.3

> **2026-07-12 rename:** the model's user-facing NAME is **TrueGLE 1.3**
> (was "Nephesh"). Internal identifiers were deliberately left as `nephesh` —
> filenames (`NepheshService.js`, `nepheshPrompts.js`), env vars
> (`NEPHESH_BASE_URL`, `NEPHESH_AUTH_TOKEN`), the provider key `'nephesh'`,
> and the `nephesh_attribution` metadata field — to avoid breaking live config
> and API contracts. Only display strings changed. Don't rename the internals
> without a coordinated env-var migration.

**TrueGLE 1.3** is Truegle's own self-hosted model and the designated engine
for **all AI responses** in the product: AI summaries on search results,
quick-answer cards, perspective/bias analysis per mode, the future Co-Founder
GPT, and licensed API access.

**Two absolute mandates are baked into every TrueGLE response** (see
`apps/backend/prompts/nepheshPrompts.js` `BASE_IDENTITY`, mirrored in
`nephesh/Modelfile`): (A) unbiased indifference — it holds no opinions of its
own and keeps any verdict to itself; its job is to help the user gather
unbiased research so THEY form their own view; (B) 100% honesty and
transparency — never deceive, mislead, manipulate, spin, or fabricate. No
exceptions on either.

## Why self-hosted (mission constraints)

- **Privacy:** queries never leave Truegle infrastructure — no third-party AI provider sees user searches.
- **No censorship:** TrueGLE is configured without topic refusals on lawful controversial subjects — it must summarize all perspectives (blue/red/purple/ocean) evenly, which commercial APIs won't reliably do.
- **$0 budget:** per-token API bills don't scale on ad revenue; self-hosting on owned compute does. (OpenAI is banned outright — user decision.)

## Target architecture

1. **Host:** TrueGLE 1.3 served on Truegle-controlled compute (the AWS EC2 host alongside SearXNG, or a dedicated GPU box when available) behind an OpenAI-compatible endpoint (e.g. Ollama / vLLM / llama.cpp server) at an internal URL, fronted by the backend — never called directly from the browser.
2. **Backend integration:** one inference service module in `apps/backend/services/` that all AI features call. Config via env (`NEPHESH_BASE_URL`, `NEPHESH_AUTH_TOKEN`, `NEPHESH_MODEL=nephesh:1.3`) in `apps/backend/config/env.js`, following the existing Joi-validated pattern. Missing config = graceful degradation (feature hides), never a crash — same rule as search providers.
3. **Fallback chain:** TrueGLE (self-hosted) first; existing free-tier providers (currently Groq — see PERMANENT FACTS) as explicit fallback while self-host capacity is unavailable; log which engine answered (label like search results: "TrueGLE · via Truegle").

## Training & configuration duties

- **System prompts per mode:** each search mode gets a perspective-tuned prompt (mainstream / alternative / skeptical / OSINT) — stored in the repo, versioned, never hardcoded inline in route handlers.
- **Fine-tuning data:** collect from consenting usage only (no PII — same discipline as the `search_queries` table: query text + mode, nothing identifying). Curate examples of even-handed multi-perspective summaries as the core training objective.
- **Evaluation:** before promoting any new TrueGLE version, run a fixed eval set: perspective balance (same query summarized under each mode), refusal rate on lawful controversial topics (target: 0), factual-citation quality, latency (< 3s p95 for summaries).
- **Version pinning:** the served model tag is pinned and recorded in `HANDOFF.md`; upgrades are a session log entry.

## API-key access (revenue product)

TrueGLE + Truegle search as a licensed API (see `financial` skill rules 5–6):
- Key issuance requires license acceptance; keys are metered and rate-limited per tier.
- Free tier: minimal (discovery/demo quota). Paid tiers: priced against compute cost so every key is margin-positive.
- Every API response carries the attribution/licensing header block (reuse `apps/backend/middleware/attribution.js` pattern).
- Scraping around the API (bot traffic on `/api/search`) stays blocked — the API key IS the sanctioned path.

## Attribution (mandatory, exclusive)

Every TrueGLE response embeds this exact block — visible footer + machine-readable
`nephesh_attribution` metadata + invisible zero-width watermark:

```
Research Provided by TrueGLE 1.3 -
https://truegle.info
Truegle Co.
©2026
```

Enforced server-side in `apps/backend/utils/nepheshAttribution.js` (idempotent —
never double-stamps) and trained into the model. Do not reword it.

## Implemented file map (2026-07-08)

| Path | What |
|---|---|
| `apps/backend/services/NepheshService.js` | Provider (Ollama API, auth-token gated for remote hosts, attribution-stamped) — registered FIRST in `UnifiedAIService` |
| `apps/backend/prompts/nepheshPrompts.js` | Versioned per-mode system prompts (blue/red/purple/ocean/green + legacy contexts + deep research) — single source of truth, mirrored in `nephesh/Modelfile` |
| `apps/backend/services/DeepResearchService.js` + `POST /api/ai/deep-research` | Deep dive: SearXNG web/news/social/videos + YouTube transcripts → multi-perspective cited report |
| `nephesh/` (repo root) | Build kit: Modelfile, QLoRA fine-tune config + seed dataset, promotion-gate eval (`node nephesh/eval/run-eval.mjs`) |
| Env | `NEPHESH_BASE_URL`, `NEPHESH_MODEL` (default `nephesh:1.3`), `NEPHESH_AUTH_TOKEN` (required for non-localhost) |

Behavior: TrueGLE (self-hosted, served via the `nephesh` provider) first when
configured; unset env = automatic fallback to the interim provider mix
(currently Groq — see PERMANENT FACTS in `.claude/memory/graph.json`). Mode
prompts and both absolute mandates apply on the fallback path too, so behavior
is consistent whichever engine answers — the Groq-served responses are still
stamped and branded as TrueGLE.

## Remaining next steps

1. Stand up Ollama on owned compute and build from `nephesh/Modelfile` (see `nephesh/README.md`); set the three env vars on Vercel.
2. Reconcile the base model + training specifics against the user's full TrueGLE build material.
3. Run `nephesh/eval/run-eval.mjs` as the promotion gate; record the version in `HANDOFF.md`.
4. Fine-tune via `nephesh/finetune/` on free GPU (Colab/Kaggle); swap the GGUF into the Modelfile.
5. Wire metered API-key issuance (licensed access — see `financial` skill).

Record all progress and the serving endpoint details in `HANDOFF.md` — never
commit the actual keys or internal URLs to the repo.
