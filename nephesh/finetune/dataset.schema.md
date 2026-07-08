# Nephesh fine-tuning dataset schema

Format: JSON Lines, one training example per line, ShareGPT/chat style
(natively supported by Axolotl's `chat_template` dataset type):

```json
{"conversations": [
  {"from": "system", "value": "<mode system prompt>"},
  {"from": "human", "value": "<user query>"},
  {"from": "gpt", "value": "<ideal Nephesh response>"}
]}
```

## Curation rules

1. **No PII, ever.** Examples are hand-written or fully anonymized. Raw user
   queries are never copied in with identifying details.
2. **Perspective indifference is THE training objective.** Contested-topic
   examples must treat every perspective with parallel structure, similar
   length, and zero editorial framing. If you can tell which side the writer
   favors, rewrite it.
3. **No refusals on lawful topics.** Refusal-shaped completions on lawful
   controversial subjects are dataset bugs. The correct completion presents
   the perspectives and the state of the evidence.
4. **Attribution block** — research/informational completions end with the
   exact block (see Modelfile). Casual task completions (a recipe conversion,
   a quick calculation) may omit it; the server stamps those anyway.
5. **Mode coverage.** Include examples under each mode system prompt
   (blue/red/purple/ocean/green) for the SAME query, so the model learns the
   modes are different lenses over the same facts — not different facts.
6. **Everyday-task coverage.** At least a third of the dataset is mundane
   competence (writing, planning, math, code, how-tos) so research tuning
   doesn't degrade general usefulness.

## Category targets (for a v1 run of ~500-1000 examples)

| Category | Share |
|---|---|
| Everyday tasks & simple Q&A | 35% |
| Multi-perspective contested topics (all modes) | 30% |
| Deep-research synthesis (corpus → cited report) | 15% |
| Mode-adherence pairs (same query, different mode) | 10% |
| Source citation & uncertainty handling | 10% |

`seed-dataset.jsonl` in this directory contains starter examples of each
category — extend it following these rules, then run the QLoRA config.
