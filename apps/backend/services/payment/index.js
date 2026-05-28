const StripeProvider = require('./StripeProvider');

let SquareProvider;
try {
  SquareProvider = require('./SquareProvider');
} catch (e) {
  // Square SDK not installed — Square payments unavailable
}

/**
 * Available payment providers
 */
const providers = {
  stripe: StripeProvider,
  ...(SquareProvider ? { square: SquareProvider } : {}),
};

/**
 * Create a payment provider instance based on configuration
 * @param {string} providerName - Name of the provider (e.g., 'stripe', 'square')
 * @param {Object} config - Provider-specific configuration
 * @returns {PaymentProvider}
 */
function createProvider(providerName, config) {
  const Provider = providers[providerName.toLowerCase()];

  if (!Provider) {
    const available = Object.keys(providers).join(', ');
    throw new Error(
      `Unknown payment provider: "${providerName}". Available providers: ${available}`
    );
  }

  return new Provider(config);
}

/**
 * Get list of available providers
 * @returns {string[]}
 */
function getAvailableProviders() {
  return Object.keys(providers);
}

module.exports = {
  createProvider,
  getAvailableProviders,
};
