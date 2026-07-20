// Token Service for Freemium System
const { query } = require('../db/connection');

// Feature categories and their token costs
const FEATURE_CONFIG = {
  // High-value tools
  'osint-tools': { cost: 1, freeUses: 0 },
  'seo-tools': { cost: 1, freeUses: 0 },

  // Standard premium: 9 free uses, then 1 token
  'red-pill': { cost: 1, freeUses: 9 },
  'ai-chat': { cost: 1, freeUses: 9 },
  'biased-results': { cost: 1, freeUses: 9 },
};

const MAX_GAME_TOKENS = 10;
const STARTING_TOKENS = 3;

class TokenService {
  /**
   * Get user's token balance and usage stats
   */
  static async getBalance(userId) {
    const result = await query(
      `SELECT token_balance, feature_usage, game_tokens_earned, subscription_tier
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const isPremium = user.subscription_tier === 'premium';

    return {
      balance: user.token_balance,
      featureUsage: user.feature_usage || {},
      gameTokensEarned: user.game_tokens_earned || 0,
      maxGameTokens: MAX_GAME_TOKENS,
      isPremium,
    };
  }

  /**
   * Check if user can access a feature (without spending)
   */
  static async canAccessFeature(userId, featureName) {
    const config = FEATURE_CONFIG[featureName];
    if (!config) {
      return { allowed: true, reason: 'free_feature' };
    }

    const balanceInfo = await this.getBalance(userId);

    // Premium users bypass all checks
    if (balanceInfo.isPremium) {
      return { allowed: true, reason: 'premium' };
    }

    // Check free uses remaining
    const usageCount = balanceInfo.featureUsage[featureName] || 0;
    if (usageCount < config.freeUses) {
      return {
        allowed: true,
        reason: 'free_use',
        freeUsesRemaining: config.freeUses - usageCount
      };
    }

    // Check token balance
    if (balanceInfo.balance >= config.cost) {
      return {
        allowed: true,
        reason: 'has_tokens',
        cost: config.cost
      };
    }

    // Not enough tokens
    return {
      allowed: false,
      reason: 'insufficient_tokens',
      required: config.cost,
      current: balanceInfo.balance
    };
  }

  /**
   * Spend tokens for feature access
   */
  static async spendToken(userId, featureName) {
    const config = FEATURE_CONFIG[featureName];
    if (!config) {
      return { success: true, message: 'Free feature' };
    }

    const balanceInfo = await this.getBalance(userId);

    // Premium bypass
    if (balanceInfo.isPremium) {
      return { success: true, message: 'Premium access' };
    }

    // Check and increment free usage
    const usageCount = balanceInfo.featureUsage[featureName] || 0;
    if (usageCount < config.freeUses) {
      const newUsage = { ...balanceInfo.featureUsage, [featureName]: usageCount + 1 };
      await query(
        'UPDATE users SET feature_usage = $1 WHERE id = $2',
        [JSON.stringify(newUsage), userId]
      );
      return {
        success: true,
        message: 'Free use consumed',
        freeUsesRemaining: config.freeUses - usageCount - 1
      };
    }

    // Deduct token
    if (balanceInfo.balance < config.cost) {
      return { success: false, message: 'Insufficient tokens' };
    }

    const newBalance = balanceInfo.balance - config.cost;
    await query(
      'UPDATE users SET token_balance = $1 WHERE id = $2',
      [newBalance, userId]
    );

    // Log transaction
    await this.logTransaction(userId, -config.cost, 'spend', featureName, newBalance);

    return {
      success: true,
      message: 'Token spent',
      newBalance
    };
  }

  /**
   * Award token for completing game level
   */
  static async earnFromGame(userId, levelCompleted) {
    // Check if already earned max game tokens
    const balanceInfo = await this.getBalance(userId);
    if (balanceInfo.gameTokensEarned >= MAX_GAME_TOKENS) {
      return {
        success: false,
        message: 'Maximum game tokens reached',
        gameTokensEarned: balanceInfo.gameTokensEarned
      };
    }

    // Check if level already completed (unique constraint will catch this too)
    try {
      await query(
        `INSERT INTO game_rewards (user_id, level_completed, tokens_awarded)
         VALUES ($1, $2, 1)`,
        [userId, levelCompleted]
      );
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return { success: false, message: 'Level already completed' };
      }
      throw error;
    }

    // Update balance and game tokens count
    const result = await query(
      `UPDATE users SET
         token_balance = token_balance + 1,
         game_tokens_earned = game_tokens_earned + 1
       WHERE id = $1
       RETURNING token_balance, game_tokens_earned`,
      [userId]
    );

    const { token_balance, game_tokens_earned } = result.rows[0];
    await this.logTransaction(userId, 1, 'earn_game', `level_${levelCompleted}`, token_balance);

    return {
      success: true,
      newBalance: token_balance,
      gameTokensEarned: game_tokens_earned,
      tokensRemaining: MAX_GAME_TOKENS - game_tokens_earned
    };
  }

  /**
   * Get feature usage stats
   */
  static async getUsageStats(userId) {
    const result = await query(
      'SELECT feature_usage FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const usage = result.rows[0].feature_usage || {};

    // Add remaining free uses for each feature
    const stats = {};
    for (const [feature, config] of Object.entries(FEATURE_CONFIG)) {
      const used = usage[feature] || 0;
      stats[feature] = {
        used,
        freeRemaining: Math.max(0, config.freeUses - used),
        requiresToken: used >= config.freeUses,
        cost: config.cost
      };
    }

    return stats;
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(userId, limit = 20) {
    const result = await query(
      `SELECT * FROM token_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Log token transaction
   */
  static async logTransaction(userId, amount, type, featureName, balanceAfter) {
    await query(
      `INSERT INTO token_transactions
         (user_id, amount, transaction_type, feature_name, balance_after)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, amount, type, featureName, balanceAfter]
    );
  }

  /**
   * Initialize tokens for new user
   */
  static async initializeNewUser(userId) {
    await query(
      `UPDATE users SET
         token_balance = $1,
         feature_usage = '{}',
         game_tokens_earned = 0
       WHERE id = $2`,
      [STARTING_TOKENS, userId]
    );

    await this.logTransaction(userId, STARTING_TOKENS, 'bonus', 'new_user', STARTING_TOKENS);
  }

  /**
   * Get feature configuration (for frontend)
   */
  static getFeatureConfig() {
    return FEATURE_CONFIG;
  }
}

module.exports = TokenService;
