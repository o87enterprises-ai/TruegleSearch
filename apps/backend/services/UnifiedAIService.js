/**
 * UnifiedAIService - Multi-Provider AI Orchestration
 * Manages multiple AI providers with automatic failover and context-aware prompt selection
 */

const NepheshService = require('./NepheshService');
const attribution = require('../utils/nepheshAttribution');
const { CONCEPTUAL_FALLBACK } = require('../prompts/nepheshPrompts');
const config = require('../config/env');
const GroqService = require('./GroqService');
const NvidiaService = require('./NvidiaService');
const OpenAIService = require('./OpenAIService');
const AnthropicService = require('./AnthropicService');
const GeminiService = require('./GeminiService');
const OllamaService = require('./OllamaService');
const TrueCodeService = require('./TrueCodeService');
const PromptService = require('./PromptService');
const { query } = require('../db/connection');
const logger = require('../utils/logger');
const promptRouter = require('./PromptRouter');
const osintToolbelt = require('./OsintToolbelt');

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
      // The owner's own endpoint — the refusal fallback the substrate
      // providers cannot be. Inert until TRUECODE_URL is set.
      truecode: new TrueCodeService(),
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
      // Normalize prior-turn history into clean {role, content} pairs. This is
      // what makes the chat an actual back-and-forth: without it every send is
      // a cold, contextless request and "the fish" forgets what you just asked.
      const history = this.sanitizeHistory(options.history);

      // Check cache first. Include systemOverride (which encodes nepheshMode/
      // verbose) in the key — otherwise toggling those on an identical
      // message+context would silently return a stale cached response from
      // before the toggle. Multi-turn conversations bypass the cache entirely:
      // the same follow-up ("why?") means different things in different threads.
      const cacheKey = this.getCacheKey(userMessage, context, options.systemOverride);
      if (history.length === 0 && !options.imageDataUrl && !options.searchResults) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
          logger.debug('Unified AI cache hit:', { context });
          return { ...cached.data, fromCache: true };
        }
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

      // An attached image turns the user message into a multimodal content
      // array (OpenAI/Groq vision shape) instead of a plain string. Only Groq
      // is wired for vision right now, so an image-attached turn skips normal
      // provider ordering and goes straight to Groq on its vision model —
      // sending an image to a text-only model would just be ignored/error.
      const hasImage = typeof options.imageDataUrl === 'string' && options.imageDataUrl.startsWith('data:image/');
      const userContent = hasImage
        ? [
            { type: 'text', text: userMessage || 'Describe this image and extract any visible text or data from it.' },
            { type: 'image_url', image_url: { url: options.imageDataUrl } },
          ]
        : userMessage;

      // Ground the answer in real search results when the caller has them.
      // `variables.searchResults` above only reaches the model when the DB
      // prompt path interpolates it — which never happens once systemOverride
      // (the mode prompts every chat call uses) is set, so search results were
      // silently discarded and the model answered from training knowledge
      // alone while a genuinely-fetched, unrelated citations list got shown
      // underneath it. Inject explicitly here so it applies regardless of
      // which system prompt is active.
      const groundingMessage = options.searchResults
        ? [{
            role: 'system',
            content: `SEARCH RESULTS (use ONLY these for specific facts, citations, titles, or figures you're not certain of from your own knowledge; if they don't cover what's asked, say so plainly — never invent a source, study, article, or statistic):\n\n${options.searchResults}`,
          }]
        : [];

      // Build messages array: system prompt, grounding (if any), prior
      // conversation turns, then the new user message. History is capped in
      // sanitizeHistory() so a long thread can't blow the context window.
      const messages = [
        { role: 'system', content: basePrompt },
        ...groundingMessage,
        ...history,
        { role: 'user', content: userContent }
      ];

      // Get provider order (with preferred provider for this context)
      const providerOrder = hasImage ? ['groq'] : await this.getProviderOrder(prompt.id);
      const providerOptions = hasImage ? { model: config.ai.groq.visionModel } : {};

      // Try each provider in order with failover
      let lastError = null;
      let refusalResponse = null; // remembered so we can return it if ALL refuse
      for (let i = 0; i < providerOrder.length; i++) {
        const providerName = providerOrder[i];
        const isLast = i === providerOrder.length - 1;
        try {
          logger.debug(`Attempting AI request with provider: ${providerName}`);

          const response = await this.callProvider(
            providerName,
            messages,
            {
              ...options,
              temperature: prompt.temperature,
              // Honor a caller-supplied cap (e.g. vs/Null-Prime mode needs a
              // larger budget so the dual-audit scaffold isn't truncated
              // mid-answer); fall back to the prompt/default cap otherwise.
              max_tokens: options.maxTokens || prompt.max_tokens,
              system: basePrompt,
              ...providerOptions,
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

          // Refusal-aware failover: substrate models (Groq's Llama etc.) carry
          // their own RLHF guardrails that refuse lawful requests Nephesh's
          // own prompt explicitly permits (e.g. compiling public records about
          // a named person). When a provider refuses, try the NEXT provider
          // before giving up — different substrates refuse different things.
          // Only return a refusal if every provider refuses.
          // NOTE the missing `&& !isLast`. It used to be there, and it meant a
          // refusal from the FINAL provider returned straight from this loop —
          // so with a single provider configured (Groq is the live engine)
          // every refusal short-circuited here and nothing downstream ever ran.
          // That silently disabled the conceptual fallback in exactly the setup
          // that ships. A refusal is now always remembered and always falls out
          // of the loop; the post-loop path decides what to do with it.
          //
          // It also means a refusal is never cached. Caching one pinned the
          // canned "I can't help with that" to that question for a full hour,
          // so a retry that would have worked never got the chance.
          if (this.isRefusalContent(this.contentOf(response))) {
            logger.info('Provider refused, trying the next one:', { provider: providerName, context, isLast });
            if (!refusalResponse) refusalResponse = branded; // keep first as fallback
            continue;
          }

          // Cache successful response — but only for single-turn, text-only
          // requests. A multi-turn answer is specific to its thread and must
          // never be served to a different conversation that happens to share
          // the last message text; an image-attached answer is specific to
          // THAT image and must never be served for a different photo that
          // happens to share the same typed caption.
          if (history.length === 0 && !hasImage && !options.searchResults) this.cacheResponse(cacheKey, branded);

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

      // Every provider either errored or refused.
      if (refusalResponse) {
        // SECOND ASK, before settling for the canned no. Every substrate has
        // refused the question as put — but a refusal is about HOW something
        // was asked at least as often as what was asked, and the conceptual
        // version of the same question is usually ordinary published
        // knowledge. So ask once more for the encyclopedia entry instead of
        // the manual (see CONCEPTUAL_FALLBACK, which draws that line).
        //
        // Opt-in per caller, not automatic: the research modes have their own
        // framing and should not have a second, differently-worded answer
        // silently substituted underneath them.
        if (options.conceptualFallback) {
          const softened = await this.conceptualRetry({
            messages, basePrompt, providerOrder, providerOptions, prompt, options, context,
          });
          if (softened) {
            return { ...softened, fromCache: false, context, promptVersion: prompt.version, softened: true };
          }
        }
        // Still no. Hand back the refusal — a real answer the caller can show
        // beats throwing.
        return { ...refusalResponse, fromCache: false, context, promptVersion: prompt.version };
      }
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
        searchResults: toolText ? `${toolText}\n\n${content || ''}` : content,
        perspective: options.perspective || 'Neutral',
        timestamp: new Date().toISOString()
      };

      // THE PROMPT ROUTER. A caller with its own system prompt (the versioned
      // TrueGLE mode prompts) still wins — that contract is unchanged. What
      // changes is the DEFAULT: instead of one general instruction block
      // interpolated with the query, the context, the results and a
      // perspective on every call, a short base plus one short flow chosen for
      // THIS question. A page of instructions gives a model more to contradict
      // and more room to answer confidently off-topic, which is what the
      // hallucination was.
      //
      // Deterministic heuristics, no second model and no extra request — see
      // PromptRouter. Set PROMPT_ROUTER=off to fall straight back to the
      // database prompt.
      let routed = null;
      if (!options.systemOverride && promptRouter.enabled()) {
        routed = promptRouter.route(queryContext || context, {
          mode: options.mode || options.perspectiveMode,
          hasSources: !!(content && String(content).trim())
            || osintToolbelt.hasEntities(queryContext),
        });
        logger.info('Prompt routed', { flow: routed.flow, chars: routed.system.length });
      }

      // TOOLS BEFORE ANSWERING. If the question names a domain, IP, email,
      // phone number or username, run the lookups instead of describing how
      // the user could run them — that advice-instead-of-answer behaviour was
      // never a prompt problem, it was the assistant genuinely having no way
      // to reach lookups that already existed and already worked.
      //
      // Runs on ANY flow that names an entity, not just the investigative
      // ones. "who owns bulsis.com" routes to `lookup` — and whois IS the
      // answer to it, so gating on `investigate` would have missed the most
      // common case. The detector earns that breadth by being conservative:
      // a username needs an explicit @handle or "username: x", a domain needs
      // a real TLD shape, a person needs stated lookup intent. Ordinary
      // questions detect nothing and cost nothing.
      //
      // `compute` is the one exclusion — a ten-digit figure in a calculation
      // reads as a phone number, and nobody doing arithmetic wants a carrier
      // lookup.
      let toolText = '';
      const toolable = routed && routed.flow !== 'compute';
      if (toolable && osintToolbelt.hasEntities(queryContext)) {
        const tools = await osintToolbelt.run(queryContext);
        if (tools.ran) {
          toolText = tools.text;
          logger.info('OSINT toolbelt attached', { entities: tools.entities });
        }
      }

      const systemPrompt = options.systemOverride
        || (routed && routed.system)
        || this.promptService.interpolatePrompt(prompt.prompt_text, variables);

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
            // Live lookup output goes FIRST — it was retrieved just now and is
            // the most reliable thing in the context.
            toolText ? `${toolText}\n\n${content || ''}` : content,
            queryContext,
            {
              ...options,
              system: systemPrompt,
              // A flow knows what it needs: a calculation wants temperature 0
              // and a deep investigation wants room. The single DB-wide value
              // could only ever be a compromise between the two.
              temperature: routed ? routed.temperature : prompt.temperature,
              // Honor a caller-supplied cap (vs/Null-Prime summaries need room
              // for the full audit scaffold); default otherwise.
              max_tokens: options.maxTokens || (routed ? routed.maxTokens : prompt.max_tokens)
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

      // TrueCode goes LAST, always. It exists to answer what the others
      // refused, so it must sit at the end of the failover chain rather than
      // take ordinary traffic — and being last is what puts it in front of the
      // conceptual fallback, which only runs once every provider has refused.
      if (availableProviders.includes('truecode')) {
        availableProviders = [...availableProviders.filter((n) => n !== 'truecode'), 'truecode'];
      }

      if (availableProviders.length === 0) {
        throw new Error('No AI providers available');
      }

      logger.debug('Provider order determined:', { providers: availableProviders });
      return availableProviders;

    } catch (error) {
      logger.error('Error determining provider order:', { error: error.message });

      // Fallback to hardcoded priority (Nephesh first, then interim providers)
      return ['nephesh', 'groq', 'gemini', 'nvidia', 'openai', 'anthropic', 'ollama', 'truecode'].filter(name => {
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
  /**
   * Normalize caller-supplied conversation history into a clean, bounded array
   * of {role:'user'|'assistant', content:string} turns. Guards against junk
   * (missing roles, non-string content, the welcome/system message leaking in)
   * and caps length so a long thread can't overflow the model context window.
   */
  sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    const MAX_TURNS = 12; // last N turns is plenty of working memory
    const MAX_CHARS = 4000; // per-turn clamp against pathological pastes
    const cleaned = [];
    for (const turn of history) {
      if (!turn || typeof turn !== 'object') continue;
      const role = turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null;
      if (!role) continue;
      const content = typeof turn.content === 'string' ? turn.content.trim() : '';
      if (!content) continue;
      cleaned.push({ role, content: content.slice(0, MAX_CHARS) });
    }
    return cleaned.slice(-MAX_TURNS);
  }

  getCacheKey(message, context, variant = '') {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${context}:${variant}:${message}`)
      .digest('hex');
    return `unified:${hash}`;
  }

  /**
   * Pull the text content out of a provider response (shape varies by provider).
   */
  contentOf(response) {
    if (!response) return '';
    return (
      response.content ||
      response.response ||
      response.choices?.[0]?.message?.content ||
      ''
    );
  }

  /**
   * One more attempt after every provider has refused, asking for the concept
   * instead of the procedure.
   *
   * The ONLY thing that changes is the system prompt — the user's own words are
   * sent again verbatim. Rewriting someone's question into a softer one behind
   * their back and answering that instead would be putting words in their mouth
   * and would make the answer quietly about something they didn't ask.
   *
   * @returns a branded response, or null if this pass refused too (or errored),
   *          in which case the caller falls back to the original refusal.
   */
  async conceptualRetry({ messages, basePrompt, providerOrder, providerOptions, prompt, options, context }) {
    const system = `${basePrompt}\n\n${CONCEPTUAL_FALLBACK}`;
    // Same conversation, new standing orders.
    const retryMessages = messages.map((m, i) => (i === 0 && m.role === 'system' ? { ...m, content: system } : m));

    for (const providerName of providerOrder) {
      try {
        const response = await this.callProvider(providerName, retryMessages, {
          ...options,
          temperature: prompt.temperature,
          max_tokens: options.maxTokens || prompt.max_tokens,
          system,
          ...providerOptions,
        });
        const branded = providerName === 'nephesh' ? response : attribution.stampResponse(response);
        if (this.isRefusalContent(this.contentOf(response))) {
          logger.info('Conceptual fallback also refused:', { provider: providerName, context });
          continue;
        }
        logger.info('Conceptual fallback answered a refused request:', { provider: providerName, context });
        return branded;
      } catch (error) {
        logger.warn(`Conceptual fallback provider ${providerName} failed:`, { error: error.message });
      }
    }
    // NOT CACHED, deliberately: this answer is a second-best substitute for a
    // question that was refused, and serving it from cache to a later, possibly
    // differently-worded ask would spread the substitution silently.
    return null;
  }

  /**
   * Heuristic: does this response read like a canned RLHF refusal rather than
   * an actual answer? Used to fail over to another provider (see chat()).
   * Kept tight — only the opening of the response, short, and clearly a
   * refusal — so real answers that merely mention "I can't confirm X" don't
   * trip it.
   */
  isRefusalContent(text) {
    if (typeof text !== 'string') return false;
    const head = text.trim().slice(0, 300);
    if (head.length === 0) return true; // empty answer = treat as failure
    return (
      /\bI(?:'m| am)? ?(?:really |very |so )?sorry,? (?:but )?I ?(?:can(?:'|no)?t|cannot|won'?t|am (?:unable|not able))/i.test(head) ||
      /\bI ?(?:can(?:'|no)?t|cannot|won'?t|am (?:unable|not able) to) (?:help|assist|provide|comply|do that|fulfill|create|generate|share)/i.test(head) ||
      /\bI(?:'m| am) (?:unable|not able) to (?:help|assist|provide|comply)/i.test(head) ||
      /\b(?:I must|I have to) (?:decline|refuse)/i.test(head) ||
      /\bthat request (?:goes against|violates|isn'?t something I can)/i.test(head)
    );
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
