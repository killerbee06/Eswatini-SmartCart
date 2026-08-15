/**
 * Delivery Service
 *
 * Manages the full delivery lifecycle:
 *  - Assignment → Pickup → In Transit → Delivered
 *  - OTP generation, verification, and rate limiting
 *  - Event logging for every state transition
 */

import db from '../config/knex.js';
import { generateDeliveryOTP } from '../shared/utils.js';
import { AppError, NotFoundError } from '../shared/errors.js';
import { DELIVERY_STATUS } from '../shared/constants.js';

// ── Delivery state machine ─────────────────────────────────
const DELIVERY_TRANSITIONS = {
  PENDING_ASSIGNMENT: ['ASSIGNED'],
  ASSIGNED: ['EN_ROUTE_TO_PICKUP'],
  EN_ROUTE_TO_PICKUP: ['AT_PICKUP'],
  AT_PICKUP: ['PICKED_UP'],
  PICKED_UP: ['EN_ROUTE_TO_CUSTOMER'],
  EN_ROUTE_TO_CUSTOMER: ['DELIVERED'],
  DELIVERED: [],
  FAILED: [],
};

// OTP defaults (overridden by system_settings if available)
const OTP_LENGTH = 4;
let OTP_MAX_ATTEMPTS = 3;
let OTP_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Load OTP settings from system_settings table.
 * Called once per request that needs OTP.
 */
async function _loadOTPSettings() {
  try {
    const maxAttemptsSetting = await db('system_settings')
      .where({ key: 'otp_max_attempts' }).first();
    if (maxAttemptsSetting) OTP_MAX_ATTEMPTS = parseInt(maxAttemptsSetting.value, 10);

    const expirySetting = await db('system_settings')
      .where({ key: 'otp_expiry_minutes' }).first();
    if (expirySetting) OTP_EXPIRY_MS = parseInt(expirySetting.value, 10) * 60 * 1000;
  } catch {
    // Use defaults if settings table doesn't exist yet
  }
}

/**
 * Validate a delivery state transition.
 */
function validateTransition(from, to) {
  const allowed = DELIVERY_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(
      `Invalid delivery transition: ${from} → ${to}. Allowed: ${allowed?.join(', ') || 'none'}`,
      400
    );
  }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Create a delivery record for an order.
 * Called during checkout or when a new order is placed.
 *
 * @param {number} orderId
 * @returns {Promise<object>}
 */
export async function createDelivery(orderId) {
  const existing = await db('deliveries').where({ order_id: orderId }).first();
  if (existing) return existing;

  const [deliveryId] = await db('deliveries').insert({
    order_id: orderId,
    status: DELIVERY_STATUS.PENDING_ASSIGNMENT,
  }).returning('id');

  await _logEvent(deliveryId, null, DELIVERY_STATUS.PENDING_ASSIGNMENT, null, 'Delivery record created');

  return await db('deliveries').where({ id: deliveryId }).first();
}

/**
 * Assign a driver to a delivery.
 *
 * @param {number} deliveryId
 * @param {string} driverId   – profile UUID of the driver
 * @returns {Promise<object>}
 */
