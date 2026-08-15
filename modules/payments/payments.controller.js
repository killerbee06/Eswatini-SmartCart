/**
 * Payments Controller
 *
 * REST endpoints for payment operations:
 *  - POST   /              – create + process a payment for an order
 *  - GET    /              – list payments for current user's orders
 *  - GET    /:id           – get payment details with event history
 *  - POST   /:id/refund    – initiate a refund
 *  - GET    /order/:orderId – get payments for a specific order
 */

import * as paymentService from '../../services/payment.service.js';
import * as notificationService from '../../services/notification.service.js';
import { success, created } from '../../shared/utils.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

/**
 * POST /api/v1/payments
 * Create and process a payment for an order.
 */
export async function createPayment(req, res, next) {
  try {
    const { order_id, provider, payer_phone } = req.body;

    // Verify the order exists and belongs to the user (or user is admin)
    const db = (await import('../../config/knex.js')).default;
    const order = await db('orders').where({ id: order_id }).first();
    if (!order) throw new NotFoundError('Order');

    if (req.user.role === 'CUSTOMER' && order.customer_id !== req.user.id) {
      throw new AppError('Access denied.', 403);
    }

    // Order must be in PENDING_PAYMENT state
    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppError(`Order is in status "${order.status}" and cannot accept payment.`, 400);
    }

    // Create payment record
    const payment = await paymentService.createPayment({
      orderId: order_id,
      payerId: req.user.id,
      amount: Number(order.grand_total),
      provider: provider || 'MOCK',
      payerPhone: payer_phone,
    });

    // Process payment via provider
    const processed = await paymentService.processPayment(payment.id, {
      payerPhone: payer_phone,
    });

    // Send notification on payment result
    if (req.io && (processed.status === 'PAID' || processed.status === 'FAILED')) {
      await notificationService.notifyPaymentResult(processed, order, req.io);
    }

    return created(res, {
      id: processed.id,
      payment_ref: processed.payment_ref,
      status: processed.status,
      amount: processed.amount,
      provider: processed.provider,
      order_id: processed.order_id,
    }, 'Payment processed successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments
 * List payments for the authenticated user's orders.
 */
export async function listMyPayments(req, res, next) {
  try {
    const db = (await import('../../config/knex.js')).default;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const query = db('payments')
      .join('orders', 'orders.id', 'payments.order_id')
      .where('orders.customer_id', req.user.id);

    const [{ count: total }] = await query.clone().count('payments.id as count');

    const payments = await query
      .select('payments.*')
      .orderBy('payments.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const { paginate } = await import('../../shared/utils.js');
    return paginate(res, { data: payments, total: parseInt(total, 10), page, limit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments/:id
 * Get payment details with event history.
 */
export async function getPayment(req, res, next) {
  try {
    const payment = await paymentService.getPayment(req.params.id);

    // Authorization: customer can only view own payments, admins see all
    if (req.user.role === 'CUSTOMER' && payment.payer_id !== req.user.id) {
      throw new AppError('Access denied.', 403);
    }

    return success(res, payment);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/payments/:id/refund
 * Initiate a refund for a paid payment.
 */
export async function refundPayment(req, res, next) {
  try {
    const { amount } = req.body;
    const db = (await import('../../config/knex.js')).default;

    // Only admins and finance can issue refunds
    if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(req.user.role)) {
      throw new AppError('Only admins or finance can issue refunds.', 403);
    }

    const payment = await paymentService.refundPayment(req.params.id, amount || null);

    // Send refund notification
    if (req.io && (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED')) {
      const _db = (await import('../../config/knex.js')).default;
      const _order = await _db('orders').where({ id: payment.order_id }).first();
      if (_order) {
        await notificationService.notifyPaymentResult({ ...payment, status: 'REFUNDED' }, _order, req.io);
      }
    }

    return success(res, {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
    }, 'Refund processed successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/payments/order/:orderId
 * Get all payments for a specific order.
 */
export async function getPaymentsForOrder(req, res, next) {
  try {
    const payments = await paymentService.getPaymentsForOrder(req.params.orderId);
    return success(res, payments);
  } catch (err) {
    next(err);
  }
}
