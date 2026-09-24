/**
 * GroqService - Groq LPU Inference (OpenAI-compatible)
 * Free tier: https://console.groq.com — no credit card required.
 * Keys come from GroqKeyPool, which tapers requests round-robin across Groq
 * ORGS — the unit rate limits are actually metered on — and parks a whole org
 * for as long as its retry-after asks after a 429.
 */
const axios = require('axios');
const config = require('../config/env');
const keyPool = require('./GroqKeyPool');
const logger = require('../utils/logger');

class GroqService {
  constructor() {
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.defaultModel = config.ai.groq?.model || 'openai/gpt-oss-120b';
    // THE FALLBACK CHAIN. GROQ_MODEL is tried first, then these, in order —
    // all free-tier models Groq itself names as successors to the ones it
    // retired. A model Groq reports as gone is struck off for the life of the
    // process (see deadModels), so one retirement can never again take every
    // AI surface down the way llama-3.3-70b-versatile did.
    this.fallbackModels = config.ai.groq?.fallbackModels?.length
      ? config.ai.groq.fallbackModels
      : ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
    this.deadModels = new Set();
    // Free-tier TPM for every Groq chat model is 8K, and Groq counts the whole
    // request — prompt PLUS the max_tokens you reserve — against it. A request
    // over the cap is refused with 413 before it runs.
    this.requestTokenBudget = Number(config.ai.groq?.requestTokenBudget) || 8000;

    logger.info(`GroqService initialized with ${keyPool.size} key(s) across ${keyPool.orgCount} org(s)`);
  }

  isAvailable() {
    return keyPool.isAvailable();
  }

  /**
   * gpt-oss reasons before it answers, and bills you for the thinking. Left
   * unset it spent 235 of 251 completion tokens deliberating over a six-word
   * reply; 'low' does the same job in ~50. Other Groq models reject the
   * parameter outright, so it only goes to the ones that take it.
   */
  reasoningFor(model) {
    if (!/^openai\/gpt-oss/.test(model)) return {};
    return { reasoning_effort: config.ai.groq?.reasoningEffort || 'low' };
  }

  /** Models to try for this request, in order, minus any Groq has retired. */
  modelChain(requested) {
    // An explicit model (the vision model, a test) is a capability choice, not
    // a preference — never swap it for a text-only fallback.
    const chain = requested ? [requested] : [this.defaultModel, ...this.fallbackModels];
    return [...new Set(chain)].filter(m => !this.deadModels.has(m));
  }

  /**
   * Rough token count for a message list — ~3.5 chars per token, deliberately
   * pessimistic so a request that "fits" here really fits Groq's meter.
   */
  estimateTokens(messages) {
    let chars = 0;
    for (const m of messages) {
      const c = m.content;
      if (typeof c === 'string') chars += c.length;
      else if (Array.isArray(c)) for (const part of c) if (part?.type === 'text') chars += (part.text || '').length;
      chars += 16; // role + framing
    }
    return Math.ceil(chars / 3.5);
  }

  /**
   * FIT THE REQUEST TO THE FREE TIER instead of sending it to be refused.
   * Shrinks the reply reservation first, then drops the oldest chat history.
   * Never touches the system prompt or the question itself. Returns null when
   * even that is too big — the caller fails over rather than eat a 413.
   */
  fitToBudget(formatted, max_tokens) {
    const MIN_REPLY = 600; // reasoning (~50 at 'low') plus a real answer
    const msgs = [...formatted];
    const room = () => this.requestTokenBudget - this.estimateTokens(msgs) - 64;
    // History = everything that is not a system message and not the final turn.
    while (room() < MIN_REPLY) {
      const i = msgs.findIndex((m, idx) => m.role !== 'system' && idx < msgs.length - 1);
      if (i === -1) return null;
      msgs.splice(i, 1);
    }
    return { messages: msgs, max_tokens: Math.min(max_tokens, room()) };
  }

  /** Groq's own explanation for a failed call, for the log. Never key material. */
  errorDetail(error) {
    const e = error.response?.data?.error;
    return (e && (e.message || e.code)) || error.message;
  }

  /** Does this failure mean the MODEL is gone (rather than the key or the request)? */
  isModelGone(error) {
    const status = error.response?.status;
    const e = error.response?.data?.error || {};
    const text = `${e.code || ''} ${e.message || ''}`;
    return status === 404 || /model_not_found|model_decommissioned|decommissioned|does not exist|no longer supported/i.test(text);
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable()) throw new Error('Groq API key not configured');

    const {
      model: requestedModel,
      temperature = 0.7,
      max_tokens = 1024,
      system = null,
    } = options;

    const formatted = typeof messages === 'string'
      ? [{ role: 'user', content: messages }]
      : [...messages];
    // SENT ONCE. UnifiedAIService already puts the system prompt at the head
    // of `messages` AND passes it as `system`; prepending it again doubled the
    // ~5K-token prompt, which alone blew the 8K free-tier cap and got every
    // real chat refused while the tiny health ping kept reporting "healthy".
    if (system && !formatted.some(m => m.role === 'system')) {
      formatted.unshift({ role: 'system', content: system });
    }

