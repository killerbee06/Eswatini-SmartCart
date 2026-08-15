import { Router } from 'express';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from './categories.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate, categorySchemas } from '../../middleware/validate.js';

const router = Router();

// GET /api/v1/categories — public: list all categories
router.get('/', listCategories);

// GET /api/v1/categories/:id — public: get category with children
router.get('/:id', getCategory);

// POST /api/v1/categories — admin: create category
router.post(
  '/',
  authenticate,
  requirePermission('admin.settings.update'),
  validate(categorySchemas.create),
  createCategory
);

// PATCH /api/v1/categories/:id — admin: update category
router.patch(
  '/:id',
  authenticate,
  requirePermission('admin.settings.update'),
  validate(categorySchemas.update),
  updateCategory
);

// DELETE /api/v1/categories/:id — admin: delete category
router.delete(
  '/:id',
  authenticate,
  requirePermission('admin.settings.update'),
  deleteCategory
);

export default router;
