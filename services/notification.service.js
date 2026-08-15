/**
 * Notification Service
 *
 * Manages the full notification lifecycle:
 *  - Create notifications for various channels (push, email, sms)
 *  - Track delivery status (PENDING → SENT / FAILED)
 *  - Broadcast real-time via Socket.IO
 *  - List and mark-as-read for users
 *  - Batch creation for order status changes
 *
 * Notification types: order_update, payment, delivery, system, payout
 * Notification channels: push, email, sms
 */

import db from '../config/knex.js';
import { AppError, NotFoundError } from '../shared/errors.js';

// ── Notification templates ────────────────────────────────

const TEMPLATES = {
  // Order notifications
  ORDER_PLACED: {
    type: 'order_update',
    channel: 'push',
    subject: 'Order Placed',
    body: 'Your order {orderRef} has been placed successfully.',
  },
  ORDER_PAID: {
    type: 'order_update',
    channel: 'push',
    subject: 'Payment Confirmed',
    body: 'Payment for order {orderRef} has been confirmed.',
  },
  ORDER_PREPARING: {
    type: 'order_update',
    channel: 'push',
    subject: 'Order Being Prepared',
    body: 'Your order {orderRef} is now being prepared.',
  },
  ORDER_READY: {
    type: 'order_update',
    channel: 'push',
    subject: 'Order Ready for Pickup',
    body: 'Your order {orderRef} is ready for driver pickup.',
  },

  // Delivery notifications
  DRIVER_ASSIGNED: {
    type: 'delivery',
    channel: 'push',
    subject: 'Driver Assigned',
    body: 'A driver has been assigned to your order {orderRef}.',
  },
  DRIVER_EN_ROUTE: {
    type: 'delivery',
    channel: 'push',
    subject: 'Driver En Route',
    body: 'Your driver is on the way to pick up your order {orderRef}.',
  },
  ORDER_PICKED_UP: {
    type: 'delivery',
    channel: 'push',
    subject: 'Order Picked Up',
    body: 'Your order {orderRef} has been picked up and is on its way to you!',
  },
  ORDER_OUT_FOR_DELIVERY: {
    type: 'delivery',
    channel: 'push',
    subject: 'Out for Delivery',
    body: 'Your order {orderRef} is almost there! Track it in real-time.',
  },
  ORDER_DELIVERED: {
    type: 'delivery',
    channel: 'push',
    subject: 'Order Delivered',
    body: 'Your order {orderRef} has been delivered. Enjoy!',
  },
  OTP_GENERATED: {
    type: 'delivery',
    channel: 'push',
    subject: 'Delivery Verification',
    body: 'Your driver has arrived. Please verify with the OTP code.',
  },

  // Payment notifications
  PAYMENT_SUCCESS: {
    type: 'payment',
    channel: 'push',
    subject: 'Payment Successful',
    body: 'Your payment of SZL {amount} for order {orderRef} was successful.',
  },
  PAYMENT_FAILED: {
    type: 'payment',
    channel: 'push',
    subject: 'Payment Failed',
    body: 'Your payment for order {orderRef} failed. Please try again.',
  },
  REFUND_PROCESSED: {
    type: 'payment',
    channel: 'push',
    subject: 'Refund Processed',
    body: 'A refund of SZL {amount} has been processed for order {orderRef}.',
  },

  // Payout notifications
  PAYOUT_APPROVED: {
    type: 'payout',
    channel: 'push',
    subject: 'Payout Approved',
    body: 'Your payout of SZL {amount} has been approved and is being processed.',
  },
  PAYOUT_COMPLETED: {
    type: 'payout',
    channel: 'push',
    subject: 'Payout Completed',
    body: 'Your payout of SZL {amount} has been disbursed.',
  },
  PAYOUT_REJECTED: {
    type: 'payout',
    channel: 'push',
    subject: 'Payout Rejected',
    body: 'Your payout request has been rejected. Reason: {reason}',
  },

  // System notifications
  WELCOME: {
    type: 'system',
    channel: 'push',
    subject: 'Welcome to SmartCart!',
    body: 'Welcome to SmartCart, {name}! Start exploring our marketplace.',
  },
};

