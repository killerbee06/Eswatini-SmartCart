/**
 * Notifications Controller
 *
 * REST endpoints for notification operations:
 *  - GET    /              – list my notifications (with filters)
 *  - GET    /unread-count  – get unread count for badge
 *  - PATCH  /:id/read      – mark single notification as read
 *  - PATCH  /read-all      – mark all as read
 *  - DELETE /:id           – delete a notification
 */

import * as notificationService from '../../services/notification.service.js';
import { success, paginate } from '../../shared/utils.js';

/**
 * GET /api/v1/notifications
 * List notifications for the current user.
 */
export async function listNotifications(req, res, next) {
  try {
    const { type, channel, status, unread_only } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await notificationService.listNotifications(req.user.id, {
      type,
      channel,
      status,
      unreadOnly: unread_only === 'true',
      page,
      limit,
    });

    return paginate(res, {
      data: result.notifications,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/notifications/unread-count
 * Get the count of unread notifications (for badge display).
 */
export async function getUnreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return success(res, { count });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read.
 */
export async function markAsRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user.id
    );
    return success(res, notification, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read for the current user.
 */
export async function markAllAsRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    return success(res, result, `${result.marked} notification(s) marked as read`);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification.
 */
export async function deleteNotification(req, res, next) {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    return success(res, null, 'Notification deleted');
  } catch (err) {
    next(err);
  }
}
