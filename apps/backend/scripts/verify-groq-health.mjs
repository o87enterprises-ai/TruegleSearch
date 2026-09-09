/* TrueGLE / Groq health check — the live one.
 *
 * WHY THIS EXISTS AND NOT JUST `GET /api/ai/health`. That endpoint pings ONCE,
 * through whichever key the pool happens to hand out, and reports "healthy".
 * With keys rotating across several orgs (see GroqKeyPool — Groq meters rate
 * limits per ORG, so keys in one org share a bucket), one healthy ping says
 * nothing about the other orgs: a revoked key or an org parked on a daily
 * limit is invisible until the pool falls through to it mid-request and the
 * answer is a failure the user sees. This checks EVERY key, individually.
 *
 * And it checks the thing that actually breaks silently: WHETHER THE
 * CONFIGURED MODEL STILL EXISTS. Groq retires model ids on its own schedule.
 * A retired id does not degrade — every AI surface in the product (summaries,
 * quick answers, perspective analysis, chat) returns an error at once, and
 * nothing in the config looks wrong. Comparing config against the live
 * /models list is the only way to see it coming.
 *
 * WHAT IT COSTS: the per-key and model checks are GET /models — authenticated
 * but free, no tokens. Only the final end-to-end ping spends anything, and
 * that is one short reply on a free tier. Pass --no-ping to spend nothing.
 *
 * Run it:  npm run groq:health            (from apps/backend)
 *          npm run groq:health -- --no-ping
 *
 * It needs the real keys in the environment, so it runs where they live — a
 * machine with the .env, or `vercel env pull` first. It never prints a key:
 * only the last four characters, which is enough to tell two keys apart in
 * the Groq console and not enough to use.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// config/env.js validates a few unrelated vars at import time. Supply only
// what the module graph needs to load; the real Groq keys must come from the
// actual environment, and are deliberately NOT defaulted here.
process.env.JWT_SECRET ||= 'health-check-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';

const config = require('../config/env.js');

const BASE_URL = 'https://api.groq.com/openai/v1';
const NO_PING = process.argv.includes('--no-ping');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const ok = [];
const bad = [];
const warn = [];
const pass = (l, e = '') => ok.push(`${c.green('PASS')} ${l}${e ? c.dim(` — ${e}`) : ''}`);
const fail = (l, e = '') => bad.push(`${c.red('FAIL')} ${l}${e ? c.dim(` — ${e}`) : ''}`);
const note = (l, e = '') => warn.push(`${c.yellow('WARN')} ${l}${e ? c.dim(` — ${e}`) : ''}`);

/** Did GROQ write this error, or did something between us and Groq? Groq's
 *  API answers in JSON with an `error` object; a proxy refusing to tunnel the
 *  host answers in prose. The distinction decides whether the fix is a new key
 *  or a network allowlist, so it must not be guessed from the status code. */
function looksLikeGroq(body) {
  try { return !!JSON.parse(body)?.error; } catch { return false; }
}

/** Never the key itself. Enough to identify it in the Groq console, useless
 *  to anyone reading a terminal over a shoulder or a pasted log. */
const tail = (key) => `…${String(key).slice(-4)}`;

const groq = config.ai?.groq || {};
const orgs = groq.orgs || [];
const keyCount = orgs.reduce((n, o) => n + (o.keys?.length || 0), 0);

console.log(c.bold('\nTrueGLE / Groq health check'));
console.log(c.dim(`${new Date().toISOString()}  ·  ${BASE_URL}\n`));

// ── 0. what is even configured ──────────────────────────────────────────────
// Printed before anything is called, because "0 keys" explains every failure
// below it and is by far the most common cause of "the AI stopped working".
console.log(c.bold('Configuration'));
console.log(`  text model   : ${groq.model || c.red('(unset)')}`);
console.log(`  vision model : ${groq.visionModel || c.dim('(unset)')}`);
console.log(`  reasoning    : ${groq.reasoningEffort || c.dim('(default)')}`);
console.log(`  orgs / keys  : ${orgs.length} org(s), ${keyCount} key(s)`);
// NEPHESH_BASE_URL set means the self-hosted model is meant to answer FIRST and
// Groq is only the fallback — worth saying out loud, because a healthy Groq
// then tells you nothing about whether the product's actual engine is up.
console.log(`  self-host    : ${config.ai?.nephesh?.baseUrl
  ? `${c.yellow('NEPHESH_BASE_URL set')} — TrueGLE answers first, Groq is fallback`
  : 'unset — Groq is the live engine for every AI surface'}`);
console.log();

if (!keyCount) {
  console.log(c.red('No Groq keys in this environment — nothing to check.\n'));
  console.log('This script reads the same config the server does, so run it where the');
  console.log('keys live: a machine with the backend .env, or `vercel env pull` first.');
  console.log(c.dim('\n(GROQ_ORG_n_KEYS / GROQ_API_KEYS / GROQ_API_KEY — see config/env.js)\n'));
  process.exit(1);
}

/** One authenticated GET /models. Free — no tokens — so it can be run per key
 *  without the check itself costing quota. Returns the parsed body on 200 and
 *  the status on anything else; a thrown network error is its own case,
 *  because "the key is bad" and "we could not reach Groq at all" are different
 *  problems with different fixes. */
async function probe(key) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    const ms = Date.now() - started;
    if (res.ok) return { ok: true, ms, body: await res.json() };
    return {
      ok: false, ms, status: res.status,
      retryAfter: res.headers.get('retry-after'),
      body: await res.text().catch(() => ''),
    };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, network: true, message: error.message };
  }
}

