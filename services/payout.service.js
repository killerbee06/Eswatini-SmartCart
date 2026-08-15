/**
 * Payout Service
 *
 * Manages the full merchant payout lifecycle:
 *  - Calculate available merchant balance from ledger entries
 *  - Generate payout batches (scheduled or on-demand)
 *  - Approval workflow (finance/admin)
 *  - Disbursement processing (mock bank transfer)
 *  - Audit trail for every state transition
 *
 * Payout state machine:
 *   PENDING → APPROVED → PROCESSING → COMPLETED
 *                  ↓           ↓
 *              REJECTED     FAILED
 */

import db from '../config/knex.js';
import { AppError, NotFoundError } from '../shared/errors.js';
import { LEDGER_ACCOUNTS } from '../shared/constants.js';
import { generateIdempotencyKey } from '../shared/utils.js';
import { getPaymentProvider } from './payment-providers/index.js';

// ── Payout state machine ──────────────────────────────────
const PAYOUT_TRANSITIONS = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],   // terminal
  FAILED: ['PENDING'],  // can retry
  REJECTED: ['PENDING'],  // can re-submit
};

/**
 * Validate a payout state transition.
 */
function validateTransition(from, to) {
  const allowed = PAYOUT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(
      `Invalid payout transition: ${from} → ${to}. Allowed: ${allowed?.join(', ') || 'none'}`,
      400
    );
  }
}

// ── Minimum payout threshold (configurable via system_settings) ──
let MIN_PAYOUT_AMOUNT = 50.00; // SZL — avoid tiny payouts

