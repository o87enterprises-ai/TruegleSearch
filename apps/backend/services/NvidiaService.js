/**
 * NVIDIA NIM Service - OpenAI-compatible AI provider
 *
 * Uses NVIDIA's hosted inference endpoint (integrate.api.nvidia.com), which is
 * OpenAI API compatible, so the request/response shape matches OpenAIService.
 * Replaces OpenRouter as the primary hosted free provider. Ollama remains the
 * self-hosted option.
 */
const axios = require('axios');
const config = require('../config/env');

class NvidiaService {
  constructor() {
    this.apiKey = config.ai.nvidia?.apiKey;
    this.baseUrl = 'https://integrate.api.nvidia.com/v1';
    this.defaultModel = config.ai.nvidia?.model || 'nvidia/nemotron-3-ultra-550b-a55b';
  }

  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Chat completion (OpenAI-compatible). Accepts a messages array (with optional
   * system role) or a string. Returns { content, model, usage, finishReason }.
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1024,
      systemPrompt = null,
    } = options;

    const formattedMessages = [];
    if (systemPrompt) formattedMessages.push({ role: 'system', content: systemPrompt });
    if (typeof messages === 'string') {
      formattedMessages.push({ role: 'user', content: messages });
    } else {
      formattedMessages.push(...messages);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
          // Suppress chain-of-thought so chat returns a clean answer (Nemotron is
          // a reasoning model that otherwise emits its thinking into content).
          chat_template_kwargs: { enable_thinking: false },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // large reasoning models can be slow
        }
      );

      const choice = response.data.choices?.[0] || {};
      // Some NIM reasoning models put the answer in message.content; reasoning (if
      // any) arrives in reasoning_content which we ignore for plain chat.
      const content = choice.message?.content || '';

      return {
        content,
        model: response.data.model || model,
        usage: response.data.usage,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      console.error('NVIDIA NIM error:', error.response?.data || error.message);
      if (error.response?.status === 401) throw new Error('Invalid NVIDIA API key');
      if (error.response?.status === 429) throw new Error('NVIDIA rate limit exceeded');
      if (error.response?.status === 400) {
        throw new Error(`NVIDIA bad request: ${error.response.data?.detail || error.response.data?.error?.message || 'unknown'}`);
      }
      throw new Error(`NVIDIA service unavailable: ${error.message}`);
    }
  }

  /**
   * Content analysis helper (used by the analyze flow). Delegates to chat with an
   * analysis-oriented prompt and returns a chat-shaped result.
   */
  async analyzeContent(content, options = {}) {
    const prompt = `Analyze the following content and summarize the primary perspectives, their core arguments, and relevant perspective labels.\n\nContent:\n${content}`;
    return this.chat(prompt, options);
  }

  async healthCheck() {
    if (!this.apiKey) return { healthy: false, error: 'No API key' };
    try {
      await this.chat('ping', { maxTokens: 5 });
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = NvidiaService;
