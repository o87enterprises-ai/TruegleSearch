/**
 * GroqService - Groq LPU Inference (OpenAI-compatible)
 * Free tier: https://console.groq.com — no credit card required.
 * Default model: llama-3.1-8b-instant (fast, free, no rate issues for a search engine).
 */
const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class GroqService {
  constructor() {
    this.apiKey = config.ai.groq?.apiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1';
    this.defaultModel = config.ai.groq?.model || 'llama-3.1-8b-instant';
  }

  isAvailable() {
    return !!this.apiKey;
  }

  async chat(messages, options = {}) {
    if (!this.apiKey) throw new Error('Groq API key not configured');

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
      logger.error('Groq error:', { status: error.response?.status, data: error.response?.data });
      if (error.response?.status === 401) throw new Error('Invalid Groq API key');
      if (error.response?.status === 429) throw new Error('Groq rate limit exceeded');
      throw new Error(`Groq service error: ${error.message}`);
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
    if (!this.apiKey) return { status: 'unavailable', message: 'No API key', provider: 'groq' };
    try {
      await this.chat('ping', { max_tokens: 5 });
      return { status: 'healthy', provider: 'groq' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message, provider: 'groq' };
    }
  }
}

module.exports = GroqService;