// ── Public API ─────────────────────────────────────────────

/**
 * Create a notification for a user.
 *
 * @param {object} params
 * @param {string} params.profileId   – recipient UUID
 * @param {string} params.type        – order_update, payment, delivery, system, payout
 * @param {string} params.channel     – push, email, sms
 * @param {string} params.subject
 * @param {string} params.body
 * @param {object} [params.metadata]  – arbitrary JSON (orderRef, amount, etc.)
 * @param {object} [params.io]        – Socket.IO instance for real-time push
 * @returns {Promise<object>}
 */
export async function createNotification({ profileId, type, channel, subject, body, metadata, io }) {
  const [notificationId] = await db('notifications').insert({
    profile_id: profileId,
    type: type || 'system',
    channel: channel || 'push',
    subject,
    body,
    status: 'PENDING',
    metadata: metadata ? JSON.stringify(metadata) : null,
  }).returning('id');

  const notification = await db('notifications').where({ id: notificationId }).first();

  // Simulate sending (in production, this would call FCM, SendGrid, Twilio, etc.)
  await _simulateSend(notification);

  // Push real-time via Socket.IO if available
  if (io) {
    io.to(`user_${profileId}`).emit('notification', {
      id: notification.id,
      type: notification.type,
      channel: notification.channel,
      subject: notification.subject,
      body: notification.body,
      metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
      created_at: notification.created_at,
    });
  }

  return notification;
}

/**
 * Create a notification from a template, filling in variables.
 *
 * @param {object} params
 * @param {string} params.templateKey  – key in TEMPLATES
 * @param {string} params.profileId    – recipient UUID
 * @param {object} params.vars         – template variables { orderRef, amount, etc. }
 * @param {object} [params.io]         – Socket.IO instance
 * @returns {Promise<object>}
 */
export async function createFromTemplate({ templateKey, profileId, vars = {}, io }) {
  const template = TEMPLATES[templateKey];
  if (!template) {
    throw new AppError(`Unknown notification template: ${templateKey}`, 400);
  }

  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '');
  }

  return createNotification({
    profileId,
    type: template.type,
    channel: template.channel,
    subject: template.subject,
    body,
    metadata: vars,
    io,
  });
}

/**
 * Batch create notifications for multiple users.
 *
 * @param {object} params
 * @param {string[]} params.profileIds
 * @param {string} params.templateKey
 * @param {object} [params.vars]
 * @param {object} [params.io]
 * @returns {Promise<object[]>}
 */
export async function createBatch({ profileIds, templateKey, vars = {}, io }) {
  const results = [];
  for (const profileId of profileIds) {
    try {
      const notification = await createFromTemplate({ templateKey, profileId, vars, io });
      results.push(notification);
    } catch {
      // Don't fail entire batch if one notification fails
      console.warn(`Failed to create notification for ${profileId}`);
    }
  }
  return results;
}

/**
 * List notifications for a user.
 *
 * @param {string} profileId
 * @param {object} [opts]
 * @param {string} [opts.type]      – filter by type
 * @param {string} [opts.channel]   – filter by channel
 * @param {string} [opts.status]    – filter by status
 * @param {boolean} [opts.unreadOnly] – only unread
 * @param {number} [opts.page]
 * @param {number} [opts.limit]
 * @returns {Promise<object>}
 */
