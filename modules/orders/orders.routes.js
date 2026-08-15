import { Router } from 'express';
import {
  checkout,
  listMyOrders,
  getOrder,
  updateOrderStatus,
  merchantOrders,
  orderEvents,
} from './orders.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, orderSchemas, orderStatusSchemas } from '../../middleware/validate.js';

const router = Router();

// POST /api/v1/orders/checkout — customer places an order
router.post('/checkout', authenticate, requirePermission('customer.orders.place'), validate(orderSchemas.checkout), checkout);

// GET /api/v1/orders/my-orders — customer views own orders
router.get('/my-orders', authenticate, requirePermission('customer.orders.read'), listMyOrders);

// GET /api/v1/orders/merchant/:storeId — merchant views orders for their store
router.get('/merchant/:storeId', authenticate, requirePermission('merchant.orders.read'), merchantOrders);

// GET /api/v1/orders/:id — view single order
router.get('/:id', authenticate, getOrder);

// GET /api/v1/orders/:id/events — view order status events
router.get('/:id/events', authenticate, orderEvents);

// PATCH /api/v1/orders/:id/status — update order status (merchant/driver/admin)
router.patch('/:id/status', authenticate, requirePermission('merchant.orders.update'), validate(orderStatusSchemas.update), updateOrderStatus);

export default router;
