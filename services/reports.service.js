/**
 * Reports Service
 *
 * Aggregation queries for the admin/finance dashboard:
 *  - Platform overview (GMV, revenue, commissions, order counts)
 *  - Revenue breakdown by time period
 *  - Top merchants by revenue
 *  - Payment method breakdown
 *  - Ledger summary with balance verification
 *  - Refund analytics
 *  - Platform health metrics
 *
 * All queries are read-only — no mutations.
 */

import db from '../config/knex.js';
import { LEDGER_ACCOUNTS } from '../shared/constants.js';

// ── Platform Overview ─────────────────────────────────────

/**
 * Get the platform overview: GMV, revenue, commissions, orders, users.
 *
 * @param {object} [opts]
 * @param {string} [opts.from]  – ISO date string (default: all time)
 * @param {string} [opts.to]    – ISO date string (default: now)
 * @returns {Promise<object>}
 */
export async function getPlatformOverview({ from, to } = {}) {
  const dateFilter = _buildDateFilter('orders.created_at', from, to);

  // Order stats
  const [orderStats] = await db('orders')
    .modify((qb) => { if (dateFilter) qb.whereRaw(...dateFilter); })
    .select(
      db.raw('COUNT(*) as total_orders'),
      db.raw(`COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed_orders`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_orders`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'REFUNDED') as refunded_orders`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'PENDING_PAYMENT') as pending_orders`),
      db.raw(`COALESCE(SUM(grand_total), 0) as gross_merchandise_value`),
      db.raw(`COALESCE(SUM(items_subtotal), 0) as items_subtotal`),
      db.raw(`COALESCE(SUM(delivery_fee), 0) as total_delivery_fees`),
      db.raw(`COALESCE(SUM(commission_amount), 0) as total_commissions`)
    );

  // Payment stats
  const [paymentStats] = await db('payments')
    .modify((qb) => {
      if (dateFilter) {
        const [sql, ...params] = dateFilter;
        qb.whereRaw(sql.replace('orders.created_at', 'payments.created_at'), params);
      }
    })
    .select(
      db.raw(`COALESCE(SUM(amount), 0) as total_payment_volume`),
      db.raw(`COUNT(*) as total_payments`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'PAID') as successful_payments`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'FAILED') as failed_payments`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'REFUNDED') as refunded_payments`)
    );

  // User stats
  const [userStats] = await db('profiles')
    .select(
      db.raw('COUNT(*) as total_users'),
      db.raw(`COUNT(*) FILTER (WHERE role = 'CUSTOMER') as customers`),
      db.raw(`COUNT(*) FILTER (WHERE role IN ('MERCHANT_OWNER', 'MERCHANT_STAFF')) as merchants`),
      db.raw(`COUNT(*) FILTER (WHERE role = 'DRIVER') as drivers`),
      db.raw(`COUNT(*) FILTER (WHERE is_active = true) as active_users`)
    );

  // Store stats
  const [storeStats] = await db('stores')
    .select(
      db.raw('COUNT(*) as total_stores'),
      db.raw(`COUNT(*) FILTER (WHERE is_active = true) as active_stores`)
    );

  return {
    period: { from: from || 'all_time', to: to || 'now' },
    orders: {
      total: parseInt(orderStats.total_orders, 10),
      completed: parseInt(orderStats.completed_orders, 10),
      cancelled: parseInt(orderStats.cancelled_orders, 10),
      refunded: parseInt(orderStats.refunded_orders, 10),
      pending: parseInt(orderStats.pending_orders, 10),
    },
    financials: {
      gross_merchandise_value: Number(orderStats.gross_merchandise_value),
      items_subtotal: Number(orderStats.items_subtotal),
      total_delivery_fees: Number(orderStats.total_delivery_fees),
      total_commissions: Number(orderStats.total_commissions),
      total_payment_volume: Number(paymentStats.total_payment_volume),
    },
    payments: {
      total: parseInt(paymentStats.total_payments, 10),
      successful: parseInt(paymentStats.successful_payments, 10),
      failed: parseInt(paymentStats.failed_payments, 10),
      refunded: parseInt(paymentStats.refunded_payments, 10),
    },
    users: {
      total: parseInt(userStats.total_users, 10),
      customers: parseInt(userStats.customers, 10),
      merchants: parseInt(userStats.merchants, 10),
      drivers: parseInt(userStats.drivers, 10),
      active: parseInt(userStats.active_users, 10),
    },
    stores: {
      total: parseInt(storeStats.total_stores, 10),
      active: parseInt(storeStats.active_stores, 10),
    },
  };
}

// ── Revenue by Period ─────────────────────────────────────

/**
 * Get daily revenue breakdown.
 *
 * @param {object} opts
 * @param {string} opts.from
 * @param {string} opts.to
 * @returns {Promise<object[]>}
 */