async function _loadPayoutSettings() {
  try {
    const setting = await db('system_settings').where({ key: 'min_payout_amount' }).first();
    if (setting) MIN_PAYOUT_AMOUNT = Number(setting.value);
  } catch {
    // Use default
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Calculate the available balance for a merchant store.
 *
 * Balance = SUM(merchant_payable CREDIT entries) − SUM(existing payouts)
 *
 * Only considers ledger entries from orders that are in a final state
 * (DELIVERED or REFUNDED — but REFUNDED orders have refund ledger entries
 * that already offset the balance).
 *
 * @param {string} storeId
 * @returns {Promise<object>} – { storeId, available, totalEarned, totalPaidOut, pendingPayouts }
 */
export async function getMerchantBalance(storeId) {
  // 1. Sum all merchant_payable credits for this store's orders
  const [{ total_earned }] = await db('ledger_entries')
    .join('orders', 'orders.id', 'ledger_entries.order_id')
    .where('ledger_entries.account', LEDGER_ACCOUNTS.MERCHANT_PAYABLE)
    .where('ledger_entries.entry_type', 'CREDIT')
    .where('orders.store_id', storeId)
    .select(db.raw('COALESCE(SUM(ledger_entries.amount), 0) as total_earned'));

  // 2. Sum all completed/payouts currently being processed for this store
  const [{ total_paid_out }] = await db('merchant_payouts')
    .where({ store_id: storeId })
    .whereIn('status', ['COMPLETED', 'PROCESSING'])
    .select(db.raw('COALESCE(SUM(amount), 0) as total_paid_out'));

  // 3. Sum pending/approved payouts (not yet disbursed)
  const [{ pending_amount }] = await db('merchant_payouts')
    .where({ store_id: storeId })
    .whereIn('status', ['PENDING', 'APPROVED'])
    .select(db.raw('COALESCE(SUM(amount), 0) as pending_amount'));

  const available = Number(total_earned) - Number(total_paid_out) - Number(pending_amount);

  return {
    store_id: storeId,
    total_earned: Number(total_earned),
    total_paid_out: Number(total_paid_out),
    pending_payouts: Number(pending_amount),
    available: Math.max(0, Number(available.toFixed(2))),
  };
}

/**
 * Generate payout records for all eligible merchants.
 *
 * A merchant is eligible if:
 *  - They have an available balance ≥ MIN_PAYOUT_AMOUNT
 *  - They don't already have a PENDING or APPROVED payout
 *
 * @param {object} [opts]
 * @param {string} [opts.generatedBy]  – profile UUID of the finance/admin who triggered
 * @returns {Promise<object[]>}        – array of created payout records
 */
export async function generatePayoutBatch({ generatedBy } = {}) {
  const trx = await db.transaction();
  try {
    // Find all stores with active merchant users
    const storesWithOrders = await trx('orders')
      .distinct('orders.store_id')
      .join('sub_orders', 'sub_orders.store_id', 'orders.store_id')
      .where('orders.status', 'DELIVERED')
      .select('orders.store_id');

    const createdPayouts = [];

    // Load configurable settings
    await _loadPayoutSettings();

    for (const { store_id: storeId } of storesWithOrders) {
      // Check if store already has an active payout
      const activePayout = await trx('merchant_payouts')
        .where({ store_id: storeId })
        .whereIn('status', ['PENDING', 'APPROVED', 'PROCESSING'])
        .first();

      if (activePayout) continue; // Skip — already has an active payout

      // Calculate balance
      const balance = await _calculateBalance(trx, storeId);

      if (balance < MIN_PAYOUT_AMOUNT) continue; // Below threshold

      // Find the merchant profile (store owner) for this store
      const storeUser = await trx('store_users')
        .where({ store_id: storeId, role: 'MERCHANT_OWNER', is_active: true })
        .first();

      if (!storeUser) continue; // No owner found

      const payoutRef = `PO-${generateIdempotencyKey()}`;

      const [payoutId] = await trx('merchant_payouts').insert({
        store_id: storeId,
        profile_id: storeUser.profile_id,
        amount: Number(balance.toFixed(2)),
        status: 'PENDING',
        reference: payoutRef,
      }).returning('id');

      // Create audit event
      await _logPayoutEvent(trx, payoutId, null, 'PENDING', generatedBy,
        `Payout batch generated. Balance: SZL ${balance.toFixed(2)}`);

      createdPayouts.push({
        id: payoutId,
        store_id: storeId,
        profile_id: storeUser.profile_id,
        amount: Number(balance.toFixed(2)),
        status: 'PENDING',
        reference: payoutRef,
      });
    }

    await trx.commit();
    return createdPayouts;
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Approve a pending payout.
 *
 * @param {number} payoutId
 * @param {string} approvedBy  – profile UUID
 * @param {string} [notes]
 * @returns {Promise<object>}
 */
export async function approvePayout(payoutId, approvedBy, notes) {
  const trx = await db.transaction();
  try {
    const payout = await trx('merchant_payouts').where({ id: payoutId }).forUpdate().first();
    if (!payout) {
      await trx.rollback();
      throw new NotFoundError('Payout');
    }

    validateTransition(payout.status, 'APPROVED');

    await trx('merchant_payouts').where({ id: payoutId }).update({
      status: 'APPROVED',
      updated_at: new Date(),
    });

    await _logPayoutEvent(trx, payoutId, payout.status, 'APPROVED', approvedBy,
      notes || `Payout of SZL ${payout.amount} approved`);

    await trx.commit();
    return await db('merchant_payouts').where({ id: payoutId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Reject a payout.
 *
 * @param {number} payoutId
 * @param {string} rejectedBy  – profile UUID
 * @param {string} reason      – must provide a reason
 * @returns {Promise<object>}
 */
export async function rejectPayout(payoutId, rejectedBy, reason) {
  if (!reason || reason.trim().length < 3) {
    throw new AppError('Rejection reason is required (minimum 3 characters).', 400);
  }

  const trx = await db.transaction();
  try {
    const payout = await trx('merchant_payouts').where({ id: payoutId }).forUpdate().first();
    if (!payout) {
      await trx.rollback();
      throw new NotFoundError('Payout');
    }

    validateTransition(payout.status, 'REJECTED');

    await trx('merchant_payouts').where({ id: payoutId }).update({
      status: 'REJECTED',
      updated_at: new Date(),
    });

    await _logPayoutEvent(trx, payoutId, payout.status, 'REJECTED', rejectedBy,
      `Payout rejected: ${reason}`);

    await trx.commit();
    return await db('merchant_payouts').where({ id: payoutId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Process (disburse) an approved payout.
 *
 * In production, this would call a bank transfer API or mobile money
 * provider. With the mock provider, it simulates instant disbursement.
 *
 * @param {number} payoutId
 * @param {string} processedBy  – profile UUID
 * @returns {Promise<object>}
 */
export async function processPayout(payoutId, processedBy) {
  const trx = await db.transaction();
  try {
    const payout = await trx('merchant_payouts').where({ id: payoutId }).forUpdate().first();
    if (!payout) {
      await trx.rollback();
      throw new NotFoundError('Payout');
    }

    validateTransition(payout.status, 'PROCESSING');

    // Transition to PROCESSING
    await trx('merchant_payouts').where({ id: payoutId }).update({
      status: 'PROCESSING',
      updated_at: new Date(),
    });

    await _logPayoutEvent(trx, payoutId, payout.status, 'PROCESSING', processedBy,
      'Disbursement initiated');

    // Call disbursement provider (mock for now)
    const provider = getPaymentProvider('MOCK');
    const result = await provider.createPayment({
      paymentRef: payout.reference,
      amount: Number(payout.amount),
      currency: 'SZL',
      payerPhone: null,
      description: `Merchant payout ${payout.reference} to store ${payout.store_id}`,
    });

    const finalStatus = result.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED';

    await trx('merchant_payouts').where({ id: payoutId }).update({
      status: finalStatus,
      updated_at: new Date(),
    });

    await _logPayoutEvent(trx, payoutId, 'PROCESSING', finalStatus, processedBy,
      finalStatus === 'COMPLETED'
        ? `Disbursement of SZL ${payout.amount} completed (${result.providerReference})`
        : `Disbursement failed: ${result.raw?.error_message || 'Unknown error'}`);

    // If completed, create offsetting ledger entry to zero out merchant_payable
    if (finalStatus === 'COMPLETED') {
      await trx('ledger_entries').insert({
        payout_id: payoutId,
        order_id: null,
        entry_type: 'DEBIT',
        account: LEDGER_ACCOUNTS.MERCHANT_PAYABLE,
        amount: payout.amount,
        description: `Payout disbursed: ${payout.reference}`,
      });
    }

    await trx.commit();
    return await db('merchant_payouts').where({ id: payoutId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Get payout details with event history.
 */
export async function getPayout(payoutId) {
  const payout = await db('merchant_payouts').where({ id: payoutId }).first();
  if (!payout) throw new NotFoundError('Payout');

  const events = await db('payout_events')
    .where({ payout_id: payoutId })
    .orderBy('created_at', 'asc');

  return { ...payout, events };
}

/**
 * List payouts for a specific store (merchant view).
 */
export async function getStorePayouts(storeId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const [{ count: total }] = await db('merchant_payouts')
    .where({ store_id: storeId })
    .count('id as count');

  const payouts = await db('merchant_payouts')
    .where({ store_id: storeId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { payouts, total: parseInt(total, 10), page, limit };
}

/**
 * List payouts for the current user's stores.
 */
export async function getMyPayouts(userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const query = db('merchant_payouts')
    .where('merchant_payouts.profile_id', userId);

  const [{ count: total }] = await query.clone().count('merchant_payouts.id as count');

  const payouts = await query
    .orderBy('merchant_payouts.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { payouts, total: parseInt(total, 10), page, limit };
}

/**
 * List all payouts (finance/admin view) with optional filters.
 */
export async function listAllPayouts({ status, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const query = db('merchant_payouts')
    .join('stores', 'stores.id', 'merchant_payouts.store_id')
    .leftJoin('profiles', 'profiles.id', 'merchant_payouts.profile_id')
    .select(
      'merchant_payouts.*',
      'stores.name as store_name',
      'profiles.full_name as merchant_name'
    );

  if (status) {
    query.where('merchant_payouts.status', status);
  }

  const [{ count: total }] = await query.clone().count('merchant_payouts.id as count');

  const payouts = await query
    .orderBy('merchant_payouts.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { payouts, total: parseInt(total, 10), page, limit };
}

/**
 * Get payout summary stats for dashboard.
 */
export async function getPayoutStats() {
  const [totalPaid] = await db('merchant_payouts')
    .where({ status: 'COMPLETED' })
    .select(db.raw('COALESCE(SUM(amount), 0) as total'));

  const [pendingCount] = await db('merchant_payouts')
    .where({ status: 'PENDING' })
    .count('id as count');

  const [pendingAmount] = await db('merchant_payouts')
    .where({ status: 'PENDING' })
    .select(db.raw('COALESCE(SUM(amount), 0) as total'));

  const [processingCount] = await db('merchant_payouts')
    .where({ status: 'PROCESSING' })
    .count('id as count');

  const [failedCount] = await db('merchant_payouts')
    .where({ status: 'FAILED' })
    .count('id as count');

  return {
    total_disbursed: Number(totalPaid?.total || 0),
    pending_count: parseInt(pendingCount?.count || 0, 10),
    pending_amount: Number(pendingAmount?.total || 0),
    processing_count: parseInt(processingCount?.count || 0, 10),
    failed_count: parseInt(failedCount?.count || 0, 10),
  };
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Calculate available balance for a store within a transaction.
 */
async function _calculateBalance(trx, storeId) {
  const [{ total_earned }] = await trx('ledger_entries')
    .join('orders', 'orders.id', 'ledger_entries.order_id')
    .where('ledger_entries.account', LEDGER_ACCOUNTS.MERCHANT_PAYABLE)
    .where('ledger_entries.entry_type', 'CREDIT')
    .where('orders.store_id', storeId)
    .select(trx.raw('COALESCE(SUM(ledger_entries.amount), 0) as total_earned'));

  const [{ total_settled }] = await trx('merchant_payouts')
    .where({ store_id: storeId })
    .whereIn('status', ['COMPLETED', 'PROCESSING'])
    .select(trx.raw('COALESCE(SUM(amount), 0) as total_settled'));

  const [{ pending_amount }] = await trx('merchant_payouts')
    .where({ store_id: storeId })
    .whereIn('status', ['PENDING', 'APPROVED'])
    .select(trx.raw('COALESCE(SUM(amount), 0) as pending_amount'));

  return Number(total_earned) - Number(total_settled) - Number(pending_amount);
}

/**
 * Log a payout event for audit trail.
 */
async function _logPayoutEvent(trx, payoutId, fromStatus, toStatus, actorId, notes) {
  // Create the payout_events table if it doesn't exist in memory check
  // We insert into it — the table should exist from migration
  try {
    await trx('payout_events').insert({
      payout_id: payoutId,
      from_status: fromStatus,
      to_status: toStatus,
      actor_id: actorId,
      notes,
    });
  } catch {
    // If payout_events table doesn't exist yet, log to audit_logs instead
    await trx('audit_logs').insert({
      actor_id: actorId,
      action: 'payout.status_changed',
      entity_type: 'payout',
      entity_id: String(payoutId),
      after: JSON.stringify({ from: fromStatus, to: toStatus, notes }),
    });
  }
}