export async function listNotifications(profileId, { type, channel, status, unreadOnly, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const query = db('notifications')
    .where({ profile_id: profileId });

  if (type) query.where('type', type);
  if (channel) query.where('channel', channel);
  if (status) query.where('status', status);
  if (unreadOnly) query.whereNull('read_at');

  const [{ count: total }] = await query.clone().count('id as count');

  const notifications = await query
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return {
    notifications,
    total: parseInt(total, 10),
    page,
    limit,
  };
}

/**
 * Get unread count for a user.
 */
export async function getUnreadCount(profileId) {
  const [{ count }] = await db('notifications')
    .where({ profile_id: profileId })
    .whereNull('read_at')
    .count('id as count');

  return parseInt(count, 10);
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId, profileId) {
  const notification = await db('notifications').where({ id: notificationId }).first();
  if (!notification) throw new NotFoundError('Notification');
  if (notification.profile_id !== profileId) {
    throw new AppError('Access denied.', 403);
  }

  await db('notifications').where({ id: notificationId }).update({
    read_at: new Date(),
  });

  return await db('notifications').where({ id: notificationId }).first();
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(profileId) {
  const updated = await db('notifications')
    .where({ profile_id: profileId })
    .whereNull('read_at')
    .update({ read_at: new Date() });

  return { marked: updated };
}

/**
 * Delete a notification.
 */
export async function deleteNotification(notificationId, profileId) {
  const notification = await db('notifications').where({ id: notificationId }).first();
  if (!notification) throw new NotFoundError('Notification');
  if (notification.profile_id !== profileId) {
    throw new AppError('Access denied.', 403);
  }

  await db('notifications').where({ id: notificationId }).delete();
  return { deleted: true };
}

// ── Convenience functions for common notification flows ────

/**
 * Notify about an order status change.
 * Sends to the customer and relevant merchants.
 */
export async function notifyOrderStatusChange(order, toStatus, io) {
  const statusTemplateMap = {
    PAID: 'ORDER_PAID',
    MERCHANT_ACCEPTED: 'ORDER_PREPARING',
    PREPARING: 'ORDER_PREPARING',
    READY_FOR_PICKUP: 'ORDER_READY',
    DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
    PICKED_UP: 'ORDER_PICKED_UP',
    OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
    DELIVERED: 'ORDER_DELIVERED',
  };

  const templateKey = statusTemplateMap[toStatus];
  if (!templateKey) return; // No notification for this status

  const vars = { orderRef: order.main_ref, orderId: String(order.id) };
  return createFromTemplate({ templateKey, profileId: order.customer_id, vars, io });
}

/**
 * Notify about a payment result.
 */
export async function notifyPaymentResult(payment, order, io) {
  const templateKey = payment.status === 'PAID' ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED';
  return createFromTemplate({
    templateKey,
    profileId: payment.payer_id,
    vars: {
      amount: String(payment.amount),
      orderRef: order?.main_ref || String(payment.order_id),
    },
    io,
  });
}

/**
 * Notify about a payout result.
 */
export async function notifyPayoutResult(payout, io) {
  const statusMap = {
    APPROVED: 'PAYOUT_APPROVED',
    COMPLETED: 'PAYOUT_COMPLETED',
    REJECTED: 'PAYOUT_REJECTED',
  };

  const templateKey = statusMap[payout.status];
  if (!templateKey) return;

  return createFromTemplate({
    templateKey,
    profileId: payout.profile_id,
    vars: {
      amount: String(payout.amount),
      reason: payout.status === 'REJECTED' ? 'Please check payout details' : '',
    },
    io,
  });
}

/**
 * Notify about OTP generation for delivery.
 */
export async function notifyOTPGenerated(order, io) {
  return createFromTemplate({
    templateKey: 'OTP_GENERATED',
    profileId: order.customer_id,
    vars: { orderRef: order.main_ref },
    io,
  });
}

// ── Internal helpers ───────────────────────────────────────

/**
 * Simulate sending a notification.
 * In production, this would dispatch to FCM, SendGrid, Twilio, etc.
 */
async function _simulateSend(notification) {
  // Simulate a small delay for "sending"
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Mark as sent (in production, this would be async with retry)
  await db('notifications').where({ id: notification.id }).update({
    status: 'SENT',
    updated_at: new Date(),
  });
}
