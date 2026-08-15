/**
 * Admin Reports Controller
 *
 * REST endpoints for the admin/finance dashboard:
 *  - GET /overview            – platform overview (GMV, revenue, users)
 *  - GET /revenue/daily       – daily revenue breakdown
 *  - GET /revenue/monthly     – monthly revenue breakdown
 *  - GET /merchants/top       – top merchants by revenue
 *  - GET /payments/breakdown  – payment method analytics
 *  - GET /ledger/summary      – ledger balance verification
 *  - GET /ledger/entries      – ledger entry listing
 *  - GET /refunds             – refund analytics
 *  - GET /deliveries          – delivery performance
 *  - GET /audit               – audit log viewer
 */

import * as reportsService from '../../services/reports.service.js';
import { success, paginate } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';

// ── Role check ────────────────────────────────────────────
const REPORTS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

function requireReportsRole(user) {
  if (!REPORTS_ROLES.includes(user.role)) {
    throw new AppError('Only admin, finance, or super admin can access reports.', 403);
  }
}

/**
 * GET /api/v1/admin/reports/overview
 * Platform overview: GMV, revenue, orders, users, stores.
 */
export async function getOverview(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const overview = await reportsService.getPlatformOverview({ from, to });
    return success(res, overview);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/revenue/daily
 * Daily revenue breakdown.
 */
export async function getDailyRevenue(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const revenue = await reportsService.getDailyRevenue({ from, to });
    return success(res, revenue);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/revenue/monthly
 * Monthly revenue breakdown.
 */
export async function getMonthlyRevenue(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const revenue = await reportsService.getMonthlyRevenue({ from, to });
    return success(res, revenue);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/merchants/top
 * Top merchants by revenue.
 */
export async function getTopMerchants(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const limit = parseInt(req.query.limit, 10) || 10;
    const merchants = await reportsService.getTopMerchants({ limit, from, to });
    return success(res, merchants);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/payments/breakdown
 * Payment method breakdown.
 */
export async function getPaymentBreakdown(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const breakdown = await reportsService.getPaymentBreakdown({ from, to });
    return success(res, breakdown);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/ledger/summary
 * Ledger balance summary.
 */
export async function getLedgerSummary(req, res, next) {
  try {
    requireReportsRole(req.user);
    const summary = await reportsService.getLedgerSummary();
    return success(res, summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/ledger/entries
 * Ledger entry listing.
 */
export async function getLedgerEntries(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { account, from, to } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const result = await reportsService.getLedgerEntries(account, { page, limit, from, to });
    return paginate(res, {
      data: result.entries,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/refunds
 * Refund analytics.
 */
export async function getRefundStats(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const stats = await reportsService.getRefundStats({ from, to });
    return success(res, stats);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/deliveries
 * Delivery performance metrics.
 */
export async function getDeliveryStats(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { from, to } = req.query;
    const stats = await reportsService.getDeliveryStats({ from, to });
    return success(res, stats);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/audit
 * Audit log viewer.
 */
export async function getAuditLogs(req, res, next) {
  try {
    requireReportsRole(req.user);
    const { action, entity_type } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const result = await reportsService.getAuditLogs({ action, entityType: entity_type, page, limit });
    return paginate(res, {
      data: result.logs,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
}
