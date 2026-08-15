import { Router } from 'express';
import {
  listSettings,
  getSetting,
  updateSetting,
} from './admin.settings.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, settingsSchemas } from '../../middleware/validate.js';

const router = Router();

// All settings routes require admin settings permission
router.use(authenticate);
router.use(requirePermission('admin.settings.update'));

// GET /api/v1/admin/settings — list all
router.get('/', listSettings);

// GET /api/v1/admin/settings/:key — get by key
router.get('/:key', getSetting);

// PATCH /api/v1/admin/settings/:key — update
router.patch('/:key', validate(settingsSchemas.update), updateSetting);

export default router;
