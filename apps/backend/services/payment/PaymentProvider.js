/**
 * PaymentProvider Interface
 * 
 * All payment provider implementations must implement this interface.
 * This ensures consistent behavior across different payment processors.
 */
class PaymentProvider {
  /**
   * Initialize the payment provider with configuration
   * @param {Object} config - Provider-specific configuration
   */
  constructor(config) {
    if (this.constructor === PaymentProvider) {
      throw new Error('PaymentProvider is an abstract class');
    }
  }

  /**
   * Create a payment intent
   * @param {Object} options - Payment options
   * @param {number} options.amount - Amount in smallest currency unit (cents)
   * @param {string} options.currency - ISO currency code (e.g., 'usd')
   * @param {Object} [options.metadata] - Optional metadata
   * @returns {Promise<{clientSecret: string, paymentIntentId: string}>}
   */
  async createPaymentIntent({ amount, currency, metadata }) {
    throw new Error('Method not implemented: createPaymentIntent');
  }

  /**
   * Confirm/retrieve payment status
   * @param {string} paymentIntentId - The payment intent ID
   * @returns {Promise<{status: string, amount: number, currency: string, created: number}>}
   */
  async confirmPayment(paymentIntentId) {
    throw new Error('Method not implemented: confirmPayment');
  }

  /**
   * Refund a payment
   * @param {string} paymentIntentId - The payment intent ID
   * @param {number} [amount] - Amount to refund (partial), omit for full refund
   * @returns {Promise<{refundId: string, status: string}>}
   */
  async refund(paymentIntentId, amount) {
    throw new Error('Method not implemented: refund');
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Raw webhook payload
   * @param {string} signature - Webhook signature
   * @param {string} secret - Webhook secret
   * @returns {Object|null} Parsed event or null if invalid
   */
  verifyWebhook(payload, signature, secret) {
    throw new Error('Method not implemented: verifyWebhook');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('Method not implemented: getName');
  }

  /**
   * Get frontend configuration (public keys only)
   * @returns {Object}
   */
  getFrontendConfig() {
    throw new Error('Method not implemented: getFrontendConfig');
  }
}

module.exports = PaymentProvider;
