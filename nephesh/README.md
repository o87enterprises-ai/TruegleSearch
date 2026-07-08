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

## Directory map

| Path | Purpose |
|---|---|
| `Modelfile` | Ollama build recipe: base model + Nephesh identity + params |
| `finetune/` | QLoRA fine-tuning config, dataset schema, seed dataset |
| `eval/` | Promotion gate: eval set + runner (perspective balance, refusals, attribution, latency) |

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
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Build Nephesh from the Modelfile (pulls the base model on first run)
cd nephesh && ollama create nephesh:1.3 -f Modelfile

# 3. Smoke test
ollama run nephesh:1.3 "In two sentences, what is a filter bubble?"

# 4. Protect it — Ollama has NO auth. Put nginx in front with a shared secret
#    (same pattern as the Revive adserver proxy):
#      location /nephesh/ {
#        if ($http_authorization != "Bearer <NEPHESH_AUTH_TOKEN>") { return 401; }
#        proxy_pass http://127.0.0.1:11434/;
#      }
#    Never expose 11434 directly in the EC2 security group.
```

Then set on Vercel (backend env):

```
NEPHESH_BASE_URL=https://<host>/nephesh     # or http://localhost:11434 for local dev
NEPHESH_MODEL=nephesh:1.3
NEPHESH_AUTH_TOKEN=<shared secret>           # required for any non-localhost URL
```

The backend refuses to talk to a remote Nephesh without the auth token, and
degrades to the interim free-tier providers whenever Nephesh is unreachable —
configuring nothing changes nothing.

## Memory guidance

| Base model | RAM needed (q4) | Fits current EC2? |
|---|---|---|
| llama3.2:3b-instruct | ~4 GB | Likely (check `free -h`) |
| llama3.1:8b-instruct (default) | ~6-8 GB | Needs ≥8 GB host |
| qwen2.5:14b-instruct | ~12 GB | Needs upgrade / GPU box |

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
