/**
 * Payouts Controller
 *
 * REST endpoints for merchant payout operations:
 *  - GET    /balance/:storeId    – merchant views available balance
 *  - GET    /my-payouts           – merchant views own payout history
 *  - GET    /                     – finance/admin lists all payouts
 *  - POST   /generate             – finance generates payout batch
 *  - POST   /:id/approve          – finance/admin approves payout
 *  - POST   /:id/reject           – finance/admin rejects payout
 *  - POST   /:id/process          – finance/admin processes disbursement
 *  - GET    /stats                – payout summary stats
 *  - GET    /:id                  – payout details with events
 */

import * as payoutService from '../../services/payout.service.js';
import * as notificationService from '../../services/notification.service.js';
import { success, paginate } from '../../shared/utils.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

// ── Role checks ────────────────────────────────────────────
const FINANCE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

function requireFinanceRole(user) {
  if (!FINANCE_ROLES.includes(user.role)) {
    throw new AppError('Only finance, admin, or super admin can perform this action.', 403);
  }
}

/**
 * GET /api/v1/payouts/balance/:storeId
 * Merchant views their available balance for a store.
 */
export async function getBalance(req, res, next) {
  try {
    const { storeId } = req.params;

    // Verify merchant has access to this store (or is admin)
    if (!FINANCE_ROLES.includes(req.user.role)) {
      const db = (await import('../../config/knex.js')).default;
      const membership = await db('store_users')
        .where({ profile_id: req.user.id, store_id: storeId, is_active: true })
        .first();
      if (!membership) {
        throw new AppError('Access denied.', 403);
      }
    }

    const balance = await payoutService.getMerchantBalance(storeId);
    return success(res, balance);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payouts/my-payouts
 * Merchant views their own payout history.
 */
export async function getMyPayouts(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await payoutService.getMyPayouts(req.user.id, { page, limit });
    return paginate(res, {
      data: result.payouts,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payouts
 * Finance/admin lists all payouts with optional status filter.
 */
export async function listPayouts(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const { status } = req.query;

    const result = await payoutService.listAllPayouts({ status, page, limit });
    return paginate(res, {
      data: result.payouts,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payouts/generate
 * Finance/admin generates a payout batch for all eligible merchants.
 */
export async function generateBatch(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const payouts = await payoutService.generatePayoutBatch({
      generatedBy: req.user.id,
    });

    return success(res, {
      generated: payouts.length,
      payouts,
    }, `${payouts.length} payout(s) generated successfully`);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payouts/:id/approve
 * Finance/admin approves a pending payout.
 */
export async function approvePayout(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const { notes } = req.body;
    const payout = await payoutService.approvePayout(req.params.id, req.user.id, notes);

    // Notify merchant of approval
    if (req.io) {
      await notificationService.notifyPayoutResult(payout, req.io);
    }

    return success(res, {
      id: payout.id,
      status: payout.status,
      amount: payout.amount,
      store_id: payout.store_id,
    }, 'Payout approved');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payouts/:id/reject
 * Finance/admin rejects a payout with a reason.
 */
export async function rejectPayout(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const { reason } = req.body;
    if (!reason) {
      throw new AppError('Rejection reason is required.', 400);
    }

    const payout = await payoutService.rejectPayout(req.params.id, req.user.id, reason);

    // Notify merchant of rejection
    if (req.io) {
      await notificationService.notifyPayoutResult(payout, req.io);
    }

    return success(res, {
      id: payout.id,
      status: payout.status,
      amount: payout.amount,
      store_id: payout.store_id,
    }, 'Payout rejected');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payouts/:id/process
 * Finance/admin processes disbursement for an approved payout.
 */
export async function processPayout(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const payout = await payoutService.processPayout(req.params.id, req.user.id);

    // Notify merchant of disbursement
    if (req.io) {
      await notificationService.notifyPayoutResult(payout, req.io);
    }

    return success(res, {
      id: payout.id,
      status: payout.status,
      amount: payout.amount,
      store_id: payout.store_id,
      reference: payout.reference,
    }, payout.status === 'COMPLETED' ? 'Payout disbursed successfully' : 'Payout disbursement failed');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payouts/stats
 * Payout summary stats for dashboard.
 */
export async function getStats(req, res, next) {
  try {
    requireFinanceRole(req.user);

    const stats = await payoutService.getPayoutStats();
    return success(res, stats);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payouts/:id
 * Get payout details with event history.
 */
export async function getPayout(req, res, next) {
  try {
    const payout = await payoutService.getPayout(req.params.id);

    // Authorization: merchant can only view own payouts, finance/admin see all
    if (!FINANCE_ROLES.includes(req.user.role) && payout.profile_id !== req.user.id) {
      throw new AppError('Access denied.', 403);
    }

    return success(res, payout);
  } catch (err) {
    next(err);
  }
}
