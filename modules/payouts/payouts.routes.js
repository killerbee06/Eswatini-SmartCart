import { Router } from 'express';
import {
  getBalance,
  getMyPayouts,
  listPayouts,
  generateBatch,
  approvePayout,
  rejectPayout,
  processPayout,
  getStats,
  getPayout,
} from './payouts.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { validate, payoutSchemas } from '../../middleware/validate.js';

const router = Router();

// ============================================================
// MERCHANT ROUTES
// ============================================================

// GET /api/v1/payouts/balance/:storeId — view available balance
router.get(
  '/balance/:storeId',
  authenticate,
  requirePermission('merchant.payouts.read'),
  getBalance
);

// GET /api/v1/payouts/my-payouts — merchant's own payout history
router.get(
  '/my-payouts',
  authenticate,
  requirePermission('merchant.payouts.read'),
  getMyPayouts
);

// ============================================================
// FINANCE / ADMIN ROUTES
// ============================================================

// GET /api/v1/payouts/stats — dashboard stats
router.get(
  '/stats',
  authenticate,
  requirePermission('finance.payouts.read'),
  getStats
);

// POST /api/v1/payouts/generate — generate payout batch
router.post(
  '/generate',
  authenticate,
  requirePermission('finance.payouts.approve'),
  generateBatch
);

// GET /api/v1/payouts — list all payouts (with optional status filter)
router.get(
  '/',
  authenticate,
  requirePermission('finance.payouts.read'),
  listPayouts
);

// GET /api/v1/payouts/:id — payout details with events
router.get(
  '/:id',
  authenticate,
  getPayout
);

// POST /api/v1/payouts/:id/approve — approve payout
router.post(
  '/:id/approve',
  authenticate,
  requirePermission('finance.payouts.approve'),
  validate(payoutSchemas.approve),
  approvePayout
);

// POST /api/v1/payouts/:id/reject — reject payout
router.post(
  '/:id/reject',
  authenticate,
  requirePermission('finance.payouts.approve'),
  validate(payoutSchemas.reject),
  rejectPayout
);

// POST /api/v1/payouts/:id/process — disburse payout
router.post(
  '/:id/process',
  authenticate,
  requirePermission('finance.payouts.approve'),
  processPayout
);

export default router;
