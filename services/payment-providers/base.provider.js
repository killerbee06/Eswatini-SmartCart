/**
 * Base Payment Provider — interface contract.
 *
 * Every provider MUST implement these methods. The mock provider
 * simulates network calls so production providers (MTN MoMo, card gateways)
 * can be slotted in without changing the payment service layer.
 */
export class BasePaymentProvider {
  /**
   * Human-readable provider name (e.g. 'MTN_MOMO', 'MOCK').
   * @returns {string}
   */
  get name() {
    throw new Error('Provider must implement get name()');
  }

  /**
   * Initialise a payment with the external provider.
   *
   * @param {object} params
   * @param {string} params.paymentRef   – our idempotency key
   * @param {number} params.amount       – in platform currency units
   * @param {string} params.currency     – e.g. 'SZL'
   * @param {string} params.payerPhone   – phone number / account identifier
   * @param {string} params.description  – human-readable description
   * @returns {Promise<ProviderInitResponse>}
   *
   * @typedef {object} ProviderInitResponse
   * @property {string} providerReference  – external ref to track this payment
   * @property {string} status             – PENDING | FAILED | SUCCEEDED
   * @property {object} [raw]              – provider-specific raw response
   */
  async createPayment({ paymentRef, amount, currency, payerPhone, description }) {
    throw new Error('Provider must implement createPayment()');
  }

  /**
   * Query the current status of a payment from the provider.
   *
   * @param {string} providerReference
   * @returns {Promise<ProviderStatusResponse>}
   *
   * @typedef {object} ProviderStatusResponse
   * @property {string} status  – PENDING | SUCCEEDED | FAILED
   * @property {object} [raw]
   */
  async queryStatus(providerReference) {
    throw new Error('Provider must implement queryStatus()');
  }

  /**
   * Attempt to reverse / refund a payment.
   *
   * @param {string} providerReference
   * @param {number} amount  – partial or full refund
   * @returns {Promise<ProviderRefundResponse>}
   *
   * @typedef {object} ProviderRefundResponse
   * @property {string} status  – REFUNDED | FAILED
   * @property {object} [raw]
   */
  async refund(providerReference, amount) {
    throw new Error('Provider must implement refund()');
  }
}
