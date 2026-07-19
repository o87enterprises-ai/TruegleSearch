// Rewards Program Service — opt-in cash rewards for honestly-viewed/clicked ads.
//
// The reward-eligible ad slot (RewardAdSlot.jsx) renders a real AdsterraBanner,
// so a rewarded view/click is the exact same event that earns Truegle real ad
// revenue — this is a genuine revenue-share, not a made-up number.
//
// Amounts are tracked in integer MICROS (millionths of a dollar; 1,000,000
// micros = $1) to avoid float drift while still representing sub-cent
// amounts — real Adsterra revenue here runs well under a cent per event.
const { query } = require('../db/connection');

// Ad rewards economics, calibrated 2026-07-19 from a real Adsterra stats
// export (146 impressions / 15 clicks / $0.02 revenue over 6 days):
//   revenue/impression ≈ $0.000137 (137 micros)
//   revenue/click      ≈ $0.00133  (1333 micros)
//   CTR                ≈ 10.3%
// A click replaces the impression trickle for that shown ad rather than
// stacking (matches reality: nearly all observed revenue was click-driven,
// not per-impression). Expected payout per shown ad ≈
//   0.897 * 50 + 0.103 * 800 ≈ 127 micros ($0.000127)
// against observed revenue/impression of 137 micros — roughly a 93% pass-
// through, with the existing 10% payout fee as the actual margin mechanism.
// Small sample (six days, $0.02 total) — revisit as real volume grows.
const MICROS_PER_IMPRESSION = 50; // $0.00005 — paid when an ad is honestly viewed but not clicked
const MICROS_PER_CLICK = 800; // $0.0008 — paid instead of the trickle when a click is detected
const MIN_PAYOUT_MICROS = 1_000_000; // $1.00 minimum cash-out
const MAX_PAYOUT_MICROS = 50_000_000; // $50.00 maximum single cash-out
const PROCESSING_FEE_PERCENT = 0.10; // 10% processing fee deducted at payout
const MIN_VISIBLE_MS = 4000; // minimum real visible time to qualify for the impression trickle
const MIN_VISIBLE_MS_FOR_CLICK = 300; // a click can be credited much faster than a full dwell

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
      microsPerImpression: MICROS_PER_IMPRESSION,
      microsPerClick: MICROS_PER_CLICK,
      minPayoutMicros: MIN_PAYOUT_MICROS,
      maxPayoutMicros: MAX_PAYOUT_MICROS,
      processingFeePercent: PROCESSING_FEE_PERCENT,
      minVisibleMs: MIN_VISIBLE_MS,
      minVisibleMsForClick: MIN_VISIBLE_MS_FOR_CLICK,
      payoutMethods: PAYOUT_METHODS,
      payoutsAutomated: false,
    };
  }

  static async getStatus(userId) {
    const result = await query(
      `SELECT rewards_opted_in, rewards_opted_in_at, rewards_balance_micros, rewards_lifetime_earned_micros
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
      balanceMicros: Number(row.rewards_balance_micros) || 0,
      lifetimeEarnedMicros: Number(row.rewards_lifetime_earned_micros) || 0,
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
   * Award cash for an honestly-measured ad event. `visibleMs` is the real,
   * server-verified elapsed time the caller tracked the ad as visible (the
   * route layer is responsible for verifying this server-side, not trusting
   * a client-reported number alone). `kind` is 'impression' or 'click'.
   */
  static async earn(userId, adId, zone, kind, visibleMs) {
    const status = await this.getStatus(userId);
    if (!status.optedIn) {
      return { success: false, message: 'Not opted into the Rewards Program' };
    }

    const amountMicros = kind === 'click' ? MICROS_PER_CLICK : MICROS_PER_IMPRESSION;

    await query(
      `INSERT INTO reward_impressions (user_id, ad_id, zone, visible_ms, amount_micros, kind)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, adId, zone, visibleMs, amountMicros, kind]
    );

    const result = await query(
      `UPDATE users SET
         rewards_balance_micros = rewards_balance_micros + $1,
         rewards_lifetime_earned_micros = rewards_lifetime_earned_micros + $1
       WHERE id = $2
       RETURNING rewards_balance_micros`,
      [amountMicros, userId]
    );

    const balanceAfterMicros = Number(result.rows[0].rewards_balance_micros);
    await this.logLedger(userId, amountMicros, `earn_${kind}`, adId, balanceAfterMicros);

    return { success: true, amountMicros, balanceMicros: balanceAfterMicros, kind };
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

    if (status.balanceMicros < MIN_PAYOUT_MICROS) {
      return {
        success: false,
        message: `Minimum payout is $${(MIN_PAYOUT_MICROS / 1e6).toFixed(2)}. Your balance: $${(status.balanceMicros / 1e6).toFixed(2)}`,
        balanceMicros: status.balanceMicros,
      };
    }

    // Cap at MAX_PAYOUT_MICROS — excess stays in balance
    const grossMicros = Math.min(status.balanceMicros, MAX_PAYOUT_MICROS);
    const feeMicros = Math.round(grossMicros * PROCESSING_FEE_PERCENT);
    const netMicros = grossMicros - feeMicros;

    const result = await query(
      `UPDATE users SET rewards_balance_micros = rewards_balance_micros - $1 WHERE id = $2 RETURNING rewards_balance_micros`,
      [grossMicros, userId]
    );
    const balanceAfterMicros = Number(result.rows[0].rewards_balance_micros);

    const payout = await query(
      `INSERT INTO reward_payout_requests (user_id, amount_micros, method, destination, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, status, requested_at`,
      [userId, netMicros, validMethod, destination || null]
    );

    await this.logLedger(userId, -grossMicros, 'payout_request', `payout_${payout.rows[0].id}`, balanceAfterMicros);

    return {
      success: true,
      payoutRequestId: payout.rows[0].id,
      grossMicros,
      feeMicros,
      netMicros,
      balanceMicros: balanceAfterMicros,
      status: payout.rows[0].status,
      message: `Payout of $${(netMicros / 1e6).toFixed(2)} requested via ${PAYOUT_METHODS[validMethod].label} (10% fee applied). Processed within 3–5 business days.`,
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

  static async logLedger(userId, amountMicros, entryType, description, balanceAfterMicros) {
    await query(
      `INSERT INTO reward_ledger (user_id, amount_micros, entry_type, description, balance_after_micros)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, amountMicros, entryType, description, balanceAfterMicros]
    );
  }
}

module.exports = RewardsService;
