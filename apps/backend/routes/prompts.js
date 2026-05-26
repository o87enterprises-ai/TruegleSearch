/**
 * Prompt Management Routes
 * Admin-only endpoints for managing AI prompts, variables, and providers
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const PromptService = require('../services/PromptService');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

// ============================================================================
// Public Endpoints
// ============================================================================

/**
 * GET /api/prompts/contexts
 * Get list of available contexts
 */
router.get('/contexts', async (req, res) => {
  try {
    const contexts = [
      {
        name: 'general',
        displayName: 'General Chat',
        description: 'Default AI assistant with radical transparency principles'
      },
      {
        name: 'search_results',
        displayName: 'Search Results',
        description: 'Unbiased analysis of search results from multiple perspectives'
      },
      {
        name: 'biased_results',
        displayName: 'Biased/Perspective Results',
        description: 'Perspective-specific analysis (Conservative, Liberal, etc.)'
      },
      {
        name: 'osint',
        displayName: 'OSINT Investigation',
        description: 'Open Source Intelligence investigation assistant'
      },
      {
        name: 'shopping',
        displayName: 'Shopping Assistant',
        description: 'Product analysis and comparison assistant'
      },
      {
        name: 'maps',
        displayName: 'Maps & Local',
        description: 'Location-based search and navigation assistant'
      }
    ];

    res.json({ success: true, contexts });

  } catch (error) {
    logger.error('Error fetching contexts:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contexts',
      message: error.message
    });
  }
});

// ============================================================================
// Admin-Only Endpoints
// ============================================================================

/**
 * GET /api/prompts/prompts
 * List all prompts with optional filters
 */
router.get('/prompts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { context, is_active, limit, offset } = req.query;

    const filters = {
      context,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    };

    const prompts = await PromptService.listPrompts(filters);

    res.json({
      success: true,
      prompts,
      count: prompts.length,
      filters
    });

  } catch (error) {
    logger.error('Error listing prompts:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list prompts',
      message: error.message
    });
  }
});

/**
 * GET /api/prompts/prompts/:id
 * Get a single prompt by ID
 */
router.get('/prompts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT
        p.*,
        json_agg(
          json_build_object(
            'id', v.id,
            'variable_name', v.variable_name,
            'description', v.description,
            'default_value', v.default_value,
            'is_required', v.is_required
          )
        ) FILTER (WHERE v.id IS NOT NULL) as variables
      FROM ai_prompts p
      LEFT JOIN ai_prompt_variables v ON p.id = v.prompt_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      });
    }

    res.json({
      success: true,
      prompt: result.rows[0]
    });

  } catch (error) {
    logger.error('Error fetching prompt:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prompt',
      message: error.message
    });
  }
});

/**
 * POST /api/prompts/prompts
 * Create a new prompt
 */
router.post('/prompts', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.userId;
    const promptData = req.body;

    // Validate required fields
    if (!promptData.name || !promptData.context || !promptData.prompt_text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['name', 'context', 'prompt_text']
      });
    }

    const newPrompt = await PromptService.createPrompt(promptData, userId);

    logger.info('Prompt created:', { promptId: newPrompt.id, userId });

    res.status(201).json({
      success: true,
      prompt: newPrompt,
      message: 'Prompt created successfully'
    });

  } catch (error) {
    logger.error('Error creating prompt:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create prompt',
      message: error.message
    });
  }
});

/**
 * PUT /api/prompts/prompts/:id
 * Update an existing prompt
 */
router.put('/prompts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { change_reason, ...updates } = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_by;
    delete updates.created_at;
    delete updates.updated_at;

    const updatedPrompt = await PromptService.updatePrompt(
      id,
      updates,
      userId,
      change_reason
    );

    logger.info('Prompt updated:', { promptId: id, userId });

    res.json({
      success: true,
      prompt: updatedPrompt,
      message: 'Prompt updated successfully'
    });

  } catch (error) {
    logger.error('Error updating prompt:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update prompt',
      message: error.message
    });
  }
});

