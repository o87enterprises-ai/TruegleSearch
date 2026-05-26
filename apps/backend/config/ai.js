/**
 * Hugging Face API Implementation for Truegle AI (TEMPORARY TESTING ONLY)
 *
 * Scalable implementation with rate limiting, caching, and error handling
 *
 * NOTE: This is ONLY for testing purposes. We haven't settled on an AI model to use yet
 * so don't make this permanent. This implementation will be replaced with the final
 * AI provider before production.
 */

const axios = require('axios');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"; // Using a free model (TEMPORARY)

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

// ============================================================================
// SIMPLE IN-MEMORY CACHE (For production, use Redis)
// ============================================================================

class SimpleCache {
  constructor(maxsize = 1000, ttl = 3600) {
    this.cache = new Map();
    this.maxsize = maxsize;
    this.ttl = ttl;
    this.timestamps = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // Check if expired
      const now = Date.now();
      const timestamp = this.timestamps.get(key);
      if (now - timestamp > this.ttl * 1000) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        return null;
      }
      return this.cache.get(key);
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.timestamps.delete(key);
    }
    
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());

    // Remove oldest if over maxsize
    if (this.cache.size > this.maxsize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.timestamps.delete(firstKey);
    }
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requestsPerMinute = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.lastUpdate = Date.now();
    this.lockUntil = 0;
  }

  acquire() {
    const currentTime = Date.now();
    
    // Check if we're in a lock period
    if (currentTime < this.lockUntil) {
      return false;
    }

    // Refill tokens based on time passed
    const timePassed = (currentTime - this.lastUpdate) / 1000; // in seconds
    this.tokens = Math.min(
      this.requestsPerMinute,
      this.tokens + (timePassed * this.requestsPerMinute / 60)
    );
    this.lastUpdate = currentTime;

    // Try to consume a token
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  setLock(seconds) {
    this.lockUntil = Date.now() + (seconds * 1000);
  }
}

// ============================================================================
// DEEPSEEK CLIENT
// ============================================================================

class DeepSeekClient {
  constructor({
    apiKey = null,
    model = "deepseek-chat",
    cacheEnabled = true,
    rateLimitRpm = 60
  } = {}) {
    this.apiKey = apiKey || DEEPSEEK_API_KEY;
    if (!this.apiKey) {
      throw new Error("DeepSeek API key is required");
    }
    this.model = model;
    this.cache = cacheEnabled ? new SimpleCache() : null;
    this.rateLimiter = new RateLimiter(rateLimitRpm);
    this.baseUrl = DEEPSEEK_API_URL;
  }

  _generateCacheKey(messages, options = {}) {
    const cacheInput = {
      messages,
      model: this.model,
      ...options
    };
    const cacheStr = JSON.stringify(cacheInput);
    return crypto.createHash('md5').update(cacheStr).digest('hex');
  }

  async _makeRequest(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 2000, ...otherOptions } = options;

    const headers = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };

    const payload = {
      model: this.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...otherOptions
    };

    try {
      const response = await axios.post(this.baseUrl, payload, { 
        headers,
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Rate limit hit - lock for 60 seconds
        this.rateLimiter.setLock(60);
        throw new Error("Rate limit exceeded. Waiting 60 seconds...");
      }
      if (error.response) {
        throw new Error(`API request failed: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      } else if (error.request) {
        throw new Error("API request failed: No response received");
      } else {
        throw new Error(`API request failed: ${error.message}`);
      }
    }
  }

  async chat(userMessage, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 2000,
      useCache = true,
      ...otherOptions
    } = options;

    const messages = [
      { role: "system", content: TRUEGLE_AI_SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];

    // Check cache first
    if (useCache && this.cache) {
      const cacheKey = this._generateCacheKey(messages, {
        temperature,
        maxTokens,
        ...otherOptions
      });
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) {
        return { ...cachedResponse, fromCache: true };
      }
    }

    // Rate limiting
    if (!this.rateLimiter.acquire()) {
      throw new Error("Rate limit reached. Please wait before making more requests.");
    }

    // Make API request
    const response = await this._makeRequest(messages, {
      temperature,
      maxTokens,
      ...otherOptions
    });

    // Cache the response
    if (useCache && this.cache) {
      const cacheKey = this._generateCacheKey(messages, {
        temperature,
        maxTokens,
        ...otherOptions
      });
      this.cache.set(cacheKey, response);
    }

    return { ...response, fromCache: false };
  }

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
}

// ============================================================================
// EXPORTS (TEMPORARY - WILL BE REPLACED IN PRODUCTION)
// ============================================================================

module.exports = {
  DeepSeekClient, // AI provider client
  TRUEGLE_AI_SYSTEM_PROMPT,
  SimpleCache,
  RateLimiter
};