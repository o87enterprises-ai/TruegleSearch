/**
 * UnifiedAIService - Multi-Provider AI Orchestration
 * Manages multiple AI providers with automatic failover and context-aware prompt selection
 */

const NepheshService = require('./NepheshService');
const attribution = require('../utils/nepheshAttribution');
const GroqService = require('./GroqService');
const NvidiaService = require('./NvidiaService');
const OpenAIService = require('./OpenAIService');
const AnthropicService = require('./AnthropicService');
const GeminiService = require('./GeminiService');
const OllamaService = require('./OllamaService');
const PromptService = require('./PromptService');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

class UnifiedAIService {
  constructor() {
    // Initialize all AI providers. Nephesh (Truegle's own self-hosted model)
    // always ranks first when configured; the rest are interim fallbacks.
    this.providers = {
      nephesh: new NepheshService(),
      groq: new GroqService(),
      gemini: new GeminiService(),
      nvidia: new NvidiaService(),
      openai: new OpenAIService(),
      anthropic: new AnthropicService(),
      ollama: new OllamaService(),
    };

    this.promptService = PromptService;

    // Response cache (inherited from OpenRouterService pattern)
    this.cache = new Map();
    this.cacheTTL = 3600000; // 1 hour
    this.maxCacheSize = 1000;

    logger.info(`UnifiedAIService initialized with ${Object.keys(this.providers).length} providers (Nephesh first when configured)`);
  }

