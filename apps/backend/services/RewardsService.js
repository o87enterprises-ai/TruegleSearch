// Rewards Program Service — opt-in cash rewards for OFFER CONVERSIONS.
//
// Adsterra (and every performance network) pays the publisher on CONVERSIONS —
// a completed offer (install / sign-up / purchase), not on ad views or clicks.
// So rewards are a genuine revenue-share of REAL, network-confirmed conversions
// attributed to a user via a per-user opaque referral id (rewards_ref) that
// rides the offer link as a SubID and comes back on Adsterra's server-to-server
// postback. No conversion => no money exists => nothing is credited. This
// replaces the old view/click crediting, which inflated CTR while earning ~$0.
//
// Amounts are tracked in integer MICROS (millionths of a dollar; 1,000,000
// micros = $1) to avoid float drift while representing sub-dollar payouts.
const crypto = require('crypto');
const { query } = require('../db/connection');

// Share of each confirmed conversion's network payout that goes to the user.
// The remainder covers the 10% payout processing fee and Truegle's margin.
const REVENUE_SHARE_PERCENT = Number(process.env.REWARDS_REVENUE_SHARE || 0.70);
const MIN_PAYOUT_MICROS = 1_000_000; // $1.00 minimum cash-out
const MAX_PAYOUT_MICROS = 50_000_000; // $50.00 maximum single cash-out
const PROCESSING_FEE_PERCENT = 0.10; // 10% processing fee deducted at payout

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
      model: 'offer', // rewards are earned by completing sponsored offers, not views
      revenueSharePercent: REVENUE_SHARE_PERCENT,
      minPayoutMicros: MIN_PAYOUT_MICROS,
      maxPayoutMicros: MAX_PAYOUT_MICROS,
      processingFeePercent: PROCESSING_FEE_PERCENT,
      payoutMethods: PAYOUT_METHODS,
      payoutsAutomated: false,
    };
  }

  static async getStatus(userId) {
    const result = await query(
      `SELECT rewards_opted_in, rewards_opted_in_at, rewards_balance_micros, rewards_lifetime_earned_micros, rewards_ref
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
      ref: row.rewards_ref || null,
    };
  }

  static async optIn(userId) {
    await query(
      `UPDATE users SET rewards_opted_in = true, rewards_opted_in_at = NOW() WHERE id = $1`,
      [userId]
    );
    await this.ensureRef(userId); // mint the attribution id used by the offer link
    return this.getStatus(userId);
  }

  static async optOut(userId) {
    await query(`UPDATE users SET rewards_opted_in = false WHERE id = $1`, [userId]);
    return this.getStatus(userId);
  }

  /**
   * Ensure the user has an opaque attribution id (rewards_ref) and return it.
   * This is the SubID carried through the offer link and echoed by the
   * network's conversion postback — never the sequential user id.
   */
  static async ensureRef(userId) {
    const existing = await query(`SELECT rewards_ref FROM users WHERE id = $1`, [userId]);
    if (existing.rows[0]?.rewards_ref) return existing.rows[0].rewards_ref;
    // Retry on the rare unique-index collision.
    for (let i = 0; i < 5; i++) {
      const ref = crypto.randomBytes(12).toString('hex'); // 24 hex chars
      try {
        await query(`UPDATE users SET rewards_ref = $1 WHERE id = $2`, [ref, userId]);
        return ref;
      } catch { /* collision — try another */ }
    }
    throw new Error('Could not allocate a rewards attribution id');
  }

  /**
   * The personalized offer link a user opens to earn. Completing any offer on
   * the Adsterra Smartlink fires a conversion postback tagged with this user's
   * ref, which credits their revenue-share (see recordConversion).
   */
  static async getOfferLink(userId) {
    const ref = await this.ensureRef(userId);
    const base = process.env.REWARDS_OFFER_URL
      || process.env.ADSTERRA_SMARTLINK_URL
      || 'https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c';
    const sep = base.includes('?') ? '&' : '?';
    // Adsterra Direct Link passes SubIDs through as sub1..sub4; send the ref on
    // sub1 (and a couple of common aliases) so attribution survives whatever
    // macro the offer wall expects.
    return `${base}${sep}sub1=${encodeURIComponent(ref)}&subid=${encodeURIComponent(ref)}`;
  }

  /**
   * Credit a user for a REAL, network-confirmed offer conversion. Called by the
   * secret-gated postback route. Idempotent on conversionId, so a replayed or
   * duplicated postback never double-credits. Returns { success, credited }.
   */
  static async recordConversion({ ref, conversionId, payoutUsd, offerName, country }) {
    if (!ref || !conversionId) {
      return { success: false, message: 'Missing ref or conversionId' };
    }
    const payout = Math.max(0, Number(payoutUsd) || 0);
    const payoutMicros = Math.round(payout * 1e6);
    const userShareMicros = Math.round(payoutMicros * REVENUE_SHARE_PERCENT);

    const userRes = await query(
      `SELECT id, rewards_opted_in FROM users WHERE rewards_ref = $1`,
      [ref]
    );
    const user = userRes.rows[0];
    if (!user) return { success: false, message: 'Unknown attribution ref' };
    if (!user.rewards_opted_in) return { success: false, message: 'User not opted in' };

    // Idempotency: unique conversion_id means a second insert throws — treat as
    // already-processed rather than crediting twice.
    try {
      await query(
        `INSERT INTO reward_conversions (user_id, conversion_id, offer_name, country, payout_micros, user_share_micros, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')`,
        [user.id, String(conversionId), offerName || null, country || null, payoutMicros, userShareMicros]
      );
    } catch (err) {
      if (err.code === '23505') return { success: true, credited: false, message: 'Duplicate conversion ignored' };
      throw err;
    }

    if (userShareMicros > 0) {
      const result = await query(
        `UPDATE users SET
           rewards_balance_micros = rewards_balance_micros + $1,
           rewards_lifetime_earned_micros = rewards_lifetime_earned_micros + $1
         WHERE id = $2
         RETURNING rewards_balance_micros`,
        [userShareMicros, user.id]
      );
      const balanceAfterMicros = Number(result.rows[0].rewards_balance_micros);
      await this.logLedger(user.id, userShareMicros, 'earn_conversion', `conv_${conversionId}`, balanceAfterMicros);
    }

    return { success: true, credited: true, userShareMicros };
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
