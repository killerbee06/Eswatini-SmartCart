/**
 * Payment Service
 *
 * Central orchestrator for all payment operations:
 *  - Create payment (with idempotency via payment_ref)
 *  - Process payment via provider
 *  - Handle webhook callbacks
 *  - Refund flow
 *  - Ledger entry generation
 *
 * All financial mutations run inside Knex transactions.
 */

import db from '../config/knex.js';
import { getPaymentProvider } from './payment-providers/index.js';
import { generateIdempotencyKey } from '../shared/utils.js';
import { AppError, ConflictError, NotFoundError } from '../shared/errors.js';
import { PAYMENT_STATUS, LEDGER_ACCOUNTS } from '../shared/constants.js';

// ── Payment state machine ──────────────────────────────────
const PAYMENT_TRANSITIONS = {
  CREATED: ['PENDING', 'FAILED', 'CANCELLED'],
  PENDING: ['PROCESSING', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: [],            // terminal
  CANCELLED: [],         // terminal
  REFUNDED: [],          // terminal
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

/**
 * Validate a payment state transition.
 */
function validateTransition(from, to) {
  const allowed = PAYMENT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(
      `Invalid payment transition: ${from} → ${to}. Allowed: ${allowed?.join(', ') || 'none'}`,
      400
    );
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Create (or return existing) payment for an order.
 * The payment_ref acts as the idempotency key — duplicate calls
 * return the original payment without creating a new one.
 *
 * @param {object} params
 * @param {number} params.orderId
 * @param {string} params.payerId      – profile UUID
 * @param {number} params.amount
 * @param {string} params.provider     – e.g. 'MOCK', 'MTN_MOMO'
 * @param {string} [params.payerPhone]
 * @returns {Promise<object>}          – payment record
 */
export async function createPayment({ orderId, payerId, amount, provider, payerPhone }) {
  const trx = await db.transaction();
  try {
    // Idempotency check: generate a ref scoped to this order
    // If a payment for this order+provider already exists, return it
    const existing = await trx('payments')
      .where({ order_id: orderId, provider: provider || 'MOCK' })
      .whereIn('status', [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID])
      .first();

    if (existing) {
      await trx.commit();
      return existing;
    }

    const paymentRef = generateIdempotencyKey();

    const [paymentId] = await trx('payments').insert({
      payment_ref: paymentRef,
      order_id: orderId,
      payer_id: payerId,
      status: PAYMENT_STATUS.CREATED,
      amount,
      provider: provider || 'MOCK',
      provider_reference: null,
    }).returning('id');

    // Log creation event
    await trx('payment_events').insert({
      payment_id: paymentId,
      event_type: 'payment_created',
      payload: JSON.stringify({ payment_ref: paymentRef, amount, provider }),
    });

    await trx.commit();

    return await db('payments').where({ id: paymentId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Process a payment — calls the external provider and updates state.
 *
 * @param {number} paymentId
 * @param {object} [opts]
 * @param {string} [opts.payerPhone]
 * @returns {Promise<object>} – updated payment record
 */
export async function processPayment(paymentId, opts = {}) {
  const trx = await db.transaction();
  try {
    const payment = await trx('payments').where({ id: paymentId }).forUpdate().first();
    if (!payment) {
      await trx.rollback();
      throw new NotFoundError('Payment');
    }

    // Fetch order for context
    const order = await trx('orders').where({ id: payment.order_id }).first();

    // Transition to PROCESSING
    validateTransition(payment.status, PAYMENT_STATUS.PROCESSING);
    await _transition(trx, payment, PAYMENT_STATUS.PROCESSING, 'Payment processing started');

    // Call provider
    const provider = getPaymentProvider(payment.provider);
    const providerResult = await provider.createPayment({
      paymentRef: payment.payment_ref,
      amount: Number(payment.amount),
      currency: 'SZL',
      payerPhone: opts.payerPhone || null,
      description: `SmartCart Order ${order?.main_ref || payment.order_id}`,
    });

    // Record attempt
    const attemptNumber = await _nextAttemptNumber(trx, paymentId);
    await trx('payment_attempts').insert({
      payment_id: paymentId,
      status: providerResult.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
      provider_response: JSON.stringify(providerResult.raw || {}),
      error_message: providerResult.status === 'FAILED' ? (providerResult.raw?.error_message || 'Provider rejected') : null,
      attempt_number: attemptNumber,
    });

    if (providerResult.status === 'SUCCEEDED') {
      // Transition to PAID
      await _transition(trx, payment, PAYMENT_STATUS.PAID, 'Payment confirmed by provider');
      await trx('payments').where({ id: paymentId }).update({
        provider_reference: providerResult.providerReference,
      });

      // Update order status
      if (order && order.status === 'PENDING_PAYMENT') {
        await trx('orders').where({ id: order.id }).update({ status: 'PAID' });
        await trx('order_status_events').insert({
          order_id: order.id,
          from_status: 'PENDING_PAYMENT',
          to_status: 'PAID',
          actor_id: payment.payer_id,
          notes: `Payment confirmed (${payment.payment_ref})`,
        });
      }

      // Create ledger entries
      await _createLedgerEntries(trx, payment, order);
    } else if (providerResult.status === 'FAILED') {
      // Transition to FAILED
      await _transition(trx, payment, PAYMENT_STATUS.FAILED, providerResult.raw?.error_message || 'Provider rejected');
    } else {
      // PENDING — leave in PROCESSING state, will be resolved by webhook
      await trx('payments').where({ id: paymentId }).update({
        provider_reference: providerResult.providerReference,
      });
    }

    // Log event
    await trx('payment_events').insert({
      payment_id: paymentId,
      event_type: `provider_${providerResult.status.toLowerCase()}`,
      payload: JSON.stringify(providerResult),
    });

    await trx.commit();

    return await db('payments').where({ id: paymentId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Handle an incoming webhook from a payment provider.
 * Validates the event, updates payment state, and triggers side effects.
 *
 * @param {object} params
 * @param {string} params.paymentRef      – our payment_ref
 * @param {string} params.providerStatus  – SUCCEEDED | FAILED | PENDING
 * @param {object} params.payload         – raw webhook body
 * @returns {Promise<object>}             – updated payment record
 */
export async function handleWebhook({ paymentRef, providerStatus, payload }) {
  const trx = await db.transaction();
  try {
    const payment = await trx('payments').where({ payment_ref: paymentRef }).forUpdate().first();
    if (!payment) {
      await trx.rollback();
      throw new NotFoundError('Payment');
    }

    // Log webhook event
    await trx('payment_events').insert({
      payment_id: payment.id,
      event_type: 'webhook_received',
      payload: JSON.stringify(payload),
    });

    // Map provider status to our status
    const targetStatus = providerStatus === 'SUCCEEDED'
      ? PAYMENT_STATUS.PAID
      : providerStatus === 'FAILED'
        ? PAYMENT_STATUS.FAILED
        : null;

    if (!targetStatus) {
      // Unknown status — log but don't change state
      await trx.commit();
      return payment;
    }

    // Only transition if not already in a terminal state
    if (payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.FAILED || payment.status === PAYMENT_STATUS.REFUNDED) {
      await trx.commit();
      return payment; // Already processed — idempotent webhook handling
    }

    if (payment.status === PAYMENT_STATUS.PROCESSING || payment.status === PAYMENT_STATUS.PENDING) {
      await _transition(trx, payment, targetStatus, `Webhook: ${providerStatus}`);

      // If paid, update order and create ledger entries
      if (targetStatus === PAYMENT_STATUS.PAID) {
        const order = await trx('orders').where({ id: payment.order_id }).first();
        if (order && order.status === 'PENDING_PAYMENT') {
          await trx('orders').where({ id: order.id }).update({ status: 'PAID' });
          await trx('order_status_events').insert({
            order_id: order.id,
            from_status: 'PENDING_PAYMENT',
            to_status: 'PAID',
            actor_id: payment.payer_id,
            notes: `Payment confirmed via webhook (${paymentRef})`,
          });
        }
        await _createLedgerEntries(trx, payment, order);
      }

      // Log state change event
      await trx('payment_events').insert({
        payment_id: payment.id,
        event_type: 'status_changed',
        payload: JSON.stringify({ from: payment.status, to: targetStatus }),
      });
    }

    await trx.commit();
    return await db('payments').where({ id: payment.id }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Refund a paid payment.
 *
 * @param {number} paymentId
 * @param {number} [amount]     – partial refund amount (default: full)
 * @returns {Promise<object>}   – updated payment record
 */
export async function refundPayment(paymentId, amount) {
  const trx = await db.transaction();
  try {
    const payment = await trx('payments').where({ id: paymentId }).forUpdate().first();
    if (!payment) {
      await trx.rollback();
      throw new NotFoundError('Payment');
    }

    if (payment.status !== PAYMENT_STATUS.PAID && payment.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED) {
      await trx.rollback();
      throw new AppError(`Cannot refund payment in status: ${payment.status}`, 400);
    }

    const refundAmount = amount ? Number(amount) : Number(payment.amount);
    if (refundAmount <= 0 || refundAmount > Number(payment.amount)) {
      await trx.rollback();
      throw new AppError('Invalid refund amount.', 400);
    }

    // Call provider refund
    const provider = getPaymentProvider(payment.provider);
    const result = await provider.refund(payment.provider_reference, refundAmount);

    if (result.status === 'REFUNDED') {
      const isPartial = refundAmount < Number(payment.amount);
      const newStatus = isPartial ? PAYMENT_STATUS.PARTIALLY_REFUNDED : PAYMENT_STATUS.REFUNDED;

      await _transition(trx, payment, newStatus, `Refund of ${refundAmount} processed`);

      // Create refund ledger entries
      await trx('ledger_entries').insert({
        payment_id: paymentId,
        order_id: payment.order_id,
        entry_type: 'DEBIT',
        account: LEDGER_ACCOUNTS.REFUND_PAYABLE,
        amount: refundAmount,
        description: `Refund for payment ${payment.payment_ref}`,
      });

      // Log refund event
      await trx('payment_events').insert({
        payment_id: paymentId,
        event_type: 'refund_completed',
        payload: JSON.stringify({ amount: refundAmount, result }),
      });

      // Update order status if full refund
      if (!isPartial) {
        const order = await trx('orders').where({ id: payment.order_id }).first();
        if (order) {
          await trx('orders').where({ id: order.id }).update({ status: 'REFUNDED' });
          await trx('order_status_events').insert({
            order_id: order.id,
            from_status: order.status,
            to_status: 'REFUNDED',
            notes: `Full refund of ${refundAmount}`,
          });
        }
      }
    } else {
      await trx('payment_events').insert({
        payment_id: paymentId,
        event_type: 'refund_failed',
        payload: JSON.stringify(result),
      });
    }

    await trx.commit();
    return await db('payments').where({ id: paymentId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Get payment details with history.
 */
export async function getPayment(paymentId) {
  const payment = await db('payments').where({ id: paymentId }).first();
  if (!payment) throw new NotFoundError('Payment');

  const events = await db('payment_events')
    .where({ payment_id: paymentId })
    .orderBy('created_at', 'asc');

  const attempts = await db('payment_attempts')
    .where({ payment_id: paymentId })
    .orderBy('created_at', 'asc');

  return { ...payment, events, attempts };
}

/**
 * Get payment by payment_ref (for webhook lookups).
 */
export async function getPaymentByRef(paymentRef) {
  return db('payments').where({ payment_ref: paymentRef }).first();
}

/**
 * List payments for an order.
 */
export async function getPaymentsForOrder(orderId) {
  return db('payments')
    .where({ order_id: orderId })
    .orderBy('created_at', 'desc');
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Transition payment status inside a transaction.
 */
async function _transition(trx, payment, toStatus, notes) {
  validateTransition(payment.status, toStatus);

  await trx('payments').where({ id: payment.id }).update({
    status: toStatus,
    updated_at: new Date(),
  });

  await trx('payment_events').insert({
    payment_id: payment.id,
    event_type: 'status_changed',
    payload: JSON.stringify({ from: payment.status, to: toStatus, notes }),
  });
}

/**
 * Get the next attempt number for a payment.
 */
async function _nextAttemptNumber(trx, paymentId) {
  const [{ count }] = await trx('payment_attempts')
    .where({ payment_id: paymentId })
    .count('id as count');
  return Number(count) + 1;
}

/**
 * Create double-entry ledger entries when a payment succeeds.
 *
 * 1. DEBIT  customer_payable    (customer owes us)
 * 2. CREDIT platform_revenue    (commission earned)
 * 3. CREDIT merchant_payable    (merchant payout)
 * 4. CREDIT delivery_revenue    (delivery fee)
 */
async function _createLedgerEntries(trx, payment, order) {
  const amount = Number(payment.amount);
  const commissionRate = order ? Number(order.commission_rate_snapshot) : 0.03;
  const deliveryFee = order ? Number(order.delivery_fee) : 0;
  const subtotal = amount - deliveryFee;
  const commission = Number((subtotal * commissionRate).toFixed(2));
  const merchantPayout = Number((subtotal - commission).toFixed(2));

  // 1. Customer pays the full amount
  await trx('ledger_entries').insert({
    payment_id: payment.id,
    order_id: payment.order_id,
    entry_type: 'DEBIT',
    account: LEDGER_ACCOUNTS.CUSTOMER_PAYABLE,
    amount,
    description: `Payment received for order ${order?.main_ref || payment.order_id}`,
  });

  // 2. Platform commission
  if (commission > 0) {
    await trx('ledger_entries').insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      entry_type: 'CREDIT',
      account: LEDGER_ACCOUNTS.PLATFORM_REVENUE,
      amount: commission,
      description: `Platform commission (${(commissionRate * 100).toFixed(1)}%)`,
    });
  }

  // 3. Merchant payout
  if (merchantPayout > 0) {
    await trx('ledger_entries').insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      entry_type: 'CREDIT',
      account: LEDGER_ACCOUNTS.MERCHANT_PAYABLE,
      amount: merchantPayout,
      description: `Merchant payout for order ${order?.main_ref || payment.order_id}`,
    });
  }

  // 4. Delivery fee
  if (deliveryFee > 0) {
    await trx('ledger_entries').insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      entry_type: 'CREDIT',
      account: LEDGER_ACCOUNTS.DELIVERY_REVENUE,
      amount: deliveryFee,
      description: `Delivery fee for order ${order?.main_ref || payment.order_id}`,
    });
  }
}
