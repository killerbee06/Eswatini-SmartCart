/**
 * Tracking Service
 *
 * Manages real-time delivery tracking:
 *  - Store and broadcast driver GPS locations
 *  - Retrieve current delivery tracking state
 *  - Calculate ETA based on delivery flow
 *  - Emit structured events via Socket.IO
 *
 * All location mutations are write-once (append-only) for audit.
 */

import db from '../config/knex.js';
import { NotFoundError, AppError } from '../shared/errors.js';
import { DELIVERY_STATUS } from '../shared/constants.js';

// ── Event types emitted to clients ────────────────────────
export const TRACKING_EVENTS = {
  DRIVER_LOCATION: 'driver:location',           // driver → customer (live GPS)
  DELIVERY_STATUS_CHANGED: 'delivery:status',   // status transition
  DELIVERY_ASSIGNED: 'delivery:assigned',        // driver assigned
  OTP_GENERATED: 'delivery:otp_generated',       // OTP ready
  DELIVERY_COMPLETED: 'delivery:completed',      // delivery confirmed
  DRIVER_TYPING: 'driver:typing',               // driver is typing a message
};

// ── Public API ─────────────────────────────────────────────

/**
 * Record a driver's GPS location and broadcast to the customer.
 *
 * @param {object} params
 * @param {number} params.deliveryId
 * @param {string} params.driverId
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {number} [params.accuracy]
 * @param {number} [params.speed]
 * @param {number} [params.heading]
 * @param {object} params.io  – Socket.IO server instance
 * @returns {Promise<object>} – saved location record
 */
export async function recordLocation({ deliveryId, driverId, latitude, longitude, accuracy, speed, heading, io }) {
  // Validate delivery exists and is active
  const delivery = await db('deliveries').where({ id: deliveryId }).first();
  if (!delivery) throw new NotFoundError('Delivery');

  if (delivery.driver_id !== driverId) {
    throw new AppError('You are not assigned to this delivery.', 403);
  }

  // Only track active deliveries
  const activeStatuses = [
    DELIVERY_STATUS.ASSIGNED,
    DELIVERY_STATUS.EN_ROUTE_TO_PICKUP,
    DELIVERY_STATUS.AT_PICKUP,
    DELIVERY_STATUS.PICKED_UP,
    DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER,
  ];

  if (!activeStatuses.includes(delivery.status)) {
    throw new AppError(`Cannot track delivery in status: ${delivery.status}`, 400);
  }

  // Validate coordinates (rough Eswatini bounds: -27.5 to -25.5 lat, 30.5 to 32.5 lng)
  if (latitude < -28 || latitude > -25 || longitude < 30 || longitude > 33) {
    // Don't reject — just log a warning. Drivers may be near borders.
    console.warn(`⚠️  Location outside Eswatini bounds: ${latitude}, ${longitude} (delivery ${deliveryId})`);
  }

  // Store location
  const [locationId] = await db('location_history').insert({
    delivery_id: deliveryId,
    driver_id: driverId,
    latitude,
    longitude,
    accuracy: accuracy || null,
    speed: speed || null,
    heading: heading || null,
  }).returning('id');

  // Broadcast to the delivery tracking room
  if (io) {
    const locationPayload = {
      deliveryId,
      driverId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      timestamp: new Date().toISOString(),
    };

    io.to(`delivery_${deliveryId}`).emit(TRACKING_EVENTS.DRIVER_LOCATION, locationPayload);
  }

  return await db('location_history').where({ id: locationId }).first();
}

/**
 * Get the current tracking state for a delivery.
 * Returns the latest location, delivery status, and relevant timestamps.
 *
 * @param {number} deliveryId
 * @param {string} [requesterId] – for authorization check
 * @returns {Promise<object>}
 */
export async function getTrackingState(deliveryId, requesterId) {
  const delivery = await db('deliveries')
    .join('orders', 'orders.id', 'deliveries.order_id')
    .where('deliveries.id', deliveryId)
    .select(
      'deliveries.*',
      'orders.main_ref',
      'orders.delivery_address',
      'orders.customer_id'
    )
    .first();

  if (!delivery) throw new NotFoundError('Delivery');

  // Authorization: only the customer, driver, or admin can track
  if (requesterId) {
    const isAuthorized =
      delivery.customer_id === requesterId ||
      delivery.driver_id === requesterId;

    if (!isAuthorized) {
      // Check if user is admin/dispatcher
      const profile = await db('profiles').where({ id: requesterId }).first();
      const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'FINANCE'];
      if (!profile || !adminRoles.includes(profile.role)) {
        throw new AppError('Access denied.', 403);
      }
    }
  }

  // Get latest location
  const [latestLocation] = await db('location_history')
    .where({ delivery_id: deliveryId })
    .orderBy('created_at', 'desc')
    .limit(1);

  // Get location count and time span
  const [{ count: locationCount }] = await db('location_history')
    .where({ delivery_id: deliveryId })
    .count('id as count');

  // Get delivery events
  const events = await db('delivery_events')
    .where({ delivery_id: deliveryId })
    .orderBy('created_at', 'asc');

  // Calculate ETA based on delivery flow
  const eta = _calculateETA(delivery, latestLocation);

  return {
    delivery: {
      id: delivery.id,
      order_ref: delivery.main_ref,
      status: delivery.status,
      delivery_address: delivery.delivery_address,
      driver_id: delivery.driver_id,
      picked_up_at: delivery.picked_up_at,
      delivered_at: delivery.delivered_at,
    },
    current_location: latestLocation ? {
      latitude: Number(latestLocation.latitude),
      longitude: Number(latestLocation.longitude),
      accuracy: latestLocation.accuracy ? Number(latestLocation.accuracy) : null,
      speed: latestLocation.speed ? Number(latestLocation.speed) : null,
      heading: latestLocation.heading ? Number(latestLocation.heading) : null,
      recorded_at: latestLocation.created_at,
    } : null,
    location_count: parseInt(locationCount, 10),
    eta,
    events,
  };
}

