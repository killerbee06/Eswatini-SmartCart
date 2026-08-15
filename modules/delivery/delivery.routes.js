import { Router } from 'express';
import {
  listPending,
  assignDriver,
  transitionStatus,
  generateOTP,
  verifyOTP,
  myDeliveries,
  getDeliveryByOrder,
  getDelivery,
  getTrackingState,
  getLocationHistory,
} from './delivery.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';
import { validate, deliverySchemas } from '../../middleware/validate.js';

const router = Router();

// ============================================================
// ADMIN / DISPATCHER ROUTES
// ============================================================

// GET /api/v1/deliveries/pending — list unassigned
router.get(
  '/pending',
  authenticate,
  requireRole('ADMIN', 'SUPER_ADMIN', 'DISPATCHER'),
  listPending
);

// POST /api/v1/deliveries/:id/assign — assign a driver
router.post(
  '/:id/assign',
  authenticate,
  requireRole('ADMIN', 'SUPER_ADMIN', 'DISPATCHER'),
  validate(deliverySchemas.assign),
  assignDriver
);

// ============================================================
// DRIVER ROUTES
// ============================================================

// GET /api/v1/deliveries/my-deliveries — driver's deliveries
router.get(
  '/my-deliveries',
  authenticate,
  requireRole('DRIVER'),
  myDeliveries
);

// PATCH /api/v1/deliveries/:id/status — driver updates delivery status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  validate(deliverySchemas.transition),
  transitionStatus
);

// POST /api/v1/deliveries/:id/otp/generate — driver generates OTP
router.post(
  '/:id/otp/generate',
  authenticate,
  requireRole('DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  generateOTP
);

// ============================================================
// CUSTOMER ROUTES
// ============================================================

// POST /api/v1/deliveries/:id/otp/verify — customer verifies OTP
router.post(
  '/:id/otp/verify',
  authenticate,
  requireRole('CUSTOMER'),
  validate(deliverySchemas.verifyOTP),
  verifyOTP
);

// GET /api/v1/deliveries/order/:orderId — delivery for an order
router.get(
  '/order/:orderId',
  authenticate,
  getDeliveryByOrder
);

// GET /api/v1/deliveries/:id — delivery details
router.get(
  '/:id',
  authenticate,
  getDelivery
);

// ============================================================
// TRACKING ROUTES
// ============================================================

// GET /api/v1/deliveries/:id/tracking — real-time tracking state
router.get(
  '/:id/tracking',
  authenticate,
  getTrackingState
);

// GET /api/v1/deliveries/:id/locations — location history
router.get(
  '/:id/locations',
  authenticate,
  getLocationHistory
);

export default router;
