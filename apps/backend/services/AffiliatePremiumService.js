// Affiliate Premium Offer Service — self-reported "sign up via an affiliate
// partner (or start a free trial), get 1 month of Truegle Premium free."
//
// There is no CJ (or other network) postback receiver in this codebase yet,
// so a claim is granted immediately on self-report and tracked as 'pending'.
// confirmClaim() is the hook a future real postback handler should call once
// genuine conversion verification exists — it requires no schema change.
// Until then, sweepExpiredClaims() claws back the granted days from any claim
// still 'pending' once its confirmation window has passed, so self-reporting
// alone can't be used to accumulate Premium time indefinitely by stacking
// claims. The window equals the grant length, so a single honest claim is
// never affected by the lack of real verification today — it only caps the
// abuse case of claiming many offers at once.
const { query } = require('../db/connection');

const PREMIUM_GRANT_DAYS = 30;
const CONFIRMATION_WINDOW_DAYS = PREMIUM_GRANT_DAYS;

// Offers eligible for this program — must be a real, live (non-placeholder)
// affiliate link in AFFILIATE_OFFERS (apps/frontend/src/config/houseAds.js).
// Keep in sync by hand; placeholder offers don't pay anything yet, so letting
// people claim free Premium for clicking one would just be giving it away.
const ELIGIBLE_OFFER_IDS = new Set([
  'aff-oo-shutup10',
  'aff-oo-diskrecovery',
  'aff-oo-safeerase',
  'aff-oo-diskimage',
  'aff-oo-defrag',
  'aff-oo-bluecon',
  'aff-oo-diskcommander',
  'aff-oo-diskstat',
  'aff-oo-powerpack',
  'aff-oo-win11-migration',
]);

class AffiliatePremiumService {
  static getConfig() {
    return {
      grantDays: PREMIUM_GRANT_DAYS,
      eligibleOfferIds: Array.from(ELIGIBLE_OFFER_IDS),
    };
  }

  static isEligible(offerId) {
    return ELIGIBLE_OFFER_IDS.has(offerId);
  }

  static async getStatus(userId) {
    await this.sweepExpiredClaims(userId);

    const result = await query(
      `SELECT subscription_tier, premium_until FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];
    const isPremiumFromOffer = !!row.premium_until && new Date(row.premium_until) > new Date();

    const claims = await query(
      `SELECT offer_id, status, granted_days, claimed_at, confirm_by, resolved_at
       FROM affiliate_premium_claims WHERE user_id = $1 ORDER BY claimed_at DESC`,
      [userId]
    );

    return {
      isPremium: row.subscription_tier === 'premium' || isPremiumFromOffer,
      premiumUntil: row.premium_until,
      claims: claims.rows,
    };
  }

  /**
   * Self-reported claim: "I signed up via this offer." Grants Premium
   * immediately (hybrid verification — see file header). One claim per user
   * per offer, ever.
   */
  static async claimOffer(userId, offerId) {
    if (!this.isEligible(offerId)) {
      return { success: false, message: 'This offer is not eligible for the Premium giveaway' };
    }

    const existing = await query(
      `SELECT id FROM affiliate_premium_claims WHERE user_id = $1 AND offer_id = $2`,
      [userId, offerId]
    );
    if (existing.rows.length > 0) {
      return { success: false, message: 'You already claimed Premium for this offer' };
    }

    const result = await query(
      `UPDATE users
       SET premium_until = GREATEST(premium_until, NOW()) + INTERVAL '${PREMIUM_GRANT_DAYS} days',
           updated_at = NOW()
       WHERE id = $1
       RETURNING premium_until`,
      [userId]
    );

    try {
      await query(
        `INSERT INTO affiliate_premium_claims (user_id, offer_id, granted_days, confirm_by)
         VALUES ($1, $2, $3, NOW() + INTERVAL '${CONFIRMATION_WINDOW_DAYS} days')`,
        [userId, offerId, PREMIUM_GRANT_DAYS]
      );
    } catch (error) {
      if (error.code === '23505') {
        // Lost a race against a concurrent claim for the same offer — undo
        // the extension we just added and report the same "already claimed"
        // outcome the loser of the race would have gotten from the SELECT above.
        await query(
          `UPDATE users SET premium_until = premium_until - INTERVAL '${PREMIUM_GRANT_DAYS} days' WHERE id = $1`,
          [userId]
        );
        return { success: false, message: 'You already claimed Premium for this offer' };
      }
      throw error;
    }

    return {
      success: true,
      premiumUntil: result.rows[0].premium_until,
      grantedDays: PREMIUM_GRANT_DAYS,
    };
  }

  /**
   * Hook for a future real-postback verifier to call once a conversion is
   * confirmed. Nothing calls this yet, but the claim shape already supports
   * it without a schema change.
   */
  static async confirmClaim(userId, offerId) {
    const result = await query(
      `UPDATE affiliate_premium_claims
       SET status = 'confirmed', resolved_at = NOW()
       WHERE user_id = $1 AND offer_id = $2 AND status = 'pending'
       RETURNING id`,
      [userId, offerId]
    );
    return { success: result.rows.length > 0 };
  }

  /**
   * Claw back the granted days from any claim still 'pending' once its
   * confirmation window has passed. Pass a userId to scope the sweep to one
   * user (called lazily from getStatus/TokenService on every read, so this
   * is enforced without needing a cron job); omit it to sweep everyone.
   * Never touches subscription_tier, so a real paid Stripe subscription is
   * never affected by this sweep.
   */
  static async sweepExpiredClaims(userId = null) {
    const whereUser = userId ? 'AND user_id = $1' : '';
    const params = userId ? [userId] : [];
    const expired = await query(
      `SELECT id, user_id, granted_days FROM affiliate_premium_claims
       WHERE status = 'pending' AND confirm_by < NOW() ${whereUser}`,
      params
    );

    for (const claim of expired.rows) {
      await query(
        `UPDATE users SET premium_until = premium_until - INTERVAL '1 day' * $1, updated_at = NOW() WHERE id = $2`,
        [claim.granted_days, claim.user_id]
      );
      await query(
        `UPDATE affiliate_premium_claims SET status = 'expired', resolved_at = NOW() WHERE id = $1`,
        [claim.id]
      );
    }

    return { sweptCount: expired.rows.length };
  }
}

module.exports = AffiliatePremiumService;
