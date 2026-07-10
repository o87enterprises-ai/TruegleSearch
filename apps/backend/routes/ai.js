const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const AIService = require('../services/AIService');
const TokenService = require('../services/TokenService');
const UnifiedAIService = require('../services/UnifiedAIService');
const QueryInterpreter = require('../services/QueryInterpreter');
const DeepResearchService = require('../services/DeepResearchService');
const logger = require('../utils/logger');

const deepResearch = new DeepResearchService();

// Initialize AI services
const aiService = new AIService(); // Legacy service for /summary and /deepseek endpoints
const unifiedAI = UnifiedAIService; // New unified service with context-aware prompts

// Unified AI client with multi-provider failover and context support
const aiClient = {
  async chat(message, context = 'general', options = {}) {
    try {
      return await unifiedAI.chat(message, context, options);
    } catch (error) {
      logger.error('Unified AI chat failed:', { error: error.message, context });
      throw error;
    }
  },

  async analyzeContent(content, context = 'general', queryContext = null, options = {}) {
    try {
      return await unifiedAI.analyzeContent(content, context, queryContext, options);
    } catch (error) {
      logger.error('Unified AI analyze failed:', { error: error.message, context });
      throw error;
    }
  },

  async healthCheck() {
    try {
      return await unifiedAI.healthCheck();
    } catch (error) {
      logger.error('AI health check failed:', { error: error.message });
      return { status: 'unhealthy', message: error.message };
    }
  }
};

logger.info('✅ Unified AI services initialized: OpenRouter + OpenAI + Anthropic + Gemini');

/**
 * @route   POST /api/ai/chat
 * @desc    Get AI response for a user query with context-aware prompts
 * @access  Private (requires authentication)
 * @body    { message: string, context?: string, nepheshMode?: boolean, verbose?: boolean, options?: object }
 */
// Mode-specific system prompts (versioned, shared with the self-hosted
// Nephesh model) — see prompts/nepheshPrompts.js for the source of truth.
// nepheshMode/verbose are opt-in flags layered onto the mode prompt by
// getModePrompt(), not baked into the mode text (see that file's doc comment).
const { getModePrompt } = require('../prompts/nepheshPrompts');

router.post('/chat', optionalAuth, rateLimitSearch, async (req, res) => {
  try {
    const { message, context = 'general', nepheshMode = false, verbose = false, options = {} } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'AI message is required and must be a non-empty string'
      });
    }

    const user = req.user;
    const isAuthed = user?.isAuthenticated && user?.userId;

    // Only enforce token gate for signed-in users
    if (isAuthed) {
      const canAccess = await TokenService.canAccessFeature(user.userId, 'ai-chat');
      if (!canAccess) {
        return res.status(402).json({
          error: 'Insufficient tokens',
          message: 'Not enough tokens to access AI chat. Please watch an ad or upgrade your account.'
        });
      }
    }

    // Mode-specific system prompt, with Nephesh mode (dual-audit protocol)
    // and verbosity layered on per the caller's toggles.
    const systemOverride = getModePrompt(context, { nepheshMode, verbose });
    const response = await aiClient.chat(message, context, {
      ...options,
      userName: isAuthed ? (user.name || 'User') : 'Guest',
      systemOverride,
    });

    // Deduct token for authenticated users
    if (isAuthed && !response.fromCache) {
      await TokenService.spendToken(user.userId, 'ai-chat');
    }

    logger.info('AI chat successful:', {
      userId: isAuthed ? user.userId : 'guest',
      context,
      fromCache: response.fromCache,
      provider: response.provider
    });

    res.json({
      success: true,
      message: message.trim(),
      response: response,
      fromCache: response.fromCache || false,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI chat error:', { error: error.message, userId: req.user?.id });

    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'AI usage limit reached. Please try again later.',
      });
    }

    if (error.message.includes('API key') || error.message.includes('authentication')) {
      return res.status(500).json({
        error: 'AI service configuration error',
        message: 'AI service is temporarily unavailable due to configuration issues.',
      });
    }

    res.status(500).json({
      error: 'AI request failed',
      message: 'Unable to process AI request at this time. Please try again.',
    });
  }
});