export async function getDailyRevenue({ from, to }) {
  return db('orders')
    .where('status', 'DELIVERED')
    .modify((qb) => {
      if (from) qb.where('orders.created_at', '>=', from);
      if (to) qb.where('orders.created_at', '<=', to);
    })
    .select(
      db.raw("DATE(created_at) as date"),
      db.raw('COUNT(*) as order_count'),
      db.raw('COALESCE(SUM(grand_total), 0) as gmv'),
      db.raw('COALESCE(SUM(commission_amount), 0) as commissions'),
      db.raw('COALESCE(SUM(delivery_fee), 0) as delivery_fees')
    )
    .groupByRaw('DATE(created_at)')
    .orderBy('date', 'asc');
}

/**
 * Get monthly revenue breakdown.
 */
export async function getMonthlyRevenue({ from, to }) {
  return db('orders')
    .where('status', 'DELIVERED')
    .modify((qb) => {
      if (from) qb.where('orders.created_at', '>=', from);
      if (to) qb.where('orders.created_at', '<=', to);
    })
    .select(
      db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"),
      db.raw('COUNT(*) as order_count'),
      db.raw('COALESCE(SUM(grand_total), 0) as gmv'),
      db.raw('COALESCE(SUM(commission_amount), 0) as commissions'),
      db.raw('COALESCE(SUM(delivery_fee), 0) as delivery_fees')
    )
    .groupByRaw("TO_CHAR(created_at, 'YYYY-MM')")
    .orderBy('month', 'asc');
}

// ── Merchant Analytics ────────────────────────────────────

/**
 * Get top merchants by revenue (commission earned).
 */
export async function getTopMerchants({ limit = 10, from, to } = {}) {
  return db('orders')
    .join('sub_orders', 'sub_orders.store_id', 'orders.store_id')
    .join('stores', 'stores.id', 'orders.store_id')
    .where('orders.status', 'DELIVERED')
    .modify((qb) => {
      if (from) qb.where('orders.created_at', '>=', from);
      if (to) qb.where('orders.created_at', '<=', to);
    })
    .select(
      'orders.store_id',
      'stores.name as store_name',
      db.raw('COUNT(DISTINCT orders.id) as order_count'),
      db.raw('COALESCE(SUM(sub_orders.subtotal), 0) as gross_revenue'),
      db.raw(`COALESCE(SUM(sub_orders.store_payout), 0) as net_payout`),
      db.raw(`COALESCE(SUM(sub_orders.subtotal * orders.commission_rate_snapshot), 0) as commissions_generated`)
    )
    .groupBy('orders.store_id', 'stores.name')
    .orderBy('gross_revenue', 'desc')
    .limit(limit);
}

// ── Payment Method Breakdown ──────────────────────────────

/**
 * Get payment breakdown by provider.
 */
export async function getPaymentBreakdown({ from, to } = {}) {
  return db('payments')
    .modify((qb) => {
      if (from) qb.where('payments.created_at', '>=', from);
      if (to) qb.where('payments.created_at', '<=', to);
    })
    .select(
      'provider',
      db.raw('COUNT(*) as count'),
      db.raw('COALESCE(SUM(amount), 0) as total_amount'),
      db.raw(`COUNT(*) FILTER (WHERE status = 'PAID') as successful`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'FAILED') as failed`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'REFUNDED') as refunded`)
    )
    .groupBy('provider')
    .orderBy('total_amount', 'desc');
}

// ── Ledger Summary ───────────────────────────────────────

/**
 * Get ledger balance summary across all accounts.
 * Verifies double-entry accounting (total debits = total credits).
 */
export async function getLedgerSummary() {
  const accounts = await db('ledger_entries')
    .select(
      'account',
      'entry_type',
      db.raw('COALESCE(SUM(amount), 0) as total')
    )
    .groupBy('account', 'entry_type')
    .orderBy('account');

  // Build account balances
  const balances = {};
  for (const row of accounts) {
    if (!balances[row.account]) {
      balances[row.account] = { debits: 0, credits: 0, net: 0 };
    }
    const amount = Number(row.total);
    if (row.entry_type === 'DEBIT') {
      balances[row.account].debits = amount;
      balances[row.account].net -= amount;
    } else {
      balances[row.account].credits = amount;
      balances[row.account].net += amount;
    }
  }

  // Calculate totals
  let totalDebits = 0;
  let totalCredits = 0;
  for (const acc of Object.values(balances)) {
    totalDebits += acc.debits;
    totalCredits += acc.credits;
  }

  return {
    accounts: balances,
    totals: {
      debits: Number(totalDebits.toFixed(2)),
      credits: Number(totalCredits.toFixed(2)),
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    },
  };
}

/**
 * Get ledger entries for a specific account.
 */
