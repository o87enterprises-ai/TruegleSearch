/**
 * TrueCodeService — the owner's own model endpoint, used as the refusal
 * fallback that the substrate providers cannot be.
 *
 * WHY THIS IS THE RIGHT PLACE FOR IT. UnifiedAIService.chat() already fails
 * over on a REFUSAL, not just on an error: when a provider returns a canned
 * "I can't help with that" it moves to the next one and only surrenders when
 * every provider has refused. That machinery has never had anything useful to
 * fail over TO — Groq is the only live substrate and the three rotating keys
 * hit the same model, so a refusal from one is a refusal from all. A separate
 * endpoint with its own behaviour is exactly the missing rung, and registering
 * it here means it is tried BEFORE the conceptual fallback (CONCEPTUAL_FALLBACK)
 * ever has to soften anything.
 *
 * DELIBERATELY LAST in the provider order. This is a fallback, not a primary:
 * ordinary traffic should keep going to the fast substrate, and this should see
 * only the questions that were refused.
 *
 * CONFIGURATION — nothing runs until TRUECODE_URL is set, so an unconfigured
 * deployment behaves exactly as it does today:
 *
 *   TRUECODE_URL      base URL, e.g. https://truecode-xxxx.onrender.com
 *   TRUECODE_PATH     request path (default /v1/chat/completions)
 *   TRUECODE_FORMAT   openai | message | prompt   (default openai)
 *   TRUECODE_MODEL    model name, if the endpoint wants one
 *   TRUECODE_API_KEY  optional bearer token
 *   TRUECODE_TIMEOUT  ms, default 45000 — a cold free-tier dyno is slow to wake
 *
 * The format is a setting rather than an assumption because this endpoint is
 * the owner's own build and its contract was not observable from the machine
 * that wrote this file. `npm run truecode:probe` asks the live service which
 * shape it speaks and prints the exact settings to paste in.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const DEFAULT_TIMEOUT = 45000;

class TrueCodeService {
  constructor() {
    this.baseUrl = (process.env.TRUECODE_URL || '').replace(/\/+$/, '');
    this.path = process.env.TRUECODE_PATH || '/v1/chat/completions';
    this.format = (process.env.TRUECODE_FORMAT || 'openai').toLowerCase();
    this.model = process.env.TRUECODE_MODEL || '';
    this.apiKey = process.env.TRUECODE_API_KEY || '';
    this.timeout = Number(process.env.TRUECODE_TIMEOUT) || DEFAULT_TIMEOUT;
  }

  isAvailable() {
    return !!this.baseUrl;
  }

  /**
   * Build the request body in whichever shape the endpoint speaks.
   * `messages` is the standard [{role, content}] array; the flatter formats get
   * the conversation collapsed into one string, since they have nowhere to put
   * turns.
   */
  buildBody(messages, { system, temperature, max_tokens }) {
    const formatted = [];
    if (system) formatted.push({ role: 'system', content: system });
    if (typeof messages === 'string') formatted.push({ role: 'user', content: messages });
    else formatted.push(...messages);

    if (this.format === 'openai') {
      return {
        ...(this.model ? { model: this.model } : {}),
        messages: formatted,
        temperature,
        max_tokens,
        stream: false,
      };
    }

    // Flatten for the single-string shapes. The system prompt has to survive —
    // it is what carries the mode and the identity — so it is prepended rather
    // than dropped.
    const flat = formatted
      .map((m) => (m.role === 'system' ? m.content : `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`))
      .join('\n\n');

    return this.format === 'prompt'
      ? { prompt: flat, ...(this.model ? { model: this.model } : {}), temperature, max_tokens }
      : { message: flat, ...(this.model ? { model: this.model } : {}), temperature, max_tokens };
  }

  /**
   * Pull the answer out of whatever came back. Tolerant on purpose: the request
   * shape is configured, but there is no reason to make someone configure the
   * response shape too when it can simply be looked for.
   */
  static extract(data) {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return '';
    return (
      data.choices?.[0]?.message?.content
      || data.choices?.[0]?.text
      || data.content
      || data.response
      || data.answer
      || data.output
      || data.text
      || (typeof data.message === 'string' ? data.message : data.message?.content)
      || ''
    );
  }

  async chat(messages, options = {}) {
    if (!this.isAvailable()) throw new Error('TrueCode endpoint not configured');
    const { temperature = 0.7, max_tokens = 1024, system = null } = options;

    const url = `${this.baseUrl}${this.path}`;
    const body = this.buildBody(messages, { system, temperature, max_tokens });

    const response = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      timeout: this.timeout,
    });

    const content = TrueCodeService.extract(response.data);
    if (!content) {
      // An empty body is treated as a failure rather than an empty answer, so
      // the caller fails over instead of showing a blank reply.
      throw new Error('TrueCode returned no usable content');
    }

    logger.info('TrueCode answered', { chars: content.length, format: this.format });
    return {
      content,
      model: response.data?.model || this.model || 'truecode',
      provider: 'truecode',
      usage: response.data?.usage || null,
    };
  }

  async healthCheck() {
    if (!this.isAvailable()) {
      return { status: 'unavailable', message: 'TRUECODE_URL not set', provider: 'truecode' };
    }
    try {
      const r = await axios.get(this.baseUrl, { timeout: 10000, validateStatus: () => true });
      return { status: r.status < 500 ? 'ok' : 'error', httpStatus: r.status, provider: 'truecode' };
    } catch (e) {
      return { status: 'error', message: e.message, provider: 'truecode' };
    }
  }
}

module.exports = TrueCodeService;