/**
 * @route   POST /api/ai/deep-research
 * @desc    Nephesh deep-dive research: gathers web/news/social/video material
 *          (including YouTube transcripts) via the self-hosted metasearch
 *          layer and synthesizes a multi-perspective, source-cited report.
 * @access  Public with optional auth (token-gated for signed-in users)
 * @body    { query: string, mode?: string, maxTranscripts?: number }
 */
router.post('/deep-research', optionalAuth, rateLimitSearch, async (req, res) => {
  try {
    const { query: researchQuery, mode = 'blue', maxTranscripts } = req.body;

    if (!researchQuery || typeof researchQuery !== 'string' || researchQuery.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Research query is required and must be a non-empty string'
      });
    }

    const user = req.user;
    const isAuthed = user?.isAuthenticated && user?.userId;

    // Deep research costs an ai-chat token for signed-in users (same gate as chat)
    if (isAuthed) {
      const canAccess = await TokenService.canAccessFeature(user.userId, 'ai-chat');
      if (!canAccess) {
        return res.status(402).json({
          error: 'Insufficient tokens',
          message: 'Not enough tokens for deep research. Please watch an ad or upgrade your account.'
        });
      }
    }

    const result = await deepResearch.research(researchQuery.trim(), { mode, maxTranscripts });

    if (isAuthed) {
      await TokenService.spendToken(user.userId, 'ai-chat');
    }

    logger.info('Deep research successful:', {
      userId: isAuthed ? user.userId : 'guest',
      mode,
      provider: result.provider,
      sources: result.sources.length,
      transcripts: result.transcriptsUsed,
    });

    res.json({
      success: true,
      query: researchQuery.trim(),
      mode,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Deep research error:', { error: error.message, userId: req.user?.userId });

    if (error.message.includes('No research material')) {
      return res.status(503).json({
        error: 'Research sources unavailable',
        message: 'The research providers are temporarily unreachable. Please try again shortly.',
      });
    }

    res.status(500).json({
      error: 'Deep research failed',
      message: 'Unable to complete deep research at this time. Please try again.',
    });
  }
});

/**
 * @route   POST /api/ai/analyze-content
 * @desc    Analyze content and return perspective-tagged results with context-aware prompts
 * @access  Private
 * @body    { content: string, context?: string, queryContext?: string, options?: object }
 */
router.post('/analyze-content', authenticate, rateLimitSearch, async (req, res) => {
  try {
    const { content, context = 'general', queryContext, options = {} } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Content to analyze is required and must be a non-empty string'
      });
    }

    // Check if user has sufficient tokens for AI access
    const user = req.user;
    const canAccess = await TokenService.canAccessFeature(user.id, 'ai-analyze');

    if (!canAccess) {
      return res.status(402).json({
        error: 'Insufficient tokens',
        message: 'Not enough tokens to access AI analysis. Please watch an ad or upgrade your account.'
      });
    }

    // Perform content analysis with context
    const response = await aiClient.analyzeContent(content, context, queryContext, {
      ...options,
      userName: user.name || 'User'
    });

    // Deduct token if not from cache
    if (!response.fromCache) {
      await TokenService.spendToken(user.id, 'ai-analyze');
    }

    logger.info('AI analyze successful:', {
      userId: user.id,
      context,
      provider: response.provider
    });

    res.json({
      success: true,
      content: content.substring(0, 100) + '...', // Truncate for response
      queryContext: queryContext || null,
      analysis: response,
      fromCache: response.fromCache || false,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI content analysis error:', { error: error.message, userId: req.user?.id });

    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'AI usage limit reached. Please try again later.',
      });
    }

    if (error.message.includes('API key') || error.message.includes('authentication')) {
      return res.status(500).json({
        error: 'AI service configuration error',
        message: 'AI service is temporarily unavailable due to configuration issues.',
      });
    }

    res.status(500).json({
      error: 'AI analysis failed',
      message: 'Unable to process AI analysis at this time. Please try again.',
    });
  }
});

