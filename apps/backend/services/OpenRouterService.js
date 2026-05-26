/**
 * OpenRouter AI Service - Primary AI Provider for Truegle
 *
 * Provides multi-model AI capabilities with automatic failover
 * between multiple API keys for reliability and rate limit handling
 */
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/env');

// Truegle AI System Prompt (same as DeepSeek)
const TRUEGLE_AI_SYSTEM_PROMPT = `
You are the AI engine for Truegle AI, a search platform built on the principles of Radical Transparency, User-Defined Impartiality, and Uncompromising Security.

CORE IDENTITY & PRIME DIRECTIVE:
- You are strictly prohibited from favoring, disfavoring, or injecting any personal bias, political leaning, theological view, or institutional affiliation into your analysis.
- Your operational goal is to represent all perspectives with factual accuracy and neutrality.
- Maintain a professional, informative, and neutral tone at all times.
- When presenting information, always acknowledge the existence of multiple viewpoints and avoid making absolute claims.

PERSPECTIVE CATEGORIZATION FRAMEWORK:
You MUST assign one or more Perspective Labels to content:
- Political: Conservative, Liberal, Bipartisan, Libertarian, Progressive, Centrist
- Faith: Religious, Atheist, New World / Illumination, Old World / Pagan, Spiritual, Secular, Universal
- Societal: Mainstream, Alternative, Conspiracy, Skeptical, Traditional, Scientific / Academic, Government, Community
- Economic: Local Economy, Global Economics, Investors, Consumers, Small Business, Corporate
- Other: Entertainment, Sports, Technology, Health, Environment

RESPONSE REQUIREMENTS:
1. Provide a concise, bullet-pointed summary of primary perspectives found
2. Present each perspective's core argument factually, without endorsement
3. Tag all content with relevant Perspective Labels
4. If information is unavailable, clearly state this limitation
5. When possible, cite sources or indicate the origin of information
6. Acknowledge uncertainty or conflicting information when it exists
7. Present balanced viewpoints even when data may seem one-sided
8. Avoid making predictions unless specifically asked, and if so, present multiple possible outcomes

Truegle AI is committed to delivering unbiased, multi-perspective understanding.
`;

class OpenRouterService {
  constructor() {
    // Get all available OpenRouter keys
    this.apiKeys = [
      config.ai.openRouter.apiKey,
      config.ai.openRouter.apiKeyUnlimited,
      ...config.ai.openRouter.keys
    ].filter(key => key); // Remove undefined/null keys

    if (this.apiKeys.length === 0) {
      console.warn('⚠️  No OpenRouter API keys configured — AI features disabled');
      this.disabled = true;
      return;
    }
    this.disabled = false;

    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.currentKeyIndex = 0;
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
    this.maxCacheSize = 1000;
  }

  /**
   * Get next API key (for rotation)
   */
  getNextKey() {
    if (this.disabled || !this.apiKeys.length) return null;
    const key = this.apiKeys[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    return key;
  }

  /**
   * Generate cache key for request
   */
  generateCacheKey(messages, options = {}) {
    const cacheData = { messages, ...options };
    return crypto.createHash('md5').update(JSON.stringify(cacheData)).digest('hex');
  }

  /**
   * Get from cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache (with size limit)
   */
  setCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Make API request with automatic key rotation on failure
   */
  async makeRequest(messages, options = {}) {
    const {
      model = 'meta-llama/llama-3.2-3b-instruct:free', // Free model by default
      temperature = 0.7,
      maxTokens = 2000,
      ...otherOptions
    } = options;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...otherOptions
    };

    let lastError = null;

    // Try all available keys
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const apiKey = this.getNextKey();

      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://truegle.info',
              'X-Title': 'Truegle AI'
            },
            timeout: 30000
          }
        );

        return {
          content: response.data.choices[0].message.content,
          model: response.data.model,
          usage: response.data.usage,
          finishReason: response.data.choices[0].finish_reason
        };
      } catch (error) {
        lastError = error;

        // If 401/403, this key is invalid, try next
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.warn(`OpenRouter key ${attempt + 1} failed (401/403), trying next...`);
          continue;
        }

        // If 429 (rate limit), try next key
        if (error.response?.status === 429) {
          console.warn(`OpenRouter key ${attempt + 1} rate limited, trying next...`);
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    // All keys failed
    throw new Error(`All OpenRouter API keys failed: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Chat completion with caching
   */
  async chat(userMessage, options = {}) {
    const { useCache = true, ...requestOptions } = options;

    const messages = [
      { role: 'system', content: TRUEGLE_AI_SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ];

    // Check cache
    if (useCache) {
      const cacheKey = this.generateCacheKey(messages, requestOptions);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Make request
    const response = await this.makeRequest(messages, requestOptions);

    // Cache response
    if (useCache) {
      const cacheKey = this.generateCacheKey(messages, requestOptions);
      this.setCache(cacheKey, response);
    }

    return { ...response, fromCache: false };
  }

  /**
   * Analyze content for bias and perspectives (Truegle-specific)
   */
  async analyzeContent(content, queryContext = null, options = {}) {
    let prompt = `Analyze the following content and provide:

1. Primary perspectives found
2. Core arguments from each perspective
3. Relevant Perspective Labels

Content to analyze:

${content}
`;

    if (queryContext) {
      prompt = `User Query Context: ${queryContext}\n\n${prompt}`;
    }

    return this.chat(prompt, options);
  }

  /**
   * Multi-turn conversation
   */
  async conversation(messages, options = {}) {
    const systemMessage = { role: 'system', content: TRUEGLE_AI_SYSTEM_PROMPT };
    const fullMessages = [systemMessage, ...messages];

    return this.makeRequest(fullMessages, options);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.chat('test', {
        useCache: false,
        maxTokens: 5
      });
      return {
        healthy: true,
        availableKeys: this.apiKeys.length,
        model: response.model
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = OpenRouterService;
