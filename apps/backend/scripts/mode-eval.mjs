#!/usr/bin/env node
// Mainstream (blue-pill) vs Rabbit Hole (red-pill): how different are the two?
//
//   BASE=http://localhost:3001 node scripts/mode-eval.mjs [--top 10] [--show]
//
// Prints, per fixed query, the overlap of the two top-N URL sets and (with
// --show) both lists with each result's rankDebug (engines, consensus, final).
// Targets (docs: TRUEGLE-FIX-PLAN 7.2): average overlap < 20 %, and the obvious
// answer inside the Mainstream top 3. Run against a LOCAL backend: every query
// is recorded in the search stats like a real one.
const BASE = process.env.BASE || 'http://localhost:3001';
const argv = process.argv.slice(2);
const TOP = Number(argv[argv.indexOf('--top') + 1]) || 10;
const SHOW = argv.includes('--show');

const QUERIES = [
  // news-like
  'ukraine peace talks', 'federal reserve interest rates', 'solar eclipse 2026', 'ai regulation europe', 'world cup qualifiers',
  // music
  'sade smooth criminal', 'best jazz albums 1960s', 'how to mix vocals', 'daft punk discovery', 'kendrick lamar',
  // history
  'roman empire collapse causes', 'cold war cuban missile crisis', 'bronze age collapse', 'history of the printing press', 'library of alexandria',
  // science
  'how do vaccines work', 'cold fusion research', 'black hole information paradox', 'crispr gene editing', 'microplastics health effects',
  // controversial / esoteric
  'jfk assassination', 'fluoride in water', 'ancient aliens evidence', 'hollow earth theory', 'project mkultra documents',
  // everyday / local
  'best pizza dough recipe', 'how to change a bike tyre', 'plumber near me eugene', 'is it safe to eat raw eggs', 'linux vs windows privacy',
];

const run = async (query, mode) => {
  const res = await fetch(`${BASE}/api/search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, mode, filters: { category: 'all', perPage: TOP, debug: true } }),
  });
  const d = await res.json().catch(() => ({}));
  return (d.results || d.data?.results || []).slice(0, TOP);
};
const norm = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');

let total = 0; let n = 0;
for (const q of QUERIES) {
  const [a, b] = [await run(q, 'blue-pill'), await run(q, 'red-pill')];
  const A = new Set(a.map((r) => norm(r.url)));
  const both = b.filter((r) => A.has(norm(r.url))).length;
  const overlap = a.length && b.length ? Math.round((both / Math.min(a.length, b.length)) * 100) : null;
  if (overlap !== null) { total += overlap; n += 1; }
  console.log(`${String(overlap ?? '—').padStart(4)}%  ${q}   (mainstream ${a.length}, rabbit ${b.length})`);
  if (SHOW) {
    for (const [label, list] of [['MAINSTREAM', a], ['RABBIT', b]]) {
      console.log(`  ${label}`);
      list.forEach((r, i) => console.log(`   ${i + 1}. ${norm(r.url)}  [eng ${r.rankDebug?.engines?.length ?? '?'} cons ${r.rankDebug?.consensus ?? '-'} final ${r.rankDebug?.final ?? '-'}]`));
    }
  }
}
console.log(`\nAverage overlap: ${n ? Math.round(total / n) : '—'}% over ${n} queries (target < 20%)`);
