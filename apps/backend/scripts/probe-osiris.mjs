/* What do the OSIRIS feeds ACTUALLY return?
 *
 * services/OsirisService.js normalises each feed to GeoJSON by looking for
 * coordinates under a list of candidate field names, because the real shapes
 * could not be verified where that file was written — this sandbox cannot
 * reach osirisai.live. Candidate lists are a reasonable way to survive an
 * unknown shape; they are a bad way to STAY unknown.
 *
 * So: run this from anywhere with network. For each layer it reports whether
 * the service can read it, and when it cannot, prints the keys the feed
 * actually used — which is exactly what has to be added to LAT_KEYS/LON_KEYS/
 * ROWS_KEYS to fix it. One run turns every guess in that file into a fact.
 *
 * Run it:  npm run osiris:probe
 *          OSIRIS_BASE_URL=http://localhost:3000 npm run osiris:probe
 *
 * Reads nothing secret and writes nothing — it is safe to run against any
 * instance, including someone else's.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.JWT_SECRET ||= 'probe-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';

const osiris = require('../services/OsirisService.js');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

console.log(c.bold('\nOSIRIS feed probe'));
console.log(c.dim(`${osiris.BASE_URL}  ·  ${new Date().toISOString()}\n`));

const readable = [];
const unreadable = [];
const unreachable = [];

for (const { id, label } of osiris.listLayers()) {
  process.stdout.write(`  ${label.padEnd(18)} `);
  const started = Date.now();
  try {
    const fc = await osiris.getLayer(id, { limit: 5000 });
    const ms = Date.now() - started;
    const { total, returned, withoutCoords } = fc.meta;
    readable.push(id);
    console.log(`${c.green('●')} ${returned}/${total} features ${c.dim(`${ms}ms`)}`
      + (withoutCoords ? c.yellow(`  ${withoutCoords} without coords`) : ''));
    // The first feature's property keys are what the OSINT filters can filter
    // ON, so they are worth seeing even on a healthy layer.
    const props = Object.keys(fc.features[0]?.properties || {}).filter((k) => !k.startsWith('_'));
    if (props.length) console.log(c.dim(`      fields: ${props.slice(0, 14).join(', ')}`));
  } catch (error) {
    const ms = Date.now() - started;
    if (error.code === 'UNRECOGNISED_SHAPE') {
      unreadable.push({ id, error });
      console.log(`${c.yellow('●')} ${c.yellow('shape not recognised')} ${c.dim(`${ms}ms`)}`);
      console.log(c.dim(`      ${error.message}`));
      // THE ACTIONABLE LINE. These are the keys to add to the candidate lists.
      const sample = error.sample || {};
      for (const [what, keys] of Object.entries(sample)) {
        console.log(c.yellow(`      ${what}: ${(keys || []).join(', ')}`));
      }
    } else {
      unreachable.push({ id, message: error.message });
      console.log(`${c.red('●')} ${c.dim(error.message.slice(0, 90))}`);
    }
  }
}

console.log();
console.log(`${c.green(`${readable.length} readable`)}`
  + `  ·  ${c.yellow(`${unreadable.length} need remapping`)}`
  + `  ·  ${c.red(`${unreachable.length} unreachable`)}`);

if (unreadable.length) {
  console.log(c.bold('\nTo fix the unreadable ones'));
  console.log('Add the field names printed above to LAT_KEYS / LON_KEYS / ROWS_KEYS');
  console.log('in services/OsirisService.js. Nothing else needs to change — the');
  console.log('route, the cache and the map all read whatever the normaliser produces.');
}
console.log();

// Unreachable is not a failure of THIS code: the host may simply be down, and
// exiting non-zero for that would make a scheduled run cry wolf. A shape that
// cannot be read is ours to fix, so that one fails.
process.exit(unreadable.length ? 1 : 0);
