// Rewards Program Service — opt-in cash rewards for honestly-viewed ads.
//
// This is strictly additive to the existing house-ad system (HouseAd.jsx /
// AdSlot.jsx): users who never opt in are completely unaffected and generate
// no rows here. Amounts are tracked in integer cents to avoid float drift.
const { query } = require('../db/connection');

// Ad rewards economics — tune these as program data comes in.
const CENTS_PER_IMPRESSION = 1; // $0.01 per honestly-verified ad view
const MIN_PAYOUT_CENTS = 2000; // $20.00 minimum cash-out
const MAX_PAYOUT_CENTS = 5000; // $50.00 maximum single cash-out
const PROCESSING_FEE_PERCENT = 0.10; // 10% processing fee deducted at payout
const MAX_REWARDED_IMPRESSIONS_PER_DAY = 40; // anti-abuse ceiling (~$0.40/day)
const MIN_VISIBLE_MS = 4000; // minimum real visible time to qualify

// Supported payout methods and what identifier each requires.
const PAYOUT_METHODS = {
  paypal:   { label: 'PayPal',                 field: 'Email address' },
  cashapp:  { label: 'Cash App',               field: '$Cashtag (e.g. $yourname)' },
  venmo:    { label: 'Venmo',                  field: '@Username (e.g. @yourname)' },
  zelle:    { label: 'Zelle',                  field: 'Phone number or email' },
  chime:    { label: 'Chime',                  field: 'Chime $tag or email' },
  fbpay:    { label: 'Facebook Pay (Meta Pay)', field: 'Facebook account email' },
  bank:     { label: 'Bank / ACH',             field: 'Routing number,Account number (comma-separated)' },
};

class RewardsService {
  static getConfig() {
    return {
      centsPerImpression: CENTS_PER_IMPRESSION,
      minPayoutCents: MIN_PAYOUT_CENTS,
      maxPayoutCents: MAX_PAYOUT_CENTS,
      processingFeePercent: PROCESSING_FEE_PERCENT,
      maxRewardedImpressionsPerDay: MAX_REWARDED_IMPRESSIONS_PER_DAY,
      minVisibleMs: MIN_VISIBLE_MS,
      payoutMethods: PAYOUT_METHODS,
      payoutsAutomated: false,
    };
  }

  static async getStatus(userId) {
    const result = await query(
      `SELECT rewards_opted_in, rewards_opted_in_at, rewards_balance_cents, rewards_lifetime_earned_cents
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];
    return {
      optedIn: row.rewards_opted_in || false,
      optedInAt: row.rewards_opted_in_at,
      balanceCents: row.rewards_balance_cents || 0,
      lifetimeEarnedCents: row.rewards_lifetime_earned_cents || 0,
    };
  }

  static async optIn(userId) {
    await query(
      `UPDATE users SET rewards_opted_in = true, rewards_opted_in_at = NOW() WHERE id = $1`,
      [userId]
    );
    return this.getStatus(userId);
  }

  static async optOut(userId) {
    await query(`UPDATE users SET rewards_opted_in = false WHERE id = $1`, [userId]);
    return this.getStatus(userId);
  }

  /**
   * Count today's rewarded impressions for a user (for the daily cap).
   */
  static async getTodayImpressionCount(userId) {
    const result = await query(
      `SELECT COUNT(*) FROM reward_impressions
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Award cash for an honestly-measured ad impression. `visibleMs` is the
   * real, server-verified elapsed time the caller tracked the ad as visible
   * (the route layer is responsible for verifying this server-side, not
   * trusting a client-reported number alone).
   */
  static async earnFromImpression(userId, adId, zone, visibleMs) {
    const status = await this.getStatus(userId);
    if (!status.optedIn) {
      return { success: false, message: 'Not opted into the Rewards Program' };
    }

    const todayCount = await this.getTodayImpressionCount(userId);
    if (todayCount >= MAX_REWARDED_IMPRESSIONS_PER_DAY) {
      return { success: false, message: 'Daily rewarded-impression limit reached' };
    }

    await query(
      `INSERT INTO reward_impressions (user_id, ad_id, zone, visible_ms, amount_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, adId, zone, visibleMs, CENTS_PER_IMPRESSION]
    );

    const result = await query(
      `UPDATE users SET
         rewards_balance_cents = rewards_balance_cents + $1,
         rewards_lifetime_earned_cents = rewards_lifetime_earned_cents + $1
       WHERE id = $2
       RETURNING rewards_balance_cents`,
      [CENTS_PER_IMPRESSION, userId]
    );

    const balanceAfterCents = result.rows[0].rewards_balance_cents;
    await this.logLedger(userId, CENTS_PER_IMPRESSION, 'earn_impression', adId, balanceAfterCents);

    return { success: true, amountCents: CENTS_PER_IMPRESSION, balanceCents: balanceAfterCents };
  }

  static async requestPayout(userId, method, destination) {
    const status = await this.getStatus(userId);

    // Validate method
    const validMethod = method && PAYOUT_METHODS[method] ? method : null;
    if (!validMethod) {
      return {
        success: false,
        message: `Invalid payout method. Supported: ${Object.keys(PAYOUT_METHODS).join(', ')}`,
      };
    }

    if (status.balanceCents < MIN_PAYOUT_CENTS) {
      return {
        success: false,
        message: `Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}. Your balance: $${(status.balanceCents / 100).toFixed(2)}`,
        balanceCents: status.balanceCents,
      };
    }

    // Cap at MAX_PAYOUT_CENTS — excess stays in balance
    const grossCents = Math.min(status.balanceCents, MAX_PAYOUT_CENTS);
    const feeCents = Math.round(grossCents * PROCESSING_FEE_PERCENT);
    const netCents = grossCents - feeCents;

    const result = await query(
      `UPDATE users SET rewards_balance_cents = rewards_balance_cents - $1 WHERE id = $2 RETURNING rewards_balance_cents`,
      [grossCents, userId]
    );
    const balanceAfterCents = result.rows[0].rewards_balance_cents;

    const payout = await query(
      `INSERT INTO reward_payout_requests (user_id, amount_cents, method, destination, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, status, requested_at`,
      [userId, netCents, validMethod, destination || null]
    );

    await this.logLedger(userId, -grossCents, 'payout_request', `payout_${payout.rows[0].id}`, balanceAfterCents);

    return {
      success: true,
      payoutRequestId: payout.rows[0].id,
      grossCents,
      feeCents,
      netCents,
      balanceCents: balanceAfterCents,
      status: payout.rows[0].status,
      message: `Payout of $${(netCents / 100).toFixed(2)} requested via ${PAYOUT_METHODS[validMethod].label} (10% fee applied). Processed within 3–5 business days.`,
    };
  }

  static async getPayoutRequests(userId, limit = 20) {
    const result = await query(
      `SELECT * FROM reward_payout_requests WHERE user_id = $1 ORDER BY requested_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async getLedger(userId, limit = 20) {
    const result = await query(
      `SELECT * FROM reward_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  static async logLedger(userId, amountCents, entryType, description, balanceAfterCents) {
    await query(
      `INSERT INTO reward_ledger (user_id, amount_cents, entry_type, description, balance_after_cents)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, amountCents, entryType, description, balanceAfterCents]
    );
  }
}

module.exports = RewardsService;