    const fitted = this.fitToBudget(formatted, max_tokens);
    if (!fitted) {
      throw new Error(`Groq free tier: request is ~${this.estimateTokens(formatted)} tokens, over the ${this.requestTokenBudget}-token cap even without history`);
    }

    const chain = this.modelChain(requestedModel);
    if (!chain.length) throw new Error('Groq: every configured model has been retired');

    let lastError = null;
    for (const model of chain) {
      try {
        return await this.chatWithModel(model, fitted.messages, { temperature, max_tokens: fitted.max_tokens });
      } catch (error) {
        lastError = error;
        if (error.modelGone) {
          this.deadModels.add(model);
          logger.error(`Groq model ${model} is gone, falling back to the next one: ${error.message}`);
          continue;
        }
        // A 429 on one model says nothing about the next: Groq meters every
        // model separately, so the next model has its own fresh allowance.
        if (error.rateLimited) continue;
        throw error;
      }
    }
    throw lastError;
  }

  /** One model, walking the key pool. Throws with .modelGone / .rateLimited set when relevant. */
  async chatWithModel(model, formatted, { temperature, max_tokens }) {
    // Walk the orgs in round-robin order. A 429 rules out an org for the rest
    // of this model's attempt; a 401 only rules out the one key, so its
    // org-mates stay in play. Bounded by orgs + keys.
    const triedOrgs = new Set();
    let sawRateLimit = false;

    for (;;) {
      const lease = keyPool.acquire(triedOrgs, model);
      if (!lease) {
        const cooling = keyPool.stats().coolingOrgs > 0;
        const err = new Error(sawRateLimit || cooling
          ? 'All Groq API keys are rate-limited'
          : 'All Groq API keys exhausted');
        err.rateLimited = sawRateLimit || cooling;
        throw err;
      }

      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          { model, messages: formatted, temperature, max_tokens, stream: false, ...this.reasoningFor(model) },
          {
            headers: {
              'Authorization': `Bearer ${lease.key}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        const choice = response.data.choices?.[0] || {};
        const content = choice.message?.content || '';

        // A reasoning model that runs out of budget mid-thought returns an empty
        // content string with finish_reason 'length' — a 200 OK carrying nothing.
        // Silently passing that up the stack ships a blank answer to the user, so
        // throw instead and let the failover chain try another provider.
        if (!content && choice.finish_reason === 'length') {
          throw new Error(
            `Groq returned no content: ${model} spent the whole ${max_tokens}-token budget reasoning. Raise max_tokens or lower GROQ_REASONING_EFFORT.`
          );
        }

        return {
          content,
          model: response.data.model || model,
          usage: response.data.usage,
          finishReason: choice.finish_reason,
          provider: 'groq',
        };

      } catch (error) {
        const status = error.response?.status;
        if (!status) throw error; // our own empty-content error, or the network
        logger.warn(`Groq org[${lease.org}] key[${lease.index}] ${model} failed:`, { status, detail: this.errorDetail(error) });

        if (status === 401 || status === 403) {
          keyPool.disable(lease.org, lease.index, `HTTP ${status}`);
          continue;
        }

        if (status === 429) {
          // Park this org for THIS model only — Groq meters per model, so
          // the fallback models still have their own allowance.
          keyPool.cool(lease.org, error.response?.headers?.['retry-after'], model);
          sawRateLimit = true;
          triedOrgs.add(lease.org);
          continue;
        }

        const err = new Error(`Groq service error (${model}, HTTP ${status}): ${this.errorDetail(error)}`, { cause: error });
        err.modelGone = this.isModelGone(error);
        throw err;
      }
    }
  }

  async analyzeContent(content, queryContext = null, options = {}) {
    const systemPrompt = options.system || null;
    const queryLine = queryContext ? `User Query Context: ${queryContext}\n\n` : '';
    const userPrompt = systemPrompt
      ? content
      : `${queryLine}Analyze the following content and summarize the primary perspectives, their core arguments, and relevant perspective labels.\n\nContent:\n${content}`;
    return this.chat(userPrompt, { ...options, system: systemPrompt });
  }

  async healthCheck() {
    if (!this.isAvailable()) return { status: 'unavailable', message: 'No API key', provider: 'groq' };
    try {
      // 5 tokens was fine for Llama, but a reasoning model spends ~50 thinking
      // before it writes anything — the ping would fail on its own budget while
      // the service was perfectly healthy. Enough headroom to think and answer.
      await this.chat('ping', { max_tokens: 256 });
      return { status: 'healthy', provider: 'groq', keys: keyPool.stats() };
    } catch (error) {
      return { status: 'unhealthy', message: error.message, provider: 'groq', keys: keyPool.stats() };
    }
  }
}

module.exports = GroqService;
