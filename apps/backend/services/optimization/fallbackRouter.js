/**
 * Fallback router (state-machine) — the DeepSeek plan's Part 2, on the real
 * Node stack.
 *
 * Priority-ordered AI providers with a per-run circuit breaker and a
 * Postgres-backed daily quota check, so the autopilot engine:
 *   - stays $0 (free tiers only: Groq → Gemini → NVIDIA),
 *   - survives a rate-limited/broken provider by failing over,
 *   - yields free-tier headroom to live user traffic (quota soft cap).
 *
 * It REUSES the existing provider services (GroqService already rotates its 5
 * keys on 429) rather than reimplementing HTTP, and it deliberately calls them
 * directly — NOT through UnifiedAIService — so the authored content does not
 * get the user-facing "Research Provided by TrueGLE" attribution stamped into
 * it. The AI substrate and its prompts are untouched.
 */

const config = require('./config');
const quota = require('./quotaTracker');
const log = require('./log');

class FallbackRouter {
  /**
   * @param {Array<{name:string, service:object}>} [injected] — for tests;
   *        when omitted, providers are loaded from config.PROVIDERS.
   */
  constructor(injected) {
    this.providers = injected || FallbackRouter.loadProviders();
    this.failures = Object.create(null); // name -> failure count (per run)
  }

  static loadProviders() {
    const out = [];
    for (const p of config.PROVIDERS) {
      try {
        const Svc = require(p.module);
        const service = new Svc();
        if (typeof service.isAvailable === 'function' && service.isAvailable()) {
          out.push({ name: p.name, service });
        } else {
          log.info(`provider ${p.name} not configured — skipping`);
        }
      } catch (e) {
        // config/env validation or missing key → provider simply unavailable
        log.info(`provider ${p.name} unavailable (${e.message}) — skipping`);
      }
    }
    return out;
  }

  available() {
    return this.providers.map((p) => p.name);
  }

  isOpen(name) {
    return (this.failures[name] || 0) >= config.CIRCUIT.FAILURE_THRESHOLD;
  }

  /**
   * Run one completion through the chain. Returns { content, provider }.
   * Throws only when every provider is exhausted/over-quota/broken.
   */
  async complete(messages, { system = null } = {}) {
    if (this.providers.length === 0) {
      throw new Error('No AI providers available (set GROQ_API_KEY / GEMINI_API_KEY)');
    }

    const opts = {
      system,
      temperature: config.GENERATION.temperature,
      max_tokens: config.GENERATION.max_tokens, // Groq / OpenAI-style
      maxOutputTokens: config.GENERATION.max_tokens, // Gemini-style
    };

    let lastError = null;
    for (const { name, service } of this.providers) {
      if (this.isOpen(name)) {
        log.info(`circuit open for ${name} — skipping`);
        continue;
      }
      if (await quota.isExceeded(name, config.QUOTA.DAILY_SOFT_CAP)) {
        log.info(`daily quota reached for ${name} — skipping to preserve live-traffic headroom`);
        continue;
      }

      try {
        const res = await service.chat(messages, opts);
        const content = (res && res.content) || '';
        if (!content.trim()) throw new Error('empty completion');
        await quota.record(name, 1);
        log.ok(`generated via ${name}`);
        return { content, provider: name };
      } catch (e) {
        lastError = e;
        this.failures[name] = (this.failures[name] || 0) + 1;
        log.warn(`${name} failed (${e.message}) — failing over`);
      }
    }

    throw new Error(`All AI providers failed. Last error: ${lastError ? lastError.message : 'none available'}`);
  }
}

module.exports = FallbackRouter;