/**
 * @route   GET /api/ai/health
 * @desc    Check AI service health across all providers
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await aiClient.healthCheck();

    const statusCode = health.status === 'operational' ? 200 :
                      health.status === 'degraded' ? 503 : 503;

    res.status(statusCode).json({
      ...health,
      service: 'Unified AI Service (Multi-Provider)',
    });
  } catch (error) {
    logger.error('AI health check failed:', { error: error.message });
    res.status(503).json({
      status: 'error',
      error: 'AI service health check failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Page mode -> DB prompt context, so the AI summary actually uses the
// mode-appropriate prompt instead of always using 'search_results'.
const MODE_TO_AI_CONTEXT = {
  'blue-pill': 'search_results',
  green: 'search_results',
  ocean: 'osint',
  'red-pill': 'biased_results',
  purple: 'purple',
};

// Mirrors SearchService.categorizeByBias's tiers/labels so the red-pill
// perspective list always matches the bias classification already attached
// to the actual results, instead of the AI inventing its own categories.
const BIAS_TIER_LABELS = {
  left: 'Left-Leaning',
  right: 'Right-Leaning',
  center: 'Center',
  unbiased: 'Fact-Based',
  neutral: 'Unclassified',
  mainstream: 'Mainstream Media',
  alternative: 'Alternative Media',
  conspiracy: 'Fringe / Conspiracy',
  independent: 'Independent',
};

// Generic, neutral one-line description per tier — always available as a
// fallback so the perspective list is never empty even if AI enrichment fails.
const BIAS_TIER_BLURBS = {
  left: 'Sources generally associated with progressive or left-leaning framing.',
  right: 'Sources generally associated with conservative or right-leaning framing.',
  center: 'Sources aiming for centrist, cross-partisan framing.',
  unbiased: 'Fact-checking or wire-service sources with minimal editorial framing.',
  neutral: 'Sources without a clearly classified editorial slant.',
  mainstream: 'Large, widely-syndicated outlets and platforms.',
  alternative: 'Independent or non-corporate outlets outside the mainstream press.',
  conspiracy: 'Fringe sources that often promote unverified or contested claims.',
  independent: 'Independent journalists, blogs, and creator-published sources.',
};

// Representative purple-mode PerspectiveSelector id for each bias tier, so a
// "deep dive" click can jump straight into the existing strict perspective filter.
const BIAS_TIER_TO_PERSPECTIVE_ID = {
  left: 'liberal',
  right: 'conservative',
  center: 'centrist',
  unbiased: 'scientific',
  neutral: 'neutral',
  mainstream: 'mainstream',
  alternative: 'alternative',
  conspiracy: 'conspiracy',
  independent: 'independent',
};

function formatResultsForPrompt(results) {
  return results.map((r) => `${r.title}: ${r.snippet || ''}`).join('\n');
}

// Round-robin sample across bias tiers so the AI summary reflects a balanced
// cross-section of sources instead of whichever tier happened to rank first
// (the root cause of the AI summary reading like it took one article as the truth).
function buildDiverseSample(results, limit = 8) {
  const groups = new Map();
  for (const r of results) {
    const key = r.bias || 'neutral';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const groupArrays = [...groups.values()];
  const sample = [];
  let index = 0;
  while (sample.length < limit && groupArrays.some((g) => index < g.length)) {
    for (const group of groupArrays) {
      if (index < group.length) sample.push(group[index]);
      if (sample.length >= limit) break;
    }
    index++;
  }
  return sample;
}

// Deterministic perspective breakdown built directly from the bias tiers
// actually present in the result set — never invented by the AI, so red-pill
// always presents real, neutral multiple choices instead of one biased paragraph.
function buildPerspectiveBreakdown(results) {
  const groups = new Map();
  for (const r of results) {
    const tier = r.bias || 'neutral';
    if (!groups.has(tier)) groups.set(tier, []);
    groups.get(tier).push(r);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tier, items]) => ({
      id: tier,
      perspectiveId: BIAS_TIER_TO_PERSPECTIVE_ID[tier] || 'neutral',
      label: BIAS_TIER_LABELS[tier] || 'Unclassified',
      count: items.length,
      summary: BIAS_TIER_BLURBS[tier] || BIAS_TIER_BLURBS.neutral,
      sample: items.slice(0, 3).map((r) => ({ title: r.title, snippet: r.snippet || '' })),
    }));
}

// Best-effort: ask the AI for one neutral sentence per perspective tier
// describing what that tier's sources actually emphasize on this query.
// Falls back silently to the generic BIAS_TIER_BLURBS on any failure (bad
// JSON, provider outage, etc.) so the perspective list is always populated.
async function enrichPerspectiveSummaries(query, perspectives) {
  if (!perspectives.length) return perspectives;

  try {
    const groupText = perspectives
      .map((p) => `id: ${p.id}\n${p.sample.map((s) => `- ${s.title}: ${s.snippet}`).join('\n')}`)
      .join('\n\n');

    const prompt = `Query: "${query}"\n\nGroups of sources by classification:\n\n${groupText}\n\nFor each group id above, write ONE neutral sentence (max 25 words) describing what that group's sources emphasize about this topic. Do not state opinions as fact or say which group is correct. Respond with ONLY a JSON array, no markdown, no commentary: [{"id":"<group id>","summary":"<sentence>"}]`;

    const result = await aiClient.chat(prompt, 'general', {
      systemOverride: 'You are a neutral content classifier. Respond with strictly valid JSON only, no markdown formatting.',
      maxTokens: 600,
      temperature: 0.3,
    });

    const text = result.content || result.response || '';
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    const bare = text.match(/(\[[\s\S]*\])/);
    const parsed = JSON.parse(fenced ? fenced[1] : bare ? bare[1] : text);
    if (!Array.isArray(parsed)) return perspectives;

    const byId = new Map(
      parsed.filter((p) => p && p.id && p.summary).map((p) => [p.id, p.summary])
    );
    return perspectives.map((p) => (byId.has(p.id) ? { ...p, summary: byId.get(p.id) } : p));
  } catch (error) {
    logger.warn('Perspective enrichment failed, using fallback blurbs:', { error: error.message });
    return perspectives;
  }
}

function fallbackSummary(mode, query) {
  if (mode === 'red-pill') {
    return `Coverage of "${query}" spans multiple perspectives below — pick one to explore in depth.`;
  }
  if (mode === 'purple') {
    return `No AI analysis is available right now for the selected perspective(s) on "${query}". Review the filtered results below.`;
  }
  return `Search results for "${query}" cover multiple sources. Review the results below for more information.`;
}

/**
 * @route   POST /api/ai/summary
 * @desc    Generate AI summary of search results (public, rate limited)
 * @access  Public
 * @body    { query, results, mode?, perspectives? }
 */
