import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/v1/notifications/unread-count — badge count (must be before /:id)
router.get('/unread-count', getUnreadCount);

// PATCH /api/v1/notifications/read-all — mark all as read (must be before /:id)
router.patch('/read-all', markAllAsRead);

// GET /api/v1/notifications — list notifications with filters
router.get('/', listNotifications);

// PATCH /api/v1/notifications/:id/read — mark single as read
router.patch('/:id/read', markAsRead);

// DELETE /api/v1/notifications/:id — delete a notification
router.delete('/:id', deleteNotification);

export default router;
