/**
 * GeminiService - Google Gemini API Integration
 * Provides chat and content analysis using Google's Gemini models
 */

const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.apiKey = config.ai.gemini?.apiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = 'gemini-1.5-flash'; // Free tier: 1M tokens/day
    this.available = !!this.apiKey;

    if (!this.available) {
      logger.warn('GeminiService: API key not configured');
    } else {
      logger.info('GeminiService initialized');
    }
  }

  /**
   * Chat completion with Gemini
   * @param {string|array} messages - User message or array of messages
   * @param {object} options - Configuration options
   * @returns {Promise<object>} AI response
   */
  async chat(messages, options = {}) {
    if (!this.available) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const {
        model = this.defaultModel,
        temperature = 0.7,
        maxOutputTokens = 2000,
        system = null
      } = options;

      // Normalize messages to Gemini format
      const { contents, systemInstruction } = this.normalizeMessages(messages, system);

      // Build request payload
      const payload = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
          topP: 0.95,
          topK: 40
        }
      };

      // Add system instruction if provided
      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      logger.debug('Gemini API request:', {
        model,
        messageCount: contents.length,
        hasSystem: !!systemInstruction
      });

      const startTime = Date.now();

      const response = await axios.post(
        `${this.baseURL}/models/${model}:generateContent?key=${this.apiKey}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      const duration = Date.now() - startTime;

      logger.info('Gemini API success:', {
        model,
        duration: `${duration}ms`,
        candidateCount: response.data.candidates?.length || 0
      });

      // Extract the response text
      const candidate = response.data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || '';
      const finishReason = candidate?.finishReason || 'STOP';

      return {
        content,
        model,
        usage: {
          prompt_tokens: response.data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.data.usageMetadata?.totalTokenCount || 0
        },
        finishReason: this.mapFinishReason(finishReason),
        provider: 'gemini'
      };

    } catch (error) {
      logger.error('Gemini API error:', {
        message: error.message,
        status: error.response?.status,
        error: error.response?.data?.error
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Invalid Gemini API key');
      } else if (error.response?.status === 429) {
        throw new Error('Gemini API rate limit exceeded');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        throw new Error(`Gemini API bad request: ${errorMsg}`);
      }

      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Analyze content with Gemini
   * @param {string} content - Content to analyze
   * @param {string} queryContext - Analysis context
   * @param {object} options - Configuration options
   * @returns {Promise<object>} Analysis result
   */
  async analyzeContent(content, queryContext, options = {}) {
    if (!this.available) {
      throw new Error('Gemini API key not configured');
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
        provider: 'gemini'
      };

    } catch (error) {
      logger.error('Gemini analyze content error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if Gemini service is healthy
   * @returns {Promise<object>} Health status
   */
  async healthCheck() {
    if (!this.available) {
      return {
        status: 'unavailable',
        message: 'Gemini API key not configured',
        provider: 'gemini'
      };
    }

    try {
      // Make a minimal API call to verify connectivity
      const response = await this.chat('Hello', {
        maxOutputTokens: 10,
        temperature: 0
      });

      return {
        status: 'healthy',
        message: 'Gemini API is operational',
        model: response.model,
        provider: 'gemini'
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        provider: 'gemini'
      };
    }
  }

  /**
   * Normalize messages to Gemini format
   * @param {string|array} messages - Input messages
   * @param {string} systemPrompt - Optional system prompt
   * @returns {object} Normalized contents and system instruction
   */
  normalizeMessages(messages, systemPrompt = null) {
    let systemInstruction = systemPrompt;
    let contents = [];

    // If string, convert to user message
    if (typeof messages === 'string') {
      contents = [{
        role: 'user',
        parts: [{ text: messages }]
      }];
    }
    // If already array, validate and normalize
    else if (Array.isArray(messages)) {
      contents = messages
        .map(msg => {
          // Extract system messages as system instruction
          if (msg.role === 'system') {
            systemInstruction = msg.content;
            return null;
          }

          return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          };
        })
        .filter(Boolean); // Remove null entries
    } else {
      throw new Error('Invalid messages format');
    }

    return { contents, systemInstruction };
  }

  /**
   * Map Gemini finish reason to standard format
   * @param {string} reason - Gemini finish reason
   * @returns {string} Standardized finish reason
   */
  mapFinishReason(reason) {
    const mapping = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop'
    };

    return mapping[reason] || 'stop';
  }

  /**
   * Get available models
   * @returns {array} List of available Gemini models
   */
  getAvailableModels() {
    return [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Best model for most text-based tasks',
        maxTokens: 30720
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient for high-volume tasks',
        maxTokens: 1000000
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable model with long context',
        maxTokens: 2000000
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

module.exports = GeminiService;
