#!/usr/bin/env node
/* The player's own health, over the window you ask for — no tap, no bug
 * report, no stranger's goodwill required.
 *
 * TrueglePlayer fires an automatic beacon to POST /api/player/diagnostics
 * the moment it detects a clip stuck — real silence, a confirmed dead error,
 * or the loading overlay having to stop trusting the platform's own "I'm
 * playing" handshake. Nothing a visitor sees or taps; see utils/
 * playerDiagnostics.js on the frontend and migrations/025_player_health.sql
 * for the privacy rule the table follows (same as media_signals: no user,
 * session, IP or raw User-Agent, ever).
 *
 * This is the other half — reading it back, on your own schedule, instead
 * of waiting for someone to notice a broken video and press Report.
 *
 *   node scripts/player-health.mjs                 # last 7 days
 *   node scripts/player-health.mjs --days 30
 *   node scripts/player-health.mjs --reason silent   # + the 20 newest flight-recorder traces for that reason
 *   node scripts/player-health.mjs --backend https://your-backend.example
 *
 * ADMIN_API_KEY must be set (the same key the deployed backend checks on
 * every /api/admin/* route) — never printed, only sent as the x-admin-key
 * header.
 */
const DEFAULT_BACKEND = 'https://backend-seven-khaki-60.vercel.app';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const days = Math.min(90, Math.max(1, Number(flag('--days')) || 7));
const reason = flag('--reason');
const BACKEND = (flag('--backend') || process.env.TRUEGLE_BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, '');

const key = process.env.ADMIN_API_KEY;
if (!key) {
  console.error('ADMIN_API_KEY is not set — this is the same key the deployed backend checks on /api/admin/*.');
  process.exit(2);
}

const res = await fetch(`${BACKEND}/api/admin/player-health?days=${days}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`, {
  headers: { 'x-admin-key': key },
}).catch((err) => { console.error(`Could not reach ${BACKEND}: ${err.message}`); process.exit(1); });

if (!res.ok) {
  console.error(`${BACKEND} answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  process.exit(1);
}

const j = await res.json();
const row = (label, items, labelKey) => {
  console.log(`\n${label}`);
  if (!items.length) { console.log('  (none)'); return; }
  for (const it of items) console.log(`  ${String(it[labelKey]).padEnd(16)} ${it.count}`);
};

console.log(`Player health — last ${j.days} day(s)`);
console.log(`Total beacons: ${j.total}`);
row('By reason', j.byReason, 'reason');
row('By kind', j.byKind, 'kind');
row('By platform', j.byPlatform, 'platform');
row('Top error codes', j.byErrorCode, 'error_code');

console.log('\nBy browser x reason');
if (!(j.byBrowserReason || []).length) console.log('  (none)');
for (const it of j.byBrowserReason || []) console.log(`  ${String(it.browser).padEnd(10)} ${String(it.reason).padEnd(18)} ${it.count}`);

if (reason) {
  console.log(`\nNewest traces for "${reason}" (t = seconds since page load; oldest event first)`);
  if (!(j.recentTraces || []).length) console.log('  (none with a trace yet — traces only exist on beacons sent after the flight recorder shipped)');
  for (const r of j.recentTraces || []) {
    console.log(`\n  ${r.created_at}  ${r.platform}/${r.browser || '?'}/${r.device || '?'}  kind=${r.kind || '?'}  err=${r.error_code || '-'}  heard=${r.heard}  muted=${r.muted}`);
    for (const ev of r.trace || []) {
      const d = ev.d ? Object.entries(ev.d).map(([k, v]) => `${k}=${v}`).join(' ') : '';
      console.log(`    ${String(ev.t).padStart(7)}  ${ev.e.padEnd(6)} ${d}`);
    }
  }
}

if (!j.total) {
  console.log('\nNothing reported in this window — either everything played cleanly, or nothing was played. The silence watchdog alone takes 25s to fire, so a quiet window on a slow day is not itself a red flag.');
}
