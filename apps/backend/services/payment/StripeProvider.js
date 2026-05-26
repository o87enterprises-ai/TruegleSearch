const Stripe = require('stripe');
const PaymentProvider = require('./PaymentProvider');

/**
 * Stripe Payment Provider Implementation
 */
class StripeProvider extends PaymentProvider {
  constructor(config) {
    super(config);

    if (!config.secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(config.secretKey);
    this.webhookSecret = config.webhookSecret;
    this.publishableKey = config.publishableKey;
  }

  async createPaymentIntent({ amount, currency, metadata }) {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: metadata || {},
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  async confirmPayment({ sourceId, idempotencyKey, amount, currency }) {
    // For Stripe, this retrieves the current state of a PaymentIntent
    // The actual confirmation happens client-side with Stripe.js
    const paymentIntent = await this.stripe.paymentIntents.retrieve(sourceId);

    return {
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      created: paymentIntent.created,
      paymentId: paymentIntent.id,
    };
  }

  async refund(paymentId, amount) {
    const charge = await this.stripe.charges.list({
      payment_intent: paymentId,
      limit: 1,
    });

    if (!charge.data.length) {
      throw new Error('No charge found for payment');
    }

    const refundParams = { charge: charge.data[0].id };
    if (amount) {
      refundParams.amount = amount;
    }

    const refund = await this.stripe.refunds.create(refundParams);

    return {
      refundId: refund.id,
      status: refund.status,
    };
  }

  verifyWebhook(payload, headers) {
    const signature = headers['stripe-signature'];
    if (!signature) {
      throw new Error('Missing Stripe signature header');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
    } catch (error) {
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  getName() {
    return 'stripe';
  }

  getFrontendConfig() {
    return {
      publishableKey: this.publishableKey,
      provider: 'stripe',
    };
  }
}

module.exports = StripeProvider;
