#!/usr/bin/env node
/* Which providers answered, per day — Brave / YouTube / Google CSE / News / TomTom / OpenRouter.
 *   node scripts/upstream-health.mjs [--days 7] [--backend URL]
 * Needs ADMIN_API_KEY (sent only as x-admin-key). Counts can undercount (serverless): read for direction. */
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const days = Math.min(60, Math.max(1, Number(flag('--days')) || 7));
const BACKEND = (flag('--backend') || process.env.TRUEGLE_BACKEND_URL || 'https://backend-seven-khaki-60.vercel.app').replace(/\/$/, '');
const key = process.env.ADMIN_API_KEY;
if (!key) { console.error('ADMIN_API_KEY is not set.'); process.exit(2); }

const res = await fetch(`${BACKEND}/api/admin/upstream-health?days=${days}`, { headers: { 'x-admin-key': key } });
if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
const j = await res.json();

const byDay = {};
for (const r of j.history || []) ((byDay[r.day] ||= {})[r.provider] ||= {})[r.outcome] = r.count;
for (const [d, provs] of Object.entries(byDay)) {
  console.log(d);
  for (const [p, o] of Object.entries(provs)) {
    const total = Object.values(o).reduce((a, b) => a + b, 0);
    console.log(`  ${p.padEnd(11)} ${String(total).padStart(5)}  ` + Object.entries(o).map(([k, v]) => `${k}=${v}`).join(' '));
  }
}
if (!j.history) console.log('(no database history — instance counters only)');
console.log('cooling down now:', JSON.stringify(j.coolingDown));