  /**
   * Chat with context-aware prompt selection and provider failover
   * @param {string} userMessage - User's message
   * @param {string} context - Page context (general, search_results, biased_results, osint, shopping)
   * @param {object} options - Additional options
   * @returns {Promise<object>} AI response
   */
  async chat(userMessage, context = 'general', options = {}) {
    try {
      // Check cache first. Include systemOverride (which encodes nepheshMode/
      // verbose) in the key — otherwise toggling those on an identical
      // message+context would silently return a stale cached response from
      // before the toggle.
      const cacheKey = this.getCacheKey(userMessage, context, options.systemOverride);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        logger.debug('Unified AI cache hit:', { context });
        return { ...cached.data, fromCache: true };
      }

      // Get prompt for context. A missing/unseeded ai_prompts table must not
      // take AI down when the caller supplies its own system prompt (the
      // versioned Nephesh mode prompts) — fall back to sane defaults.
      let prompt;
      try {
        prompt = await this.promptService.getPromptByContext(context);
      } catch (promptError) {
        if (!options.systemOverride) throw promptError;
        logger.warn('No DB prompt for context, using systemOverride with defaults:', {
          context,
          error: promptError.message,
        });
        prompt = { id: null, prompt_text: '', temperature: 0.7, max_tokens: 2000, version: 'override-only' };
      }

      // Interpolate variables in prompt
      const variables = {
        userName: options.userName || 'User',
        query: userMessage,
        perspective: options.perspective || 'Neutral',
        context: context,
        searchResults: options.searchResults || '',
        timestamp: new Date().toISOString()
      };

      // Use mode-specific override if provided, otherwise use DB prompt
      const basePrompt = options.systemOverride || this.promptService.interpolatePrompt(
        prompt.prompt_text,
        variables
      );

      // Build messages array
      const messages = [
        { role: 'system', content: basePrompt },
        { role: 'user', content: userMessage }
      ];

      // Get provider order (with preferred provider for this context)
      const providerOrder = await this.getProviderOrder(prompt.id);

      // Try each provider in order with failover
      let lastError = null;
      for (const providerName of providerOrder) {
        try {
          logger.debug(`Attempting AI request with provider: ${providerName}`);

          const response = await this.callProvider(
            providerName,
            messages,
            {
              ...options,
              temperature: prompt.temperature,
              max_tokens: prompt.max_tokens,
              system: basePrompt
            }
          );

          // Nephesh is the brand for ALL Truegle AI. When the answer came from
          // a fallback substrate (Groq/Gemini/etc. — e.g. while no self-hosted
          // box exists), stamp the Nephesh identity + attribution here so the
          // response is branded regardless of engine. NepheshService already
          // self-stamps, so skip it to avoid a double watermark.
          const branded = providerName === 'nephesh'
            ? response
            : attribution.stampResponse(response);

          // Cache successful response
          this.cacheResponse(cacheKey, branded);

          logger.info('AI request successful:', {
            provider: providerName,
            context,
            model: response.model
          });

          return {
            ...branded,
            fromCache: false,
            context,
            promptVersion: prompt.version
          };

        } catch (error) {
          logger.warn(`Provider ${providerName} failed:`, { error: error.message });
          lastError = error;
          continue; // Try next provider
        }
      }

      // All providers failed
      throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);

    } catch (error) {
      logger.error('Unified AI chat error:', {
        context,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze content with context-aware prompts
   * @param {string} content - Content to analyze
   * @param {string} context - Page context
   * @param {string} queryContext - Analysis query context
   * @param {object} options - Additional options
   * @returns {Promise<object>} Analysis result
   */
  async analyzeContent(content, context = 'general', queryContext = '', options = {}) {
    try {
      // Get prompt for context. As with chat(), a missing/unseeded ai_prompts
      // table must not break analysis when the caller supplies its own system
      // prompt (the versioned Nephesh mode prompts) — fall back to defaults.
      let prompt;
      try {
        prompt = await this.promptService.getPromptByContext(context);
      } catch (promptError) {
        if (!options.systemOverride) throw promptError;
        logger.warn('No DB prompt for context, using systemOverride with defaults:', {
          context,
          error: promptError.message,
        });
        prompt = { id: null, prompt_text: '', temperature: 0.5, max_tokens: 1500, version: 'override-only' };
      }

      // Interpolate variables
      const variables = {
        userName: options.userName || 'User',
        query: queryContext,
        context: context,
        searchResults: content,
        perspective: options.perspective || 'Neutral',
        timestamp: new Date().toISOString()
      };

      const systemPrompt = options.systemOverride || this.promptService.interpolatePrompt(
        prompt.prompt_text,
        variables
      );

      // Get provider order
      const providerOrder = await this.getProviderOrder(prompt.id);

      // Try each provider
      let lastError = null;
      for (const providerName of providerOrder) {
        try {
          const provider = this.providers[providerName];

          logger.debug(`Checking provider ${providerName}:`, {
            exists: !!provider,
            available: provider?.isAvailable?.() || false
          });

          if (!provider || !provider.isAvailable()) {
            logger.debug(`Skipping ${providerName}: not available`);
            continue;
          }

          logger.info(`Attempting analysis with ${providerName}`);

          const response = await provider.analyzeContent(
            content,
            queryContext,
            {
              ...options,
              system: systemPrompt,
              temperature: prompt.temperature,
              max_tokens: prompt.max_tokens
            }
          );

          logger.info('Content analysis successful:', {
            provider: providerName,
            context
          });

          const branded = providerName === 'nephesh'
            ? response
            : attribution.stampResponse(response);

          return {
            ...branded,
            context,
            promptVersion: prompt.version,
            provider: providerName
          };

        } catch (error) {
          logger.warn(`Provider ${providerName} analyze failed:`, { error: error.message });
          lastError = error;
          continue;
        }
      }

      throw new Error(`All AI providers failed for analysis. Last error: ${lastError?.message}`);

    } catch (error) {
      logger.error('Unified AI analyze error:', {
        context,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Call a specific AI provider
   * @param {string} providerName - Provider name (openrouter, openai, anthropic, gemini)
   * @param {array} messages - Message array
   * @param {object} options - Options
   * @returns {Promise<object>} Provider response
   */
  async callProvider(providerName, messages, options = {}) {
    const provider = this.providers[providerName];

    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    if (!provider.isAvailable || !provider.isAvailable()) {
      throw new Error(`Provider not available: ${providerName}`);
    }

    // For providers that accept system prompt separately
    if (providerName === 'anthropic' || providerName === 'gemini') {
      // Extract system message
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');

      return await provider.chat(userMessages, {
        ...options,
        system: systemMessage?.content || options.system
      });
    }

    // OpenRouter and OpenAI accept messages array directly
    return await provider.chat(messages, options);
  }

  /**
   * Get provider order based on prompt preferences and global priority
   * @param {number} promptId - Prompt ID
   * @returns {Promise<array>} Ordered list of provider names
   */
  async getProviderOrder(promptId) {
    try {
      // Get providers with mappings for this prompt
      const result = await query(`
        SELECT
          p.name,
          p.priority,
          COALESCE(m.is_preferred, false) as is_preferred
        FROM ai_providers p
        LEFT JOIN ai_prompt_provider_mapping m ON p.id = m.provider_id AND m.prompt_id = $1
        WHERE p.is_active = true
        ORDER BY
          COALESCE(m.is_preferred, false) DESC,
          p.priority DESC,
          p.name ASC
      `, [promptId]);

      const providerNames = result.rows.map(row => row.name);

      // Filter out unavailable providers
      const dbProviders = providerNames.filter(name => {
        const provider = this.providers[name];
        return provider && provider.isAvailable && provider.isAvailable();
      });

      // Always include code-registered providers that aren't tracked in the DB
      // (e.g. nvidia, ollama) so new free providers are used without a migration.
      const extra = Object.keys(this.providers).filter(
        (name) => this.providers[name]?.isAvailable?.() && !dbProviders.includes(name)
      );
      let availableProviders = [...dbProviders, ...extra];

      // Nephesh is Truegle's own model — when configured it outranks every
      // DB-tracked provider regardless of stored priorities.
      if (availableProviders.includes('nephesh')) {
        availableProviders = ['nephesh', ...availableProviders.filter((n) => n !== 'nephesh')];
      }

      if (availableProviders.length === 0) {
        throw new Error('No AI providers available');
      }

      logger.debug('Provider order determined:', { providers: availableProviders });
      return availableProviders;

    } catch (error) {
      logger.error('Error determining provider order:', { error: error.message });

      // Fallback to hardcoded priority (Nephesh first, then interim providers)
      return ['nephesh', 'groq', 'gemini', 'nvidia', 'openai', 'anthropic', 'ollama'].filter(name => {
        const provider = this.providers[name];
        return provider && provider.isAvailable && provider.isAvailable();
      });
    }
  }

  /**
   * Health check across all providers
   * @returns {Promise<object>} Health status for all providers
   */
  async healthCheck() {
    const results = {};

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        if (provider.healthCheck) {
          results[name] = await provider.healthCheck();
        } else {
          results[name] = {
            status: provider.isAvailable && provider.isAvailable() ? 'available' : 'unavailable',
            message: provider.isAvailable && provider.isAvailable() ? 'Provider configured' : 'Provider not configured'
          };
        }
      } catch (error) {
        results[name] = {
          status: 'error',
          message: error.message
        };
      }
    }

    // Overall status
    const healthyProviders = Object.values(results).filter(
      r => r.status === 'healthy' || r.status === 'available'
    ).length;

    return {
      status: healthyProviders > 0 ? 'operational' : 'degraded',
      providers: results,
      healthyCount: healthyProviders,
      totalCount: Object.keys(this.providers).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get cache key for a request. `variant` distinguishes otherwise-identical
   * message+context requests that differ in system prompt (e.g. nepheshMode/
   * verbose toggles) so they don't collide in the cache.
   * @param {string} message - User message
   * @param {string} context - Context
   * @param {string} [variant] - system prompt or other cache-relevant variant
   * @returns {string} Cache key
   */
  getCacheKey(message, context, variant = '') {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${context}:${variant}:${message}`)
      .digest('hex');
    return `unified:${hash}`;
  }

  /**
   * Cache a response
   * @param {string} key - Cache key
   * @param {object} data - Response data
   */
  cacheResponse(key, data) {
    // Enforce max cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Unified AI cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Get list of available providers
   * @returns {array} Provider names
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([name, provider]) => provider.isAvailable && provider.isAvailable())
      .map(([name]) => name);
  }

  /**
   * Get provider by name
   * @param {string} name - Provider name
   * @returns {object} Provider instance
   */
  getProvider(name) {
    return this.providers[name];
  }
}

// Export singleton instance
module.exports = new UnifiedAIService();
