/* Ask the TrueCode endpoint what shape it speaks, and print the env to use.
 *
 * WHY: TrueCodeService can talk three request shapes, because the endpoint is
 * the owner's own build and its contract was not observable from the machine
 * that wrote the service (that environment's network policy blocks every
 * outbound host). Rather than guess and ship something that silently fails
 * over, this asks the live service directly.
 *
 * It sends a trivial prompt down each plausible path/format combination and
 * reports the first that returns usable text, then prints the exact settings.
 *
 *   node scripts/probe-truecode.mjs https://truecode-xxxx.onrender.com
 *   npm run truecode:probe -- https://truecode-xxxx.onrender.com
 *
 * Nothing is written anywhere; it only tells you what to set.
 *
 * NOTE ON COLD STARTS: a free Render dyno sleeps, and the first request can
 * take the better part of a minute to wake it. A timeout here is not
 * necessarily a wrong path — the run warms the service up, so try twice before
 * concluding a combination does not work.
 */
import { createRequire } from 'node:module';

process.env.JWT_SECRET ||= 'test-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
process.env.GOOGLE_API_KEY ||= 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID ||= 'test-only';

const require = createRequire(import.meta.url);
const TrueCodeService = require('../services/TrueCodeService.js');

const base = (process.argv[2] || process.env.TRUECODE_URL || '').replace(/\/+$/, '');
if (!base) {
  console.error('Usage: node scripts/probe-truecode.mjs <base-url>');
  process.exit(64);
}
const apiKey = process.env.TRUECODE_API_KEY || '';
const model = process.env.TRUECODE_MODEL || '';
const TIMEOUT = Number(process.env.TRUECODE_TIMEOUT) || 60000;

// Known-good first: a run against the live service found POST /chat + `prompt`.
// Ordering it first means a re-probe confirms the working combination in one
// request instead of waking the dyno with a dozen 404s.
const PATHS = ['/chat', '/v1/chat/completions', '/chat/completions', '/api/chat', '/v1/completions', '/generate', '/'];
const FORMAT_ORDER = ['prompt', 'openai', 'message'];

const PROMPT = 'Reply with exactly: TRUECODE OK';

console.log(`Probing ${base}`);
console.log('(a sleeping free dyno can take ~50s to answer the first request)\n');

// Wake it up and see what the root says.
try {
  const r = await fetch(base, { signal: AbortSignal.timeout(TIMEOUT) });
  const body = (await r.text()).slice(0, 160).replace(/\s+/g, ' ');
  console.log(`root: HTTP ${r.status} — ${body || '(empty)'}\n`);
} catch (e) {
  console.log(`root: unreachable — ${e.message}\n`);
}

const build = (format, msgs) => {
  const svc = new TrueCodeService();
  svc.baseUrl = base; svc.format = format; svc.model = model;
  return svc.buildBody(msgs, { system: 'You are a test harness.', temperature: 0.2, max_tokens: 64 });
};

let winner = null;
for (const path of PATHS) {
  for (const format of FORMAT_ORDER) {
    const body = build(format, [{ role: 'user', content: PROMPT }]);
    try {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const raw = await res.text();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
      const content = TrueCodeService.extract(parsed);
      const label = `${path.padEnd(24)} ${format.padEnd(8)} HTTP ${res.status}`;
      if (res.ok && content) {
        console.log(`✓ ${label} → ${JSON.stringify(String(content).slice(0, 70))}`);
        if (!winner) winner = { path, format };
      } else {
        console.log(`✗ ${label} ${res.ok ? '(no usable content)' : ''} ${String(raw).slice(0, 70).replace(/\s+/g, ' ')}`);
      }
    } catch (e) {
      console.log(`✗ ${path.padEnd(24)} ${format.padEnd(8)} ${e.message}`);
    }
  }
}

console.log('');
if (!winner) {
  console.log('No combination returned usable text.');
  console.log('If everything timed out, the dyno may still have been waking — run it again.');
  console.log('If everything 404d, the service uses a path not in the list; add it to PATHS.');
  process.exit(1);
}

console.log('Set these (Vercel env for the backend, and .env locally):\n');
console.log(`  TRUECODE_URL=${base}`);
console.log(`  TRUECODE_PATH=${winner.path}`);
console.log(`  TRUECODE_FORMAT=${winner.format}`);
if (model) console.log(`  TRUECODE_MODEL=${model}`);
if (apiKey) console.log('  TRUECODE_API_KEY=<the key you probed with>');
console.log('\nOnce set, TrueCode joins the provider chain LAST — it only sees questions');
console.log('the other providers refused, and it runs before the conceptual fallback.');
