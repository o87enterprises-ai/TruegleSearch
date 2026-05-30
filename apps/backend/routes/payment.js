const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createProvider } = require('../services/payment/index');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

// Initialize payment provider from env
const PROVIDER_NAME = process.env.PAYMENT_PROVIDER || 'stripe';

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

    const provider = getProvider();
    const result = await provider.createPaymentIntent({
      amount: Math.round(amount),
      currency: currency.toLowerCase(),
      metadata: { ...metadata, userId: req.user.userId },
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
 * @access  Authenticated
 */
router.post('/refund', authenticate, async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const provider = getProvider();
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
  await query(
    `UPDATE users
     SET subscription_tier = 'premium',
         token_balance = token_balance + 100,
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