router.post('/summary', rateLimitSearch, async (req, res) => {
  const { query, results, mode = 'blue-pill', perspectives = [], isQuestion = false, nepheshMode = false, verbose = false } = req.body;

  try {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required and must be a non-empty string',
      });
    }

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Results array is required',
      });
    }

    // Red-pill mode: a neutral, multiple-choice list of perspectives grounded
    // in the bias classification already attached to the results — replaces
    // the old single biased paragraph that read like it took one article as the truth.
    if (mode === 'red-pill') {
      let breakdown = buildPerspectiveBreakdown(results);
      breakdown = await enrichPerspectiveSummaries(query, breakdown);
      breakdown = breakdown.map(({ sample, ...rest }) => rest);

      return res.json({
        success: true,
        query: query.trim(),
        mode,
        summary: fallbackSummary(mode, query),
        perspectives: breakdown,
        sourcesAnalyzed: results.length,
        model: 'perspective-breakdown',
        timestamp: new Date().toISOString(),
      });
    }

    const aiContext = MODE_TO_AI_CONTEXT[mode] || 'search_results';
    // Purple results are already strictly filtered to the selected
    // perspective(s), so use them as-is; everything else gets a diversified
    // sample so the summary can't just echo whichever tier ranked first.
    const sample = mode === 'purple' ? results.slice(0, 8) : buildDiverseSample(results, 8);
    const searchContext = formatResultsForPrompt(sample);
    const selectedPerspective = Array.isArray(perspectives) && perspectives.length > 0
      ? perspectives.join(', ')
      : 'Neutral';

    // Question-phrased queries get an instruction to answer directly up
    // front, so the frontend can surface that opening line as a quick-answer
    // card instead of making the user read the whole summary to find it.
    const queryForAi = isQuestion
      ? `${query}\n\n(This is a direct question — answer it in the first sentence, plainly and concisely, then add supporting context.)`
      : query;

    // Mode-specific system prompt, with Nephesh mode (dual-audit protocol)
    // and verbosity layered on per the caller's toggles — same source of
    // truth as /chat, so summaries and follow-up chat behave consistently.
    const systemOverride = getModePrompt(aiContext, { nepheshMode, verbose });

    // Try unified AI service first (with multi-provider failover)
    try {
      const aiResponse = await aiClient.analyzeContent(searchContext, aiContext, queryForAi, {
        searchResults: searchContext,
        perspective: selectedPerspective,
        systemOverride,
      });

      return res.json({
        success: true,
        query: query.trim(),
        mode,
        summary: aiResponse.content || aiResponse.response,
        isQuestion,
        perspectives: [],
        sourcesAnalyzed: sample.length,
        model: aiResponse.provider || 'unified-ai',
        timestamp: new Date().toISOString(),
      });
    } catch (aiError) {
      logger.warn('Unified AI failed, trying legacy service:', { error: aiError.message });

      // Fallback to legacy AIService
      const analysis = await aiService.getAnalysis(query, results);

      return res.json({
        success: true,
        query: query.trim(),
        mode,
        summary: analysis.summary,
        perspectives: [],
        sourcesAnalyzed: analysis.sourcesAnalyzed,
        model: analysis.model,
        timestamp: analysis.timestamp,
      });
    }
  } catch (error) {
    console.error('AI summary error:', error);

    // Return a fallback summary
    res.json({
      success: true,
      query: query || '',
      mode,
      summary: fallbackSummary(mode, query || ''),
      perspectives: [],
      sourcesAnalyzed: 0,
      model: 'fallback',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route   POST /api/ai/deepseek
 * @desc    DeepSeek API endpoint for perspective analysis (public)
 * @access  Public
 */
router.post('/deepseek', rateLimitSearch, async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query is required',
      });
    }

    // Use AI service to generate summary (will use HuggingFace or fallback)
    const summary = await aiService.generateSummary(query, []);

    // Generate perspectives
    const perspectives = [
      {
        type: 'left',
        title: 'Progressive View',
        summary: `Progressive perspectives on "${query}" emphasize social equity, environmental concerns, and systemic change.`,
      },
      {
        type: 'center',
        title: 'Balanced View',
        summary: `Mainstream analysis of "${query}" presents multiple viewpoints and focuses on consensus-driven understanding.`,
      },
      {
        type: 'right',
        title: 'Conservative View',
        summary: `Conservative perspectives on "${query}" emphasize traditional values, free markets, and individual responsibility.`,
      },
    ];

    res.json({
      success: true,
      summary: summary.summary,
      perspectives: perspectives,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('DeepSeek endpoint error:', error);

    res.json({
      success: true,
      summary: `Analysis of "${req.body.query}" reveals multiple perspectives across the political and social spectrum.`,
      perspectives: [
        { type: 'neutral', title: 'Overview', summary: 'Multiple viewpoints available in search results.' },
      ],
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Extract a JSON object from an AI response that may be fenced or padded with
 * prose. Returns the parsed object or null.
 */
function parseQuickAnswerJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const bare = text.match(/(\{[\s\S]*\})/);
  const candidate = fenced ? fenced[1] : bare ? bare[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * @route   POST /api/ai/quick-answer
 * @desc    DuckDuckGo-style answer box: for a question / factual-lookup query,
 *          return a short answer grounded strictly in the supplied search
 *          results, with the specific sources it drew from. Answers only when
 *          confident — otherwise `answer` is null and the frontend shows nothing.
 * @access  Public (rate limited)
 * @body    { query: string, results: Array }
 */
router.post('/quick-answer', rateLimitSearch, async (req, res) => {
  const { query, results } = req.body;
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';

  // Any failure below resolves to a null answer (HTTP 200) rather than an error,
  // so a missing answer simply hides the card and never disrupts the results page.
  const empty = (reason) => res.json({
    success: true, query: trimmedQuery, answer: null, sources: [], reason,
  });

  try {
    if (!trimmedQuery) {
      return res.status(400).json({ error: 'Invalid request', message: 'Query is required' });
    }
    if (!Array.isArray(results)) return empty('no_results');

    // Cheap gate: only spend an AI call on queries that plausibly have a
    // short, definitive answer.
    if (!QueryInterpreter.isAnswerableQuery(trimmedQuery)) return empty('not_answerable');

    const top = results
      .slice(0, 6)
      .filter((r) => r && (r.title || r.snippet));
    if (top.length === 0) return empty('no_results');

    const sourceLines = top
      .map((r, i) => `[${i}] ${r.title || ''} — ${(r.snippet || '').slice(0, 300)} (${r.domain || ''})`)
      .join('\n');

    const prompt =
      `Question: "${trimmedQuery}"\n\nSources:\n${sourceLines}\n\n` +
      `Answer the question in 1-2 short, factual sentences using ONLY the sources above. ` +
      `Respond with ONLY valid JSON (no markdown):\n` +
      `{"answer":"<your answer>","sources":[<indexes of the sources you used>]}\n` +
      `If the sources do not contain a clear, factual answer, respond with exactly: NO_ANSWER`;

    const systemOverride =
      'You are a search engine answer box. Answer in 1-2 short, factual sentences using ONLY the ' +
      'provided sources. Never invent facts or URLs, and never answer from your own knowledge if the ' +
      'sources do not support it. Respond with strictly valid JSON, or the single token NO_ANSWER.';

    const resp = await aiClient.chat(prompt, 'general', {
      systemOverride,
      maxTokens: 300,
      temperature: 0.2,
    });

    const text = (resp.content || resp.response || '').trim();
    if (!text || /^NO_ANSWER/i.test(text)) return empty('no_answer');

    const parsed = parseQuickAnswerJson(text);
    if (!parsed || typeof parsed.answer !== 'string' || !parsed.answer.trim()) {
      return empty('unparseable');
    }

    // Map the AI's cited indexes back to the real results so we only ever show
    // sources that actually exist (no hallucinated URLs). Fall back to the top
    // couple of results if the model didn't return usable indexes.
    const citedIdx = Array.isArray(parsed.sources) ? parsed.sources : [];
    let sources = citedIdx
      .map((i) => top[i])
      .filter(Boolean)
      .slice(0, 3)
      .map((r) => ({ title: r.title || r.domain || r.url, url: r.url, domain: r.domain || null }));
    if (sources.length === 0) {
      sources = top.slice(0, 2).map((r) => ({ title: r.title || r.domain || r.url, url: r.url, domain: r.domain || null }));
    }

    logger.info('Quick answer generated:', { query: trimmedQuery, sources: sources.length, provider: resp.provider });

    return res.json({
      success: true,
      query: trimmedQuery,
      answer: parsed.answer.trim(),
      sources,
      model: resp.provider || 'unified-ai',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('Quick answer failed (non-fatal):', { error: error.message });
    return empty('error');
  }
});

module.exports = router;