export async function getLedgerEntries(account, { page = 1, limit = 50, from, to } = {}) {
  const offset = (page - 1) * limit;

  const query = db('ledger_entries')
    .leftJoin('orders', 'orders.id', 'ledger_entries.order_id')
    .leftJoin('payments', 'payments.id', 'ledger_entries.payment_id')
    .modify((qb) => {
      if (account) qb.where('ledger_entries.account', account);
      if (from) qb.where('ledger_entries.created_at', '>=', from);
      if (to) qb.where('ledger_entries.created_at', '<=', to);
    })
    .select(
      'ledger_entries.*',
      'orders.main_ref as order_ref',
      'payments.payment_ref'
    );

  const [{ count: total }] = await query.clone().count('ledger_entries.id as count');

  const entries = await query
    .orderBy('ledger_entries.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { entries, total: parseInt(total, 10), page, limit };
}

// ── Refund Analytics ──────────────────────────────────────

/**
 * Get refund statistics.
 */
export async function getRefundStats({ from, to } = {}) {
  const [refundStats] = await db('payments')
    .where('status', 'REFUNDED')
    .orWhere('status', 'PARTIALLY_REFUNDED')
    .modify((qb) => {
      if (from) qb.where('payments.created_at', '>=', from);
      if (to) qb.where('payments.created_at', '<=', to);
    })
    .select(
      db.raw('COUNT(*) as total_refunds'),
      db.raw(`COUNT(*) FILTER (WHERE status = 'REFUNDED') as full_refunds`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'PARTIALLY_REFUNDED') as partial_refunds`),
      db.raw(`COALESCE(SUM(amount), 0) as total_refund_amount`)
    );

  // Refund rate
  const [totalPayments] = await db('payments')
    .modify((qb) => {
      if (from) qb.where('payments.created_at', '>=', from);
      if (to) qb.where('payments.created_at', '<=', to);
    })
    .count('id as count');

  const total = parseInt(totalPayments.count, 10);
  const refunded = parseInt(refundStats.total_refunds, 10);

  return {
    total_refunds: refunded,
    full_refunds: parseInt(refundStats.full_refunds, 10),
    partial_refunds: parseInt(refundStats.partial_refunds, 10),
    total_refund_amount: Number(refundStats.total_refund_amount),
    refund_rate: total > 0 ? Number(((refunded / total) * 100).toFixed(2)) : 0,
    total_payments: total,
  };
}

// ── Delivery Analytics ────────────────────────────────────

/**
 * Get delivery performance metrics.
 */
export async function getDeliveryStats({ from, to } = {}) {
  const [stats] = await db('deliveries')
    .modify((qb) => {
      if (from) qb.where('deliveries.created_at', '>=', from);
      if (to) qb.where('deliveries.created_at', '<=', to);
    })
    .select(
      db.raw('COUNT(*) as total_deliveries'),
      db.raw(`COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'FAILED') as failed`),
      db.raw(`COUNT(*) FILTER (WHERE driver_id IS NOT NULL) as assigned`),
      db.raw(`COUNT(*) FILTER (WHERE driver_id IS NULL AND status = 'PENDING_ASSIGNMENT') as unassigned`),
      db.raw(`AVG(EXTRACT(EPOCH FROM (delivered_at - picked_up_at)) / 60) FILTER (WHERE delivered_at IS NOT NULL AND picked_up_at IS NOT NULL) as avg_delivery_minutes`)
    );

  return {
    total: parseInt(stats.total_deliveries, 10),
    completed: parseInt(stats.completed, 10),
    failed: parseInt(stats.failed, 10),
    assigned: parseInt(stats.assigned, 10),
    unassigned: parseInt(stats.unassigned, 10),
    avg_delivery_minutes: stats.avg_delivery_minutes
      ? Number(Number(stats.avg_delivery_minutes).toFixed(1))
      : null,
    completion_rate: parseInt(stats.total_deliveries, 10) > 0
      ? Number(((parseInt(stats.completed, 10) / parseInt(stats.total_deliveries, 10)) * 100).toFixed(1))
      : 0,
  };
}

// ── Audit Trail ──────────────────────────────────────────

/**
 * Get recent audit log entries.
 */
export async function getAuditLogs({ action, entityType, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;

  const query = db('audit_logs')
    .leftJoin('profiles', 'profiles.id', 'audit_logs.actor_id')
    .modify((qb) => {
      if (action) qb.where('audit_logs.action', action);
      if (entityType) qb.where('audit_logs.entity_type', entityType);
    })
    .select(
      'audit_logs.*',
      'profiles.full_name as actor_name'
    );

  const [{ count: total }] = await query.clone().count('audit_logs.id as count');

  const logs = await query
    .orderBy('audit_logs.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { logs, total: parseInt(total, 10), page, limit };
}

// ── Internal helpers ──────────────────────────────────────

/**
 * Build a date filter condition for a given column.
 * @returns {[string, ...any[]] | null}
 */
function _buildDateFilter(column, from, to) {
  const conditions = [];
  const params = [];

  if (from) {
    conditions.push(`${column} >= ?`);
    params.push(from);
  }
  if (to) {
    conditions.push(`${column} <= ?`);
    params.push(to);
  }

  if (conditions.length === 0) return null;
  return [conditions.join(' AND '), ...params];
}
