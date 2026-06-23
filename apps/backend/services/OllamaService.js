/**
 * OllamaService - Ollama Integration
 * Provides chat and content analysis using Ollama models
 *
 * Cloud Model Access:
 * - Run `ollama signin` in your terminal to authenticate
 * - Once signed in, your local Ollama server gains access to cloud models
 * - Use cloud model names like 'qwen3-coder:480b', 'deepseek-v3.2', etc.
 * - The local server automatically proxies requests to Ollama Cloud
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class OllamaService {
  constructor() {
    this.baseUrl = config.ai.ollama?.baseUrl || 'http://localhost:11434';
    this.model = config.ai.ollama?.model || 'qwen3-coder:480b';
    this.authToken = config.ai.ollama?.authToken || null;
    this.available = true;

    logger.info(`OllamaService initialized: ${this.baseUrl} with model ${this.model}`);
    logger.info('Cloud models: Available if signed in via `ollama signin`');
  }

  /**
   * Headers for requests to the Ollama server. A remote, self-hosted box
   * (e.g. AWS) has no built-in auth, so it must sit behind a reverse proxy
   * that checks this shared-secret bearer token.
   */
  authHeaders() {
    return this.authToken
      ? { Authorization: `Bearer ${this.authToken}` }
      : {};
  }

  /**
   * Chat completion with Ollama
   * @param {string|array} messages - User message or array of messages
   * @param {object} options - Configuration options
   * @returns {Promise<object>} AI response
   */
  async chat(messages, options = {}) {
    try {
      const {
        model = this.model,
        temperature = 0.7,
        max_tokens = 2000,
        system = null
      } = options;

      // Format messages for Ollama
      const prompt = this.formatMessages(messages, system);

      logger.debug('Ollama API request:', { model, promptLength: prompt.length });

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature: parseFloat(temperature),
            num_predict: parseInt(max_tokens),
          }
        },
        {
          timeout: 120000,
          headers: {
            'Content-Type': 'application/json',
            ...this.authHeaders()
          }
        }
      );

      logger.info('Ollama API success:', {
        model,
        responseLength: response.data.response?.length || 0
      });

      return {
        content: response.data.response,
        model,
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
          total_tokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        finishReason: 'stop',
        provider: 'ollama'
      };

    } catch (error) {
      logger.error('Ollama API error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: this.baseUrl
      });

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama server is not running. Start it with: ollama serve');
      }

      if (error.response?.status === 404) {
        throw new Error(`Model '${this.model}' not found. Cloud models require: ollama signin`);
      }

      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  /**
   * Analyze content with Ollama
   * @param {string} content - Content to analyze
   * @param {string} queryContext - Query context
   * @param {object} options - Additional options
   * @returns {Promise<object>} Analysis result
   */
  async analyzeContent(content, queryContext, options = {}) {
    const systemPrompt = options.system || `You are an AI assistant that provides balanced, unbiased analysis of content. Analyze perspectives fairly and factually.`;

    let prompt = `${systemPrompt}

User Query: ${queryContext || 'General analysis'}

Content to analyze:
${content}

Provide a concise, balanced analysis that:
1. Summarizes the main points
2. Identifies different perspectives if present
3. Remains objective and factual

Analysis:`;

    try {
      const response = await this.chat(prompt, {
        ...options,
        temperature: options.temperature || 0.5,
        max_tokens: options.max_tokens || 1500
      });

      return {
        content: response.content,
        response: response.content, // Alias for compatibility
        provider: 'ollama',
        model: response.model,
        usage: response.usage
      };

    } catch (error) {
      logger.error('Ollama analyze content error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Format messages for Ollama prompt
   * @param {string|array} messages - Messages to format
   * @param {string} system - System prompt
   * @returns {string} Formatted prompt
   */
  formatMessages(messages, system = null) {
    let prompt = '';

    // Add system prompt if provided
    if (system) {
      prompt += `${system}\n\n`;
    }

    // Handle string input
    if (typeof messages === 'string') {
      prompt += messages;
    }
    // Handle array of messages
    else if (Array.isArray(messages)) {
      messages.forEach(msg => {
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

  /**
   * Health check for Ollama service
   * @returns {Promise<object>} Health status
   */
  async healthCheck() {
    try {
      // Try to list models to verify Ollama is running
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: this.authHeaders()
      });

      const models = response.data.models || [];
      const hasModel = models.some(m => m.name.includes(this.model.split(':')[0]));

      return {
        status: hasModel ? 'healthy' : 'degraded',
        message: hasModel
          ? `Ollama is running with ${models.length} models available`
          : `Ollama is running but model ${this.model} not found. Available: ${models.map(m => m.name).join(', ')}`,
        models: models.map(m => m.name),
        provider: 'ollama',
        baseUrl: this.baseUrl
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.code === 'ECONNREFUSED'
          ? 'Ollama server is not running. Start with: ollama serve'
          : `Ollama error: ${error.message}`,
        provider: 'ollama',
        baseUrl: this.baseUrl
      };
    }
  }

  /**
   * Check if service is available
   * A localhost server is always considered available. A remote, self-hosted
   * server (e.g. an AWS box running Gemma) is only treated as available once
   * an auth token is configured, so we never send requests to an unprotected
   * public endpoint by mistake.
   * @returns {boolean} Availability status
   */
  isAvailable() {
    const isLocal = this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1');
    if (!isLocal && !this.authToken) {
      return false;
    }
    return this.available;
  }
}

module.exports = OllamaService;
