const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createProvider } = require('../services/payment/index');
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
 * @route   POST /api/payment/webhook
 * @desc    Handle payment provider webhooks
 * @access  Public (verified by provider signature)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const provider = getProvider();
    const event = provider.verifyWebhook(req.body, req.headers);

    logger.info('Payment webhook received', { type: event.type });

    // Handle specific events
    switch (event.type) {
      case 'payment_intent.succeeded':
        logger.info('Payment succeeded', { id: event.data?.object?.id });
        // TODO: Update user premium status, grant tokens, etc.
        break;
      case 'payment_intent.payment_failed':
        logger.warn('Payment failed', { id: event.data?.object?.id });
        break;
      default:
        logger.info('Unhandled webhook event', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook verification failed', { error: error.message });
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

module.exports = router;
