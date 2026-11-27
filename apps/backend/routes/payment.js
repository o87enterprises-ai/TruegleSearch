const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { createProvider } = require('../services/payment/index');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

// Initialize payment provider from env
const PROVIDER_NAME = process.env.PAYMENT_PROVIDER || 'stripe';
// Smallest one-time payment that unlocks premium (USD cents; $9.99 monthly price,
// same figure as routes/auth.js PREMIUM_PRICE_USD). Override with PREMIUM_MIN_AMOUNT_CENTS.
const PREMIUM_MIN_AMOUNT_CENTS = Number(process.env.PREMIUM_MIN_AMOUNT_CENTS) || 999;

const getProvider = () => {
  const configs = {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
      locationId: process.env.SQUARE_LOCATION_ID,
      applicationId: process.env.SQUARE_APPLICATION_ID,
    },
  };

  const config = configs[PROVIDER_NAME];
  if (!config) {
    throw new Error(`Payment provider "${PROVIDER_NAME}" not configured`);
  }

  return createProvider(PROVIDER_NAME, config);
};

/**
 * @route   GET /api/payment/config
 * @desc    Get public payment configuration for frontend
 * @access  Public
 */
router.get('/config', (req, res) => {
  try {
    const provider = getProvider();
    res.json({
      success: true,
      config: provider.getFrontendConfig(),
    });
  } catch (error) {
    logger.error('Payment config error', { error: error.message });
    res.status(503).json({ error: 'Payment service not configured' });
  }
});

/**
 * @route   POST /api/payment/create-intent
 * @desc    Create a payment intent
 * @access  Authenticated
 */
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'A positive amount is required' });
    }

    if (amount > 99999999) {
      return res.status(400).json({ error: 'Amount exceeds maximum allowed' });
    }

    if (typeof currency !== 'string' || !/^[a-zA-Z]{3}$/.test(currency)) {
      return res.status(400).json({ error: 'A valid 3-letter currency code is required' });
    }
    // Client metadata is untrusted: plain object only, short string values, and
    // never allowed to set userId (the webhook grants premium to metadata.userId).
    const safeMeta = {};
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      for (const [k, v] of Object.entries(metadata).slice(0, 10)) {
        if (k === 'userId' || typeof v !== 'string' && typeof v !== 'number') continue;
        safeMeta[String(k).slice(0, 40)] = String(v).slice(0, 200);
      }
    }

    const provider = getProvider();
    const result = await provider.createPaymentIntent({
      amount: Math.round(amount),
      currency: currency.toLowerCase(),
      metadata: { ...safeMeta, userId: String(req.user.userId) },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Create payment intent failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create payment', details: 'Service unavailable' });
  }
});

/**
 * @route   POST /api/payment/complete
 * @desc    Confirm/retrieve payment status
 * @access  Authenticated
 */
router.post('/complete', authenticate, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const provider = getProvider();
    const result = await provider.confirmPayment({ sourceId: paymentIntentId });

    res.json({ success: true, payment: result });
  } catch (error) {
    logger.error('Payment completion failed', { error: error.message });
    res.status(500).json({ error: 'Failed to complete payment', details: 'Service unavailable' });
  }
});

/**
 * @route   POST /api/payment/refund
 * @desc    Refund a payment
 * @access  Admin only. This was open to ANY signed-in user, who could refund any
 *          payment intent (their own after receiving premium, or anyone else's)
 *          for any amount — refunds move money out of our Stripe account.
 */
router.post('/refund', authenticate, requireAdmin, async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const provider = getProvider();
    if (amount !== undefined && (typeof amount !== 'number' || !(amount > 0))) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const result = await provider.refund(
      paymentIntentId,
      amount ? Math.round(amount) : undefined
    );

    res.json({ success: true, refund: result });
  } catch (error) {
    logger.error('Refund failed', { error: error.message });
    res.status(500).json({ error: 'Failed to process refund', details: 'Service unavailable' });
  }
});

/**
 * Grant premium status to a user by ID.
 * Sets subscription_tier = 'premium' and adds 100 bonus tokens.
 */
async function grantPremium(userId) {
  // The +100 bonus is paid ONCE, on the transition to premium. Stripe fires
  // customer.subscription.updated on every renewal/plan tweak, and retries
  // webhooks; granting on each event minted unlimited tokens. In a single
  // UPDATE the right-hand side sees the OLD row, so CASE tests the prior tier.
  await query(
    `UPDATE users
     SET token_balance = token_balance
           + CASE WHEN subscription_tier IS DISTINCT FROM 'premium' THEN 100 ELSE 0 END,
         subscription_tier = 'premium',
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  logger.info('Premium granted', { userId });
}

/**
 * Revoke premium status (subscription cancelled/expired).
 */
async function revokePremium(userId) {
  await query(
    `UPDATE users
     SET subscription_tier = 'free',
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  logger.info('Premium revoked', { userId });
}

/**
 * @route   POST /api/payment/webhook
 * @desc    Handle Stripe webhook events (signature-verified)
 * @access  Public
 */
router.post('/webhook', async (req, res) => {
  // Must respond quickly — process async after acknowledging
  let event;
  try {
    const provider = getProvider();

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    event = provider.verifyWebhook(req.body, req.headers);
  } catch (error) {
    logger.error('Webhook signature verification failed', { error: error.message });
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  // Acknowledge receipt immediately
  res.json({ received: true });

  // Process the event asynchronously so Stripe doesn't time out
  try {
    const obj = event.data?.object;
    const userId = obj?.metadata?.userId;

    logger.info('Stripe webhook event', { type: event.type, userId });

    switch (event.type) {
      // One-time payment completed
      case 'payment_intent.succeeded': {
        if (!userId) {
          logger.warn('payment_intent.succeeded: no userId in metadata', { id: obj?.id });
          break;
        }
        // Any payment intent carrying a userId used to unlock premium — including
        // a 1-cent one created through /create-intent. Premium must be PAID for.
        if (!Number.isFinite(obj?.amount_received ?? obj?.amount) ||
            (obj.amount_received ?? obj.amount) < PREMIUM_MIN_AMOUNT_CENTS) {
          logger.warn('payment_intent.succeeded below premium price; not granting', { id: obj?.id });
          break;
        }
        await grantPremium(userId);
        break;
      }

      // Subscription activated or renewed
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subUserId = obj?.metadata?.userId;
        if (!subUserId) {
          logger.warn(`${event.type}: no userId in metadata`, { id: obj?.id });
          break;
        }
        const isActive = ['active', 'trialing'].includes(obj?.status);
        if (isActive) {
          await grantPremium(subUserId);
        } else {
          await revokePremium(subUserId);
        }
        break;
      }

      // Subscription cancelled or expired
      case 'customer.subscription.deleted': {
        const subUserId = obj?.metadata?.userId;
        if (subUserId) await revokePremium(subUserId);
        break;
      }

      case 'payment_intent.payment_failed':
        logger.warn('Payment failed', { id: obj?.id, userId });
        break;

      case 'invoice.payment_failed':
        logger.warn('Invoice payment failed', { id: obj?.id, userId: obj?.metadata?.userId });
        break;

      default:
        logger.info('Unhandled Stripe event type', { type: event.type });
    }
  } catch (err) {
    // Don't re-send a response — already acknowledged above
    logger.error('Webhook event processing error', { type: event.type, error: err.message });
  }
});

module.exports = router;
