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
    this.defaultModel = config.ai.groq?.model || 'llama-3.3-70b-versatile';

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

  async chat(messages, options = {}) {
    if (!this.isAvailable()) throw new Error('Groq API key not configured');

    const {
      model = this.defaultModel,
      temperature = 0.7,
      max_tokens = 1024,
      system = null,
    } = options;

    const formatted = [];
    if (system) formatted.push({ role: 'system', content: system });

    if (typeof messages === 'string') {
      formatted.push({ role: 'user', content: messages });
    } else {
      formatted.push(...messages);
    }

    // Walk the orgs in round-robin order. A 429 rules out an org for the rest
    // of this request; a 401 only rules out the one key, so its org-mates stay
    // in play. Each pass either cools an org or disables a key, both finite,
    // so the loop is bounded by orgs + keys.
    const triedOrgs = new Set();

    for (;;) {
      const lease = keyPool.acquire(triedOrgs);
      if (!lease) {
        // Nothing left to lease: if an org is only cooling down, this is a
        // rate limit and the caller should fail over rather than retry Groq.
        throw new Error(keyPool.stats().coolingOrgs > 0
          ? 'All Groq API keys are rate-limited'
          : 'All Groq API keys exhausted');
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
        logger.warn(`Groq org[${lease.org}] key[${lease.index}] failed:`, { status });

        if (status === 401 || status === 403) {
          keyPool.disable(lease.org, lease.index, `HTTP ${status}`);
          continue;
        }

        if (status === 429) {
          keyPool.cool(lease.org, error.response?.headers?.['retry-after']);
          triedOrgs.add(lease.org);
          continue;
        }

        // Non-recoverable error — throw immediately
        throw new Error(`Groq service error: ${error.message}`, { cause: error });
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
      await this.chat('ping', { max_tokens: 5 });
      return { status: 'healthy', provider: 'groq', keys: keyPool.stats() };
    } catch (error) {
      return { status: 'unhealthy', message: error.message, provider: 'groq', keys: keyPool.stats() };
    }
  }
}

module.exports = GroqService;
