const { SquareClient, SquareEnvironment } = require('square');
const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

/**
 * Square Payment Provider Implementation
 */
class SquareProvider extends PaymentProvider {
  constructor(config) {
    super(config);

    if (!config.accessToken) {
      throw new Error('Square access token is required');
    }

    const environment = config.environment === 'production'
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox;

    this.client = new SquareClient({
      token: config.accessToken,
      environment,
    });

    this.locationId = config.locationId;
    this.applicationId = config.applicationId;
    this.webhookSignatureKey = config.webhookSignatureKey;
  }

  async createPaymentIntent({ amount, currency, metadata }) {
    const idempotencyKey = crypto.randomUUID();

    return {
      clientSecret: idempotencyKey,
      paymentIntentId: idempotencyKey,
      locationId: this.locationId,
      amount,
      currency,
    };
  }

  async confirmPayment({ sourceId, idempotencyKey, amount, currency }) {
    if (!sourceId) {
      throw new Error('sourceId (card token) is required');
    }

    const requestBody = {
      sourceId,
      idempotencyKey: idempotencyKey || crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amount),
        currency: currency.toUpperCase(),
      },
      locationId: this.locationId,
    };

    const response = await this.client.paymentsApi.createPayment(requestBody);

    if (response.result?.payment) {
      const payment = response.result.payment;
      return {
        status: payment.status,
        amount: Number(payment.amountMoney.amount),
        currency: payment.amountMoney.currency,
        created: Date.parse(payment.createdAt) / 1000,
        paymentId: payment.id,
      };
    }

    if (response.result?.errors) {
      throw new Error(response.result.errors.map(e => e.detail).join(', '));
    }

    throw new Error('Unexpected Square API response');
  }

  async refund(paymentId, amount) {
    if (!paymentId) {
      throw new Error('paymentId is required');
    }

    const requestBody = {
      idempotencyKey: crypto.randomUUID(),
      paymentId,
    };

    if (amount) {
      requestBody.amountMoney = {
        amount: BigInt(amount),
        currency: 'USD',
      };
    }

    const response = await this.client.refundsApi.refundPayment(requestBody);

    if (response.result?.refund) {
      return {
        refundId: response.result.refund.id,
        status: response.result.refund.status,
      };
    }

    if (response.result?.errors) {
      throw new Error(response.result.errors.map(e => e.detail).join(', '));
    }

    throw new Error('Unexpected Square API response');
  }

  verifyWebhook(payload, headers) {
    const signature = headers['x-square-signature'];
    const requestUrl = headers['x-square-hmac-sha256-signature-url'];

    if (!signature || !requestUrl) {
      throw new Error('Missing Square webhook signature headers');
    }

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSignatureKey);
      const digest = hmac.update(`${requestUrl}${JSON.stringify(payload)}`).digest('hex');

      if (digest !== signature) {
        throw new Error('Signature mismatch');
      }

      return payload;
    } catch (error) {
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  getName() {
    return 'square';
  }

  getFrontendConfig() {
    return {
      applicationId: this.applicationId,
      locationId: this.locationId,
      provider: 'square',
      environment: this.client.config.environment.name.toLowerCase(),
    };
  }
}

module.exports = SquareProvider;
