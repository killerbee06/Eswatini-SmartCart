/**
 * Payment Provider Registry
 *
 * Factory that returns the correct provider instance by name.
 * In production, swap MockPaymentProvider for real implementations.
 */

import { PAYMENT_PROVIDERS } from '../../shared/constants.js';
import { MockPaymentProvider } from './mock.provider.js';

// Singleton instances
const providers = new Map();

/**
 * Get (or create) a payment provider by name.
 *
 * @param {string} providerName  – one of PAYMENT_PROVIDERS values
 * @param {object} [opts]        – provider-specific options
 * @returns {import('./base.provider.js').BasePaymentProvider}
 */
export function getPaymentProvider(providerName, opts = {}) {
  const name = (providerName || PAYMENT_PROVIDERS.MOCK).toUpperCase();

  if (providers.has(name)) {
    return providers.get(name);
  }

  let provider;

  switch (name) {
    case PAYMENT_PROVIDERS.MOCK:
      provider = new MockPaymentProvider(opts);
      break;

    // Future providers:
    // case PAYMENT_PROVIDERS.MTN_MOMO:
    //   provider = new MtnMomoProvider(opts);
    //   break;
    // case PAYMENT_PROVIDERS.CARD:
    //   provider = new CardProvider(opts);
    //   break;

    default:
      // Fall back to mock for unknown providers during development
      console.warn(`⚠️  Unknown payment provider "${name}", falling back to MOCK`);
      provider = new MockPaymentProvider(opts);
      break;
  }

  providers.set(name, provider);
  return provider;
}

/**
 * Reset provider cache (useful in tests).
 */
export function resetProviders() {
  providers.clear();
}
