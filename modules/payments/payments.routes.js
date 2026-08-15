import { Router } from 'express';
import {
  createPayment,
  listMyPayments,
  getPayment,
  refundPayment,
  getPaymentsForOrder,
} from './payments.controller.js';
import { handleWebhook, testWebhook } from './payments.webhooks.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, paymentSchemas } from '../../middleware/validate.js';

const router = Router();

// ============================================================
// WEBHOOK ROUTES (no JWT auth — use signature verification)
// ============================================================

// POST /api/v1/payments/webhook/:provider — receive provider callbacks
router.post('/webhook/:provider', handleWebhook);

// POST /api/v1/payments/webhook/test — simulate webhook (dev only)
router.post('/webhook/test', testWebhook);

// ============================================================
// AUTHENTICATED ROUTES
// ============================================================

// POST /api/v1/payments — create + process a payment
router.post(
  '/',
  authenticate,
  requirePermission('customer.orders.place'),
  validate(paymentSchemas.create),
  createPayment
);

// GET /api/v1/payments — list my payments
router.get(
  '/',
  authenticate,
  requirePermission('customer.orders.read'),
  listMyPayments
);

// GET /api/v1/payments/order/:orderId — payments for an order
router.get(
  '/order/:orderId',
  authenticate,
  getPaymentsForOrder
);

// GET /api/v1/payments/:id — payment details with history
router.get(
  '/:id',
  authenticate,
  getPayment
);

// POST /api/v1/payments/:id/refund — initiate refund (admin/finance only)
router.post(
  '/:id/refund',
  authenticate,
  requirePermission('admin.payments.read'),
  validate(paymentSchemas.refund),
  refundPayment
);

export default router;
