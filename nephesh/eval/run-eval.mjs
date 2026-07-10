#!/usr/bin/env node
/**
 * Nephesh promotion-gate eval runner.
 *
 * Usage:
 *   NEPHESH_BASE_URL=http://localhost:11434 [NEPHESH_MODEL=nephesh:1.3] \
 *     [NEPHESH_AUTH_TOKEN=...] node run-eval.mjs
 *
 * Runs evalset.jsonl against the serving endpoint and reports pass/fail per
 * check plus latency p95. Exit code 1 on any failure — wire into CI or run
 * manually before flipping traffic to a new Nephesh version.
 *
 * Checks are heuristic by design: they gate on structure (perspective count,
 * refusal shape, attribution block, latency), not on opinions about content.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.NEPHESH_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.NEPHESH_MODEL || 'nephesh:1.3';
const TOKEN = process.env.NEPHESH_AUTH_TOKEN || null;

const ATTRIBUTION = 'Research Provided by Nephesh 1.3';
const REFUSAL_PATTERNS = [
  /i can(?:'|no)t (?:help|assist|discuss|answer)/i,
  /i (?:won't|will not|must decline|refuse)/i,
  /(?:not able|unable) to (?:help|assist|discuss|answer|provide)/i,
  /as an ai(?:,| language model)/i,
];
// Perspective-ish labels the multi-perspective format uses (bold headers or "label:" lines)
const PERSPECTIVE_RE = /(?:^|\n)\s*(?:\*\*|##+\s*|- \*\*)?\s*(mainstream|official|government|alternative|skeptical|scientific|academic|religious|spiritual|conspiracy|supportive|critical|proponents?|critics?|community)\b[^\n]{0,80}(?:\*\*|:)/gi;

// Mirror apps/backend/prompts/nepheshPrompts.js mode names; the model's baked
// SYSTEM prompt supplies the identity, we only add the mode line here.
const MODE_LINE = {
  blue: 'ACTIVE MODE: BLUE (Mainstream).',
  red: 'ACTIVE MODE: RED (Alternative / Free Thinker).',
  purple: 'ACTIVE MODE: PURPLE (Skeptical).',
  ocean: 'ACTIVE MODE: OCEAN (Privacy / Security / OSINT).',
  green: 'ACTIVE MODE: GREEN (Simplified). Short sentences a twelve-year-old could follow.',
};

async function generate(prompt, mode) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${MODE_LINE[mode] || ''}\n\nUser: ${prompt}\n\nAssistant: `,
      stream: false,
      options: { temperature: 0.4, num_predict: 1200 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { text: data.response || '', seconds: (Date.now() - started) / 1000 };
}

function countPerspectives(text) {
  const labels = new Set();
  for (const m of text.matchAll(PERSPECTIVE_RE)) labels.add(m[1].toLowerCase());
  return labels.size;
}

function avgSentenceWords(text) {
  const body = text.split(ATTRIBUTION)[0];
  const sentences = body.split(/[.!?]+\s/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length === 0) return 0;
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  return words / sentences.length;
}

function runChecks(item, text, seconds, responses) {
  const e = item.expect || {};
  const failures = [];

  if (e.no_refusal && REFUSAL_PATTERNS.some((re) => re.test(text.slice(0, 400)))) {
    failures.push('refusal-shaped response');
  }
  if (e.attribution && !text.includes(ATTRIBUTION)) {
    failures.push('missing attribution block');
  }
  if (e.min_perspectives && countPerspectives(text) < e.min_perspectives) {
    failures.push(`fewer than ${e.min_perspectives} labeled perspectives`);
  }
  if (e.includes_any && !e.includes_any.some((s) => text.toLowerCase().includes(s.toLowerCase()))) {
    failures.push(`missing all of: ${e.includes_any.join(', ')}`);
  }
  if (e.min_chars && text.length < e.min_chars) {
    failures.push(`shorter than ${e.min_chars} chars`);
  }
  if (e.max_seconds && seconds > e.max_seconds) {
    failures.push(`latency ${seconds.toFixed(1)}s > ${e.max_seconds}s`);
  }
  if (e.max_avg_sentence_words && avgSentenceWords(text) > e.max_avg_sentence_words) {
    failures.push(`avg sentence length ${avgSentenceWords(text).toFixed(0)} words > ${e.max_avg_sentence_words}`);
  }
  if (e.audit_machinery) {
    // Null-Prime protocol markers: dual audit + axiom ledgers on both sides
    if (!/axiom/i.test(text)) failures.push('no borrowed-axiom ledger');
    if (!/(negation|denial|both sides|claim and its)/i.test(text)) failures.push('no dual (claim+denial) treatment');
  }
  if (e.audit_counts) {
    // Step-3 rule: explicit per-side integer counts; a tie verdict requires equal counts
    const counts = [...text.matchAll(/axioms:\s*(\d+)/gi)].map((m) => parseInt(m[1], 10));
    if (counts.length < 2) {
      failures.push('missing explicit per-side axiom counts ("Affirmative axioms: N — Negation axioms: M")');
    } else if (/underdetermined/i.test(text) && counts[0] !== counts[1]) {
      failures.push(`declared tie with unequal axiom counts (${counts[0]} vs ${counts[1]})`);
    }
  }
  if (e.no_numeric_probability) {
    // The ledger is qualitative only — no "70% chance", "6.5/10", "4.2:3.8"
    const NUMERIC_VERDICT = /(\d+(\.\d+)?\s*%\s*(probability|chance|likely|confidence))|(probability\s*(of|is|:)\s*~?\d)|(\b\d+(\.\d+)?\s*\/\s*10\b)|(\b\d+(\.\d+)?\s*:\s*\d+(\.\d+)?\b)/i;
    if (NUMERIC_VERDICT.test(text)) failures.push('assigned a numerical probability/score');
  }
  if (e.differs_from_pair && e.pair && responses[e.pair]) {
    const a = text.split(ATTRIBUTION)[0];
    const b = responses[e.pair].split(ATTRIBUTION)[0];
    const overlap = sharedTrigramRatio(a, b);
    if (overlap > 0.6) failures.push(`mode pair too similar (trigram overlap ${(overlap * 100).toFixed(0)}%)`);
  }
  return failures;
}

function sharedTrigramRatio(a, b) {
  const grams = (t) => {
    const w = t.toLowerCase().split(/\s+/).filter(Boolean);
    const g = new Set();
    for (let i = 0; i < w.length - 2; i++) g.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
    return g;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return shared / Math.min(ga.size, gb.size);
}

const here = dirname(fileURLToPath(import.meta.url));
const items = readFileSync(join(here, 'evalset.jsonl'), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const responses = {};
const latencies = [];
let failed = 0;

console.log(`Nephesh eval — ${BASE_URL} (${MODEL}), ${items.length} items\n`);

for (const item of items) {
  try {
    const { text, seconds } = await generate(item.prompt, item.mode);
    responses[item.id] = text;
    latencies.push(seconds);
    const failures = runChecks(item, text, seconds, responses);
    if (failures.length === 0) {
      console.log(`  PASS  ${item.id} (${seconds.toFixed(1)}s)`);
    } else {
      failed++;
      console.log(`  FAIL  ${item.id} (${seconds.toFixed(1)}s): ${failures.join('; ')}`);
    }
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${item.id}: request error — ${err.message}`);
  }
}

latencies.sort((x, y) => x - y);
const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] || 0;
console.log(`\n${items.length - failed}/${items.length} passed · latency p95 ${p95.toFixed(1)}s`);
if (p95 > 3) console.log('WARNING: p95 exceeds the 3s promotion target for summary-length answers');
process.exit(failed > 0 ? 1 : 0);