/**
 * DELETE /api/prompts/prompts/:id
 * Delete a prompt (soft delete)
 */
router.delete('/prompts/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await PromptService.deletePrompt(id);

    logger.info('Prompt deleted:', { promptId: id, userId });

    res.json({
      success: true,
      message: 'Prompt deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting prompt:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete prompt',
      message: error.message
    });
  }
});

/**
 * GET /api/prompts/prompts/:id/history
 * Get version history for a prompt
 */
router.get('/prompts/:id/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const history = await PromptService.getHistory(id);

    res.json({
      success: true,
      history,
      count: history.length
    });

  } catch (error) {
    logger.error('Error fetching prompt history:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prompt history',
      message: error.message
    });
  }
});

/**
 * POST /api/prompts/prompts/:id/rollback
 * Rollback prompt to a previous version
 */
router.post('/prompts/:id/rollback', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { history_id } = req.body;
    const userId = req.user.userId;

    if (!history_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing history_id'
      });
    }

    const updatedPrompt = await PromptService.rollbackToVersion(
      id,
      history_id,
      userId
    );

    logger.info('Prompt rolled back:', { promptId: id, historyId: history_id, userId });

    res.json({
      success: true,
      prompt: updatedPrompt,
      message: 'Prompt rolled back successfully'
    });

  } catch (error) {
    logger.error('Error rolling back prompt:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to rollback prompt',
      message: error.message
    });
  }
});

/**
 * GET /api/prompts/prompts/:id/variables
 * Get variables for a prompt
 */
router.get('/prompts/:id/variables', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const variables = await PromptService.getVariables(id);

    res.json({
      success: true,
      variables,
      count: variables.length
    });

  } catch (error) {
    logger.error('Error fetching variables:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variables',
      message: error.message
    });
  }
});

/**
 * POST /api/prompts/prompts/:id/variables
 * Add a variable to a prompt
 */
router.post('/prompts/:id/variables', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const variableData = req.body;

    const newVariable = await PromptService.addVariable(id, variableData);

    logger.info('Variable added to prompt:', { promptId: id, variableName: variableData.variable_name });

    res.status(201).json({
      success: true,
      variable: newVariable,
      message: 'Variable added successfully'
    });

  } catch (error) {
    logger.error('Error adding variable:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add variable',
      message: error.message
    });
  }
});

/**
 * GET /api/prompts/providers
 * List all AI providers
 */
router.get('/providers', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM ai_providers
      ORDER BY priority DESC, name ASC
    `);

    res.json({
      success: true,
      providers: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching providers:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers',
      message: error.message
    });
  }
});

/**
 * PUT /api/prompts/providers/:id
 * Update a provider configuration
 */
router.put('/providers/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic UPDATE query
    const fields = Object.keys(updates).filter(f => ['display_name', 'is_active', 'priority', 'config'].includes(f));
    const values = fields.map(f => updates[f]);

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

    const result = await query(`
      UPDATE ai_providers
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *
    `, [...values, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    logger.info('Provider updated:', { providerId: id });

    res.json({
      success: true,
      provider: result.rows[0],
      message: 'Provider updated successfully'
    });

  } catch (error) {
    logger.error('Error updating provider:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update provider',
      message: error.message
    });
  }
});

/**
 * GET /api/prompts/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const stats = PromptService.getCacheStats();

    res.json({
      success: true,
      cache: stats
    });

  } catch (error) {
    logger.error('Error fetching cache stats:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache stats',
      message: error.message
    });
  }
});

/**
 * POST /api/prompts/cache/clear
 * Clear prompt cache
 */
router.post('/cache/clear', authenticate, requireAdmin, async (req, res) => {
  try {
    PromptService.clearCache();

    logger.info('Prompt cache cleared');

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing cache:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

module.exports = router;
