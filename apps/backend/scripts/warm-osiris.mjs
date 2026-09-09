/* Fill the shared OSIRIS cache out of band, so no visitor ever waits on it.
 *
 * ── WHY THIS IS THE FIX AND A BIGGER TIMEOUT IS NOT ─────────────────────────
 *
 * The probe measured three feeds (aircraft, satellites, weather) exceeding
 * even a 25-second timeout against the public host — and weather returned in
 * 10.6s on an earlier run, so it is variable rather than uniformly slow.
 *
 * There is no timeout that fixes that inside a web request. Raising it just
 * moves who suffers: a visitor holding a connection open for a minute, on a
 * platform that will kill the function before it finishes anyway, and an
 * upstream getting one request per cold instance — which is exactly the
 * visitor-correlation the proxy exists to prevent.
 *
 * So the slow fetch is taken OUT of the request path entirely. This runs on a
 * schedule with a timeout no web request would tolerate, writes what it gets
 * into the shared cache (migration 022), and every visitor is then served from
 * that. The upstream sees this job, on its own cadence, and nothing about how
 * many people are looking at the map.
 *
 * Run it:  npm run osiris:warm
 *          OSIRIS_TIMEOUT_MS=180000 npm run osiris:warm     (very slow feeds)
 *          npm run osiris:warm -- flights satellites        (just these)
 *
 * Needs DATABASE_URL, since the whole point is the shared tier. Without it the
 * fetches would land in a per-process memory cache that dies with the process,
 * which is a waste of everyone's time — so it says so and stops.
 *
 * Schedule it wherever you already run scheduled work, at roughly the TTL of
 * the layers you care about. Missing a run is harmless: stale-while-revalidate
 * keeps serving the last good answer.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.JWT_SECRET ||= 'warm-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
// A warmer is not a web request and should not be held to a web request's
// patience. Overridable, but this default is deliberately generous.
process.env.OSIRIS_TIMEOUT_MS ||= '120000';

const osiris = require('../services/OsirisService.js');
const { query } = require('../db/connection.js');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const layers = osiris.listLayers().filter((l) => !wanted.length || wanted.includes(l.id));

console.log(c.bold('\nOSIRIS cache warm'));
console.log(c.dim(`${osiris.BASE_URL}  ·  timeout ${process.env.OSIRIS_TIMEOUT_MS}ms  ·  ${new Date().toISOString()}\n`));

if (!process.env.DATABASE_URL) {
  console.log(c.red('DATABASE_URL is not set.\n'));
  console.log('Warming writes to the SHARED cache (migration 022). Without a database');
  console.log('the fetches would land in this process\'s memory and die with it, which');
  console.log('is slower than not running at all.\n');
  process.exit(1);
}

// Fail early and clearly rather than fetching for two minutes and then finding
// there is nowhere to put it.
try {
  const { rows } = await query("SELECT to_regclass('public.osiris_cache') AS t");
  if (!rows[0]?.t) {
    console.log(c.red('osiris_cache does not exist — run `npm run migrate` first.\n'));
    process.exit(1);
  }
} catch (error) {
  console.log(c.red(`Cannot reach the database: ${error.message}\n`));
  process.exit(1);
}

let warmed = 0;
let failed = 0;

for (const layer of layers) {
  process.stdout.write(`  ${layer.label.padEnd(18)} `);
  const started = Date.now();
  try {
    // getLayer does the fetch, the normalise and the shared write. Asking for
    // the whole world (no bbox) on purpose: the cache holds the full feed and
    // per-request bounding boxes are applied on read, so one warm serves every
    // viewport rather than only the one this job happened to ask about.
    const fc = await osiris.getLayer(layer.id, { limit: 5000 });
    const ms = Date.now() - started;
    warmed += 1;
    console.log(`${c.green('●')} ${fc.meta.returned}/${fc.meta.total} ${c.dim(`${(ms / 1000).toFixed(1)}s`)}`
      + (fc.meta.withoutCoords ? c.yellow(`  ${fc.meta.withoutCoords} without coords`) : ''));
  } catch (error) {
    failed += 1;
    const ms = Date.now() - started;
    const why = error.code === 'UNRECOGNISED_SHAPE' ? 'shape not recognised' : error.message;
    console.log(`${c.red('●')} ${c.dim(`${why.slice(0, 70)} (${(ms / 1000).toFixed(1)}s)`)}`);
    if (error.sample) console.log(c.yellow(`      ${JSON.stringify(error.sample)}`));
  }
}

console.log();
const { rows: state } = await query(
  'SELECT layer, fetched_at FROM osiris_cache ORDER BY layer',
).catch(() => ({ rows: [] }));
console.log(c.bold('Shared cache now holds'));
for (const row of state) {
  const age = Math.round((Date.now() - new Date(row.fetched_at).getTime()) / 1000);
  console.log(`  ${row.layer.padEnd(14)} ${c.dim(`${age}s old`)}`);
}
if (!state.length) console.log(c.dim('  (nothing)'));

console.log(`\n${c.green(`${warmed} warmed`)} · ${failed ? c.red(`${failed} failed`) : `${failed} failed`}\n`);

// A feed being down is not this script's failure, and a scheduled job that
// cries wolf gets muted. Only a total wipeout is worth alerting on.
process.exit(warmed === 0 ? 1 : 0);
