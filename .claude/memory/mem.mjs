#!/usr/bin/env node
/**
 * mem.mjs — the Truegle agent's PERSISTENT MEMORY across Claude Code sessions.
 *
 * Why this exists: without it, every new session re-reads the huge HANDOFF.md
 * and re-derives (and re-litigates) facts we already settled — burning tokens
 * and repeating the same conversations. This stores durable knowledge as a
 * GraphiPy-style graph (nodes + edges; see github.com/shobeir/GraphiPy) and
 * emits a compact digest at session start so the next session starts *knowing*.
 *
 * Node types:
 *   fact     — a PERMANENT fact. Do not re-derive or re-ask. (e.g. hosting reality)
 *   decision — a settled choice + its rationale. Don't re-litigate.
 *   entity   — a key thing (service/provider/infra/file) + attributes.
 *   thread   — an open work item (status open|done|blocked).
 * Edges carry a Label (relates_to, supersedes, blocks, part_of, …).
 *
 * Usage:
 *   node .claude/memory/mem.mjs digest                 # compact memory (hook uses this)
 *   node .claude/memory/mem.mjs add <type> <id> "<label>" "<body>"
 *   node .claude/memory/mem.mjs done <threadId>        # mark a thread resolved
 *   node .claude/memory/mem.mjs link <src> <label> <dst>
 *   node .claude/memory/mem.mjs query <term>
 *   node .claude/memory/mem.mjs list [type]
 *   node .claude/memory/mem.mjs rm <id>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STORE = join(dirname(fileURLToPath(import.meta.url)), 'graph.json');
const TYPES = ['fact', 'decision', 'entity', 'thread'];

// ---- GraphiPy-style store (Id/Label/Type + edges Source/Target/Label) --------
function load() {
  if (!existsSync(STORE)) return { nodes: {}, edges: {}, updated: null };
  try { return JSON.parse(readFileSync(STORE, 'utf8')); }
  catch { return { nodes: {}, edges: {}, updated: null }; }
}
function save(g) {
  g.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(STORE, JSON.stringify(g, null, 2) + '\n');
}
function allNodes(g) { return Object.values(g.nodes).flatMap((byId) => Object.values(byId)); }
function allEdges(g) { return Object.values(g.edges).flatMap((byId) => Object.values(byId)); }
function findNode(g, id) { return allNodes(g).find((n) => n.Id === id) || null; }

function upsertNode(g, { Type, Id, Label, body, status }) {
  if (!TYPES.includes(Type)) throw new Error(`type must be one of ${TYPES.join('|')}`);
  const bucket = (g.nodes[Type] = g.nodes[Type] || {});
  const existing = bucket[Id];
  bucket[Id] = {
    Id, Type, Label,
    body: body ?? existing?.body ?? '',
    status: status ?? existing?.status ?? (Type === 'thread' ? 'open' : undefined),
    ts: new Date().toISOString().slice(0, 10),
    created: existing?.created ?? new Date().toISOString().slice(0, 10),
  };
  return bucket[Id];
}
function addEdge(g, source, label, target) {
  const Id = `${source}|${label}|${target}`;
  const bucket = (g.edges[label] = g.edges[label] || {});
  bucket[Id] = { Id, Source: source, Target: target, Label: label };
  return bucket[Id];
}

// ---- digest (what the session-start hook prints) -----------------------------
function digest(g) {
  const nodes = allNodes(g);
  const facts = nodes.filter((n) => n.Type === 'fact');
  const decisions = nodes.filter((n) => n.Type === 'decision');
  const entities = nodes.filter((n) => n.Type === 'entity');
  const openThreads = nodes.filter((n) => n.Type === 'thread' && n.status !== 'done');
  const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

  const lines = [];
  lines.push('🧠 TRUEGLE AGENT MEMORY — persistent across sessions. Trust it; do NOT re-derive or re-ask settled items.');
  lines.push(`Updated ${g.updated || '—'} · ${facts.length} facts · ${decisions.length} decisions · ${entities.length} entities · ${openThreads.length} open threads`);
  if (facts.length) {
    lines.push('\n🔴 PERMANENT FACTS (do not re-derive / re-ask):');
    for (const f of facts) lines.push(`- ${f.Label}: ${trunc(f.body, 200)}`);
  }
  if (decisions.length) {
    lines.push('\n✅ SETTLED DECISIONS (do not re-litigate):');
    for (const d of decisions) lines.push(`- ${d.Label}: ${trunc(d.body, 180)}`);
  }
  if (entities.length) {
    lines.push('\n📦 KEY ENTITIES:');
    for (const e of entities) lines.push(`- ${e.Label}: ${trunc(e.body, 160)}`);
  }
  if (openThreads.length) {
    lines.push('\n🔧 OPEN THREADS:');
    for (const t of openThreads) lines.push(`- [${t.status}] ${t.Label}: ${trunc(t.body, 160)}`);
  }
  const edges = allEdges(g).filter((e) => e.Label !== 'relates_to');
  if (edges.length) {
    lines.push('\n🔗 LINKS:');
    for (const e of edges.slice(0, 20)) lines.push(`- ${e.Source} —${e.Label}→ ${e.Target}`);
  }
  lines.push('\n(update: node .claude/memory/mem.mjs add <fact|decision|entity|thread> <id> "label" "body"  ·  resolve: … done <id>)');
  return lines.join('\n');
}

// ---- CLI ---------------------------------------------------------------------
const [cmd, ...args] = process.argv.slice(2);
const g = load();

switch (cmd) {
  case 'digest':
    console.log(digest(g));
    break;
  case 'add': {
    const [Type, Id, Label, body] = args;
    if (!Type || !Id || !Label) { console.error('usage: add <type> <id> "<label>" "<body>"'); process.exit(1); }
    upsertNode(g, { Type, Id, Label, body });
    save(g);
    console.log(`✓ ${Type} "${Id}" saved`);
    break;
  }
  case 'done': {
    const [Id] = args;
    const n = findNode(g, Id);
    if (!n) { console.error(`no node "${Id}"`); process.exit(1); }
    n.status = 'done'; n.ts = new Date().toISOString().slice(0, 10);
    save(g);
    console.log(`✓ "${Id}" marked done`);
    break;
  }
  case 'link': {
    const [source, label, target] = args;
    if (!source || !label || !target) { console.error('usage: link <src> <label> <dst>'); process.exit(1); }
    addEdge(g, source, label, target);
    save(g);
    console.log(`✓ ${source} —${label}→ ${target}`);
    break;
  }
  case 'rm': {
    const [Id] = args;
    let removed = false;
    for (const type of Object.keys(g.nodes)) if (g.nodes[type][Id]) { delete g.nodes[type][Id]; removed = true; }
    save(g);
    console.log(removed ? `✓ removed "${Id}"` : `no node "${Id}"`);
    break;
  }
  case 'query': {
    const term = (args.join(' ') || '').toLowerCase();
    const hits = allNodes(g).filter((n) => `${n.Id} ${n.Label} ${n.body}`.toLowerCase().includes(term));
    if (!hits.length) { console.log(`no memory matches "${term}"`); break; }
    for (const n of hits) console.log(`[${n.Type}] ${n.Id} — ${n.Label}: ${n.body}`);
    break;
  }
  case 'list': {
    const type = args[0];
    const nodes = allNodes(g).filter((n) => !type || n.Type === type);
    for (const n of nodes) console.log(`[${n.Type}] ${n.Id} — ${n.Label}${n.status ? ` (${n.status})` : ''}`);
    break;
  }
  default:
    console.log('commands: digest | add | done | link | rm | query | list');
    console.log('run `node .claude/memory/mem.mjs digest` for current memory');
}
