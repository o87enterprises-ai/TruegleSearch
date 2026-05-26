/**
 * AnthropicService - Anthropic Claude API Integration
 * Provides chat and content analysis using Anthropic's Claude models
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class AnthropicService {
  constructor() {
    this.apiKey = config.ai.anthropic?.apiKey;
    this.baseURL = 'https://api.anthropic.com/v1';
    this.defaultModel = 'claude-3-5-sonnet-20241022';
    this.available = !!this.apiKey;

    if (!this.available) {
      logger.warn('AnthropicService: API key not configured');
    } else {
      logger.info('AnthropicService initialized');
    }
  }

  /**
   * Chat completion with Claude
   * @param {string|array} messages - User message or array of messages
   * @param {object} options - Configuration options
   * @returns {Promise<object>} AI response
   */
  async chat(messages, options = {}) {
    if (!this.available) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      const {
        model = this.defaultModel,
        max_tokens = 2000,
        temperature = 0.7,
        system = null
      } = options;

      // Normalize messages to array format
      const messageArray = this.normalizeMessages(messages);

      // Build request payload
      const payload = {
        model,
        max_tokens,
        temperature,
        messages: messageArray
      };

      // Add system prompt if provided
      if (system) {
        payload.system = system;
      }

      logger.debug('Anthropic API request:', {
        model,
        messageCount: messageArray.length,
        hasSystem: !!system
      });

      const startTime = Date.now();

      const response = await axios.post(
        `${this.baseURL}/messages`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      const duration = Date.now() - startTime;

      logger.info('Anthropic API success:', {
        model,
        duration: `${duration}ms`,
        inputTokens: response.data.usage?.input_tokens,
        outputTokens: response.data.usage?.output_tokens
      });

      // Extract the response text
      const content = response.data.content[0]?.text || '';

      return {
        content,
        model: response.data.model,
        usage: {
          prompt_tokens: response.data.usage?.input_tokens || 0,
          completion_tokens: response.data.usage?.output_tokens || 0,
          total_tokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)
        },
        finishReason: response.data.stop_reason || 'end_turn',
        id: response.data.id,
        provider: 'anthropic'
      };

    } catch (error) {
      logger.error('Anthropic API error:', {
        message: error.message,
        status: error.response?.status,
        error: error.response?.data?.error
      });

      if (error.response?.status === 401) {
        throw new Error('Invalid Anthropic API key');
      } else if (error.response?.status === 429) {
        throw new Error('Anthropic API rate limit exceeded');
      } else if (error.response?.status === 400) {
        throw new Error(`Anthropic API bad request: ${error.response?.data?.error?.message || error.message}`);
      }

      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  /**
   * Analyze content with Claude
   * @param {string} content - Content to analyze
   * @param {string} queryContext - Analysis context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Analysis result
   */
  async analyzeContent(content, queryContext, options = {}) {
    if (!this.available) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      const analysisPrompt = `Analyze the following content in the context of: "${queryContext}"

Content:
${content.substring(0, 4000)}

Provide a concise analysis covering:
1. Main perspectives present
2. Key arguments or claims
3. Potential biases or viewpoints
4. Missing perspectives (if any)

Format your response as a structured analysis.`;

      const response = await this.chat(analysisPrompt, {
        ...options,
        temperature: 0.5 // Lower temperature for more focused analysis
      });

      return {
        analysis: response.content,
        model: response.model,
        usage: response.usage,
        provider: 'anthropic'
      };

    } catch (error) {
      logger.error('Anthropic analyze content error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if Anthropic service is healthy
   * @returns {Promise<object>} Health status
   */
  async healthCheck() {
    if (!this.available) {
      return {
        status: 'unavailable',
        message: 'Anthropic API key not configured',
        provider: 'anthropic'
      };
    }

    try {
      // Make a minimal API call to verify connectivity
      const response = await this.chat('Hello', {
        max_tokens: 10,
        temperature: 0
      });

      return {
        status: 'healthy',
        message: 'Anthropic API is operational',
        model: response.model,
        provider: 'anthropic',
        latency: response.latency
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        provider: 'anthropic'
      };
    }
  }

  /**
   * Normalize messages to Anthropic format
   * @param {string|array} messages - Input messages
   * @returns {array} Normalized message array
   */
  normalizeMessages(messages) {
    // If string, convert to user message
    if (typeof messages === 'string') {
      return [{ role: 'user', content: messages }];
    }

    // If already array, validate and normalize
    if (Array.isArray(messages)) {
      return messages.map(msg => {
        // OpenAI format to Anthropic format
        if (msg.role === 'system') {
          // Anthropic handles system as separate parameter
          logger.warn('System message in messages array - should be in options.system');
          return null;
        }

        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        };
      }).filter(Boolean); // Remove null entries
    }

    throw new Error('Invalid messages format');
  }

  /**
   * Stream chat completion (for future implementation)
   * @param {string|array} messages - User message or array of messages
   * @param {object} options - Configuration options
   * @returns {Promise<Stream>} Response stream
   */
  async streamChat(messages, options = {}) {
    // Placeholder for streaming implementation
    throw new Error('Streaming not yet implemented for AnthropicService');
  }

  /**
   * Get available models
   * @returns {array} List of available Claude models
   */
  getAvailableModels() {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most capable model, best for complex tasks',
        maxTokens: 4096
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Powerful model for demanding tasks',
        maxTokens: 4096
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced model for most use cases',
        maxTokens: 4096
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient for simpler tasks',
        maxTokens: 4096
      }
    ];
  }

  /**
   * Check if service is available
   * @returns {boolean} Availability status
   */
  isAvailable() {
    return this.available;
  }
}

module.exports = AnthropicService;
