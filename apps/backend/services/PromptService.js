/**
 * PromptService - AI Prompt Management Service
 * Handles CRUD operations, template interpolation, versioning, and caching for AI prompts
 */

const { query } = require('../db/connection');
const logger = require('../utils/logger');

class PromptService {
  constructor() {
    // In-memory cache for prompt lookups
    this.promptCache = new Map();
    this.cacheTTL = 600000; // 10 minutes
    this.cacheEnabled = true;

    logger.info('PromptService initialized with caching enabled');
  }

  /**
   * Get active prompt by context
   * @param {string} context - Page context (general, search_results, biased_results, osint, shopping)
   * @param {object} options - Additional options
   * @returns {Promise<object>} Prompt object
   */
  async getPromptByContext(context, options = {}) {
    try {
      const cacheKey = `prompt:${context}`;

      // Check cache first
      if (this.cacheEnabled && !options.skipCache) {
        const cached = this.promptCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
          logger.debug(`Prompt cache hit for context: ${context}`);
          return cached.data;
        }
      }

      // Fetch from database
      const result = await query(`
        SELECT
          p.id,
          p.name,
          p.context,
          p.prompt_text,
          p.system_role,
          p.temperature,
          p.max_tokens,
          p.version,
          p.created_at,
          p.updated_at,
          json_agg(
            json_build_object(
              'variable_name', v.variable_name,
              'description', v.description,
              'default_value', v.default_value,
              'is_required', v.is_required
            )
          ) FILTER (WHERE v.id IS NOT NULL) as variables
        FROM ai_prompts p
        LEFT JOIN ai_prompt_variables v ON p.id = v.prompt_id
        WHERE p.context = $1 AND p.is_active = true
        GROUP BY p.id
        ORDER BY p.version DESC
        LIMIT 1
      `, [context]);

      if (result.rows.length === 0) {
        logger.warn(`No active prompt found for context: ${context}, falling back to general`);

        // Fallback to general context
        if (context !== 'general') {
          return await this.getPromptByContext('general', options);
        }

        throw new Error(`No active prompt found for context: ${context}`);
      }

      const prompt = result.rows[0];

      // Cache the result
      if (this.cacheEnabled) {
        this.promptCache.set(cacheKey, {
          data: prompt,
          timestamp: Date.now()
        });
        logger.debug(`Prompt cached for context: ${context}`);
      }

      return prompt;

    } catch (error) {
      logger.error('Error fetching prompt by context:', { context, error: error.message });
      throw error;
    }
  }

  /**
   * Interpolate template variables in prompt text
   * @param {string} promptText - Prompt text with {{variables}}
   * @param {object} variables - Key-value pairs for variable replacement
   * @returns {string} Interpolated prompt text
   */
  interpolatePrompt(promptText, variables = {}) {
    try {
      let interpolated = promptText;

      // Sanitize and replace variables
      for (const [key, value] of Object.entries(variables)) {
        // Remove curly braces from key if present
        const cleanKey = key.replace(/[{}]/g, '');

        // Sanitize value to prevent prompt injection
        const sanitizedValue = this.sanitizeInput(String(value));

        // Replace {{key}} with sanitized value
        const pattern = new RegExp(`\\{\\{\\s*${cleanKey}\\s*\\}\\}`, 'g');
        interpolated = interpolated.replace(pattern, sanitizedValue);
      }

      // Add default values for common variables if not provided
      const now = new Date().toISOString();
      interpolated = interpolated.replace(/\{\{timestamp\}\}/g, variables.timestamp || now);
      interpolated = interpolated.replace(/\{\{userName\}\}/g, variables.userName || 'User');

      return interpolated;

    } catch (error) {
      logger.error('Error interpolating prompt:', { error: error.message });
      throw error;
    }
  }

  /**
   * Sanitize user input to prevent prompt injection
   * @param {string} input - User input string
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      // Remove potential prompt injection patterns
      .replace(/[{}]/g, '')  // Remove template delimiters
      .replace(/system:|assistant:|user:/gi, '')  // Remove role markers
      .trim()
      .substring(0, 5000); // Limit length
  }

  /**
   * Create a new prompt
   * @param {object} promptData - Prompt data
   * @param {number} userId - User ID creating the prompt
   * @returns {Promise<object>} Created prompt
   */
  async createPrompt(promptData, userId) {
    try {
      const {
        name,
        context,
        prompt_text,
        system_role = 'assistant',
        temperature = 0.7,
        max_tokens = 2000
      } = promptData;

      // Validate required fields
      if (!name || !context || !prompt_text) {
        throw new Error('Missing required fields: name, context, prompt_text');
      }

      const result = await query(`
        INSERT INTO ai_prompts (
          name, context, prompt_text, system_role, temperature, max_tokens,
          is_active, version, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, 1, $7)
        RETURNING *
      `, [name, context, prompt_text, system_role, temperature, max_tokens, userId]);

      const newPrompt = result.rows[0];

      // Invalidate cache for this context
      this.invalidateCache(context);

      logger.info('Prompt created:', { promptId: newPrompt.id, context, userId });
      return newPrompt;

    } catch (error) {
      logger.error('Error creating prompt:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing prompt
   * @param {number} promptId - Prompt ID
   * @param {object} updates - Fields to update
   * @param {number} userId - User ID making the update
   * @param {string} changeReason - Reason for the change
   * @returns {Promise<object>} Updated prompt
   */
  async updatePrompt(promptId, updates, userId, changeReason = null) {
    try {
      // Get current prompt for history
      const currentResult = await query('SELECT * FROM ai_prompts WHERE id = $1', [promptId]);
      if (currentResult.rows.length === 0) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      const currentPrompt = currentResult.rows[0];

      // Save to history if prompt_text changed
      if (updates.prompt_text && updates.prompt_text !== currentPrompt.prompt_text) {
        await query(`
          INSERT INTO ai_prompt_history (
            prompt_id, previous_text, previous_version, changed_by, change_reason
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          promptId,
          currentPrompt.prompt_text,
          currentPrompt.version,
          userId,
          changeReason
        ]);

        // Increment version
        updates.version = currentPrompt.version + 1;
      }

      // Build dynamic UPDATE query
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');

      const result = await query(`
        UPDATE ai_prompts
        SET ${setClause}, updated_at = NOW()
        WHERE id = $${fields.length + 1}
        RETURNING *
      `, [...values, promptId]);

      const updatedPrompt = result.rows[0];

      // Invalidate cache
      this.invalidateCache(updatedPrompt.context);

      logger.info('Prompt updated:', { promptId, userId, version: updatedPrompt.version });
      return updatedPrompt;

    } catch (error) {
      logger.error('Error updating prompt:', { promptId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a prompt (soft delete by setting is_active = false)
   * @param {number} promptId - Prompt ID
   * @returns {Promise<boolean>} Success status
   */
  async deletePrompt(promptId) {
    try {
      const result = await query(`
        UPDATE ai_prompts
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING context
      `, [promptId]);

      if (result.rows.length === 0) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      // Invalidate cache
      this.invalidateCache(result.rows[0].context);

      logger.info('Prompt deleted (soft):', { promptId });
      return true;

    } catch (error) {
      logger.error('Error deleting prompt:', { promptId, error: error.message });
      throw error;
    }
  }

  /**
   * List all prompts with optional filters
   * @param {object} filters - Filter criteria
   * @returns {Promise<array>} List of prompts
   */
  async listPrompts(filters = {}) {
    try {
      const { context, is_active, limit = 50, offset = 0 } = filters;

      let queryText = `
        SELECT
          p.*,
          json_agg(
            json_build_object(
              'variable_name', v.variable_name,
              'description', v.description,
              'default_value', v.default_value,
              'is_required', v.is_required
            )
          ) FILTER (WHERE v.id IS NOT NULL) as variables
        FROM ai_prompts p
        LEFT JOIN ai_prompt_variables v ON p.id = v.prompt_id
      `;

      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (context) {
        conditions.push(`p.context = $${paramCount++}`);
        params.push(context);
      }

      if (is_active !== undefined) {
        conditions.push(`p.is_active = $${paramCount++}`);
        params.push(is_active);
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      queryText += `
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;

      params.push(limit, offset);

      const result = await query(queryText, params);
      return result.rows;

    } catch (error) {
      logger.error('Error listing prompts:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get prompt history
   * @param {number} promptId - Prompt ID
   * @returns {Promise<array>} History records
   */
  async getHistory(promptId) {
    try {
      const result = await query(`
        SELECT * FROM ai_prompt_history
        WHERE prompt_id = $1
        ORDER BY changed_at DESC
      `, [promptId]);

      return result.rows;

    } catch (error) {
      logger.error('Error fetching prompt history:', { promptId, error: error.message });
      throw error;
    }
  }

  /**
   * Rollback prompt to a previous version
   * @param {number} promptId - Prompt ID
   * @param {number} historyId - History record ID to rollback to
   * @param {number} userId - User ID performing rollback
   * @returns {Promise<object>} Updated prompt
   */
  async rollbackToVersion(promptId, historyId, userId) {
    try {
      // Get the history record
      const historyResult = await query(`
        SELECT * FROM ai_prompt_history
        WHERE id = $1 AND prompt_id = $2
      `, [historyId, promptId]);

      if (historyResult.rows.length === 0) {
        throw new Error(`History record not found: ${historyId}`);
      }

      const historyRecord = historyResult.rows[0];

      // Update prompt with previous text
      return await this.updatePrompt(
        promptId,
        { prompt_text: historyRecord.previous_text },
        userId,
        `Rolled back to version ${historyRecord.previous_version}`
      );

    } catch (error) {
      logger.error('Error rolling back prompt:', { promptId, historyId, error: error.message });
      throw error;
    }
  }

  /**
   * Add a variable to a prompt
   * @param {number} promptId - Prompt ID
   * @param {object} variableData - Variable data
   * @returns {Promise<object>} Created variable
   */
  async addVariable(promptId, variableData) {
    try {
      const { variable_name, description, default_value, is_required = false } = variableData;

      const result = await query(`
        INSERT INTO ai_prompt_variables (
          prompt_id, variable_name, description, default_value, is_required
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [promptId, variable_name, description, default_value, is_required]);

      logger.info('Variable added to prompt:', { promptId, variable_name });
      return result.rows[0];

    } catch (error) {
      logger.error('Error adding variable:', { promptId, error: error.message });
      throw error;
    }
  }

  /**
   * Get variables for a prompt
   * @param {number} promptId - Prompt ID
   * @returns {Promise<array>} Variables
   */
  async getVariables(promptId) {
    try {
      const result = await query(`
        SELECT * FROM ai_prompt_variables
        WHERE prompt_id = $1
        ORDER BY variable_name
      `, [promptId]);

      return result.rows;

    } catch (error) {
      logger.error('Error fetching variables:', { promptId, error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific context
   * @param {string} context - Context to invalidate
   */
  invalidateCache(context) {
    const cacheKey = `prompt:${context}`;
    this.promptCache.delete(cacheKey);
    logger.debug(`Cache invalidated for context: ${context}`);
  }

  /**
   * Clear all cached prompts
   */
  clearCache() {
    this.promptCache.clear();
    logger.info('All prompt cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.promptCache.size,
      ttl: this.cacheTTL,
      enabled: this.cacheEnabled,
      keys: Array.from(this.promptCache.keys())
    };
  }
}

// Export singleton instance
module.exports = new PromptService();
