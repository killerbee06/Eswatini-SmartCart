/**
 * Delivery Controller
 *
 * REST endpoints for delivery operations:
 *  - GET    /pending              – list unassigned deliveries
 *  - POST   /:id/assign           – assign a driver
 *  - PATCH  /:id/status           – transition delivery status
 *  - POST   /:id/otp/generate     – generate OTP (driver action)
 *  - POST   /:id/otp/verify       – verify OTP (customer action)
 *  - GET    /my-deliveries        – driver's assigned deliveries
 *  - GET    /order/:orderId       – delivery for an order
 *  - GET    /:id                  – delivery details with event history
 */

import * as deliveryService from '../../services/delivery.service.js';
import * as trackingService from '../../services/tracking.service.js';
import * as notificationService from '../../services/notification.service.js';
import { success } from '../../shared/utils.js';
import { AppError } from '../../shared/errors.js';
import { DELIVERY_STATUS } from '../../shared/constants.js';

/**
 * GET /api/v1/deliveries/pending
 * List unassigned deliveries (for dispatchers/drivers).
 */
export async function listPending(req, res, next) {
  try {
    const deliveries = await deliveryService.getPendingDeliveries();
    return success(res, deliveries);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/deliveries/:id/assign
 * Assign a driver to a delivery.
 */
export async function assignDriver(req, res, next) {
  try {
    const { driver_id } = req.body;
    const deliveryId = req.params.id;

    // Allow self-assignment for drivers
    const targetDriverId = driver_id || req.user.id;

    if (!targetDriverId) {
      throw new AppError('driver_id is required.', 400);
    }

    const delivery = await deliveryService.assignDriver(deliveryId, targetDriverId);

    // Emit real-time event
    if (req.io) {
      trackingService.emitDeliveryAssigned({
        deliveryId: delivery.id,
        driverId: delivery.driver_id,
        io: req.io,
      });
    }

    // Send notification to customer
    const db = (await import('../../config/knex.js')).default;
    const order = await db('orders').where({ id: delivery.order_id }).first();
    if (order && req.io) {
      await notificationService.notifyOrderStatusChange(order, 'DRIVER_ASSIGNED', req.io);
    }

    return success(res, {
      id: delivery.id,
      status: delivery.status,
      driver_id: delivery.driver_id,
      order_id: delivery.order_id,
    }, 'Driver assigned successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/deliveries/:id/status
 * Transition delivery to the next status.
 */
export async function transitionStatus(req, res, next) {
  try {
    const { status, notes } = req.body;
    const deliveryId = req.params.id;

    // Get current status before transition for event
    const beforeDelivery = await (await import('../../config/knex.js')).default('deliveries').where({ id: deliveryId }).first();

    const delivery = await deliveryService.transitionDelivery(
      deliveryId,
      status,
      req.user.id,
      notes
    );

    // Emit real-time status change event
    if (req.io) {
      trackingService.emitStatusChange({
        deliveryId: delivery.id,
        fromStatus: beforeDelivery?.status,
        toStatus: delivery.status,
        io: req.io,
      });
    }

    // Send notification on key delivery milestones
    if (req.io && ['PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'DELIVERED'].includes(delivery.status)) {
      const _db = (await import('../../config/knex.js')).default;
      const _order = await _db('orders').where({ id: delivery.order_id }).first();
      if (_order) {
        await notificationService.notifyOrderStatusChange(_order, delivery.status, req.io);
      }
    }

    return success(res, {
      id: delivery.id,
      status: delivery.status,
    }, 'Delivery status updated');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/deliveries/:id/otp/generate
 * Generate OTP for delivery verification (driver action).
 * Returns the OTP to display to the driver (not to the customer).
 */
export async function generateOTP(req, res, next) {
  try {
    const deliveryId = req.params.id;

    // Verify the requester is the assigned driver or an admin
    const delivery = await deliveryService.getDelivery(deliveryId);
    if (req.user.role === 'DRIVER' && delivery.driver_id !== req.user.id) {
      throw new AppError('You are not assigned to this delivery.', 403);
    }

    const result = await deliveryService.generateOTP(deliveryId);

    // Emit OTP generated event so customer UI can prompt for code entry
    if (req.io) {
      trackingService.emitOTPGenerated({
        deliveryId: delivery.id,
        io: req.io,
      });

      // Notify customer that OTP is ready
      const _db2 = (await import('../../config/knex.js')).default;
      const _order2 = await _db2('orders').where({ id: delivery.order_id }).first();
      if (_order2) {
        await notificationService.notifyOTPGenerated(_order2, req.io);
      }
    }

    // Return OTP to the driver (they show it or read it to the customer)
    return success(res, {
      otp: delivery.otp ? '***' : 'N/A', // Don't expose in response log
      otp_display: result.otp_sent,
      otp_expires_at: result.otp_expires_at,
      message: 'OTP generated. Share this code with the customer.',
    }, 'OTP generated successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/deliveries/:id/otp/verify
 * Verify OTP submitted by customer to confirm delivery.
 */
export async function verifyOTP(req, res, next) {
  try {
    const { otp } = req.body;
    const deliveryId = req.params.id;

    const delivery = await deliveryService.verifyOTP(deliveryId, otp);

    // Emit delivery completed event
    if (req.io) {
      trackingService.emitDeliveryCompleted({
        deliveryId: delivery.id,
        io: req.io,
      });
      trackingService.emitStatusChange({
        deliveryId: delivery.id,
        fromStatus: 'EN_ROUTE_TO_CUSTOMER',
        toStatus: 'DELIVERED',
        io: req.io,
      });
    }

    return success(res, {
      id: delivery.id,
      status: delivery.status,
      delivered_at: delivery.delivered_at,
    }, 'Delivery confirmed — OTP verified');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/deliveries/my-deliveries
 * Driver views their assigned deliveries.
 */
export async function myDeliveries(req, res, next) {
  try {
    const deliveries = await deliveryService.getDriverDeliveries(req.user.id);
    return success(res, deliveries);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/deliveries/order/:orderId
 * Get delivery info for an order.
 */
export async function getDeliveryByOrder(req, res, next) {
  try {
    const delivery = await deliveryService.getDeliveryByOrder(req.params.orderId);
    if (!delivery) {
      return success(res, null, 'No delivery found for this order');
    }
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/deliveries/:id
 * Get delivery details with event history.
 */
export async function getDelivery(req, res, next) {
  try {
    const delivery = await deliveryService.getDelivery(req.params.id);
    return success(res, delivery);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/deliveries/:id/tracking
 * Get real-time tracking state: latest location, ETA, status events.
 */
export async function getTrackingState(req, res, next) {
  try {
    const tracking = await trackingService.getTrackingState(
      req.params.id,
      req.user.id
    );
    return success(res, tracking);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/deliveries/:id/locations
 * Get location history for a delivery (map trail).
 */
export async function getLocationHistory(req, res, next) {
  try {
    const { since } = req.query;
    const limit = parseInt(req.query.limit, 10) || 100;

    const locations = await trackingService.getLocationHistory(
      req.params.id,
      { limit, since }
    );
    return success(res, locations);
  } catch (err) {
    next(err);
  }
}
