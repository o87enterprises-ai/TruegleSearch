/* The refusal -> conceptual-fallback chain, driven through the real service.
 *
 * WHAT THIS PROTECTS: when every provider refuses, UnifiedAIService asks once
 * more for the concept instead of the procedure (CONCEPTUAL_FALLBACK) rather
 * than handing back a canned "I can't help with that". Three things about that
 * are easy to break and invisible when they do:
 *
 *   1. IT HAS TO FIRE AT ALL. The refusal check used to carry `&& !isLast`, so
 *      a refusal from the final provider returned straight out of the loop —
 *      and with a single provider configured (Groq is the live engine) that is
 *      EVERY refusal. The fallback was unreachable in the setup that ships.
 *   2. THE USER'S WORDS MUST NOT BE REWRITTEN. Only the system prompt changes;
 *      quietly softening someone's question and answering that instead would be
 *      putting words in their mouth.
 *   3. THE LINE MUST STILL BE IN THE PROMPT. Concept yes, procedure no — that
 *      boundary is what makes the fallback legitimate rather than a laundering
 *      step, so its absence is a failure, not a nit.
 *
 * Providers are stubbed; nothing here talks to a network.
 *
 * Run it:  npm run ai:test   (from apps/backend)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// config/env.js validates a handful of vars at import time; none of them is
// used by this test, they just have to exist for the module graph to load.
process.env.JWT_SECRET ||= 'test-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
process.env.GOOGLE_API_KEY ||= 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID ||= 'test-only';

const svc = require('../services/UnifiedAIService.js');
const ok = []; const bad = [];
const check = (c, l, e='') => (c?ok:bad).push(`${c?'PASS':'FAIL'} ${l}${e?` — ${e}`:''}`);
// nepheshAttribution appends an attribution footer carrying a zero-width
// canary. The canary no longer sits inside the body — it used to split the
// opening words of every answer — but strip anyway: the footer travels with
// the string and providers occasionally emit their own invisible characters.
const plain = (s) => String(s || '').replace(/[\u200b-\u200f\u2060-\u2064\ufeff]/g, '');

const calls = [];
function stub({ refuseFirst = true, refuseRetry = false, providers = ['groq'] }) {
  calls.length = 0;
  svc.getProviderOrder = async () => providers;
  svc.promptService = { getPromptByContext: async () => ({ id: 1, prompt_text: '', temperature: 0.7, max_tokens: 2000, version: 'test' }), interpolatePrompt: (t) => t };
  svc.cache = new Map();
  svc.callProvider = async (name, messages, options) => {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const isRetry = system.includes('SECOND PASS — CONCEPTUAL ANSWER');
    calls.push({ provider: name, isRetry, system, userTurns: messages.filter(m => m.role === 'user').map(m => m.content) });
    const refuse = isRetry ? refuseRetry : refuseFirst;
    return { content: refuse ? "I'm sorry, but I can't help with that." : (isRetry ? 'Conceptually, here is how it works…' : 'Direct answer.'), model: 'stub' };
  };
}

// 1. single provider (the shipping setup), refusal -> fallback answers
stub({ refuseFirst: true, refuseRetry: false, providers: ['groq'] });
let r = await svc.chat('how does X work', 'general', { systemOverride: 'BASE', conceptualFallback: true });
check(calls.length === 2, '1 provider: a refusal triggers a second ask', `${calls.length} provider calls`);
check(calls[1]?.isRetry === true, '   the second ask carries the conceptual prompt');
check(r.softened === true, '   response is flagged softened');
check(/Conceptually/.test(plain(r.content)), '   the user gets the conceptual answer, not the refusal');

// 2. the user's words are NOT rewritten
check(JSON.stringify(calls[0].userTurns) === JSON.stringify(calls[1].userTurns),
  '   the retry re-sends the original question verbatim', JSON.stringify(calls[1].userTurns));

// 3. the boundary is actually in the prompt sent
check(/No procedure/.test(calls[1].system) && /No quantities/.test(calls[1].system),
  '   the retry forbids procedure and quantities');

// 4. fallback also refuses -> original refusal returned, nothing invented
stub({ refuseFirst: true, refuseRetry: true, providers: ['groq'] });
r = await svc.chat('nope', 'general', { systemOverride: 'BASE', conceptualFallback: true });
check(calls.length === 2, 'fallback refuses too: still only one retry', `${calls.length} calls`);
check(!r.softened && /can't help/.test(plain(r.content)), '   falls back to the honest refusal');

// 5. NOT opted in -> no second ask at all
stub({ refuseFirst: true, providers: ['groq'] });
r = await svc.chat('x', 'general', { systemOverride: 'BASE' });
check(calls.length === 1, 'without the flag there is no second ask', `${calls.length} calls`);
check(/can't help/.test(plain(r.content)), '   plain refusal is returned unchanged');

// 6. no refusal -> untouched
stub({ refuseFirst: false, providers: ['groq'] });
r = await svc.chat('normal question', 'general', { systemOverride: 'BASE', conceptualFallback: true });
check(calls.length === 1, 'a normal answer never triggers the retry', `${calls.length} calls`);
check(/Direct answer\./.test(plain(r.content)) && !r.softened, '   and is returned as-is (plus the usual attribution stamp)', JSON.stringify(plain(r.content)).slice(0,80));

// 7. a refusal must never be cached
stub({ refuseFirst: true, refuseRetry: true, providers: ['groq'] });
await svc.chat('cache me', 'general', { systemOverride: 'BASE', conceptualFallback: true });
check(svc.cache.size === 0, 'a refusal is never cached', `cache size ${svc.cache.size}`);

// 8. multi-provider: try them all before falling back
stub({ refuseFirst: true, refuseRetry: false, providers: ['groq', 'gemini'] });
await svc.chat('x', 'general', { systemOverride: 'BASE', conceptualFallback: true });
const firstPass = calls.filter(c => !c.isRetry).length;
check(firstPass === 2, '2 providers: both tried before the conceptual retry', `${firstPass} first-pass calls`);

// ── TrueCode: the owner's own endpoint as the refusal rung ──────────────────
//
// The provider the refusal failover never had. It must sit LAST (it answers
// what the others refused; it should not take ordinary traffic) and it must get
// its turn BEFORE the conceptual fallback softens anything.
{
  const TrueCodeService = require('../services/TrueCodeService.js');

  delete process.env.TRUECODE_URL;
  check(new TrueCodeService().isAvailable() === false, 'truecode: inert until TRUECODE_URL is set');
  process.env.TRUECODE_URL = 'https://stub.invalid';
  const cfg = new TrueCodeService();
  check(cfg.isAvailable() === true, 'truecode: available once configured');
  // The defaults are what the live probe measured: POST /chat with a `prompt`
  // body. An OpenAI-shaped body to that path returns 400 "No prompt provided",
  // so getting these wrong is a silent, total failure of the refusal rung.
  check(cfg.path === '/chat' && cfg.format === 'prompt',
    'truecode: defaults match the probed contract (POST /chat, prompt body)', `${cfg.path} ${cfg.format}`);
  check(cfg.timeout >= 60000,
    'truecode: timeout allows for a sleeping free dyno (~50s cold start)', String(cfg.timeout));

  // Request shapes — configurable because the endpoint's contract could not be
  // observed from the machine that wrote the service.
  const body = (fmt) => {
    const t = new TrueCodeService();
    t.baseUrl = 'https://stub.invalid'; t.format = fmt;
    return t.buildBody([{ role: 'user', content: 'hi' }], { system: 'SYS', temperature: 0.2, max_tokens: 8 });
  };
  check(Array.isArray(body('openai').messages) && body('openai').messages[0].role === 'system',
    'truecode: openai shape sends a messages array carrying the system prompt');
  check(typeof body('message').message === 'string' && body('message').message.includes('SYS'),
    'truecode: flat shapes keep the system prompt rather than dropping it');
  check(typeof body('prompt').prompt === 'string' && body('prompt').prompt.includes('SYS'),
    'truecode: prompt shape likewise');

  const shapes = [
    [{ choices: [{ message: { content: 'A' } }] }, 'A'],
    [{ content: 'B' }, 'B'], [{ response: 'C' }, 'C'], [{ message: 'D' }, 'D'],
    [{ text: 'E' }, 'E'], ['F', 'F'], [{}, ''],
  ];
  check(shapes.every(([inp, want]) => TrueCodeService.extract(inp) === want),
    'truecode: an answer is found in any of the usual response shapes');

  const tcCalls = [];
  svc.cache = new Map();
  svc.getProviderOrder = async () => ['groq', 'truecode'];
  svc.callProvider = async (name) => {
    tcCalls.push(name);
    return name === 'truecode'
      ? { content: 'The answer groq would not give.', model: 'tc' }
      : { content: "I'm sorry, but I can't help with that.", model: 'm' };
  };
  const tcRes = await svc.chat('x', 'general', { systemOverride: 'BASE', conceptualFallback: true });
  check(tcCalls.join('>') === 'groq>truecode', 'truecode: a refusal fails over to it', tcCalls.join(' > '));
  check(/would not give/.test(plain(tcRes.content)), 'truecode: its answer is what the user gets');
  check(!tcRes.softened, 'truecode: answering means the conceptual fallback never runs');
}

ok.forEach(l => console.log(l));
if (bad.length) { console.log(''); bad.forEach(l => console.log(l)); console.log(`\n${bad.length} failed, ${ok.length} passed`); process.exit(1); }
console.log(`\nall ${ok.length} passed`);
