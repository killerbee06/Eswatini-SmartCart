/**
 * Mock Payment Provider — simulates a real payment gateway.
 *
 * Behaviour (configurable via environment or constructor opts):
 *  - Creates a payment instantly (status = SUCCEEDED after a short delay).
 *  - Can be forced to fail via amount triggers or explicit flags.
 *  - Supports refund simulation.
 *  - Useful for development, CI, and automated testing.
 *
 * In production this would be replaced by MTN MoMo, Stripe, etc.
 */

import { BasePaymentProvider } from './base.provider.js';

// Simulated processing delay (ms)
const MOCK_DELAY_MS = 300;

// Amounts that trigger a simulated failure (useful for testing error paths)
const FAIL_AMOUNTS = new Set([666.66, 0.01]);

export class MockPaymentProvider extends BasePaymentProvider {
  /** @type {'MOCK'} */
  #providerName = 'MOCK';

  /** If true, all payments succeed regardless of amount. */
  #forceSuccess;

  constructor({ forceSuccess = false } = {}) {
    super();
    this.#forceSuccess = forceSuccess;
  }

  get name() {
    return this.#providerName;
  }

  /**
   * Simulate creating a payment.
   * Returns PENDING initially, then resolves based on amount rules.
   */
  async createPayment({ paymentRef, amount, currency, payerPhone, description }) {
    // Simulate network latency
    await this.#delay();

    const shouldFail =
      !this.#forceSuccess &&
      (FAIL_AMOUNTS.has(Number(amount)) || this.#shouldRandomFail());

    if (shouldFail) {
      return {
        providerReference: `MOCK-${paymentRef}-FAIL`,
        status: 'FAILED',
        raw: {
          error_code: 'INSUFFICIENT_FUNDS',
          error_message: 'Mock: simulated insufficient funds',
        },
      };
    }

    return {
      providerReference: `MOCK-${paymentRef}`,
      status: 'SUCCEEDED',
      raw: {
        provider: 'mock',
        currency: currency || 'SZL',
        payer_phone: payerPhone,
        description,
        processed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Query payment status — always returns SUCCEEDED for valid refs.
   */
  async queryStatus(providerReference) {
    await this.#delay();

    if (providerReference && providerReference.includes('-FAIL')) {
      return {
        status: 'FAILED',
        raw: { error_code: 'PAYMENT_FAILED' },
      };
    }

    return {
      status: 'SUCCEEDED',
      raw: { provider: 'mock', queried_at: new Date().toISOString() },
    };
  }

  /**
   * Simulate a refund.
   */
  async refund(providerReference, amount) {
    await this.#delay();

    if (!providerReference || providerReference.includes('-FAIL')) {
      return {
        status: 'FAILED',
        raw: { error: 'Cannot refund a failed payment' },
      };
    }

    return {
      status: 'REFUNDED',
      raw: {
        provider: 'mock',
        refund_amount: amount,
        refunded_at: new Date().toISOString(),
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────

  #delay() {
    return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  }

  /** 5% random failure rate to surface retry logic in tests. */
  #shouldRandomFail() {
    return Math.random() < 0.05;
  }
}
