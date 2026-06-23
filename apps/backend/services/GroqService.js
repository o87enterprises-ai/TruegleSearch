/**
 * GroqService - Groq LPU Inference (OpenAI-compatible)
 * Free tier: https://console.groq.com — no credit card required.
 * Supports multiple keys via GROQ_API_KEY through GROQ_API_KEY_5.
 * When a key hits its rate limit (429) the service automatically rotates
 * to the next available key so requests keep flowing.
 */
const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class GroqService {
  constructor() {
    this.keys = config.ai.groq?.keys || (config.ai.groq?.apiKey ? [config.ai.groq.apiKey] : []);
    this.currentKeyIndex = 0;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.defaultModel = config.ai.groq?.model || 'llama-3.1-8b-instant';

    logger.info(`GroqService initialized with ${this.keys.length} key(s)`);
  }

  get apiKey() {
    return this.keys[this.currentKeyIndex] || null;
  }

  isAvailable() {
    return this.keys.length > 0;
  }

  rotateKey() {
    const next = (this.currentKeyIndex + 1) % this.keys.length;
    if (next === this.currentKeyIndex) return false; // only one key, can't rotate
    this.currentKeyIndex = next;
    logger.warn(`Groq: rotated to key index ${this.currentKeyIndex}`);
    return true;
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

    const startIndex = this.currentKeyIndex;

    // Try each key once before giving up
    do {
      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          { model, messages: formatted, temperature, max_tokens, stream: false },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          }
        );

        const choice = response.data.choices?.[0] || {};
        return {
          content: choice.message?.content || '',
          model: response.data.model || model,
          usage: response.data.usage,
          finishReason: choice.finish_reason,
          provider: 'groq',
        };

      } catch (error) {
        const status = error.response?.status;
        logger.warn(`Groq key[${this.currentKeyIndex}] failed:`, { status });

        if (status === 401) {
          // Bad key — rotate and try next
          if (!this.rotateKey() || this.currentKeyIndex === startIndex) break;
          continue;
        }

        if (status === 429) {
          // Rate limited — rotate and try next
          if (!this.rotateKey() || this.currentKeyIndex === startIndex) {
            throw new Error('All Groq API keys are rate-limited');
          }
          continue;
        }

        // Non-recoverable error — throw immediately
        throw new Error(`Groq service error: ${error.message}`);
      }
    } while (this.currentKeyIndex !== startIndex);

    throw new Error('All Groq API keys exhausted');
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
      return { status: 'healthy', provider: 'groq', activeKeyIndex: this.currentKeyIndex, totalKeys: this.keys.length };
    } catch (error) {
      return { status: 'unhealthy', message: error.message, provider: 'groq' };
    }
  }
}

module.exports = GroqService;
