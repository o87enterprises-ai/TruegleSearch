const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const AIService = require('../services/AIService');
const TokenService = require('../services/TokenService');
const UnifiedAIService = require('../services/UnifiedAIService');
const logger = require('../utils/logger');

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
 * @body    { message: string, context?: string, options?: object }
 */
router.post('/chat', authenticate, rateLimitSearch, async (req, res) => {
  try {
    const { message, context = 'general', options = {} } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'AI message is required and must be a non-empty string'
      });
    }

    // Check if user has sufficient tokens for AI access
    const user = req.user;
    const canAccess = await TokenService.canAccessFeature(user.id, 'ai-chat');

    if (!canAccess) {
      return res.status(402).json({
        error: 'Insufficient tokens',
        message: 'Not enough tokens to access AI chat. Please watch an ad or upgrade your account.'
      });
    }

    // Perform AI chat using the unified client with context
    const response = await aiClient.chat(message, context, {
      ...options,
      userName: user.name || 'User'
    });

    // Deduct token if not from cache
    if (!response.fromCache) {
      await TokenService.spendToken(user.id, 'ai-chat');
    }

    logger.info('AI chat successful:', {
      userId: user.id,
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

/**
 * @route   POST /api/ai/summary
 * @desc    Generate AI summary of search results (public, rate limited)
 * @access  Public
 */
router.post('/summary', rateLimitSearch, async (req, res) => {
  try {
    const { query, results } = req.body;

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

    // Try unified AI service first (with multi-provider failover)
    try {
      const searchContext = results.slice(0, 5).map(r =>
        `${r.title}: ${r.snippet || ''}`
      ).join('\n');

      const aiResponse = await aiClient.analyzeContent(
        searchContext,
        'search_results',
        query,
        { searchResults: results }
      );

      // Get perspective analysis from legacy service
      const perspectives = await aiService.analyzePerspectives(query, results);

      return res.json({
        success: true,
        query: query.trim(),
        summary: aiResponse.content || aiResponse.response,
        perspectives: perspectives,
        sourcesAnalyzed: Math.min(results.length, 5),
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
        summary: analysis.summary,
        perspectives: analysis.perspectives,
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
      query: req.body.query || '',
      summary: `Search results for "${req.body.query}" cover multiple perspectives from various sources. Review the results below for comprehensive information.`,
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

module.exports = router;