/**
 * Get location history for a delivery (for replay/map trail).
 *
 * @param {number} deliveryId
 * @param {object} [opts]
 * @param {number} [opts.limit]  – max records (default 100)
 * @param {string} [opts.since]  – ISO timestamp to filter from
 * @returns {Promise<object[]>}
 */
export async function getLocationHistory(deliveryId, { limit = 100, since } = {}) {
  const query = db('location_history')
    .where({ delivery_id: deliveryId });

  if (since) {
    query.where('created_at', '>', since);
  }

  return query
    .orderBy('created_at', 'asc')
    .limit(limit)
    .select('latitude', 'longitude', 'accuracy', 'speed', 'heading', 'created_at');
}

/**
 * Emit a delivery status change event to all subscribers.
 *
 * @param {object} params
 * @param {number} params.deliveryId
 * @param {string} params.fromStatus
 * @param {string} params.toStatus
 * @param {object} params.io  – Socket.IO server instance
 */
export function emitStatusChange({ deliveryId, fromStatus, toStatus, io }) {
  if (!io) return;

  io.to(`delivery_${deliveryId}`).emit(TRACKING_EVENTS.DELIVERY_STATUS_CHANGED, {
    deliveryId,
    from: fromStatus,
    to: toStatus,
    timestamp: new Date().toISOString(),
  });

  // Emit to the merchant room if delivery is associated with an order
  // (picked up, out for delivery, delivered)
  const broadcastStatuses = [
    DELIVERY_STATUS.PICKED_UP,
    DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER,
    DELIVERY_STATUS.DELIVERED,
  ];

  if (broadcastStatuses.includes(toStatus)) {
    io.emit(TRACKING_EVENTS.DELIVERY_STATUS_CHANGED, {
      deliveryId,
      from: fromStatus,
      to: toStatus,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit a delivery assignment event.
 */
export function emitDeliveryAssigned({ deliveryId, driverId, io }) {
  if (!io) return;

  io.to(`delivery_${deliveryId}`).emit(TRACKING_EVENTS.DELIVERY_ASSIGNED, {
    deliveryId,
    driverId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit OTP generated event (so customer UI can prompt for code).
 */
export function emitOTPGenerated({ deliveryId, io }) {
  if (!io) return;

  io.to(`delivery_${deliveryId}`).emit(TRACKING_EVENTS.OTP_GENERATED, {
    deliveryId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit delivery completed event.
 */
export function emitDeliveryCompleted({ deliveryId, io }) {
  if (!io) return;

  io.to(`delivery_${deliveryId}`).emit(TRACKING_EVENTS.DELIVERY_COMPLETED, {
    deliveryId,
    timestamp: new Date().toISOString(),
  });
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Calculate estimated time of arrival based on delivery flow.
 * Returns a simple status-based ETA rather than complex routing.
 */
function _calculateETA(delivery, latestLocation) {
  const status = delivery.status;

  // No ETA for terminal states
  if (status === DELIVERY_STATUS.DELIVERED || status === DELIVERY_STATUS.FAILED) {
    return null;
  }

  // No ETA without a driver
  if (!delivery.driver_id) {
    return { status: 'waiting_for_driver', minutes: null };
  }

  // Simple ETA estimation based on delivery phase
  const etaMap = {
    [DELIVERY_STATUS.ASSIGNED]: { status: 'driver_en_route_to_pickup', minutes: 15 },
    [DELIVERY_STATUS.EN_ROUTE_TO_PICKUP]: { status: 'driver_en_route_to_pickup', minutes: 10 },
    [DELIVERY_STATUS.AT_PICKUP]: { status: 'at_store_pickup', minutes: 5 },
    [DELIVERY_STATUS.PICKED_UP]: { status: 'out_for_delivery', minutes: 20 },
    [DELIVERY_STATUS.EN_ROUTE_TO_CUSTOMER]: { status: 'out_for_delivery', minutes: 10 },
  };

  const eta = etaMap[status] || { status: 'unknown', minutes: null };

  // If we have speed data, we could refine the ETA (future enhancement)
  if (latestLocation && latestLocation.speed && Number(latestLocation.speed) > 0) {
    // Could calculate distance to delivery address and estimate
    // For now, use the static estimate
  }

  return eta;
}