export async function assignDriver(deliveryId, driverId) {
  const trx = await db.transaction();
  try {
    const delivery = await trx('deliveries').where({ id: deliveryId }).forUpdate().first();
    if (!delivery) {
      await trx.rollback();
      throw new NotFoundError('Delivery');
    }

    validateTransition(delivery.status, DELIVERY_STATUS.ASSIGNED);

    await trx('deliveries').where({ id: deliveryId }).update({
      driver_id: driverId,
      status: DELIVERY_STATUS.ASSIGNED,
      updated_at: new Date(),
    });

    await _logEvent(deliveryId, delivery.status, DELIVERY_STATUS.ASSIGNED, driverId, 'Driver assigned');

    // Update order to DRIVER_ASSIGNED
    const order = await trx('orders').where({ id: delivery.order_id }).first();
    if (order) {
      await trx('orders').where({ id: order.id }).update({
        driver_id: driverId,
        status: 'DRIVER_ASSIGNED',
      });
      await trx('order_status_events').insert({
        order_id: order.id,
        from_status: order.status,
        to_status: 'DRIVER_ASSIGNED',
        actor_id: driverId,
        notes: 'Driver assigned for delivery',
      });
    }

    await trx.commit();
    return await db('deliveries').where({ id: deliveryId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Transition delivery to next status in the flow.
 *
 * @param {number} deliveryId
 * @param {string} toStatus
 * @param {string} [actorId]
 * @param {string} [notes]
 * @returns {Promise<object>}
 */
export async function transitionDelivery(deliveryId, toStatus, actorId, notes) {
  const trx = await db.transaction();
  try {
    const delivery = await trx('deliveries').where({ id: deliveryId }).forUpdate().first();
    if (!delivery) {
      await trx.rollback();
      throw new NotFoundError('Delivery');
    }

    validateTransition(delivery.status, toStatus);

    const updates = { status: toStatus, updated_at: new Date() };

    // Track timestamps for key milestones
    if (toStatus === DELIVERY_STATUS.PICKED_UP) {
      updates.picked_up_at = new Date();
    }
    if (toStatus === DELIVERY_STATUS.DELIVERED) {
      updates.delivered_at = new Date();
    }

    await trx('deliveries').where({ id: deliveryId }).update(updates);
    await _logEvent(deliveryId, delivery.status, toStatus, actorId, notes);

    // Mirror to order status
    const order = await trx('orders').where({ id: delivery.order_id }).first();
    if (order) {
      const orderStatusMap = {
        EN_ROUTE_TO_PICKUP: 'DRIVER_ASSIGNED',
        AT_PICKUP: 'DRIVER_ASSIGNED',
        PICKED_UP: 'PICKED_UP',
        EN_ROUTE_TO_CUSTOMER: 'OUT_FOR_DELIVERY',
        DELIVERED: 'DELIVERED',
      };

      const orderStatus = orderStatusMap[toStatus];
      if (orderStatus && order.status !== orderStatus) {
        await trx('orders').where({ id: order.id }).update({ status: orderStatus });
        await trx('order_status_events').insert({
          order_id: order.id,
          from_status: order.status,
          to_status: orderStatus,
          actor_id: actorId,
          notes: notes || `Delivery status: ${toStatus}`,
        });
      }
    }

    await trx.commit();
    return await db('deliveries').where({ id: deliveryId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Generate an OTP for delivery verification.
 * Called when the driver is at the customer's location.
 *
 * @param {number} deliveryId
 * @returns {Promise<object>} – delivery with OTP (OTP only visible to driver)
 */
export async function generateOTP(deliveryId) {
  const trx = await db.transaction();
  try {
    const delivery = await trx('deliveries').where({ id: deliveryId }).forUpdate().first();
    if (!delivery) {
      await trx.rollback();
      throw new NotFoundError('Delivery');
    }

    if (delivery.status !== DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER &&
        delivery.status !== DELIVERY_STATUS.PICKED_UP) {
      await trx.rollback();
      throw new AppError('OTP can only be generated when delivery is en route or picked up.', 400);
    }

    // Load configurable OTP settings
    await _loadOTPSettings();

    const otp = generateDeliveryOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await trx('deliveries').where({ id: deliveryId }).update({
      otp,
      otp_expires_at: expiresAt,
      otp_attempts: 0, // Reset attempts on new OTP
      updated_at: new Date(),
    });

    await _logEvent(deliveryId, delivery.status, delivery.status, delivery.driver_id, 'OTP generated');

    await trx.commit();

    // Return delivery WITHOUT the OTP in the public response
    const updated = await db('deliveries').where({ id: deliveryId }).first();
    return {
      ...updated,
      otp_sent: true,
      otp_expires_at: expiresAt,
    };
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Verify OTP submitted by the customer.
 * Implements rate limiting (max attempts) and expiry checking.
 *
 * @param {number} deliveryId
 * @param {string} submittedOtp
 * @returns {Promise<object>} – updated delivery
 */
export async function verifyOTP(deliveryId, submittedOtp) {
  const trx = await db.transaction();
  try {
    const delivery = await trx('deliveries').where({ id: deliveryId }).forUpdate().first();
    if (!delivery) {
      await trx.rollback();
      throw new NotFoundError('Delivery');
    }

    if (!delivery.otp) {
      await trx.rollback();
      throw new AppError('No OTP has been generated for this delivery.', 400);
    }

    // Check expiry
    if (delivery.otp_expires_at && new Date(delivery.otp_expires_at) < new Date()) {
      await trx.rollback();
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }

    // Check attempt limit
    if (delivery.otp_attempts >= OTP_MAX_ATTEMPTS) {
      await trx.rollback();
      throw new AppError('Maximum OTP attempts exceeded. Please request a new OTP.', 400);
    }

    // Increment attempts
    await trx('deliveries').where({ id: deliveryId }).increment('otp_attempts', 1);

    // Verify
    if (String(submittedOtp).trim() !== String(delivery.otp).trim()) {
      const remaining = OTP_MAX_ATTEMPTS - (delivery.otp_attempts + 1);
      await trx.commit();
      throw new AppError(
        `Invalid OTP. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'No attempts remaining.'}`,
        400
      );
    }

    // OTP verified — mark as DELIVERED
    await trx('deliveries').where({ id: deliveryId }).update({
      status: DELIVERY_STATUS.DELIVERED,
      delivered_at: new Date(),
      otp: null, // Clear OTP after successful verification
      otp_expires_at: null,
      updated_at: new Date(),
    });

    await _logEvent(deliveryId, delivery.status, DELIVERY_STATUS.DELIVERED, delivery.driver_id, 'OTP verified — delivery confirmed');

    // Update order
    const order = await trx('orders').where({ id: delivery.order_id }).first();
    if (order) {
      await trx('orders').where({ id: order.id }).update({ status: 'DELIVERED' });
      await trx('order_status_events').insert({
        order_id: order.id,
        from_status: order.status,
        to_status: 'DELIVERED',
        actor_id: delivery.driver_id,
        notes: 'OTP verified — delivery confirmed by customer',
      });
    }

    await trx.commit();
    return await db('deliveries').where({ id: deliveryId }).first();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Get delivery details with event history.
 */
export async function getDelivery(deliveryId) {
  const delivery = await db('deliveries').where({ id: deliveryId }).first();
  if (!delivery) throw new NotFoundError('Delivery');

  const events = await db('delivery_events')
    .where({ delivery_id: deliveryId })
    .orderBy('created_at', 'asc');

  return { ...delivery, events };
}

/**
 * Get delivery by order ID.
 */
export async function getDeliveryByOrder(orderId) {
  return db('deliveries').where({ order_id: orderId }).first();
}

/**
 * List deliveries assigned to a driver.
 */
export async function getDriverDeliveries(driverId) {
  return db('deliveries')
    .where({ driver_id: driverId })
    .orderBy('created_at', 'desc');
}

/**
 * List pending deliveries (unassigned).
 */
export async function getPendingDeliveries() {
  return db('deliveries')
    .where({ status: DELIVERY_STATUS.PENDING_ASSIGNMENT })
    .orderBy('created_at', 'asc');
}

// ── Internal helpers ───────────────────────────────────────

async function _logEvent(deliveryId, fromStatus, toStatus, actorId, notes) {
  await db('delivery_events').insert({
    delivery_id: deliveryId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    notes,
  });
}