// ── 1. every key, one at a time ─────────────────────────────────────────────
// Individually, not through the pool: the pool's whole job is to hide a dead
// key by falling through to a live one, which is right in production and
// exactly wrong here.
console.log(c.bold('Keys'));
let liveModels = null;
for (const org of orgs) {
  for (const key of org.keys) {
    const label = `${org.label} ${tail(key)}`;
    const r = await probe(key);
    if (r.ok) {
      liveModels ||= r.body;
      pass(`${label} authenticates`, `${r.ms}ms`);
      console.log(`  ${c.green('●')} ${label} ${c.dim(`${r.ms}ms`)}`);
    } else if (r.network) {
      // Not the key's fault, and not something a new key would fix.
      fail(`${label} — could not reach Groq`, r.message);
      console.log(`  ${c.red('●')} ${label} ${c.dim(`network: ${r.message}`)}`);
    } else if (r.status === 429) {
      // A live key that is simply out of quota. Its org is parked, not broken —
      // the pool handles this correctly, so it is a warning, not a failure.
      note(`${label} is rate-limited`, `retry-after ${r.retryAfter || 'unspecified'}`);
      console.log(`  ${c.yellow('●')} ${label} ${c.dim(`429, retry-after ${r.retryAfter || '?'}`)}`);
    } else if (r.status === 403 && !looksLikeGroq(r.body)) {
      // A 403 that Groq did not write. Corporate proxies and sandboxed CI
      // return this for a host they will not tunnel, and reading it as a dead
      // key sends you to the Groq console to replace a key that is fine —
      // which is the wrong fix for a problem that is not even in this account.
      fail(`${label} — blocked before it reached Groq (403 from something in between)`,
        r.body.slice(0, 160));
      console.log(`  ${c.red('●')} ${label} ${c.dim('403 from a proxy, not from Groq')}`);
    } else if (r.status === 401 || r.status === 403) {
      // Revoked or mistyped. This one never comes back on its own.
      fail(`${label} is rejected (${r.status}) — revoked or wrong`, r.body.slice(0, 120));
      console.log(`  ${c.red('●')} ${label} ${c.dim(`${r.status} rejected`)}`);
    } else {
      fail(`${label} returned ${r.status}`, r.body.slice(0, 120));
      console.log(`  ${c.red('●')} ${label} ${c.dim(String(r.status))}`);
    }
  }
}
console.log();

// ── 2. does the model we are configured to call still exist ─────────────────
// The silent killer. A retired id does not degrade gracefully: every AI
// surface fails at once and the config still looks correct.
console.log(c.bold('Models'));
if (!liveModels) {
  fail('could not read the model list — no key authenticated');
  console.log(`  ${c.red('●')} skipped, no working key\n`);
} else {
  const ids = (liveModels.data || []).map((m) => m.id);
  console.log(`  ${c.dim(`${ids.length} model(s) available to this account`)}`);
  for (const [what, id] of [['text', groq.model], ['vision', groq.visionModel]]) {
    if (!id) { note(`no ${what} model configured`); continue; }
    if (ids.includes(id)) {
      pass(`${what} model "${id}" is live`);
      console.log(`  ${c.green('●')} ${what}: ${id}`);
    } else {
      // Name the nearest surviving relatives — a retirement usually has an
      // obvious successor, and the fix is a one-line env change.
      const stem = id.split(/[/-]/)[0];
      const near = ids.filter((m) => m.includes(stem)).slice(0, 5);
      fail(`${what} model "${id}" is NOT in this account's model list — retired or renamed`,
        near.length ? `closest available: ${near.join(', ')}` : 'no similar id offered');
      console.log(`  ${c.red('●')} ${what}: ${id} ${c.red('MISSING')}`);
      if (near.length) console.log(`      ${c.dim(`closest: ${near.join(', ')}`)}`);
    }
  }
}
console.log();

// ── 3. end to end, through the real service ─────────────────────────────────
// The only step that spends tokens, and the only one that proves the thing the
// product actually does: the pool, the model, the reasoning-effort handling
// and the attribution stamp, in one call.
if (NO_PING) {
  console.log(c.dim('Skipping the end-to-end ping (--no-ping).\n'));
} else {
  console.log(c.bold('End to end'));
  const GroqService = require('../services/GroqService.js');
  const svc = new GroqService();
  const started = Date.now();
  try {
    const answer = await svc.chat('Reply with the single word: ok', { max_tokens: 256 });
    const ms = Date.now() - started;
    const text = String(answer || '').trim();
    if (text) {
      pass('a real chat completion came back', `${ms}ms`);
      console.log(`  ${c.green('●')} ${ms}ms  ${c.dim(JSON.stringify(text.slice(0, 60)))}`);
      // Latency is a health signal in its own right: the promotion gate in the
      // inference skill asks for < 3s p95 on summaries, and a free tier under
      // load is the usual reason that slips.
      if (ms > 3000) note('slower than the 3s target for summaries', `${ms}ms`);
    } else {
      // A reasoning model can burn its whole completion budget thinking and
      // return nothing. GroqService throws on that; an empty string here would
      // mean that guard has regressed.
      fail('the completion came back empty', `${ms}ms`);
    }
  } catch (error) {
    fail('the end-to-end chat failed', error.message);
    console.log(`  ${c.red('●')} ${error.message}`);
  }
  console.log();
}

// ── verdict ─────────────────────────────────────────────────────────────────
console.log([...ok, ...warn, ...bad].join('\n'));
const liveKeys = ok.filter((l) => l.includes('authenticates')).length;
console.log(`\n${ok.length} passed, ${warn.length} warning(s), ${bad.length} failed`);
console.log(`${liveKeys} of ${keyCount} key(s) answering\n`);
process.exit(bad.length ? 1 : 0);
