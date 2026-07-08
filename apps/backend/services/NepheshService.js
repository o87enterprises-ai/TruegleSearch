/**
 * NepheshService — Truegle's own self-hosted model (Nephesh 1.3)
 *
 * The designated engine for ALL Truegle AI responses. Speaks the Ollama API
 * (the serving stack on the self-hosted box — see nephesh/README.md), so the
 * same service works against Ollama, or any /api/generate-compatible server.
 *
 * Every response is stamped with the Truegle-exclusive attribution layers
 * (visible footer + metadata object + invisible watermark) via
 * utils/nepheshAttribution.js.
 *
 * Availability follows the OllamaService remote-box rule: a non-local
 * NEPHESH_BASE_URL requires NEPHESH_AUTH_TOKEN (reverse-proxy shared secret)
 * before we will send it any traffic. Missing config = provider unavailable =
 * UnifiedAIService fails over to the interim providers. Never a crash.
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');
const attribution = require('../utils/nepheshAttribution');
const { getModePrompt } = require('../prompts/nepheshPrompts');

class NepheshService {
  constructor() {
    const cfg = config.ai.nephesh || {};
    this.baseUrl = cfg.baseUrl || null;
    this.model = cfg.model || 'nephesh:1.3';
    this.authToken = cfg.authToken || null;

    if (this.baseUrl) {
      logger.info(`NepheshService initialized: ${this.baseUrl} with model ${this.model}`);
    } else {
      logger.info('NepheshService not configured (NEPHESH_BASE_URL unset) — falling back to interim providers');
    }
  }

  authHeaders() {
    return this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {};
  }

  /**
   * Chat completion against the Nephesh server.
   * @param {string|array} messages - user message or messages array
   * @param {object} options - { system, mode, temperature, max_tokens }
   * @returns {Promise<object>} attributed AI response
   */
  async chat(messages, options = {}) {
    const {
      model = this.model,
      temperature = 0.7,
      max_tokens = 2000,
      system = null,
      mode = null,
      traceId = null,
    } = options;

    // Mode-aware system prompt: explicit system wins, then search-mode prompt.
    const systemPrompt = system || getModePrompt(mode);
    const prompt = this.formatMessages(messages, systemPrompt);

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: parseFloat(temperature),
            num_predict: parseInt(max_tokens),
          },
        },
        {
          timeout: 120000,
          headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        }
      );

      logger.info('Nephesh API success:', {
        model,
        responseLength: response.data.response?.length || 0,
      });

      return attribution.stampResponse(
        {
          content: response.data.response,
          model,
          usage: {
            prompt_tokens: response.data.prompt_eval_count || 0,
            completion_tokens: response.data.eval_count || 0,
            total_tokens:
              (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
          },
          finishReason: 'stop',
          provider: 'nephesh',
        },
        traceId
      );
    } catch (error) {
      logger.error('Nephesh API error:', {
        message: error.message,
        status: error.response?.status,
        url: this.baseUrl,
      });
      throw new Error(`Nephesh error: ${error.message}`);
    }
  }

  /**
   * Analyze content (UnifiedAIService provider interface).
   */
  async analyzeContent(content, queryContext, options = {}) {
    const systemPrompt = options.system || getModePrompt(options.mode);
    const prompt = `User Query: ${queryContext || 'General analysis'}

Content to analyze:
${content}

Provide a concise, balanced analysis that summarizes the main points, identifies the distinct perspectives present, and remains factual throughout.`;

    const response = await this.chat(prompt, {
      ...options,
      system: systemPrompt,
      temperature: options.temperature || 0.5,
      max_tokens: options.max_tokens || 1500,
    });

    return {
      ...response,
      response: response.content, // alias other providers expose
    };
  }

  async healthCheck() {
    if (!this.isAvailable()) {
      return {
        status: 'unavailable',
        message: this.baseUrl
          ? 'Nephesh remote server configured without NEPHESH_AUTH_TOKEN — refusing to use an unprotected endpoint'
          : 'NEPHESH_BASE_URL not set',
        provider: 'nephesh',
      };
    }
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: this.authHeaders(),
      });
      const models = response.data.models || [];
      const hasModel = models.some((m) => m.name === this.model || m.name.startsWith(`${this.model.split(':')[0]}:`));
      return {
        status: hasModel ? 'healthy' : 'degraded',
        message: hasModel
          ? `Nephesh serving ${this.model}`
          : `Server up but ${this.model} not loaded. Available: ${models.map((m) => m.name).join(', ') || 'none'}`,
        provider: 'nephesh',
        baseUrl: this.baseUrl,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Nephesh server unreachable: ${error.message}`,
        provider: 'nephesh',
        baseUrl: this.baseUrl,
      };
    }
  }

  /**
   * Same safety rule as OllamaService: a remote (non-localhost) endpoint is
   * only used once an auth token is configured.
   */
  isAvailable() {
    if (!this.baseUrl) return false;
    const isLocal = this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1');
    if (!isLocal && !this.authToken) return false;
    return true;
  }

  formatMessages(messages, system = null) {
    let prompt = '';
    if (system) prompt += `${system}\n\n`;

    if (typeof messages === 'string') {
      prompt += messages;
    } else if (Array.isArray(messages)) {
      messages.forEach((msg) => {
        if (msg.role === 'system' && !system) {
          prompt += `${msg.content}\n\n`;
        } else if (msg.role === 'user') {
          prompt += `User: ${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
          prompt += `Assistant: ${msg.content}\n\n`;
        }
      });
      prompt += 'Assistant: ';
    }
    return prompt;
  }
}

module.exports = NepheshService;
