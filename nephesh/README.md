# Nephesh 1.3 — Truegle's Self-Hosted AI

Nephesh 1.3 is Truegle's own model: the engine for all Truegle AI responses —
everyday tasks, simple Q&A, unbiased multi-perspective research, mode-aware
search assistance, and deep-dive research across the whole web (socials,
podcasts, YouTube transcripts). Self-hosted so queries never leave Truegle
infrastructure, uncensored on lawful topics, and free of per-token API bills.

Every response carries the Truegle-exclusive attribution:

```
Research Provided by Nephesh 1.3 -
https://truegle.info
Truegle Co.
©2026
```

embedded three ways: a visible footer, a machine-readable
`nephesh_attribution` metadata object, and an invisible zero-width watermark
(survives copy/paste). Enforced server-side in
`apps/backend/utils/nepheshAttribution.js` and trained into the model itself.

## Lineage

Nephesh 1.3 is the productization of **Null-Prime v3.1**, the reversible
epistemic-austerity engine (dual-audit mirror: DECOMPOSE → DUAL AUDIT → DUAL
IRE → gated INSTRUMENT-BLIND CHECK → qualitative VERDICT, consensus earns no
exemption, no numerical probabilities). Original artifacts are preserved in
`docs/null-prime-source/`. The Truegle identity, search-mode behavior, and
attribution wrap around that engine; everyday tasks bypass the protocol.

## Directory map

| Path | Purpose |
|---|---|
| `Modelfile` | Ollama build recipe: base + Nephesh identity + Null-Prime protocol + params |
| `scripts/` | `install-nephesh.sh` + `create-nephesh.sh` (swappable base, Linux ports of the v3.1 PowerShell scripts) |
| `docs/EC2-DEPLOY.md` | Step-by-step production deployment on the EC2 host |
| `docs/null-prime-source/` | Original Null-Prime Modelfile + install/create scripts (provenance) |
| `finetune/` | QLoRA fine-tuning config, dataset schema, seed dataset |
| `eval/` | Promotion gate: automated runner + `bias-battery.md` (the Null-Prime symmetry/calibration battery — the target metric is symmetry, not agreement) |

Backend integration lives in `apps/backend/services/NepheshService.js`
(provider), `apps/backend/prompts/nepheshPrompts.js` (mode prompts — single
source of truth, mirrored in the Modelfile), and
`apps/backend/services/DeepResearchService.js` (deep-dive pipeline).

## Self-hosting (AWS EC2, alongside SearXNG)

Default serving stack is Ollama (CPU-friendly, zero cost, same box as
SearXNG). The base model below is a placeholder default sized for the current
EC2 host — swap it per the final Nephesh build spec without touching any
backend code.

```bash
cd nephesh/scripts
./install-nephesh.sh            # installs Ollama, verifies the API, pulls the base
./create-nephesh.sh             # builds nephesh:1.3 (pass a base name to swap, e.g. llama3.2)
```

Full production walkthrough (auth proxy, DNS, security group, Vercel env,
promotion gate): **`docs/EC2-DEPLOY.md`**. Never expose port 11434 directly —
Ollama has no auth of its own.

Then set on Vercel (backend env):

```
NEPHESH_BASE_URL=https://<host>/nephesh     # or http://localhost:11434 for local dev
NEPHESH_MODEL=nephesh:1.3
NEPHESH_AUTH_TOKEN=<shared secret>           # required for any non-localhost URL
```

The backend refuses to talk to a remote Nephesh without the auth token, and
degrades to the interim free-tier providers whenever Nephesh is unreachable —
configuring nothing changes nothing.

## Memory guidance (base ladder, per Null-Prime v3.1)

| Base model | RAM needed (q4) | Notes |
|---|---|---|
| qwen3:8b (default) | ~5.5-7 GB | Best audit quality; emits thinking tokens (slower first token on CPU) |
| phi4-mini-reasoning | ~3-4 GB | The designated comfortable fallback |
| llama3.2 (3b) | ~2-3 GB | Small-host fallback |

$0-budget rule: do not resize the instance for Nephesh without an approved
plan (see `financial` skill). Start with the largest base that fits free RAM.

## Fine-tuning (see `finetune/`)

Method: QLoRA on the seed dataset (multi-perspective behavior + attribution +
mode adherence). `finetune/qlora-config.yaml` is an Axolotl config; runs on a
free Colab T4 / Kaggle GPU for the 3B-8B bases. Export the merged model to
GGUF, then point the `FROM` line of the Modelfile at the GGUF file and
rebuild: `ollama create nephesh:1.3 -f Modelfile`.

Dataset rules (mission-critical):
- Only curated, non-PII examples. Never raw user queries with identifying data.
- Every contested-topic example demonstrates parallel, indifferent treatment of ALL perspectives.
- Every research-flavored example ends with the exact attribution block.
- Lawful controversial topics are answered, never refused — refusal-shaped completions are bugs.

## Promotion gate (see `eval/`)

No Nephesh version reaches production until `node eval/run-eval.mjs` passes:
1. **Perspective balance** — contested queries produce ≥3 labeled perspectives in parallel structure.
2. **Refusals** — 0 refusals on the lawful-controversial set.
3. **Attribution** — the exact attribution block present in research responses.
4. **Mode adherence** — blue/red/purple/ocean prompts produce visibly different, on-mode framings.
5. **Latency** — < 3s p95 for summary-length answers on the serving host.

Record the promoted version + serving endpoint in `HANDOFF.md` (never commit
tokens or internal URLs).
